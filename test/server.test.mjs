import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const freePort = () => new Promise((r) => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let child, base, dir;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'garimpo-srv-'));
  // dados e configurações prontos: o servidor não dispara coleta ao abrir
  writeFileSync(join(dir, 'deals.json'), JSON.stringify({ deals: [], radar: [], coupons: [] }));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ every: 0, f5: false, ntfyTopic: '' }));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), GARIMPO_LOCAL_DIR: dir, GARIMPO_LIVE_OFFLINE: '1' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${base}/api/status`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
});
after(() => child?.kill());

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('página de outro site não consegue mexer no login do Telegram', async () => {
  const r = await post('/api/telegram/login', { apiId: 1, apiHash: 'x', phone: '+55' }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  const r2 = await post('/api/live', { on: true }, { origin: 'https://evil.example' });
  assert.equal(r2.status, 403);
});

test('ligar o live fica salvo nas configurações', async () => {
  const r = await post('/api/live', { on: true }, { origin: base });
  assert.equal(r.status, 200);
  const s = await (await fetch(`${base}/api/live`)).json();
  assert.equal(s.on, true);
  assert.equal(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).live, true);
  await post('/api/live', { on: false }, { origin: base });
});

test('status do live nunca devolve api_hash nem sessão', async () => {
  writeFileSync(join(dir, 'telegram.json'), JSON.stringify({ apiId: 123, apiHash: 'SEGREDOHASH' }));
  writeFileSync(join(dir, 'telegram-session.txt'), 'SEGREDOSESSAO');
  const txt = await (await fetch(`${base}/api/live`)).text();
  assert.doesNotMatch(txt, /SEGREDO/);
  const st = await (await fetch(`${base}/api/status`)).text();
  assert.doesNotMatch(st, /SEGREDO/);
});
