import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
globalThis.fetch = async () => { throw new Error('sem rede nos testes'); };
const { createLive, nextDelay } = await import('../scraper/live.mjs');
const { entitiesToText } = await import('../scraper/tg-account.mjs');
const { parseTelegramPost } = await import('../scraper/scrape.mjs');

const NOW = new Date();
const page = readFileSync(new URL('./fixtures/tme-page.html', import.meta.url), 'utf8');
const dir = () => mkdtempSync(join(tmpdir(), 'garimpo-live-'));
const read = (d) => JSON.parse(readFileSync(join(d, 'deals.json'), 'utf8'));
const noAccount = { available: async () => false, hasSession: async () => false };
const mk = (d, o = {}) => createLive({ localDir: d, channels: ['pcdofafapromo'], getTopic: () => '', onChange: () => {}, log: () => {}, now: () => NOW, account: noAccount, ...o });
const post = (postId, text) => ({ channel: 'canalteste', postId, postedAt: NOW.toISOString(), image: null, text });
const PRODUTO = 'Processador AMD Ryzen 7 5700X AM4 Box\n\nValor: R$845,00\n\nCupom: LIVE5700\n\n https://meli.la/abc123 ';

test('nextDelay: volta normal 45–90 s, falhas dobram até 15 min, 5 falhas pausam 30 min', () => {
  for (let i = 0; i < 20; i++) {
    const v = nextDelay(0);
    assert.ok(v >= 45000 && v <= 90000);
  }
  assert.equal(nextDelay(1), 60000);
  assert.equal(nextDelay(4), 480000);
  assert.equal(nextDelay(5), 30 * 60000);
});

test('poller: 1ª leitura só marca onde parou; depois processa só posts novos', async () => {
  const d = dir();
  let html = page;
  const live = mk(d, { fetchText: async () => html });
  await live.pollOnce();
  assert.throws(() => read(d)); // nada gravado: o passado é da coleta completa
  // chega um post novo (cupom de loja); os antigos continuam fora
  html = page.replace('data-post="pcdofafapromo/73603"', 'data-post="pcdofafapromo/73700"');
  await live.pollOnce();
  const r = read(d);
  assert.deepEqual(r.coupons.map((c) => c.code), ['MELI250']);
  assert.equal([...r.deals, ...r.radar].length, 0);
});

test('post de produto entra na hora; "Esgotou CÓDIGO" tira a oferta', async () => {
  const d = dir();
  const live = mk(d);
  await live.handlePosts([post(1, PRODUTO)]);
  const a = read(d);
  assert.ok([...a.deals, ...a.radar].some((x) => x.id === 'tg-canalteste-1'));
  await live.handlePosts([post(2, 'Esgotou LIVE5700')]);
  const b = read(d);
  assert.ok(![...b.deals, ...b.radar].some((x) => x.id === 'tg-canalteste-1'));
});

test('depois da coleta completa, o que o live trouxe volta (e o esgotado continua fora)', async () => {
  const d = dir();
  const live = mk(d);
  const since = new Date(Date.now() - 1000).toISOString();
  await live.handlePosts([post(10, PRODUTO.replace('LIVE5700', 'OUTRO123'))]);
  await live.handlePosts([post(11, PRODUTO.replace('5700X', '5600X').replace('LIVE5700', 'ACABA999'))]);
  const gone = read(d).radar.find((x) => x.id === 'tg-canalteste-11');
  await live.handlePosts([post(12, 'Esgotou ACABA999')]);
  // a coleta (outro processo) grava um deals.json que não tem o post 10 e ainda tem o 11
  writeFileSync(join(d, 'deals.json'), JSON.stringify({ updatedAt: NOW.toISOString(), deals: [], radar: [gone], coupons: [] }));
  await live.reapplyAfterCollect(since);
  const r = read(d);
  assert.ok(r.radar.some((x) => x.id === 'tg-canalteste-10'));
  assert.ok(!r.radar.some((x) => x.id === 'tg-canalteste-11'));
});

test('entitiesToText põe a URL dos links escondidos no texto', () => {
  const msg = { message: 'Monitor LG 27GR75Q R$ 899 Comprar', entities: [{ className: 'MessageEntityTextUrl', offset: 26, length: 7, url: 'https://meli.la/abc' }] };
  const t = entitiesToText(msg);
  assert.match(t, /Comprar https:\/\/meli\.la\/abc/);
  const d = parseTelegramPost(t, { channel: 'x', postId: 1, postedAt: NOW.toISOString() });
  assert.equal(d?.url, 'https://meli.la/abc');
});

test('sem gramjs: fica no t.me/s e o login explica o motivo', async () => {
  const live = mk(dir(), { fetchText: async () => page });
  await live.start();
  assert.equal(live.status().mode, 'tme');
  assert.equal(live.status().gramjs, false);
  await assert.rejects(live.login({ apiId: 1, apiHash: 'x', phone: '+55' }));
  assert.match(live.status().error, /npm install/);
  live.stop();
});
