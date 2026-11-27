import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelKey, detectCategory, detectBrand, extractSpecs } from '../scraper/classify.mjs';

const item = (title) => {
  const category = detectCategory(title);
  const brand = detectBrand(category, title);
  return { title, category, brand, specs: extractSpecs(category, title) };
};
const key = (t) => modelKey(item(t));

test('mesmo processador em lojas diferentes tem a mesma chave', () => {
  const a = key('Processador AMD Ryzen 7 5700X AM4');
  assert.equal(a, key('Ryzen 7 5700X 3.4GHz Box'));
  assert.ok(a.startsWith('cpu|amd|5700x'));
});

test('RTX 4060 e RTX 4060 Ti têm chaves diferentes', () => {
  const a = key('Placa de Vídeo ASUS Dual RTX 4060 8GB');
  assert.ok(a);
  assert.notEqual(a, key('ASUS Dual RTX 4060 Ti 8GB'));
  assert.equal(a, 'gpu|asus|dual|rtx 4060|8gb');
});

test('SSD: código do modelo e capacidade', () => {
  const a = key('SSD WD Black SN770 1TB NVMe');
  assert.equal(a, key('SSD WD_BLACK SN770 1TB M.2 2280'));
  assert.equal(a, 'ssd|wd|sn770|1024');
});

test('mouse: código do modelo no título', () => {
  assert.match(key('Mouse Logitech G502 Hero'), /g502/);
});

test('sem código de modelo → null', () => {
  assert.equal(modelKey({ title: 'Teclado Gamer RGB ABNT2', category: 'teclado', brand: 'Logitech', specs: {} }), null);
  assert.equal(key('Teclado Mecânico Logitech G Pro X'), null);
});
