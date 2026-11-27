import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccount, watchSession } from '../scraper/tg-account.mjs';

const clients = [];
class FakeClient {
  constructor() { this.disconnected = false; this.session = { save: () => 'S' }; clients.push(this); }
  setLogLevel() {}
  async connect() {}
  async disconnect() { this.disconnected = true; }
  async sendCode() { return { phoneCodeHash: 'h' }; }
}
const fakeLib = { TelegramClient: FakeClient, StringSession: class {}, Api: {}, NewMessage: class {}, EditedMessage: class {} };

test('novo login desconecta o cliente anterior (sem conexões esquecidas)', async () => {
  const a = createAccount({ localDir: mkdtempSync(join(tmpdir(), 'garimpo-acc-')), lib: fakeLib });
  await a.startLogin({ apiId: 1, apiHash: 'x', phone: '+55' });
  await a.startLogin({ apiId: 1, apiHash: 'x', phone: '+55' });
  assert.equal(clients.length, 2);
  assert.equal(clients[0].disconnected, true);
  assert.equal(clients[1].disconnected, false);
});

test('sessão revogada com o live rodando é percebida', async () => {
  const errors = [];
  const client = { getMe: async () => { throw new Error('AUTH_KEY_UNREGISTERED'); } };
  const stop = watchSession(client, (e) => errors.push(e.message), { interval: 10 });
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(errors.length >= 1);
  assert.match(errors[0], /AUTH_KEY_UNREGISTERED/);
  // erro vindo do próprio gramjs também chega
  await client.onError(new Error('SESSION_REVOKED'));
  assert.match(errors.at(-1), /SESSION_REVOKED/);
  stop();
});
