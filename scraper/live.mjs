// Modo live (versão local): posts novos dos canais de Telegram entram na página em segundos.
// Roda dentro do servidor, separado da coleta completa.
//
//   Com conta (gramjs): o Telegram empurra os posts dos canais que a conta segue. Sem polling.
//   Sem conta, ou canais não seguidos: lê só a 1ª página de t.me/s/<canal>, um canal por vez,
//   com pausas sorteadas e espera crescente quando o Telegram reclama (para não ter o IP limitado).

import { join } from 'node:path';
import {
  parseTelegramPost, parseTmePage, build, notify, get, sleep,
  EXPIRED_IDS, EXPIRED_CODES, COUPONS, REFS, KEEP_HOURS,
} from './scrape.mjs';
import { loadJson, saveJson } from './history.mjs';
import { loadState, applyState, captureState } from './state.mjs';
import { createAccount } from './tg-account.mjs';

const MIN = 60000;
const rand = (a, b) => a + Math.random() * (b - a);

// Espera até a próxima leitura de um canal: 45–90 s normal; com falhas seguidas, 1, 2, 4, 8 min
// (até 15); na 5ª falha seguida o canal fica pausado 30 min.
export function nextDelay(failures) {
  if (!failures) return Math.round(rand(45000, 90000));
  if (failures >= 5) return 30 * MIN;
  return Math.min(2 ** (failures - 1) * MIN, 15 * MIN);
}

const MEM = { expiredIds: EXPIRED_IDS, expiredCodes: EXPIRED_CODES, refs: REFS };

export function createLive({
  localDir, channels, getTopic = () => '', onChange = () => {}, log = console.log,
  fetchText = (u) => get(u, { tries: 1 }), now = () => new Date(), account,
}) {
  const DATA = join(localDir, 'deals.json');
  const STATE = join(localDir, 'state.json');
  const HIST = join(localDir, 'history.json');
  const EXT = join(localDir, 'external-history.json');
  account ||= createAccount({ localDir, log });

  const st = {
    on: false, mode: 'tme', user: null, lastPostAt: null, error: null, gramjs: false, loginStep: null,
    joined: new Set(), lastId: {}, failures: {}, retryAt: {},
  };
  let journal = []; // o que o live mudou, para reaplicar depois de uma coleta completa
  let queue = Promise.resolve();
  let timer = null;
  let running = false;
  const serial = (fn) => (queue = queue.then(fn, fn));

  const status = () => ({
    on: st.on, mode: st.mode, user: st.user, lastPostAt: st.lastPostAt, error: st.error, gramjs: st.gramjs, loginStep: st.loginStep,
    channels: channels.map((name) => {
      const k = name.toLowerCase();
      const until = st.failures[k] >= 5 || (st.retryAt[k] && st.failures[k]) ? st.retryAt[k] : null;
      return { name, joined: st.joined.has(k), paused: st.failures[k] >= 5, until: until ? new Date(until).toISOString() : null };
    }),
  });

  // Junta posts no deals.json com as mesmas regras da coleta (build), grava e avisa.
  async function apply(deals, { quiet = false } = {}) {
    const t = now().toISOString();
    const prev = await loadJson(DATA, { deals: [] });
    const [hist, ext] = [await loadJson(HIST, null), await loadJson(EXT, {})];
    const { payload, prevById, prevCoupons } = build(prev, { live: { ok: true, deals } }, t, hist ? { hist, ext } : {});
    payload.sources = { ...(prev.sources || {}), ...payload.sources };
    delete payload.partial;
    await saveJson(DATA, payload);
    await saveJson(STATE, captureState(await loadState(STATE), MEM, t, KEEP_HOURS));
    COUPONS.clear(); // já estão no deals.json; o próximo build parte dele
    if (!quiet) {
      const newDeals = payload.deals.filter((d) => !prevById.has(d.id));
      const newRadar = payload.radar.filter((d) => !prevById.has(d.id));
      const newCoupons = payload.coupons.filter((c) => !prevCoupons.has(c.id));
      await notify(newDeals, newRadar, newCoupons, getTopic());
    }
  }

  function handlePosts(posts) {
    return serial(async () => {
      applyState(await loadState(STATE), MEM);
      const beforeIds = new Set(EXPIRED_IDS), beforeCodes = new Set(EXPIRED_CODES);
      const deals = [];
      for (const p of posts) {
        const d = parseTelegramPost(p.text, p);
        if (d) deals.push(d);
      }
      const expiredIds = [...EXPIRED_IDS].filter((x) => !beforeIds.has(x));
      const expiredCodes = [...EXPIRED_CODES].filter((x) => !beforeCodes.has(x));
      const coupons = [...COUPONS.values()];
      if (!deals.length && !expiredIds.length && !expiredCodes.length && !coupons.length) return;
      await apply(deals);
      journal.push({ at: now().toISOString(), deals, expiredIds, expiredCodes, coupons });
      st.lastPostAt = now().toISOString();
      log(`live: ${deals.length} ofertas, ${coupons.length} cupons, ${expiredIds.length + expiredCodes.length} esgotados`);
      onChange();
    });
  }

  // A coleta completa (outro processo) regrava o deals.json a partir do que leu no começo:
  // reaplica o que o live trouxe desde então.
  function reapplyAfterCollect(sinceIso) {
    return serial(async () => {
      journal = journal.filter((j) => j.at >= sinceIso);
      applyState(await loadState(STATE), MEM);
      for (const j of journal) {
        j.expiredIds.forEach((x) => EXPIRED_IDS.add(x));
        j.expiredCodes.forEach((x) => EXPIRED_CODES.add(x));
      }
      if (!journal.length) return;
      for (const j of journal) for (const c of j.coupons) COUPONS.set(c.id, c);
      await apply(journal.flatMap((j) => j.deals), { quiet: true });
      onChange();
    });
  }

  // ---------------------------------------------------------------- t.me/s
  async function pollOnce() {
    let first = true;
    for (const ch of channels) {
      const k = ch.toLowerCase();
      if (st.mode === 'account' && st.joined.has(k)) continue; // esse chega pela conta
      if (st.retryAt[k] && st.retryAt[k] > Date.now()) continue;
      if (!first) await sleep(Math.round(rand(2000, 5000)));
      first = false;
      try {
        const posts = parseTmePage(await fetchText(`https://t.me/s/${ch}`));
        st.failures[k] = 0;
        st.retryAt[k] = 0;
        const max = Math.max(0, ...posts.map((p) => p.postId));
        if (st.lastId[k] == null) {
          st.lastId[k] = max; // 1ª leitura: só marca onde parou; o passado é da coleta completa
          continue;
        }
        const fresh = posts.filter((p) => p.postId > st.lastId[k]);
        st.lastId[k] = Math.max(st.lastId[k], max);
        if (fresh.length) await handlePosts(fresh);
      } catch (e) {
        st.failures[k] = (st.failures[k] || 0) + 1;
        st.retryAt[k] = Date.now() + nextDelay(st.failures[k]);
        log(`live: t.me/s/${ch} falhou (${e.message}), tenta de novo em ${Math.round(nextDelay(st.failures[k]) / MIN)} min`);
        if (st.failures[k] >= 5) st.failures[k] = 5;
        onChange();
      }
    }
  }
  async function loop() {
    if (!st.on || running) return;
    running = true;
    try {
      await pollOnce();
    } finally {
      running = false;
    }
    if (st.on) timer = setTimeout(loop, nextDelay(0));
  }

  // ---------------------------------------------------------------- conta
  async function connectAccount() {
    try {
      const { user, joined } = await account.connect({
        channels,
        onPost: (p) => handlePosts([p]),
        onError: (e) => fallBack(e),
      });
      st.mode = 'account';
      st.user = user;
      st.joined = joined;
      st.error = null;
      log(`live: conectado ao Telegram como ${user} (${joined.size}/${channels.length} canais seguidos)`);
    } catch (e) {
      fallBack(e);
    }
  }
  function fallBack(e) {
    st.mode = 'tme';
    st.user = null;
    st.joined = new Set();
    st.error = `Conta do Telegram desconectada (${e.message}). Lendo pelo t.me/s.`;
    log(`live: ${st.error}`);
    onChange();
  }

  return {
    status,
    handlePosts: (p) => handlePosts(p),
    reapplyAfterCollect,
    pollOnce: () => pollOnce(),
    async start() {
      if (st.on) return;
      st.on = true;
      st.gramjs = await account.available();
      if (st.gramjs && (await account.hasSession())) await connectAccount();
      else if (!st.gramjs && (await account.hasSession?.())) st.error = 'Há uma sessão salva, mas o gramjs não está instalado: rode "npm install".';
      onChange();
      loop();
    },
    stop() {
      st.on = false;
      clearTimeout(timer);
      account.disconnect?.();
      st.mode = 'tme';
      st.user = null;
      st.joined = new Set();
      onChange();
    },
    async login({ apiId, apiHash, phone }) {
      st.gramjs = await account.available();
      if (!st.gramjs) {
        st.error = 'Para entrar com sua conta, rode "npm install" na pasta do Garimpo.';
        onChange();
        throw new Error(st.error);
      }
      const r = await account.startLogin({ apiId, apiHash, phone });
      st.loginStep = r.step;
      onChange();
      return r;
    },
    async code(code) {
      const r = await account.submitCode(code);
      return this._after(r);
    },
    async password(pw) {
      const r = await account.submitPassword(pw);
      return this._after(r);
    },
    async _after(r) {
      st.loginStep = r.step === 'done' ? null : r.step;
      if (r.step === 'done' && st.on) await connectAccount();
      onChange();
      return r;
    },
    async logout() {
      await account.logout();
      st.mode = 'tme';
      st.user = null;
      st.joined = new Set();
      st.error = null;
      onChange();
    },
    async join(channel) {
      if (!channels.some((c) => c.toLowerCase() === String(channel).toLowerCase())) throw new Error('canal fora da lista');
      await account.join(channel);
      st.joined.add(channel.toLowerCase());
      onChange();
    },
  };
}
