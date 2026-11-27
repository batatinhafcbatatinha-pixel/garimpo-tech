// Garimpo local: serve o site e roda a coleta no intervalo escolhido na página.
// A cada fonte concluída a página é avisada (Server-Sent Events) e já mostra o que chegou,
// sem esperar a coleta inteira. Com a opção "F5 refaz a coleta" ligada, recarregar a página
// dispara uma coleta completa.
//
//   node server.mjs            → http://localhost:4322
//   node server.mjs --open     → idem, abrindo o navegador
//
// Modo live: botão na página; posts novos do Telegram entram em segundos (scraper/live.mjs).
//
// Rodando no seu PC, Pichau e Terabyte passam pelo Cloudflare (no GitHub não passam).

import http from 'node:http';
import { spawn, exec } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 4322);
const HOST = process.env.HOST || '127.0.0.1';
const LOCAL_DIR = process.env.GARIMPO_LOCAL_DIR || join(ROOT, 'data', 'local');
const DATA = join(LOCAL_DIR, 'deals.json');
const SETTINGS = join(LOCAL_DIR, 'settings.json');
const INTERVALS = [0, 10, 15, 30, 60, 180, 360, 720, 1440]; // minutos; 0 = desligado

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

let settings = { every: 30, f5: false, ntfyTopic: '', live: false };
const state = { running: false, startedAt: null, lastEnd: null, lastOk: null, lastError: null, nextAt: null, progress: '' };
const clients = new Set();
let timer = null;

const log = (...a) => console.log(new Date().toLocaleTimeString('pt-BR'), ...a);
const status = () => ({ ...state, every: settings.every, f5: !!settings.f5, intervals: INTERVALS, live: live ? live.status() : null });

function send(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

async function loadSettings() {
  try {
    settings = { ...settings, ...JSON.parse(await readFile(SETTINGS, 'utf8')) };
  } catch {}
  // primeira vez: herda o tópico do ntfy do site publicado, se houver dados locais antigos
  if (!settings.ntfyTopic) {
    try {
      settings.ntfyTopic = JSON.parse(await readFile(join(ROOT, 'data', 'deals.json'), 'utf8')).ntfyTopic || '';
    } catch {}
  }
}
const saveSettings = () => mkdir(LOCAL_DIR, { recursive: true }).then(() => writeFile(SETTINGS, JSON.stringify(settings, null, 2)));

// ------------------------------------------------------------------ live (Telegram)
// O import do coletor fica depois de DATA_FILE definido; o live grava no mesmo data/local.
process.env.DATA_FILE ||= DATA;
const { createLive } = await import('./scraper/live.mjs');
const { TG_CHANNELS } = await import('./scraper/scrape.mjs');
const live = createLive({
  localDir: LOCAL_DIR,
  channels: TG_CHANNELS,
  getTopic: () => settings.ntfyTopic || '',
  log: (...a) => log(...a),
  ...(process.env.GARIMPO_LIVE_OFFLINE ? { fetchText: async () => { throw new Error('offline'); } } : {}),
  onChange: () => {
    send('live', live.status());
  },
  // cada leva de posts gravada: a página recarrega os dados (o mesmo evento das fontes da coleta)
  onDeals: () => send('partial', { at: new Date().toISOString(), live: true }),
});

// ------------------------------------------------------------------ coleta
function collect() {
  if (state.running) return;
  clearTimeout(timer);
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.nextAt = null;
  state.progress = 'iniciando…';
  send('status', status());
  log('coleta iniciada');
  const child = spawn(process.execPath, [join(ROOT, 'scraper', 'scrape.mjs')], {
    cwd: ROOT,
    env: { ...process.env, DATA_FILE: DATA, PARTIAL: '1', NTFY_TOPIC: settings.ntfyTopic || '', SITE_URL: `http://localhost:${PORT}/` },
    windowsHide: true,
  });
  let errTail = '';
  const onLine = (buf) => {
    for (const line of String(buf).split('\n').map((l) => l.trim()).filter(Boolean)) {
      // uma fonte terminou e o arquivo já tem o que ela trouxe: a página mostra na hora
      if (line === '@@partial') {
        send('partial', { at: new Date().toISOString() });
        continue;
      }
      process.stdout.write(`  ${line}\n`);
      // "03:22:43 telegram: 75 itens..." → "telegram: 75 itens..."
      state.progress = line.replace(/^\d\d:\d\d:\d\d\s+/, '').slice(0, 120);
      send('progress', { progress: state.progress });
    }
  };
  child.stdout.on('data', onLine);
  child.stderr.on('data', (b) => (errTail = (errTail + b).slice(-400)));
  child.on('close', (code) => {
    state.running = false;
    state.lastEnd = new Date().toISOString();
    state.lastOk = code === 0;
    state.lastError = code === 0 ? null : errTail.trim().split('\n').pop() || `saiu com código ${code}`;
    state.progress = '';
    log(code === 0 ? 'coleta concluída' : `coleta falhou: ${state.lastError}`);
    const done = () => {
      if (code === 0) send('updated', { at: state.lastEnd });
      schedule();
    };
    // a coleta regravou o deals.json a partir do que leu no começo: devolve o que o live trouxe nesse meio-tempo
    live.reapplyAfterCollect(state.startedAt).catch((e) => log('live: reaplicar falhou', e.message)).finally(done);
  });
}

async function schedule() {
  clearTimeout(timer);
  if (state.running) return;
  if (!settings.every) {
    state.nextAt = null;
    send('status', status());
    return;
  }
  // conta a partir do fim da última coleta (ou da data do arquivo, ao abrir o servidor)
  let base = state.lastEnd ? Date.parse(state.lastEnd) : 0;
  if (!base) {
    try {
      base = (await stat(DATA)).mtimeMs;
    } catch {}
  }
  const at = Math.max(Date.now() + 1500, base + settings.every * 60000);
  state.nextAt = new Date(at).toISOString();
  timer = setTimeout(collect, at - Date.now());
  send('status', status());
}

// ------------------------------------------------------------------ HTTP
const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function serveFile(res, file) {
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('não encontrado');
  }
}

const readBody = async (req) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
};
// Só a própria página pode mandar comandos (POST). Outro site aberto no navegador não pode,
// ainda mais os de login do Telegram.
const sameOrigin = (req) => {
  const o = req.headers.origin;
  return !o || o === `http://localhost:${PORT}` || o === `http://127.0.0.1:${PORT}`;
};

async function liveApi(p, req, res) {
  if (p === '/api/live' && req.method === 'GET') return json(res, 200, live.status());
  if (req.method !== 'POST') return json(res, 405, { error: 'use POST' });
  let j;
  try {
    j = await readBody(req);
  } catch {
    return json(res, 400, { error: 'JSON inválido' });
  }
  try {
    if (p === '/api/live') {
      settings.live = !!j.on;
      await saveSettings();
      if (settings.live) await live.start();
      else live.stop();
      log(`modo live: ${settings.live ? 'ligado' : 'desligado'}`);
      return json(res, 200, live.status());
    }
    if (p === '/api/telegram/login') return json(res, 200, { ...(await live.login(j)), live: live.status() });
    if (p === '/api/telegram/code') return json(res, 200, { ...(await live.code(j.code)), live: live.status() });
    if (p === '/api/telegram/password') return json(res, 200, { ...(await live.password(j.password)), live: live.status() });
    if (p === '/api/telegram/logout') return await live.logout(), json(res, 200, live.status());
    if (p === '/api/telegram/join') return await live.join(j.channel), json(res, 200, live.status());
  } catch (e) {
    // mensagem do Telegram (ex.: PHONE_CODE_INVALID) volta para a página; nunca a sessão
    return json(res, 400, { error: e.message, live: live.status() });
  }
  return json(res, 404, { error: 'não encontrado' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  if (req.method === 'POST' && !sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  if (p === '/api/live' || p.startsWith('/api/telegram/')) return liveApi(p, req, res);

  if (p === '/api/status') return json(res, 200, status());

  if (p === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: status\ndata: ${JSON.stringify(status())}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  // F5 com a opção ligada: refaz a coleta inteira (se já estiver coletando, não começa outra)
  if (p === '/api/collect' && req.method === 'POST') {
    const started = !state.running;
    collect();
    return json(res, 200, { started, ...status() });
  }

  if (p === '/api/settings' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const j = JSON.parse(body || '{}');
      if ('every' in j) {
        if (!INTERVALS.includes(+j.every)) return json(res, 400, { error: 'intervalo inválido' });
        settings.every = +j.every;
        log(`intervalo de coleta: ${settings.every ? `${settings.every} min` : 'desligado'}`);
      }
      if ('f5' in j) {
        settings.f5 = !!j.f5;
        log(`F5 refaz a coleta: ${settings.f5 ? 'ligado' : 'desligado'}`);
      }
      await saveSettings();
      await schedule();
      return json(res, 200, status());
    } catch {
      return json(res, 400, { error: 'JSON inválido' });
    }
  }

  // dados: na versão local vêm da coleta local
  if (p === '/data/deals.json') return serveFile(res, DATA);

  let file = normalize(join(ROOT, p.endsWith('/') ? `${p}index.html` : p));
  if (!file.startsWith(ROOT) || /[\\/](data[\\/]local|\.git|scraper|node_modules)([\\/]|$)/.test(file.slice(ROOT.length))) {
    res.writeHead(403);
    return res.end('proibido');
  }
  return serveFile(res, file);
});

await loadSettings();
server.listen(PORT, HOST, async () => {
  if (settings.live) live.start().catch((e) => log('live não ligou', e.message));
  const url = `http://localhost:${PORT}/`;
  log(`Garimpo local em ${url}  (coleta: ${settings.every ? `a cada ${settings.every} min` : 'desligada'})`);
  if (process.argv.includes('--open')) exec(process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`);
  // sem dados locais ainda: coleta já
  try {
    await stat(DATA);
  } catch {
    return collect();
  }
  schedule();
});
