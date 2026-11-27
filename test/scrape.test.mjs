import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// importar o coletor não pode disparar a coleta
let fetched = 0;
globalThis.fetch = async () => { fetched++; throw new Error('sem rede nos testes'); };
const S = await import('../scraper/scrape.mjs');
const page = readFileSync(new URL('./fixtures/tme-page.html', import.meta.url), 'utf8');

test('importar scrape.mjs não roda a coleta', async () => {
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fetched, 0);
});

test('parseTmePage lê os posts da prévia pública', () => {
  const posts = S.parseTmePage(page);
  assert.equal(posts.length, 3);
  assert.ok(posts.every((p) => p.channel === 'pcdofafapromo' && typeof p.postId === 'number'));
  assert.match(posts[0].text, /R\$/);
  assert.equal(posts[0].postedAt, '2026-11-27T10:00:00.000Z');
  assert.match(posts[0].image, /img73601/);
});

test('post "Esgotou X" marca o código como expirado', () => {
  const posts = S.parseTmePage(page);
  const r = S.parseTelegramPost(posts[1].text, posts[1]);
  assert.equal(r, undefined);
  assert.ok(S.EXPIRED_CODES.has('ZB9MELI'));
});

test('histórico do GitHub vem do site publicado, ao lado do deals.json', () => {
  assert.equal(S.siblingUrl('https://x.github.io/garimpo-tech/data/deals.json', 'history.json'), 'https://x.github.io/garimpo-tech/data/history.json');
});
