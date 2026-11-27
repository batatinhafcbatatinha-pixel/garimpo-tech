// Histórico de preços (versão local): o menor preço do dia de cada modelo, por loja.
// Serve para conferir se o preço "de" anunciado é real: a referência é a mediana dos 30 dias
// anteriores à oferta aparecer. Preço que só sai com cupom fica guardado à parte e não entra na conta.
//
// Formato: { [modelKey]: { title, category, days: { "AAAA-MM-DD": { [loja]: { shelf, coupon? } } } } }
// Externo (Zoom/Buscapé): { [modelKey]: { at, source, days: { "AAAA-MM-DD": preço } } }

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { modelKey } from './classify.mjs';

export const KEEP_DAYS = 90;
export const WINDOW = 30; // dias olhados para a referência
export const FULL_DAYS = 20; // com isso nos últimos 30, o histórico está cheio e o externo não é mais usado
export const MIN_DAYS = 7; // menos que isso: sem referência

export const dayOf = (iso) => new Date(iso).toISOString().slice(0, 10);
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

export async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.log(`${path}: ilegível (${e.message}), começando do zero`);
    return fallback;
  }
}

export async function saveJson(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(obj));
  for (let i = 0; ; i++) {
    try {
      await rename(tmp, path);
      return;
    } catch (e) {
      if (i >= 9) throw e; // Windows: arquivo aberto por um leitor
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

export function recordPrice(hist, { key, title, category, store, price, coupon }, day) {
  if (!key || !(price > 0)) return;
  const e = (hist[key] ||= { title, category, days: {} });
  const s = ((e.days[day] ||= {})[store] ||= {});
  const f = coupon ? 'coupon' : 'shelf';
  if (!(s[f] <= price)) s[f] = price;
}

export function prune(hist, today, keepDays = KEEP_DAYS) {
  const cut = addDays(today, -keepDays);
  for (const [k, e] of Object.entries(hist)) {
    for (const d of Object.keys(e.days)) if (d < cut) delete e.days[d];
    if (!Object.keys(e.days).length) delete hist[k];
  }
}

// menor preço de prateleira do dia, entre todas as lojas
function shelfOfDay(stores) {
  let min = Infinity;
  for (const s of Object.values(stores || {})) if (s.shelf > 0 && s.shelf < min) min = s.shelf;
  return isFinite(min) ? min : null;
}

export function isFull(hist, key, today) {
  const e = hist[key];
  if (!e) return false;
  const from = addDays(today, -(WINDOW - 1));
  let n = 0;
  for (const [d, stores] of Object.entries(e.days)) if (d >= from && d <= today && shelfOfDay(stores) != null) n++;
  return n >= FULL_DAYS;
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Referência de preço para uma oferta vista pela 1ª vez em `firstSeen`: os 30 dias antes desse dia.
export function reference(hist, ext, key, firstSeen) {
  const first = dayOf(firstSeen);
  const from = addDays(first, -WINDOW);
  const prices = new Map();
  for (const [d, stores] of Object.entries(hist[key]?.days || {})) {
    if (d < from || d >= first) continue;
    const p = shelfOfDay(stores);
    if (p != null) prices.set(d, p);
  }
  let source = 'nosso';
  const x = ext?.[key];
  if (x?.days && !isFull(hist, key, addDays(first, -1))) {
    let used = false;
    for (const [d, p] of Object.entries(x.days)) {
      if (d < from || d >= first || prices.has(d) || !(p > 0)) continue;
      prices.set(d, p);
      used = true;
    }
    if (used) source = `nosso+${x.source}`;
  }
  if (prices.size < MIN_DAYS) return null;
  const v = [...prices.values()];
  return { median: median(v), min: Math.min(...v), days: prices.size, source };
}

// Tira as ofertas cujo desconto contra a referência fica abaixo do mínimo. As que passam ganham `hist`.
export function verify(deals, hist, ext, minDiscount) {
  const kept = [];
  let removed = 0;
  for (const d of deals) {
    const key = modelKey(d);
    const ref = key && reference(hist, ext, key, d.firstSeen || new Date().toISOString());
    if (!ref) {
      kept.push(d);
      continue;
    }
    const real = Math.round((1 - d.price / ref.median) * 100);
    if (real < minDiscount) {
      removed++;
      continue;
    }
    kept.push({ ...d, hist: { min30: ref.min, median30: ref.median, source: ref.source, days: ref.days } });
  }
  return { kept, removed };
}

// Itens do radar (sem preço "de" que prove os 50%): com histórico, o desconto real é conhecido.
// 50%+ real → sobem para a lista 50%+ (o "de" passa a ser a mediana); abaixo disso → saem de tudo.
// Sem histórico suficiente → continuam no radar.
export function checkRadar(radar, hist, ext, minDiscount) {
  const promoted = [], kept = [];
  let removed = 0;
  for (const d of radar) {
    const key = modelKey(d);
    const ref = key && reference(hist, ext, key, d.firstSeen || d.postedAt || new Date().toISOString());
    if (!ref) {
      kept.push(d);
      continue;
    }
    const real = Math.round((1 - d.price / ref.median) * 100);
    if (real < minDiscount) {
      removed++;
      continue;
    }
    const { radar: _, ...rest } = d;
    promoted.push({
      ...rest,
      oldPrice: Math.round(ref.median * 100) / 100,
      discount: real,
      ref: 'Mediana do histórico de preços (30 dias antes da oferta)',
      hist: { min30: ref.min, median30: ref.median, source: ref.source, days: ref.days },
    });
  }
  return { promoted, kept, removed };
}
