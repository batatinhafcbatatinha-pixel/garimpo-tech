import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, applyState, captureState } from '../scraper/state.mjs';

const NOW = '2026-11-27T12:00:00.000Z';
const hoursAgo = (h) => new Date(Date.parse(NOW) - h * 3600e3).toISOString();
const sets = () => ({ expiredIds: new Set(), expiredCodes: new Set(), refs: new Map() });

test('código esgotado há 10 h volta a valer na próxima coleta', () => {
  const s = sets();
  applyState({ expiredIds: { 'tg-a-1': hoursAgo(10) }, expiredCodes: { ZB9MELI: hoursAgo(10) }, refs: { 'cpu|5700X': 900 } }, s);
  assert.ok(s.expiredCodes.has('ZB9MELI'));
  assert.ok(s.expiredIds.has('tg-a-1'));
  assert.equal(s.refs.get('cpu|5700X'), 900);
});

test('expirado com mais de KEEP_HOURS sai; novo ganha a data de agora', () => {
  const s = sets();
  s.expiredCodes.add('NOVO');
  const st = captureState({ expiredIds: {}, expiredCodes: { VELHO: hoursAgo(73), RECENTE: hoursAgo(5) }, refs: {} }, s, NOW, 72);
  assert.deepEqual(Object.keys(st.expiredCodes).sort(), ['NOVO', 'RECENTE']);
  assert.equal(st.expiredCodes.NOVO, NOW);
  assert.equal(st.expiredCodes.RECENTE, hoursAgo(5));
});

test('sem referências novas, mantém as anteriores', () => {
  const st = captureState({ expiredIds: {}, expiredCodes: {}, refs: { a: 1 } }, sets(), NOW, 72);
  assert.deepEqual(st.refs, { a: 1 });
});

test('arquivo ausente → estado vazio', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'garimpo-'));
  assert.deepEqual(await loadState(join(dir, 'state.json')), { expiredIds: {}, expiredCodes: {}, refs: {} });
});

test('expirado vencido também sai da memória (processo longo do live)', () => {
  const s = sets();
  const old = { expiredIds: {}, expiredCodes: { VELHO: hoursAgo(73) }, refs: {} };
  applyState(old, s);
  const st = captureState(old, s, NOW, 72);
  assert.equal(st.expiredCodes.VELHO, undefined);
  assert.equal(s.expiredCodes.has('VELHO'), false);
});
