import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITES, enrichExternal, searchTerm } from '../scraper/external.mjs';
import { recordPrice, addDays } from '../scraper/history.mjs';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const SEARCH = fx('zoom-search.html');
const PRODUCT = fx('zoom-product.html');
const NOW = '2026-11-27T12:00:00.000Z';
const cpu = (title = 'Processador AMD Ryzen 7 5700X AM4') => ({ title, category: 'cpu', brand: 'AMD', specs: { modelo: '5700X' }, price: 450, discount: 60 });
const gpuDeal = { title: 'Placa de Vídeo ASUS Dual RTX 4060 8GB', category: 'gpu', brand: 'ASUS', specs: { chip: 'RTX 4060', vram: 8 }, price: 900, discount: 55 };
const fakeSite = (routes) => {
  const calls = [];
  const fetchHtml = async (url) => {
    calls.push(url);
    for (const [re, body] of routes) if (re.test(url)) return typeof body === 'function' ? body(url) : body;
    throw new Error('HTTP 404');
  };
  return { calls, fetchHtml };
};
const opts = (o) => ({ hist: {}, ext: {}, now: NOW, pause: [0, 0], log: () => {}, ...o });
const nextData = (o) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(o)}</script>`;

test('parse da busca e do produto do Zoom', () => {
  const hits = SITES.zoom.search(SEARCH);
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => !h.url.startsWith('/lead')));
  const days = SITES.zoom.history(PRODUCT);
  assert.ok(Object.keys(days).length >= 7);
  assert.equal(days['2026-10-19'], 1199.99);
});

test('termo de busca sai da chave do modelo', () => {
  assert.equal(searchTerm(cpu()), 'amd 5700x');
});

test('busca o histórico do mesmo modelo e guarda no cache', async () => {
  const s = fakeSite([[/search/, SEARCH], [/processador\//, PRODUCT]]);
  const ext = {};
  const r = await enrichExternal([cpu()], opts({ ext, fetchHtml: s.fetchHtml }));
  assert.equal(r.hits, 1);
  const e = ext['cpu|amd|5700x'];
  assert.equal(e.source, 'zoom');
  assert.equal(e.at, NOW);
  assert.ok(Object.keys(e.days).length >= 7);
});

test('produto parecido mas diferente (4060 Ti para 4060) é descartado', async () => {
  const search = nextData({ props: { initialReduxState: { hits: { hits: [{ name: 'Placa de Vídeo ASUS Dual RTX 4060 Ti 8GB', url: '/placa-de-video/asus-dual-rtx-4060-ti' }] } } } });
  const s = fakeSite([[/search/, search], [/placa-de-video\//, PRODUCT]]);
  const ext = {};
  await enrichExternal([gpuDeal], opts({ ext, fetchHtml: s.fetchHtml }));
  assert.deepEqual(ext['gpu|asus|dual|rtx 4060|8gb'].days, {});
  assert.equal(s.calls.filter((u) => /placa-de-video\//.test(u)).length, 0);
});

test('no máximo 40 consultas por coleta', async () => {
  const deals = Array.from({ length: 50 }, (_, i) => cpu(`Processador AMD Ryzen 7 ${5000 + i}X AM4`)).map((d, i) => ({ ...d, specs: { modelo: `${5000 + i}X` } }));
  const s = fakeSite([[/search/, nextData({ props: { initialReduxState: { hits: { hits: [] } } } })]]);
  const r = await enrichExternal(deals, opts({ fetchHtml: s.fetchHtml }));
  assert.equal(r.looked, 40);
  assert.equal(s.calls.length, 40);
});

test('cache de 2 h não consulta; de 25 h consulta', async () => {
  const key = 'cpu|amd|5700x';
  const hoursAgo = (h) => new Date(Date.parse(NOW) - h * 3600e3).toISOString();
  const s1 = fakeSite([[/search/, SEARCH], [/processador\//, PRODUCT]]);
  await enrichExternal([cpu()], opts({ ext: { [key]: { at: hoursAgo(2), source: 'zoom', days: {} } }, fetchHtml: s1.fetchHtml }));
  assert.equal(s1.calls.length, 0);
  const s2 = fakeSite([[/search/, SEARCH], [/processador\//, PRODUCT]]);
  await enrichExternal([cpu()], opts({ ext: { [key]: { at: hoursAgo(25), source: 'zoom', days: {} } }, fetchHtml: s2.fetchHtml }));
  assert.ok(s2.calls.length > 0);
});

test('modelo com histórico cheio não é consultado', async () => {
  const hist = {};
  for (let i = 0; i < 25; i++) recordPrice(hist, { key: 'cpu|amd|5700x', title: 't', category: 'cpu', store: 'kabum', price: 1000, coupon: false }, addDays('2026-11-27', -i));
  const s = fakeSite([[/search/, SEARCH]]);
  await enrichExternal([cpu()], opts({ hist, fetchHtml: s.fetchHtml }));
  assert.equal(s.calls.length, 0);
});

test('Zoom bloqueado: não insiste nele e segue no Buscapé', async () => {
  const s = fakeSite([
    [/zoom\.com\.br/, '<html><title>Just a moment...</title>cf-chl</html>'],
    [/buscape\.com\.br\/search/, SEARCH],
    [/buscape\.com\.br\/processador\//, PRODUCT],
  ]);
  const deals = [cpu(), { ...cpu('Processador AMD Ryzen 5 5600 AM4'), specs: { modelo: '5600' } }];
  const ext = {};
  await enrichExternal(deals, opts({ ext, fetchHtml: s.fetchHtml }));
  assert.equal(s.calls.filter((u) => /zoom/.test(u)).length, 1);
  assert.equal(ext['cpu|amd|5700x'].source, 'buscape');
});
