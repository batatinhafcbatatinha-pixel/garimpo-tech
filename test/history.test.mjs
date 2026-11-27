import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordPrice, prune, isFull, reference, verify, loadJson, saveJson, dayOf, addDays } from '../scraper/history.mjs';

const K = 'cpu|amd|5700x';
const TODAY = '2026-11-27';
const it = (price, extra = {}) => ({ key: K, title: 'Ryzen 7 5700X', category: 'cpu', store: 'kabum', price, coupon: false, ...extra });
// n dias seguidos terminando em `last`, todos com o mesmo preço
function fill(hist, n, last, price, store = 'kabum') {
  for (let i = 0; i < n; i++) recordPrice(hist, it(price, { store }), addDays(last, -i));
}

test('recordPrice guarda o menor preço do dia, prateleira e cupom separados', () => {
  const h = {};
  recordPrice(h, it(900), TODAY);
  recordPrice(h, it(850), TODAY);
  recordPrice(h, it(700, { coupon: true }), TODAY);
  assert.equal(h[K].days[TODAY].kabum.shelf, 850);
  assert.equal(h[K].days[TODAY].kabum.coupon, 700);
});

test('prune apaga o que passou de 90 dias', () => {
  const h = {};
  recordPrice(h, it(900), addDays(TODAY, -91));
  recordPrice(h, it(900), addDays(TODAY, -90));
  prune(h, TODAY);
  assert.deepEqual(Object.keys(h[K].days), [addDays(TODAY, -90)]);
});

test('histórico cheio = 20 dias com preço de prateleira nos últimos 30', () => {
  const h20 = {}; fill(h20, 20, TODAY, 1000);
  const h19 = {}; fill(h19, 19, TODAY, 1000);
  const hc = {};
  for (let i = 0; i < 20; i++) recordPrice(hc, it(700, { coupon: true }), addDays(TODAY, -i));
  assert.equal(isFull(h20, K, TODAY), true);
  assert.equal(isFull(h19, K, TODAY), false);
  assert.equal(isFull(hc, K, TODAY), false);
});

test('referência usa só os 30 dias antes da oferta aparecer', () => {
  const h = {};
  const first = '2026-11-20T15:00:00.000Z';
  fill(h, 10, '2026-11-19', 1000);
  fill(h, 5, '2026-11-24', 400); // durante a promoção
  const r = reference(h, {}, K, first);
  assert.equal(r.median, 1000);
  assert.equal(r.source, 'nosso');
});

test('menos de 7 dias de dados → sem referência; externo completa', () => {
  const h = {}; fill(h, 6, '2026-11-26', 1000);
  assert.equal(reference(h, {}, K, `${TODAY}T10:00:00Z`), null);
  const h4 = {}; fill(h4, 4, '2026-11-26', 1000);
  const ext = { [K]: { at: `${TODAY}T00:00:00Z`, source: 'zoom', days: { '2026-11-10': 990, '2026-11-11': 980, '2026-11-12': 970 } } };
  const r = reference(h4, ext, K, `${TODAY}T10:00:00Z`);
  assert.ok(r);
  assert.equal(r.source, 'nosso+zoom');
  assert.equal(r.days, 7);
});

test('histórico cheio ignora o externo', () => {
  const h = {}; fill(h, 25, '2026-11-26', 1000);
  const ext = { [K]: { source: 'zoom', days: { '2026-11-01': 100 } } };
  const r = reference(h, ext, K, `${TODAY}T10:00:00Z`);
  assert.equal(r.source, 'nosso');
  assert.equal(r.median, 1000);
});

test('verify tira a oferta inflada e marca a boa', () => {
  const h = {}; fill(h, 10, '2026-11-26', 1000);
  const deal = (id, price) => ({ id, title: 'Processador AMD Ryzen 7 5700X', category: 'cpu', brand: 'AMD', specs: { modelo: '5700X' }, price, oldPrice: 1300, discount: 54, firstSeen: `${TODAY}T10:00:00Z` });
  const bad = verify([deal('a', 600)], h, {}, 50);
  assert.equal(bad.removed, 1);
  assert.equal(bad.kept.length, 0);
  const good = verify([deal('b', 450)], h, {}, 50);
  assert.equal(good.removed, 0);
  assert.equal(good.kept[0].hist.median30, 1000);
  assert.equal(good.kept[0].hist.min30, 1000);
});

test('loadJson com arquivo quebrado ou ausente devolve o padrão; saveJson grava', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'garimpo-'));
  writeFileSync(join(dir, 'h.json'), '{quebrado');
  assert.deepEqual(await loadJson(join(dir, 'h.json'), {}), {});
  assert.deepEqual(await loadJson(join(dir, 'nada.json'), { a: 1 }), { a: 1 });
  await saveJson(join(dir, 'ok.json'), { x: 2 });
  assert.deepEqual(await loadJson(join(dir, 'ok.json'), {}), { x: 2 });
});

test('dayOf converte ISO em dia', () => assert.equal(dayOf('2026-11-27T23:00:00.000Z'), '2026-11-27'));

test('histórico com formato errado não derruba nada', () => {
  const h = { a: {}, b: { days: null } };
  assert.doesNotThrow(() => prune(h, TODAY));
  assert.equal(isFull({ x: {} }, 'x', TODAY), false);
  assert.equal(reference({ [K]: {} }, {}, K, `${TODAY}T10:00:00Z`), null);
  assert.doesNotThrow(() => recordPrice({ [K]: { title: 't' } }, it(900), TODAY));
});
