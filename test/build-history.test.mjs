import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.fetch = async () => { throw new Error('sem rede nos testes'); };
const { build } = await import('../scraper/scrape.mjs');
const { recordPrice, addDays } = await import('../scraper/history.mjs');

const NOW = '2026-11-27T12:00:00.000Z';
const K = 'cpu|amd|5700x';
const deal = (id, price) => ({
  id, store: 'kabum', title: `Processador AMD Ryzen 7 5700X AM4 ${id}`, brand: 'AMD', category: 'cpu',
  specs: { modelo: '5700X' }, price, oldPrice: 1300, discount: Math.round((1 - price / 1300) * 100), url: 'x', source: 'KaBuM!',
});
const hist = () => {
  const h = {};
  for (let i = 1; i <= 10; i++) recordPrice(h, { key: K, title: 't', category: 'cpu', store: 'kabum', price: 1000, coupon: false }, addDays('2026-11-27', -i));
  return h;
};

test('build com histórico tira a oferta inflada (e não manda para o radar)', () => {
  const { payload } = build({ deals: [] }, { kabum: { ok: true, deals: [deal('kb-1', 600), deal('kb-2', 450)] } }, NOW, { hist: hist(), ext: {} });
  assert.deepEqual(payload.deals.map((d) => d.id), ['kb-2']);
  assert.equal(payload.radar.find((d) => d.id === 'kb-1'), undefined);
  assert.equal(payload.deals[0].hist.median30, 1000);
  assert.equal(payload.removedInflated, 1);
  assert.deepEqual(payload.sources.historico, { ok: true, count: 1 });
});

test('build sem histórico mantém o comportamento de hoje', () => {
  const { payload } = build({ deals: [] }, { kabum: { ok: true, deals: [deal('kb-1', 600), deal('kb-2', 450)] } }, NOW);
  assert.equal(payload.deals.length, 2);
  assert.equal(payload.removedInflated, undefined);
});
