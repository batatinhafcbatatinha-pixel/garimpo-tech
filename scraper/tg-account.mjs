// Conta do Telegram do próprio usuário (opcional), via gramjs. Único arquivo que carrega a biblioteca:
// sem `npm install`, o resto do Garimpo funciona e o live usa só a prévia pública t.me/s.
//
// A sessão (data/local/telegram-session.txt) dá acesso total à conta: nunca sai do PC e nunca vai para log.
// O Garimpo só LÊ os canais. Entrar em canal (join) acontece apenas quando o usuário clica em "Seguir".

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

let lib = null;
async function loadLib() {
  if (lib) return lib;
  try {
    const t = await import('telegram');
    const { StringSession } = await import('telegram/sessions/index.js');
    const { NewMessage } = await import('telegram/events/index.js');
    const { EditedMessage } = await import('telegram/events/EditedMessage.js');
    lib = { ...t, StringSession, NewMessage, EditedMessage };
  } catch {
    lib = null;
  }
  return lib;
}

// Texto do post no mesmo formato que a prévia t.me/s produz: links escondidos atrás de uma palavra
// ("Comprar") viram a URL solta logo depois da palavra.
export function entitiesToText(message) {
  let text = message?.message || '';
  const links = (message?.entities || [])
    .filter((e) => e?.className === 'MessageEntityTextUrl' && e.url)
    .sort((a, b) => b.offset - a.offset);
  for (const e of links) {
    const end = e.offset + e.length;
    text = `${text.slice(0, end)} ${e.url} ${text.slice(end)}`;
  }
  return text;
}

const DEAD_SESSION = /AUTH_KEY_UNREGISTERED|SESSION_REVOKED|AUTH_KEY_DUPLICATED|USER_DEACTIVATED/;

export function createAccount({ localDir, log = () => {} }) {
  const CREDS = join(localDir, 'telegram.json');
  const SESSION = join(localDir, 'telegram-session.txt');
  let client = null;
  let pending = null; // login em andamento: { apiId, apiHash, phone, phoneCodeHash }

  const readCreds = async () => JSON.parse(await readFile(CREDS, 'utf8'));
  const saveSession = async () => {
    await mkdir(localDir, { recursive: true });
    await writeFile(SESSION, client.session.save());
  };
  async function newClient(apiId, apiHash, session = '') {
    const L = await loadLib();
    if (!L) throw new Error('gramjs não instalado: rode "npm install" na pasta do Garimpo');
    const c = new L.TelegramClient(new L.StringSession(session), +apiId, apiHash, {
      connectionRetries: 5,
      floodSleepThreshold: 300, // FLOOD_WAIT de até 5 min: espera sozinho
      deviceModel: 'Garimpo',
      appVersion: '1.0',
    });
    c.setLogLevel?.('error');
    await c.connect();
    return c;
  }

  return {
    available: async () => !!(await loadLib()),
    async hasSession() {
      try {
        return !!(await readFile(SESSION, 'utf8')).trim();
      } catch {
        return false;
      }
    },

    async startLogin({ apiId, apiHash, phone }) {
      if (!+apiId || !apiHash || !phone) throw new Error('preencha api_id, api_hash e telefone');
      client = await newClient(apiId, apiHash);
      const { phoneCodeHash } = await client.sendCode({ apiId: +apiId, apiHash }, phone);
      pending = { apiId: +apiId, apiHash, phone, phoneCodeHash };
      return { step: 'code' };
    },
    async submitCode(code) {
      if (!pending) throw new Error('comece pelo telefone');
      const L = await loadLib();
      try {
        await client.invoke(new L.Api.auth.SignIn({ phoneNumber: pending.phone, phoneCodeHash: pending.phoneCodeHash, phoneCode: String(code).trim() }));
      } catch (e) {
        if (/SESSION_PASSWORD_NEEDED/.test(e.message)) return { step: 'password' };
        throw e;
      }
      return this.finishLogin();
    },
    async submitPassword(password) {
      if (!pending) throw new Error('comece pelo telefone');
      await client.signInWithPassword(
        { apiId: pending.apiId, apiHash: pending.apiHash },
        { password: async () => password, onError: (e) => { throw e; } }
      );
      return this.finishLogin();
    },
    async finishLogin() {
      await mkdir(localDir, { recursive: true });
      await writeFile(CREDS, JSON.stringify({ apiId: pending.apiId, apiHash: pending.apiHash }));
      await saveSession();
      pending = null;
      return { step: 'done' };
    },

    // Liga na conta e chama onPost a cada post novo ou editado dos canais.
    // Devolve { user, joined } — joined: canais (em minúsculas) que a conta segue.
    async connect({ channels, onPost, onError }) {
      const { apiId, apiHash } = await readCreds();
      const session = (await readFile(SESSION, 'utf8')).trim();
      const L = await loadLib();
      try {
        client = await newClient(apiId, apiHash, session);
        const me = await client.getMe();
        const want = new Set(channels.map((c) => c.toLowerCase()));
        const joined = new Set();
        for (const d of await client.getDialogs({})) {
          const u = d.entity?.username?.toLowerCase();
          if (u && want.has(u) && d.isChannel) joined.add(u);
        }
        const handler = (edited) => async (ev) => {
          try {
            const m = ev.message;
            const chat = await m.getChat();
            const channel = chat?.username;
            if (!channel || !want.has(channel.toLowerCase())) return;
            onPost({ channel, postId: m.id, postedAt: new Date(m.date * 1000).toISOString(), image: null, text: entitiesToText(m), edited });
          } catch (e) {
            log('telegram: post ignorado', e.message);
          }
        };
        client.addEventHandler(handler(false), new L.NewMessage({}));
        client.addEventHandler(handler(true), new L.EditedMessage({}));
        client._garimpoErr = onError;
        const name = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || 'sua conta';
        return { user: name, joined };
      } catch (e) {
        if (DEAD_SESSION.test(e.message)) await rm(SESSION, { force: true });
        throw e;
      }
    },
    async join(channel) {
      const L = await loadLib();
      if (!client) throw new Error('não conectado');
      await client.invoke(new L.Api.channels.JoinChannel({ channel }));
    },
    async disconnect() {
      try {
        await client?.disconnect();
      } catch {}
      client = null;
    },
    async logout() {
      const L = await loadLib();
      try {
        if (client && L) await client.invoke(new L.Api.auth.LogOut());
      } catch {}
      await this.disconnect();
      await rm(SESSION, { force: true });
      await rm(CREDS, { force: true });
    },
  };
}
