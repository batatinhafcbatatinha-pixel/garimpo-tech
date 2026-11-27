// Histórico de preços de fora (Zoom; Buscapé de reserva — são a mesma plataforma, com os mesmos dados).
// Usado só enquanto o nosso histórico daquele modelo ainda não está cheio, e só para ofertas que
// passaram dos 50% pelo preço anunciado. Poucas consultas por coleta, uma por vez, com cache de 24 h.

import { detectBrand, extractSpecs, modelKey } from './classify.mjs';
import { isFull, dayOf } from './history.mjs';

const CACHE_HOURS = 24;

function nextData(html) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html || '');
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

class Blocked extends Error {}
const state = (html) => {
  const j = nextData(html);
  if (!j) throw new Blocked('página sem dados (bloqueio ou desafio do Cloudflare)');
  return j.props?.initialReduxState || {};
};

const platform = (base) => ({
  base,
  searchUrl: (q) => `${base}/search?q=${encodeURIComponent(q)}`,
  // resultados da busca: só produtos (links /lead?… são ofertas avulsas)
  search(html) {
    return (state(html).hits?.hits || [])
      .filter((h) => h?.name && h.url && !h.url.startsWith('/lead'))
      .map((h) => ({ title: h.name, url: h.url }));
  },
  // { "AAAA-MM-DD": preço } — menor preço do dia
  history(html) {
    const out = {};
    for (const v of Object.values(state(html).priceHistory?.priceHistory || {})) {
      for (const d of v?.days || []) {
        if (!(d?.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
        if (!(out[d.date] <= d.price)) out[d.date] = d.price;
      }
    }
    return out;
  },
});

export const SITES = {
  zoom: platform('https://www.zoom.com.br'),
  buscape: platform('https://www.buscape.com.br'),
};

// "cpu|amd|5700x" → "amd 5700x"; SSD/RAM sem a capacidade no fim
export function searchTerm(d) {
  const key = modelKey(d);
  if (!key) return null;
  const parts = key.split('|').slice(1);
  if ((d.category === 'ssd' || d.category === 'ram') && /^\d+$/.test(parts.at(-1))) parts.pop();
  return parts.join(' ');
}

const sameModel = (d, title) =>
  modelKey({ title, category: d.category, brand: detectBrand(d.category, title) || d.brand, specs: extractSpecs(d.category, title) }) === modelKey(d);

export async function enrichExternal(
  candidates,
  { hist, ext, fetchHtml, now = new Date().toISOString(), limit = 40, pause = [3000, 6000], log = console.log }
) {
  const today = dayOf(now);
  const nowMs = Date.parse(now);
  const blocked = new Set();
  const wait = () => new Promise((r) => setTimeout(r, pause[0] + Math.random() * (pause[1] - pause[0])));
  let looked = 0, hits = 0, first = true;
  const seen = new Set();
  for (const d of candidates) {
    if (looked >= limit) break;
    const key = modelKey(d);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (isFull(hist, key, today)) continue;
    const c = ext[key];
    if (c?.at && nowMs - Date.parse(c.at) < CACHE_HOURS * 3600e3) continue;
    const sites = Object.entries(SITES).filter(([n]) => !blocked.has(n));
    if (!sites.length) break;
    looked++;
    for (const [name, site] of sites) {
      try {
        if (!first) await wait();
        first = false;
        const found = site.search(await fetchHtml(site.searchUrl(searchTerm(d))));
        const match = found.find((h) => sameModel(d, h.title));
        let days = {};
        if (match) {
          await wait();
          days = site.history(await fetchHtml(site.base + match.url));
        }
        ext[key] = { at: now, source: name, days };
        if (Object.keys(days).length) hits++;
        break; // achou ou não, a resposta deste site vale
      } catch (e) {
        // bloqueio: não insiste neste site nesta coleta; tenta o próximo
        blocked.add(name);
        log(`externo: ${name} desligado nesta coleta (${e.message})`);
      }
    }
  }
  log(`externo: ${looked} consultas, ${hits} com histórico`);
  return { looked, hits };
}
