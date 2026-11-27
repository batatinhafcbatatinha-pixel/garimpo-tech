// Coletor de ofertas — roda no GitHub Actions (Node 20+, sem dependências).
// Junta fontes diretas (KaBuM API, Amazon, Pato Loco) com o agregador Promobit
// (que cobre cupons de Amazon, Magalu, Mercado Livre, Shopee, KaBuM, Pichau, Terabyte),
// filtra por >= MIN_DISCOUNT, só produtos novos, só marcas boas, e grava data/deals.json.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { detectCategory, detectBrand, extractSpecs, isNew, strip } from './classify.mjs';

const MIN_DISCOUNT = +(process.env.MIN_DISCOUNT || 50);
const KEEP_HOURS = +(process.env.KEEP_HOURS || 72);
const OUT = new URL('../data/deals.json', import.meta.url);
const PREV_URL = process.env.PREV_URL || '';
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_MIN = +(process.env.NTFY_MIN_DISCOUNT || 60);
const SITE_URL = process.env.SITE_URL || '';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HEADERS = {
  'user-agent': UA,
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

export const STORES = {
  amazon: 'Amazon',
  kabum: 'KaBuM!',
  pichau: 'Pichau',
  terabyte: 'Terabyte',
  patoloco: 'Pato Loco',
  gk: 'GK Informática',
  magalu: 'Magalu',
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
};

const storeKey = (name = '', domain = '') => {
  const s = strip(`${name} ${domain}`);
  if (/amazon/.test(s)) return 'amazon';
  if (/kabum/.test(s)) return 'kabum';
  if (/pichau/.test(s)) return 'pichau';
  if (/terabyte/.test(s)) return 'terabyte';
  if (/pato ?loco/.test(s)) return 'patoloco';
  if (/\bgk\b|gkinfo/.test(s)) return 'gk';
  if (/magazine|magalu/.test(s)) return 'magalu';
  if (/mercado ?livre|mercadolivre/.test(s)) return 'mercadolivre';
  if (/shopee/.test(s)) return 'shopee';
  return null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, { json = false, headers = {}, tries = 2 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = AbortSignal.timeout(25000);
      const r = await fetch(url, { headers: { ...HEADERS, ...headers }, signal: ctl, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      last = e;
      await sleep(800 + i * 1200);
    }
  }
  throw last;
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const round2 = (n) => Math.round(n * 100) / 100;

// ------------------------------------------------------------------ normalização
function makeDeal(raw) {
  const { title, price } = raw;
  let oldPrice = raw.oldPrice;
  if (!title || !(price > 0)) return null;
  if (!(oldPrice > price) && !raw.allowRef) return null;
  if (!isNew(title)) return null;
  const category = detectCategory(title, raw.menu);
  if (!category) return null;
  const brand = detectBrand(category, title, raw.brandHint);
  if (!brand) return null;
  const specs = extractSpecs(category, title);
  let ref = null;
  // Sem preço "de" (comum em posts de cupom): usa o preço regular do mesmo modelo no KaBuM como referência.
  if (!(oldPrice > price) && raw.allowRef) {
    const r = REFS.get(refKey(category, specs));
    if (r && r > price) {
      oldPrice = r;
      ref = 'Preço regular do mesmo modelo no KaBuM';
    }
  }
  if (!(oldPrice > price)) return null;
  const discount = Math.round((1 - price / oldPrice) * 100);
  if (discount < MIN_DISCOUNT || discount > 97) return null;
  return {
    ref,
    id: raw.id,
    store: raw.store,
    title: title.replace(/\s+/g, ' ').trim(),
    brand,
    category,
    price: round2(price),
    oldPrice: round2(oldPrice),
    discount,
    coupon: raw.coupon || null,
    url: raw.url,
    image: raw.image || null,
    source: raw.source,
    specs,
  };
}

// ------------------------------------------------------------------ preços de referência (catálogo KaBuM)
const REFS = new Map();
function refKey(category, s) {
  if (category === 'cpu' && s.modelo) return `cpu|${s.modelo}`;
  if (category === 'gpu' && s.chip && s.vram) return `gpu|${s.chip}|${s.vram}`;
  if (category === 'ram' && s.tipo && s.capacidade && s.frequencia) return `ram|${s.tipo}|${s.capacidade}|${s.frequencia}|${s.uso}`;
  return null;
}
const refSamples = new Map();
function addRefSample(title, menu, regular) {
  if (!(regular > 0)) return;
  const category = detectCategory(title, menu);
  if (!category) return;
  const key = refKey(category, extractSpecs(category, title));
  if (!key) return;
  if (!refSamples.has(key)) refSamples.set(key, []);
  refSamples.get(key).push(regular);
}
function buildRefs() {
  for (const [k, arr] of refSamples) {
    if (arr.length < 2) continue; // exige pelo menos 2 anúncios para evitar referência inflada
    const s = [...arr].sort((a, b) => a - b);
    REFS.set(k, s[Math.floor(s.length / 2)]);
  }
  log(`referências de preço: ${REFS.size} modelos`);
}

// ------------------------------------------------------------------ Promobit
function nextData(html) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  return m ? JSON.parse(m[1]) : null;
}

function fromPromobitOffer(o) {
  if (!o || o.offerStatusName && !/APPROVED/i.test(o.offerStatusName)) return null;
  const store = storeKey(o.storeName, o.storeDomain);
  if (!store) return null;
  const price = +o.offerPrice;
  const oldPrice = +o.offerOldPrice;
  if (!(price > 1)) return null;
  const photo = o.offerPhoto ? `https://i.promobit.com.br/268${o.offerPhoto.startsWith('/') ? '' : '/'}${o.offerPhoto}` : null;
  return makeDeal({
    id: `pb-${o.offerId}`,
    store,
    title: o.offerTitle,
    price,
    oldPrice,
    coupon: typeof o.offerCoupon === 'string' && o.offerCoupon.length < 40 ? o.offerCoupon.trim() : null,
    url: `https://www.promobit.com.br/oferta/${o.offerSlug}/`,
    image: photo,
    source: 'Promobit',
    allowRef: true,
  });
}

async function promobit() {
  // [caminho, páginas extras via cursor]
  const pages = [
    ['/promocoes/placa-video/s/', 6],
    ['/promocoes/processador/s/', 5],
    ['/promocoes/monitor/s/', 5],
    ['/promocoes/monitor-gamer/s/', 4],
    ['/promocoes/monitor-4-k/s/', 2],
    ['/promocoes/hd-ssd/s/', 5],
    ['/promocoes/memoria-ram/s/', 5],
    ['/promocoes/notebooks/s/', 5],
    ['/promocoes/notebook-gamer/s/', 4],
    ['/promocoes/placa-mae/s/', 4],
    ['/promocoes/hardware-perifericos/s/', 4],
    ['/promocoes/informatica/', 6],
    ['/promocoes/loja/kabum/', 3],
    ['/promocoes/loja/pichau/', 3],
    ['/promocoes/loja/terabyteshop/', 3],
    ['/promocoes/loja/amazon/', 2],
    ['/promocoes/loja/mercado-livre/', 2],
    ['/promocoes/loja/magazine-luiza/', 2],
    ['/promocoes/loja/shopee/', 2],
  ];
  const BASE = 'https://www.promobit.com.br';
  const out = [];
  const seen = new Set();
  let ok = 0;
  const take = (pp) => {
    const lists = [pp?.serverOffers?.offers, pp?.serverFeaturedOffers, pp?.sidebarFeaturedOffers, pp?.fixedOffer]
      .flat()
      .filter(Boolean);
    for (const o of lists) {
      if (!o?.offerId || seen.has(o.offerId)) continue;
      seen.add(o.offerId);
      const d = fromPromobitOffer(o);
      if (d) out.push(d);
    }
  };
  for (const [path, extra] of pages) {
    try {
      const nd = nextData(await get(BASE + path));
      if (!nd) throw new Error('sem __NEXT_DATA__');
      ok++;
      let pp = nd.props?.pageProps;
      take(pp);
      const dataPath = `${BASE}/_next/data/${nd.buildId}${path.replace(/\/$/, '')}.json`;
      for (let i = 0; i < extra; i++) {
        const after = pp?.serverOffers?.after;
        if (!after) break;
        await sleep(450);
        const j = await get(`${dataPath}?after=${encodeURIComponent(after)}`, { json: true });
        pp = j.pageProps;
        const before = seen.size;
        take(pp);
        if (seen.size === before) break;
      }
      await sleep(500);
    } catch (e) {
      log('promobit', path, e.message);
    }
  }
  log(`promobit: ${seen.size} ofertas lidas, ${out.length} aprovadas`);
  return { deals: out, ok: ok > 0 };
}

// ------------------------------------------------------------------ KaBuM (API pública do catálogo)
async function kabum() {
  const queries = ['placa de video', 'processador', 'monitor', 'ssd', 'memoria ram', 'notebook', 'placa mae'];
  const out = [];
  let ok = 0;
  const seen = new Set();
  for (const q of queries) {
    for (let page = 1; page <= 5; page++) {
      const url = `https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products?query=${encodeURIComponent(q)}&page_size=100&page_number=${page}&sort=-discount_percentage`;
      try {
        const j = await get(url, { json: true, headers: { accept: 'application/json' } });
        ok++;
        const items = j.data || [];
        for (const it of items) {
          const a = it.attributes || {};
          if (seen.has(it.id) || !a.available || a.is_openbox) continue;
          seen.add(it.id);
          if (!a.is_marketplace) addRefSample(a.title, a.menu, Math.max(+a.price_with_discount || 0, +a.old_price || 0));
          // Preço "de": o regular à vista (ou old_price, quando a loja informa). Preço "por": o da oferta relâmpago, à vista.
          let price, oldPrice;
          if (a.offer && a.offer.price_with_discount) {
            price = +a.offer.price_with_discount;
            oldPrice = Math.max(+a.price_with_discount || 0, +a.old_price || 0);
          } else {
            price = +(a.price_with_discount || a.price);
            oldPrice = +(a.old_price || 0);
          }
          const d = makeDeal({
            id: `kb-${it.id}`,
            store: 'kabum',
            title: a.title,
            price,
            oldPrice,
            menu: a.menu,
            brandHint: a.manufacturer?.name,
            url: `https://www.kabum.com.br/produto/${it.id}/${a.product_link || ''}`,
            image: (a.images && a.images[0]) || a.photos?.g?.[0] || null,
            source: 'KaBuM!',
          });
          if (d) out.push(d);
        }
        if (items.length < 100) break;
        await sleep(400);
      } catch (e) {
        log('kabum', q, page, e.message);
        break;
      }
    }
  }
  log(`kabum: ${out.length} aprovadas`);
  return { deals: out, ok: ok > 0 };
}

// ------------------------------------------------------------------ Amazon (busca com filtro de desconto)
const decodeHtml = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const brl = (s) => +String(s).replace(/[^\d,]/g, '').replace(',', '.');

async function amazon() {
  const queries = ['placa de video', 'processador', 'monitor gamer', 'ssd nvme', 'memoria ram ddr5', 'memoria ram ddr4', 'notebook', 'placa mae'];
  const out = [];
  let ok = 0;
  for (const q of queries) {
    const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(q)}&pct-off=50-99&i=computers`;
    try {
      const html = await get(url);
      if (/captcha|api-services-support/i.test(html.slice(0, 5000))) throw new Error('captcha');
      ok++;
      const blocks = html.split('data-component-type="s-search-result"').slice(1);
      for (const b of blocks) {
        const asin = /data-asin="([A-Z0-9]{10})"/.exec(b)?.[1] || /\/dp\/([A-Z0-9]{10})/.exec(b)?.[1];
        const title = decodeHtml(
          /<h2 aria-label="([^"]+)"/.exec(b)?.[1] || (/<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/.exec(b)?.[1] || '').replace(/<[^>]+>/g, '')
        ).replace(/^Anúncio patrocinado – /, '');
        const price = brl(/<span class="a-price"[^>]*>\s*<span class="a-offscreen">([^<]+)</.exec(b)?.[1] || '');
        const oldPrice = brl(/a-text-price"[^>]*>\s*<span class="a-offscreen">([^<]+)</.exec(b)?.[1] || '');
        const img = /<img[^>]+class="s-image"[^>]+src="([^"]+)"/.exec(b)?.[1];
        if (!asin || !title) continue;
        const d = makeDeal({
          id: `az-${asin}`,
          store: 'amazon',
          title,
          price,
          oldPrice,
          url: `https://www.amazon.com.br/dp/${asin}`,
          image: img,
          source: 'Amazon',
        });
        if (d) out.push(d);
      }
      await sleep(1500);
    } catch (e) {
      log('amazon', q, e.message);
    }
  }
  log(`amazon: ${out.length} aprovadas`);
  return { deals: out, ok: ok > 0 };
}

// ------------------------------------------------------------------ Pato Loco (HTML)
async function patoloco() {
  const paths = [
    'promocao-especial/blackfriday2026',
    'produtos/placa-de-video',
    'produtos/placa-de-video/2',
    'produtos/processadores',
    'produtos/processadores/2',
    'produtos/placas-mae',
    'produtos/memorias',
    'produtos/ssd',
    'produtos/ssd-m2',
    'produtos/monitor',
  ];
  const out = [];
  let ok = 0;
  const seen = new Set();
  for (const p of paths) {
    try {
      const html = await get(`https://patoloco.com.br/${p}`);
      ok++;
      // cada card de produto começa com o form "adicionar ao carrinho"
      for (const block of html.split('carrinho/actions/adicionar/').slice(1)) {
        const card = block.slice(0, 6000);
        const m = /<a href="(https:\/\/patoloco\.com\.br\/[^"]+)" title="([^"]+)"/.exec(card);
        if (!m) continue;
        const [, link, rawTitle] = m;
        if (seen.has(link)) continue;
        seen.add(link);
        const title = decodeHtml(rawTitle).trim();
        const oldPrice = brl(/price-old">\s*<del[^>]*>\s*R\$\s?([\d.]+,\d{2})/.exec(card)?.[1] || '');
        const price = brl(/price-new">[\s\S]*?([\d.]+,\d{2})/.exec(card)?.[1] || '');
        const img = /<img[^>]+src="(https:\/\/patoloco\.com\.br\/resize\/[^"]+)"/.exec(card)?.[1];
        const d = makeDeal({ id: `pl-${link.split('/').pop().slice(0, 80)}`, store: 'patoloco', title, price, oldPrice, url: link, image: img, source: 'Pato Loco' });
        if (d) out.push(d);
      }
      await sleep(700);
    } catch (e) {
      log('patoloco', p, e.message);
    }
  }
  log(`patoloco: ${out.length} aprovadas`);
  return { deals: out, ok: ok > 0 };
}

// ------------------------------------------------------------------ merge + saída
async function loadPrevious() {
  try {
    if (PREV_URL) {
      const j = await get(`${PREV_URL}?t=${Date.now()}`, { json: true });
      if (Array.isArray(j.deals)) return j;
    }
  } catch (e) {
    log('prev (url)', e.message);
  }
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return { deals: [] };
  }
}

async function notify(newDeals) {
  if (!NTFY_TOPIC) return;
  const best = newDeals.filter((d) => d.discount >= NTFY_MIN).sort((a, b) => b.discount - a.discount).slice(0, 15);
  for (const d of best) {
    const prio = d.discount >= 80 ? 5 : d.discount >= 70 ? 4 : 3;
    const body = `${d.discount}% OFF • R$ ${d.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (era R$ ${d.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n${STORES[d.store]}${d.coupon ? ` • cupom ${d.coupon}` : ''}`;
    for (const topic of [NTFY_TOPIC, `${NTFY_TOPIC}-${d.category}`]) {
      try {
        await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          body,
          headers: {
            Title: d.title.slice(0, 120).replace(/[^\x20-\x7EÀ-ÿ]/g, ''),
            Priority: String(prio),
            Tags: `${d.category},${d.store},d${Math.floor(d.discount / 10) * 10}`,
            Click: d.url,
            ...(d.image ? { Attach: d.image } : {}),
            ...(SITE_URL ? { Actions: `view, Ver no Garimpo, ${SITE_URL}` } : {}),
          },
        });
      } catch (e) {
        log('ntfy', e.message);
      }
    }
  }
  if (best.length) log(`ntfy: ${best.length} notificações enviadas`);
}

async function main() {
  const prev = await loadPrevious();
  const now = new Date().toISOString();
  const results = {};
  // KaBuM primeiro: o catálogo dele alimenta os preços de referência usados nos posts de cupom
  try {
    results.kabum = await kabum();
  } catch (e) {
    log('kabum falhou', e.message);
    results.kabum = { deals: [], ok: false };
  }
  buildRefs();
  const sources = { promobit, amazon, patoloco };
  await Promise.all(
    Object.entries(sources).map(async ([k, fn]) => {
      try {
        results[k] = await fn();
      } catch (e) {
        log(k, 'falhou', e.message);
        results[k] = { deals: [], ok: false };
      }
    })
  );

  const prevById = new Map((prev.deals || []).map((d) => [d.id, d]));
  const current = new Map();
  for (const r of Object.values(results)) {
    for (const d of r.deals) {
      const p = prevById.get(d.id);
      current.set(d.id, { ...d, firstSeen: p?.firstSeen || now, lastSeen: now });
    }
  }
  // fontes diretas que funcionaram nesta rodada são "autoridade": se o item sumiu, saiu de promoção
  const directOk = new Set(Object.entries({ kabum: 'kb-', amazon: 'az-', patoloco: 'pl-' }).filter(([k]) => results[k]?.ok).map(([, p]) => p));
  const cutoff = Date.now() - KEEP_HOURS * 3600e3;
  for (const d of prev.deals || []) {
    if (current.has(d.id)) continue;
    const prefix = d.id.slice(0, 3);
    if (directOk.has(prefix)) continue;
    if (new Date(d.lastSeen).getTime() < cutoff) continue;
    current.set(d.id, d);
  }

  // dedup: mesmo produto/preço em fontes diferentes
  const byKey = new Map();
  for (const d of current.values()) {
    const s = d.specs || {};
    const model =
      d.category === 'cpu' && s.modelo ? s.modelo
      : d.category === 'gpu' && s.chip ? `${d.brand}|${s.chip}|${s.vram}|${strip(d.title).replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 8).join(' ')}`
      : strip(d.title).slice(0, 60);
    const key = `${d.store}|${d.category}|${model}|${Math.round(d.price / 30)}`;
    const ex = byKey.get(key);
    // mantém o mais barato; em empate, o que tem cupom e o mais recente
    if (!ex || d.price < ex.price || (d.price === ex.price && d.coupon && !ex.coupon)) {
      if (ex) d.firstSeen = ex.firstSeen < d.firstSeen ? ex.firstSeen : d.firstSeen;
      byKey.set(key, d);
    }
  }
  const deals = [...byKey.values()].sort((a, b) => b.discount - a.discount);

  const newDeals = deals.filter((d) => !prevById.has(d.id));
  await notify(newDeals);

  const status = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { ok: r.ok, count: r.deals.length }]));
  const payload = { updatedAt: now, minDiscount: MIN_DISCOUNT, ntfyTopic: NTFY_TOPIC || null, ntfyMin: NTFY_MIN, sources: status, stores: STORES, count: deals.length, deals };
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  log(`total: ${deals.length} ofertas (${newDeals.length} novas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
