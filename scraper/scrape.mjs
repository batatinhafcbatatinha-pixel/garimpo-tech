// Coletor de ofertas — roda no GitHub Actions (Node 20+, sem dependências).
// Fontes: KaBuM (API), Amazon, Pato Loco, Pichau e Terabyte (Chrome headless), Promobit e
// canais públicos do Telegram (cupons de Mercado Livre, Shopee, AliExpress, Amazon, Magalu...).
// Saída (data/deals.json):
//   deals   — ofertas com >= MIN_DISCOUNT comprovado, só novos, só marcas boas
//   radar   — posts de cupom em hardware sem como comprovar os 50% (últimas RADAR_HOURS)
//   coupons — cupons gerais de loja (ex.: "R$ 250 OFF acima de R$ 999")

import { writeFile, readFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { detectCategory, detectBrand, extractSpecs, isNew, strip, moboSlotsFromSpec, modelKey } from './classify.mjs';
import { verify, checkRadar, recordPrice, prune, loadJson, saveJson, dayOf } from './history.mjs';
import { loadState, applyState, captureState } from './state.mjs';
import { enrichExternal } from './external.mjs';

const MIN_DISCOUNT = +(process.env.MIN_DISCOUNT || 50);
const KEEP_HOURS = +(process.env.KEEP_HOURS || 72);
const RADAR_HOURS = +(process.env.RADAR_HOURS || 48);
const COUPON_HOURS = +(process.env.COUPON_HOURS || 36);
// DATA_FILE: caminho de saída (o servidor local usa data/local/deals.json)
const OUT = process.env.DATA_FILE ? pathToFileURL(resolve(process.env.DATA_FILE)) : new URL('../data/deals.json', import.meta.url);
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
  aliexpress: 'AliExpress',
};

const storeKey = (name = '', domain = '') => {
  const s = strip(`${name} ${domain}`);
  if (/aliexpress/.test(s)) return 'aliexpress';
  if (/amazon|amzn|link\.amazon/.test(s)) return 'amazon';
  if (/kabum/.test(s)) return 'kabum';
  if (/pichau/.test(s)) return 'pichau';
  if (/terabyte/.test(s)) return 'terabyte';
  if (/pato ?loco/.test(s)) return 'patoloco';
  if (/\bgk\b|gkinfo/.test(s)) return 'gk';
  if (/magazine|magalu/.test(s)) return 'magalu';
  if (/mercado ?livre|mercadolivre|meli\.la|\bmeli\b/.test(s)) return 'mercadolivre';
  if (/shopee/.test(s)) return 'shopee';
  return null;
};

// loja a partir do link do post (encurtadores de afiliado inclusos)
const storeFromUrl = (u) => {
  let h;
  try {
    h = new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  if (/(^|\.)meli\.la$|mercadolivre\.com|mercadolibre\.com/.test(h)) return 'mercadolivre';
  if (/shopee\.com\.br|shope\.ee/.test(h)) return 'shopee';
  if (/aliexpress\.com|s\.click\.aliexpress/.test(h)) return 'aliexpress';
  if (/amazon\.com\.br|amzn\.to|link\.amazon|a\.co$/.test(h)) return 'amazon';
  if (/kabum\.com\.br|tidd\.ly/.test(h)) return 'kabum';
  if (/pichau\.com\.br/.test(h)) return 'pichau';
  if (/terabyteshop\.com\.br/.test(h)) return 'terabyte';
  if (/magazineluiza\.com\.br|magazinevoce\.com\.br|magalu\.com/.test(h)) return 'magalu';
  if (/patoloco\.com\.br/.test(h)) return 'patoloco';
  return null;
};

// Corrige texto UTF-8 lido como Latin-1 ("MemÃ³ria" -> "Memória")
const fixMojibake = (s) => (/Ã[\x80-\xBF]|Ã§|Ã£|Ã©|Ãª|Ã³|Ãµ|Ã¡|Ã­|Ãº/.test(s) ? Buffer.from(s, 'latin1').toString('utf8') : s);

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
// raw.radar = true: se não der pra comprovar os 50% (post de cupom sem preço "de"),
// o item vai para o "Radar de cupons" em vez de ser descartado.
function makeDeal(raw) {
  const { title, price } = raw;
  let oldPrice = raw.oldPrice;
  if (!title || !(price > 0)) return null;
  if (!(oldPrice > price) && !raw.allowRef && !raw.radar) return null;
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
  let discount = oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : null;
  if (discount != null && discount > 97) return null;
  let radar = false;
  if (discount == null || discount < MIN_DISCOUNT) {
    if (!raw.radar) return null;
    radar = true;
  }
  if (discount == null) oldPrice = null;
  return {
    ...(radar ? { radar: true } : {}),
    ...(raw.via ? { via: raw.via } : {}),
    ...(raw.postedAt ? { postedAt: raw.postedAt } : {}),
    ...(raw.expiresAt ? { expiresAt: raw.expiresAt } : {}),
    ref,
    id: raw.id,
    store: raw.store,
    title: title.replace(/\s+/g, ' ').trim(),
    brand,
    category,
    price: round2(price),
    oldPrice: oldPrice ? round2(oldPrice) : null,
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

// ------------------------------------------------------------------ expirados
// Ofertas e cupons que a fonte marcou como encerrados nesta rodada: saem do site
// mesmo que tenham sido vistos antes.
const EXPIRED_IDS = new Set(); // ids de ofertas
const EXPIRED_CODES = new Set(); // códigos de cupom esgotados
const EXPIRED_WORDS = /\b(esgotad[oa]s?|esgotou|encerrad[oa]s?|encerrou|expirad[oa]s?|expirou|acabou|finalizad[oa]|indispon[ií]vel)\b/i;
const NOT_A_CODE = /^(ESGOTOU|ESGOTADO|ESGOTADA|ENCERRADO|ENCERRADA|EXPIRADO|ACABOU|CUPOM|CUPONS|OFERTA|PROMO|GALERA|LINK|BLACK|FRIDAY)$/;

function fromPromobitOffer(o) {
  if (!o) return null;
  if (o.offerStatusName && !/APPROVED/i.test(o.offerStatusName)) {
    EXPIRED_IDS.add(`pb-${o.offerId}`);
    return null;
  }
  const store = storeKey(o.storeName, o.storeDomain);
  if (!store) return null;
  const price = +o.offerPrice;
  const oldPrice = +o.offerOldPrice;
  if (!(price > 1)) return null;
  const photo = o.offerPhoto ? `https://i.promobit.com.br/268${o.offerPhoto.startsWith('/') ? '' : '/'}${o.offerPhoto}` : null;
  const coupon = typeof o.offerCoupon === 'string' && o.offerCoupon.length < 40 ? o.offerCoupon.trim() : null;
  return makeDeal({
    id: `pb-${o.offerId}`,
    store,
    title: o.offerTitle,
    price,
    oldPrice,
    coupon,
    radar: !!coupon,
    via: 'Promobit',
    postedAt: o.offerPublished,
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
    ['/promocoes/cooler/s/', 2],
    ['/promocoes/gabinete/s/', 2],
    ['/promocoes/teclado/s/', 2],
    ['/promocoes/mouse/s/', 2],
    ['/promocoes/headset/s/', 2],
    ['/promocoes/fone-de-ouvido/s/', 2],
    ['/promocoes/playstation-5/s/', 2],
    ['/promocoes/nintendo-switch/s/', 1],
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
    for (const c of [pp?.serverCoupons, pp?.couponsByStore].flat().filter(Boolean)) {
      const store = storeKey(c.storeName, c.storeDomain);
      if (!store || !c.couponCode) continue;
      const until = c.couponUntil ? Date.parse(String(c.couponUntil).replace(/([+-]\d{2})(\d{2})$/, '$1:$2')) : NaN;
      if ((c.couponStatusName && !/APPROVED/i.test(c.couponStatusName)) || until < Date.now()) {
        EXPIRED_CODES.add(String(c.couponCode).trim().toUpperCase());
        continue;
      }
      addCoupon({
        id: `pbc-${c.couponId}`,
        store,
        code: String(c.couponCode).trim(),
        title: c.couponTitle || `${c.couponDiscount || ''} ${c.couponDiscountOn || ''}`.trim(),
        discount: c.couponDiscountShort || c.couponDiscount || null,
        rules: (c.couponInstructions || '').slice(0, 260) || null,
        url: c.couponUrl ? `https://www.promobit.com.br${c.couponUrl}` : null,
        postedAt: c.couponPublished ? new Date(c.couponPublished.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')).toISOString() : null,
        via: 'Promobit',
      });
    }
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
  const queries = [
    'placa de video', 'processador', 'monitor', 'ssd', 'memoria ram', 'notebook', 'placa mae',
    'cooler', 'water cooler', 'gabinete', 'fonte', 'teclado', 'mouse', 'headset', 'fone de ouvido',
    'playstation 5', 'xbox series', 'nintendo switch',
  ];
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
          let price, oldPrice, expiresAt = null;
          if (a.offer && a.offer.price_with_discount) {
            price = +a.offer.price_with_discount;
            oldPrice = Math.max(+a.price_with_discount || 0, +a.old_price || 0);
            if (a.offer.ends_at) expiresAt = new Date(a.offer.ends_at * 1000).toISOString();
          } else {
            price = +(a.price_with_discount || a.price);
            oldPrice = +(a.old_price || 0);
          }
          // histórico: todo produto visto conta, não só as ofertas (é o que dá o preço normal)
          seePrice({ store: 'kabum', title: a.title, menu: a.menu, brandHint: a.manufacturer?.name, price });
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
            expiresAt,
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
  const queries = [
    'placa de video', 'processador', 'monitor gamer', 'ssd nvme', 'memoria ram ddr5', 'memoria ram ddr4', 'notebook', 'placa mae',
    'water cooler', 'air cooler', 'gabinete gamer', 'fonte atx', 'teclado mecanico', 'mouse gamer', 'headset gamer',
    ['fone de ouvido bluetooth', 'electronics'], ['console', 'videogames'],
  ];
  const out = [];
  let ok = 0;
  for (const entry of queries) {
    const [q, dept = 'computers'] = Array.isArray(entry) ? entry : [entry];
    const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(q)}&pct-off=50-99&i=${dept}`;
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

// ------------------------------------------------------------------ cupons de loja
const COUPONS = new Map();
const OFF_TOPIC = /\b(pet|casa|decora|moda|beleza|perfum|supermercado|mercado(?! livre)|fralda|livro|roupa|cal[cç]ado|t[eê]nis|brinquedo|alimento|bebida|farm[aá]cia|sa[uú]de|watch|rel[oó]gio|viagem|passagem|hotel|ifood|delivery|uber)\b/i;
function addCoupon(c) {
  if (!c.code || !/^[A-Z0-9][A-Z0-9_-]{3,30}$/i.test(c.code) || NOT_CODE.test(c.code.toUpperCase())) return;
  if (OFF_TOPIC.test(`${c.title || ''} ${c.code}`)) return;
  const clean = (s) => s && s.replace(/\s*[:\-–]\s*cupom\s*$/i, '').trim();
  c.title = clean(c.title);
  c.discount = clean(c.discount);
  const key = `${c.store}|${c.code.toUpperCase()}`;
  const ex = COUPONS.get(key);
  // o mais recente vence (traz o texto atualizado do cupom)
  if (!ex || (c.postedAt || '') > (ex.postedAt || '')) COUPONS.set(key, { ...c, code: c.code.toUpperCase(), id: key });
}

// ------------------------------------------------------------------ Telegram (canais públicos de promoção)
// t.me/s/<canal> é a prévia pública do canal: HTML simples, sem login. É de onde vêm os posts do tipo
// "Processador AMD Ryzen 7 5700X - R$895 - Cupom BAIXOU - meli.la/...".
const TG_CHANNELS = (process.env.TELEGRAM_CHANNELS || 'pcdofafapromo,ofertasbenevides,ofertasdecomputador,EconoMister,LinksBrazil,gamerdasofertas,linguicapromocoes,ofertasportateis')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const tgText = (html) =>
  decodeHtml(
    html
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<a [^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g, ' $1 ')
      .replace(/<[^>]+>/g, '')
      .replace(/&#036;/g, '$')
  );
// códigos de cupom são sempre em MAIÚSCULAS nos posts; a palavra "cupom" pode vir de qualquer jeito
const COUPON_RE = /[Cc][Uu][Pp][Oo][MmNn][Ss]?\s*:?\s*([A-Z0-9][A-Z0-9_-]{3,30})\b(?:\s*\+\s*([A-Z0-9][A-Z0-9_-]{3,30})\b)?/;
const NOT_CODE = /^(HTTPS?|DESTA|DESSA|DESCONTO|LOJA|APP|NO|NA|PARA|VALIDO|ABAIXO|ACIMA|EXCLUSIVO|AQUI|LINK|OFF)$/;
const SKIP_LINK = /t\.me\/|telegram|nerdofertas|ofertou\.ai|promoavisa|whatsapp|instagram|bit\.ly\/grupo|linktr\.ee|tr\.ee\/|economisterpromocoes|ofertascriticalhits|x\.com\/|twitter\.com/i;

function parseTelegramPost(text, meta) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return;
  // "[Mercado Livre] Produto" (@ofertasportateis): a loja entre colchetes sai do título
  const unTag = (l) => l.replace(/^[^\p{L}\p{N}[]*\[[^\]]{2,30}\]\s*/u, '');
  const head = unTag(lines[0])
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s*[-–|]\s*(por\s*)?R\$\s*[\d.,]+.*$/i, '')
    .trim();
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"']+/g)].map((m) => m[0]).filter((u) => !SKIP_LINK.test(u));
  const url = urls[0];
  const store = (url && storeFromUrl(url)) || storeKey(head);
  // Post (ou edição de post) dizendo que esgotou: a oferta sai, e os cupons citados também.
  if (EXPIRED_WORDS.test(text)) {
    EXPIRED_IDS.add(`tg-${meta.channel}-${meta.postId}`);
    // aviso curto ("Esgotou MAPQHFAPEIC") = o cupom acabou; post de produto esgotado não derruba o cupom da loja
    const isNotice = !/R\$\s*\d/.test(text) || text.length < 160;
    if (isNotice) {
      for (const m of text.matchAll(/\b[A-Z0-9][A-Z0-9_-]{4,24}\b/g)) {
        if (!NOT_A_CODE.test(m[0]) && !/^\d+$/.test(m[0])) EXPIRED_CODES.add(m[0]);
      }
    }
    return;
  }

  // Post de cupom de loja: "Novo Cupom Mercado Livre — R$250 OFF EM R$ 999: ZB9MELI"
  if (/^(novo )?cupo[mn]s?\b|cupo[mn]s? (de )?(desconto )?(mercado livre|amazon|shopee|magalu|kabum|pichau|terabyte|aliexpress)/i.test(head) && store) {
    for (const l of lines.slice(1)) {
      const m = /(.*?(?:off|%|desconto).*?)[:\-–]\s*([A-Z0-9][A-Z0-9_-]{3,30})\s*$/i.exec(l.replace(/^[^\p{L}\p{N}R$]+/u, ''));
      if (m) addCoupon({ store, code: m[2], title: m[1].trim(), discount: m[1].trim(), url, postedAt: meta.postedAt, via: `@${meta.channel}` });
    }
    return;
  }

  // Post de produto. Formatos aceitos:
  //   "Processador X ... R$ 845 ... Cupom: ZB9MELI"               (preço com R$)
  //   "CHAMADA EM MAIÚSCULAS / Monitor X / de 749,00 por 399,05"  (@gamerdasofertas)
  const NUM = '([\\d.]+(?:,\\d{2})?)';
  const pm = new RegExp(`\\bpor\\s*:?\\s*(?:R\\$\\s*)?${NUM}`, 'i').exec(text) || new RegExp(`R\\$\\s*${NUM}`).exec(text);
  if (!pm || !store || !url) return;
  const price = brl(pm[1].includes(',') ? pm[1] : `${pm[1]},00`);
  // título: a primeira das linhas iniciais que parece produto (a 1ª pode ser só uma chamada)
  const title =
    lines
      .slice(0, 5)
      .map((l) => unTag(l).replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*[-–|]\s*(por\s*)?R\$\s*[\d.,]+.*$/i, '').trim())
      .find((l) => l.length > 12 && detectCategory(l)) || head;
  const cm = COUPON_RE.exec(text);
  const coupon = cm ? [cm[1], cm[2]].filter((c) => c && !NOT_CODE.test(c)).join(' + ') || null : null;
  const om = new RegExp(`\\b(?:de|era)\\s*:?\\s*(?:R\\$\\s*)?${NUM}\\s*(?:por|→|->)`, 'i').exec(text);
  return makeDeal({
    id: `tg-${meta.channel}-${meta.postId}`,
    store,
    title,
    price,
    oldPrice: om ? brl(om[1].includes(',') ? om[1] : `${om[1]},00`) : 0,
    coupon,
    url,
    image: meta.image,
    source: 'Telegram',
    via: `@${meta.channel}`,
    postedAt: meta.postedAt,
    allowRef: true,
    radar: true,
  });
}

// Prévia pública t.me/s/<canal> → posts (texto já convertido por tgText).
// withEmpty: inclui posts sem texto (só foto), para a paginação por "before" não pular ids.
function parseTmePage(html, { withEmpty = false } = {}) {
  const out = [];
  for (const p of html.split('tgme_widget_message_wrap').slice(1)) {
    const dp = /data-post="([^"/]+)\/(\d+)"/.exec(p);
    if (!dp) continue;
    const body = /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/.exec(p)?.[1];
    if (!body && !withEmpty) continue;
    const dt = /datetime="([^"]+)"/.exec(p)?.[1];
    out.push({
      channel: dp[1],
      postId: +dp[2],
      postedAt: dt ? new Date(dt).toISOString() : null,
      image: /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/.exec(p)?.[1] || null,
      text: body ? tgText(body) : '',
    });
  }
  return out;
}

async function telegram() {
  const out = [];
  let ok = 0;
  await Promise.all(
    TG_CHANNELS.map(async (ch) => {
      let before = '';
      for (let page = 0; page < 4; page++) {
        try {
          const html = await get(`https://t.me/s/${ch}${before ? `?before=${before}` : ''}`);
          ok++;
          const posts = parseTmePage(html, { withEmpty: true });
          if (!posts.length) break;
          let minId = Infinity;
          for (const p of posts) {
            minId = Math.min(minId, p.postId);
            if (!p.text) continue;
            const d = parseTelegramPost(p.text, p);
            if (d) out.push(d);
          }
          if (!isFinite(minId)) break;
          before = String(minId);
          await sleep(500);
        } catch (e) {
          log('telegram', ch, e.message);
          break;
        }
      }
    })
  );
  // o mesmo produto costuma ser postado em vários canais: fica o primeiro
  const uniq = new Map();
  for (const d of out.sort((a, b) => (a.postedAt || '').localeCompare(b.postedAt || ''))) {
    const k = `${d.store}|${strip(d.title).slice(0, 50)}|${Math.round(d.price)}`;
    if (!uniq.has(k)) uniq.set(k, d);
  }
  const deals = [...uniq.values()];
  log(`telegram: ${deals.length} itens de hardware (${deals.filter((d) => !d.radar).length} com 50%+), ${COUPONS.size} cupons até agora`);
  return { deals, ok: ok > 0 };
}

// ------------------------------------------------------------------ navegador headless
// Pichau e Terabyte ficam atrás do Cloudflare, que recusa o fetch do Node e o curl,
// mas libera um Chrome de verdade (mesma técnica do garimpo-vagas).

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
function findBrowser() {
  const c = [
    process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return c.find((p) => p && existsSync(p)) || null;
}
const BROWSER = findBrowser();
let busy = 0;
const queue = [];
async function slot(fn) {
  if (busy >= 2) await new Promise((r) => queue.push(r));
  busy++;
  try {
    return await fn();
  } finally {
    busy--;
    queue.shift()?.();
  }
}
function browserOnce(url, waitMs) {
  const profile = mkdtempSync(join(tmpdir(), 'garimpo-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled', `--user-agent=${BROWSER_UA}`, '--lang=pt-BR',
    `--user-data-dir=${profile}`, `--virtual-time-budget=${waitMs}`, '--dump-dom', url,
  ];
  if (process.platform === 'linux') args.unshift('--no-sandbox', '--disable-dev-shm-usage');
  return new Promise((resolve, reject) => {
    execFile(BROWSER, args, { maxBuffer: 1 << 27, windowsHide: true, timeout: 120000 }, (err, stdout) => {
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500);
      if (err && !stdout) return reject(new Error(`navegador falhou: ${err.killed ? 'timeout' : err.message.split('\n')[0].slice(0, 100)}`));
      resolve(stdout);
    });
  });
}
async function browserHtml(url, { waitMs = 15000, ok } = {}) {
  if (!BROWSER) throw new Error('nenhum Chrome/Edge encontrado');
  // o desafio do Cloudflare às vezes passa na 2ª/3ª tentativa, com mais tempo para o JS rodar
  for (let i = 0; i < 3; i++) {
    const html = await slot(() => browserOnce(url, waitMs + i * 10000)).catch((e) => (i === 2 ? Promise.reject(e) : ''));
    if (html && (!ok || ok(html))) return html;
    await sleep(4000 + i * 4000);
  }
  throw new Error('bloqueado (desafio do Cloudflare não passou)');
}

// ------------------------------------------------------------------ Pichau (via navegador)
async function pichau() {
  const paths = [
    'hardware/placa-de-video', 'hardware/placa-de-video?page=2', 'hardware/processadores', 'hardware/memorias',
    'hardware/ssd', 'hardware/placa-mae', 'monitores', 'notebooks',
  ];
  const out = [];
  let ok = 0;
  const seen = new Set();
  await Promise.all(
    paths.map(async (p) => {
      try {
        const html = await browserHtml(`https://www.pichau.com.br/${p}`, { ok: (h) => h.includes('data-cy="list-product"') });
        ok++;
        let n = 0;
        for (const block of html.split('data-cy="list-product" href="').slice(1)) {
          const card = block.slice(0, 7000);
          const href = card.slice(0, card.indexOf('"'));
          if (seen.has(href)) continue;
          seen.add(href);
          n++;
          const title = decodeHtml(/<h2[^>]*>([^<]+)<\/h2>/.exec(card)?.[1] || /title="([^"]+)"/.exec(card)?.[1] || '');
          const oldPrice = brl(/strikeThrough">R\$(?:&nbsp;|\s)?([\d.,]+)/.exec(card)?.[1] || '');
          const price = brl(/price_vista">R\$(?:&nbsp;|\s)?([\d.,]+)/.exec(card)?.[1] || '');
          const img = /<img[^>]+src="(https:\/\/media\.pichau[^"]+)"/.exec(card)?.[1];
          const d = makeDeal({ id: `pc-${href.replace(/^\//, '').slice(0, 90)}`, store: 'pichau', title, price, oldPrice, url: `https://www.pichau.com.br${href}`, image: img, source: 'Pichau' });
          if (d) out.push(d);
        }
        log(`pichau ${p}: ${n} produtos`);
      } catch (e) {
        log('pichau', p, e.message);
      }
    })
  );
  log(`pichau: ${out.length} aprovadas`);
  return { deals: out, ok: ok > 0 };
}

// ------------------------------------------------------------------ Terabyte (via navegador)
async function terabyte() {
  const paths = ['hardware/placas-de-video', 'hardware/processadores', 'hardware/memorias', 'hardware/hard-disk/ssd', 'hardware/placas-mae', 'monitores', 'notebooks'];
  const out = [];
  let ok = 0;
  const seen = new Set();
  await Promise.all(
    paths.map(async (p) => {
      try {
        const html = await browserHtml(`https://www.terabyteshop.com.br/${p}`, { ok: (h) => h.includes('product-item__name') });
        ok++;
        let n = 0;
        const re = /class="product-item__name"/g;
        let hit;
        while ((hit = re.exec(html))) {
          const card = html.slice(hit.index, hit.index + 5000);
          const m = /href="(https:\/\/www\.terabyteshop\.com\.br\/produto\/(\d+)\/[^"]+)" title="([^"]+)"/.exec(card);
          if (!m || seen.has(m[2])) continue;
          seen.add(m[2]);
          n++;
          const oldPrice = brl(/old-price">\s*<del>De:\s*<span>R\$\s?([\d.,]+)/.exec(card)?.[1] || '');
          const price = brl(/new-price">\s*<span>R\$\s?([\d.,]+)/.exec(card)?.[1] || '');
          // a imagem vem logo antes do nome no card
          const before = html.slice(Math.max(0, hit.index - 2500), hit.index);
          const imgs = [...before.matchAll(/src="(https:\/\/img\.terabyteshop\.com\.br\/produto\/[^"]+)"/g)];
          const img = imgs.length ? imgs[imgs.length - 1][1] : null;
          const d = makeDeal({ id: `tb-${m[2]}`, store: 'terabyte', title: fixMojibake(decodeHtml(m[3])), price, oldPrice, url: m[1], image: img, source: 'Terabyte' });
          if (d) out.push(d);
        }
        log(`terabyte ${p}: ${n} produtos`);
      } catch (e) {
        log('terabyte', p, e.message);
      }
    })
  );
  log(`terabyte: ${out.length} aprovadas`);
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

const money = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asciiTitle = (s) => s.slice(0, 120).replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '').trim();
async function ntfy(topic, { title, body, prio = 3, tags, click, image }) {
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body,
      headers: {
        Title: asciiTitle(title),
        Priority: String(prio),
        ...(tags ? { Tags: tags } : {}),
        ...(click ? { Click: click } : {}),
        ...(image ? { Attach: image } : {}),
        ...(SITE_URL ? { Actions: `view, Ver no Garimpo, ${SITE_URL}` } : {}),
      },
    });
  } catch (e) {
    log('ntfy', e.message);
  }
}

// Push para o celular (app ntfy). Tópicos: <base> e <base>-<categoria> para 50%+,
// <base>-radar para posts de cupom em hardware, <base>-cupons para cupons de loja.
async function notify(newDeals, newRadar, newCoupons, topic = NTFY_TOPIC) {
  if (!topic) return;
  const best = newDeals.filter((d) => d.discount >= NTFY_MIN).sort((a, b) => b.discount - a.discount).slice(0, 15);
  for (const d of best) {
    const msg = {
      title: d.title,
      body: `${d.discount}% OFF • R$ ${money(d.price)} (era R$ ${money(d.oldPrice)})\n${STORES[d.store]}${d.coupon ? ` • cupom ${d.coupon}` : ''}`,
      prio: d.discount >= 80 ? 5 : d.discount >= 70 ? 4 : 3,
      tags: `${d.category},${d.store},d${Math.floor(d.discount / 10) * 10}`,
      click: d.url,
      image: d.image,
    };
    await ntfy(topic, msg);
    await ntfy(`${topic}-${d.category}`, msg);
  }
  for (const d of newRadar.slice(0, 15)) {
    await ntfy(`${topic}-radar`, {
      title: d.title,
      body: `R$ ${money(d.price)}${d.coupon ? ` com cupom ${d.coupon}` : ''} • ${STORES[d.store]}${d.via ? ` • ${d.via}` : ''}`,
      tags: `${d.category},${d.store},radar`,
      click: d.url,
      image: d.image,
    });
  }
  for (const c of newCoupons.slice(0, 10)) {
    await ntfy(`${topic}-cupons`, { title: `Cupom ${STORES[c.store]}: ${c.code}`, body: c.title || c.discount || '', tags: `ticket,${c.store}`, click: c.url });
  }
  const n = best.length + Math.min(15, newRadar.length) + Math.min(10, newCoupons.length);
  if (n) log(`ntfy: ${n} notificações enviadas`);
}

function dedupe(list) {
  const byKey = new Map();
  for (const d of list) {
    const s = d.specs || {};
    const model =
      d.category === 'cpu' && s.modelo ? s.modelo
      : d.category === 'gpu' && s.chip ? `${d.brand}|${s.chip}|${s.vram}|${strip(d.title).replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 8).join(' ')}`
      : strip(d.title).slice(0, 60);
    const key = `${d.store}|${d.category}|${model}|${Math.round(d.price / 30)}`;
    const ex = byKey.get(key);
    // mantém o mais barato; em empate, o que tem cupom
    if (!ex || d.price < ex.price || (d.price === ex.price && d.coupon && !ex.coupon)) {
      if (ex) d.firstSeen = ex.firstSeen < d.firstSeen ? ex.firstSeen : d.firstSeen;
      byKey.set(key, d);
    }
  }
  return [...byKey.values()];
}

// ------------------------------------------------------------------ placa-mãe: slots pela ficha técnica
// Quantos slots PCIe x16 (dá pra ligar mais de uma placa de vídeo?), de que geração e quantos M.2 quase nunca vêm no título.
// A ficha técnica do KaBuM traz os dois. Para ofertas de outras lojas, procura o mesmo modelo no catálogo do KaBuM.
// O resultado fica guardado na oferta (campo "sheet") e é reaproveitado nas rodadas seguintes.
const KB_API = 'https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products';
const SLOT_KEYS = ['pcie16', 'm2', 'pcie'];
// palavras que distinguem um modelo de outro da mesma linha (TUF x Prime, Elite x Eagle...)
const MOBO_SERIES = new Set(['tuf', 'rog', 'strix', 'prime', 'proart', 'tomahawk', 'mortar', 'pro', 'plus', 'aorus', 'elite', 'eagle', 'ultra', 'master', 'steel', 'legend', 'phantom', 'riptide', 'lightning', 'edge', 'carbon', 'max', 'ds3h', 'ax', 'x', 'v2', 'ii', 'lite', 'challenger', 'ice', 'hero', 'extreme', 'apex', 'crosshair', 'maximus', 'tachyon', 'aero', 'vision', 'taichi', 'nova', 'creator', 'ace', 'godlike', 'unify', 'torpedo', 'bazooka', 'vdh', 'k', 'p', 'a', 'e', 'f', 'm', 'h', 'i', 'g']);
function moboModel(title) {
  const t = strip(title).replace(/[,()/]/g, ' ');
  const words = t.split(' ').filter(Boolean);
  const chip = words.find((w) => /^[abhxz]\d{3}m?(-|$)/.test(w));
  const parts = new Set(words.filter((w) => w.length >= 8 && /\d/.test(w) && /[a-z]/.test(w) && w.includes('-')));
  const series = new Set(words.flatMap((w) => w.split('-')).filter((w) => MOBO_SERIES.has(w)));
  return { chip, parts, series, brand: detectBrand('mobo', title) };
}
function sameMobo(a, b) {
  const A = moboModel(a), B = moboModel(b);
  if ([...A.parts].some((p) => B.parts.has(p))) return true; // mesmo código do fabricante
  if (!A.chip || A.chip !== B.chip || !A.brand || A.brand !== B.brand) return false;
  return A.series.size === B.series.size && [...A.series].every((w) => B.series.has(w));
}
async function kabumSheet(id) {
  const j = await get(`${KB_API}/${id}`, { json: true, headers: { accept: 'application/json' } });
  const a = j.attributes || {};
  const s = moboSlotsFromSpec(a.html || '', a.description || '');
  if (s.pcieGen) s.pcie = `PCIe ${s.pcieGen}.0`;
  delete s.pcieGen;
  return s;
}
async function enrichMobos(results, prev) {
  const prevById = new Map([...(prev.deals || []), ...(prev.radar || [])].map((d) => [d.id, d]));
  const mobos = Object.values(results).flatMap((r) => r.deals).filter((d) => d.category === 'mobo');
  let fetched = 0, found = 0;
  for (const d of mobos) {
    const p = prevById.get(d.id);
    if (p?.sheet) {
      d.sheet = p.sheet;
      for (const k of SLOT_KEYS) if (p.specs?.[k] != null) d.specs[k] = p.specs[k];
      continue;
    }
    if (fetched >= 40) continue; // limite por rodada; o resto fica para a próxima
    fetched++;
    try {
      let id = d.id.startsWith('kb-') ? d.id.slice(3) : null;
      if (!id) {
        const q = strip(d.title).replace(/placa[ -]?mae|motherboard|gamer/g, '').split(/[,(]/)[0].trim().split(' ').slice(0, 6).join(' ');
        const j = await get(`${KB_API}?query=${encodeURIComponent(q)}&page_size=20&page_number=1`, { json: true, headers: { accept: 'application/json' } });
        id = (j.data || []).find((it) => it.attributes?.title && sameMobo(d.title, it.attributes.title))?.id || null;
      }
      const s = id ? await kabumSheet(id) : {};
      for (const k of SLOT_KEYS) if (s[k] != null) d.specs[k] = s[k];
      d.sheet = id ? `kb-${id}` : 'sem ficha';
      if (s.pcie16 != null || s.m2 != null) found++;
      await sleep(300);
    } catch (e) {
      log('ficha placa-mãe', d.id, e.message);
    }
  }
  if (mobos.length) log(`placas-mãe: ${mobos.length} ofertas, ${fetched} fichas consultadas, ${found} com slots identificados`);
}

// PARTIAL=1 (versão local): grava o resultado a cada fonte concluída e imprime "@@partial",
// para a página mostrar as ofertas na hora. Sem PARTIAL (GitHub), grava uma vez só no fim.
const PARTIAL = !!process.env.PARTIAL;

// ------------------------------------------------------------------ histórico de preços (só versão local)
const LOCAL_DIR = process.env.DATA_FILE ? dirname(resolve(process.env.DATA_FILE)) : null;
const HIST_FILE = LOCAL_DIR && join(LOCAL_DIR, 'history.json');
const EXT_FILE = LOCAL_DIR && join(LOCAL_DIR, 'external-history.json');
let HIST = null; // carregado no main() quando há DATA_FILE
let EXT = {};
const STATE_FILE = LOCAL_DIR && join(LOCAL_DIR, 'state.json');
const MEM = () => ({ expiredIds: EXPIRED_IDS, expiredCodes: EXPIRED_CODES, refs: REFS });
function seePrice({ store, title, menu, brandHint, price, coupon = false, category, brand, specs }) {
  if (!HIST || !(price > 0) || !title) return;
  category ||= detectCategory(title, menu);
  if (!category) return;
  brand ||= detectBrand(category, title, brandHint);
  if (!brand) return;
  const key = modelKey({ title, category, brand, specs: specs || extractSpecs(category, title) });
  if (key) recordPrice(HIST, { key, title, category, store, price, coupon }, dayOf(new Date().toISOString()));
}
async function saveHistory(results) {
  if (!HIST) return;
  for (const r of Object.values(results))
    for (const d of r.deals) seePrice({ store: d.store, title: d.title, price: d.price, coupon: !!d.coupon, category: d.category, brand: d.brand, specs: d.specs });
  prune(HIST, dayOf(new Date().toISOString()));
  await saveJson(HIST_FILE, HIST);
  log(`histórico: ${Object.keys(HIST).length} modelos`);
}
const DIRECT = { kabum: 'kb-', amazon: 'az-', patoloco: 'pl-', pichau: 'pc-', terabyte: 'tb-' };

function isExpired(d, nowMs) {
  if (EXPIRED_IDS.has(d.id)) return true;
  if (d.expiresAt && Date.parse(d.expiresAt) < nowMs) return true;
  // oferta que dependia de um cupom que esgotou
  if (d.coupon && !d.coupon.includes('+') && EXPIRED_CODES.has(d.coupon.toUpperCase())) return true;
  return false;
}

// Oferta guardada de rodadas anteriores: se as regras de categoria mudaram (ex.: mouse saiu de
// "periferico" e virou "mouse"), atualiza categoria, marca e specs pelo título.
function reclassify(d) {
  const c = detectCategory(d.title);
  if (!c || c === d.category) return d;
  const brand = detectBrand(c, d.title);
  return brand ? { ...d, category: c, brand, specs: extractSpecs(c, d.title) } : d;
}

// Junta o que já foi coletado nesta rodada com o anterior e aplica as regras de validade.
// opts.hist / opts.ext (versão local): confere o desconto contra o histórico de preços e tira as infladas.
function build(prev, results, now, { hist, ext } = {}) {
  const nowMs = Date.parse(now);
  const prevAll = [...(prev.deals || []), ...(prev.radar || [])];
  const prevById = new Map(prevAll.map((d) => [d.id, d]));
  const current = new Map();
  for (const r of Object.values(results)) {
    for (const d of r.deals) {
      const p = prevById.get(d.id);
      current.set(d.id, { ...d, firstSeen: p?.firstSeen || now, lastSeen: now });
    }
  }
  // lojas lidas direto que funcionaram nesta rodada: se o item sumiu, saiu de promoção
  const directOk = new Set(Object.entries(DIRECT).filter(([k]) => results[k]?.ok).map(([, p]) => p));
  const cutoff = nowMs - KEEP_HOURS * 3600e3;
  for (const d of prevAll) {
    if (current.has(d.id)) continue;
    if (directOk.has(d.id.slice(0, 3))) continue;
    if (Date.parse(d.lastSeen) < cutoff) continue;
    current.set(d.id, reclassify(d));
  }
  const all = [...current.values()].filter((d) => !isExpired(d, nowMs));
  const radarCutoff = nowMs - RADAR_HOURS * 3600e3;
  let deals = dedupe(all.filter((d) => !d.radar));
  let removedInflated;
  if (hist) {
    const v = verify(deals, hist, ext || {}, MIN_DISCOUNT);
    deals = v.kept;
    removedInflated = v.removed;
  }
  let radar = dedupe(all.filter((d) => d.radar && Date.parse(d.postedAt || d.firstSeen) >= radarCutoff));
  if (hist) {
    // radar com histórico: desconto real conhecido → sobe para a 50%+ ou sai de tudo
    const r = checkRadar(radar, hist, ext || {}, MIN_DISCOUNT);
    radar = r.kept;
    deals = deals.concat(r.promoted);
    removedInflated += r.removed;
  }
  deals.sort((a, b) => b.discount - a.discount);
  radar.sort((a, b) => (b.postedAt || b.firstSeen).localeCompare(a.postedAt || a.firstSeen));

  // cupons: os desta rodada + os anteriores ainda válidos
  const couponCut = nowMs - COUPON_HOURS * 3600e3;
  const prevCoupons = new Map((prev.coupons || []).map((c) => [c.id, c]));
  const merged = new Map(prevCoupons);
  for (const [k, c] of COUPONS) merged.set(k, { ...c, firstSeen: prevCoupons.get(k)?.firstSeen || c.firstSeen || now });
  const coupons = [...merged.values()]
    .filter((c) => !EXPIRED_CODES.has(c.code))
    .filter((c) => Date.parse(c.postedAt || c.firstSeen || now) >= couponCut)
    .sort((a, b) => (b.postedAt || b.firstSeen).localeCompare(a.postedAt || a.firstSeen));

  const status = Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { ok: r.ok, count: r.deals.length }]));
  if (hist) status.historico = { ok: true, count: removedInflated };
  return {
    prevById,
    prevCoupons,
    payload: {
      updatedAt: now,
      minDiscount: MIN_DISCOUNT,
      ntfyTopic: NTFY_TOPIC || null,
      ntfyMin: NTFY_MIN,
      telegramChannels: TG_CHANNELS,
      sources: status,
      stores: STORES,
      count: deals.length,
      ...(hist ? { removedInflated } : {}),
      deals,
      radar,
      coupons,
    },
  };
}

let writing = Promise.resolve();
function save(payload) {
  // grava num temporário e troca de uma vez: quem estiver lendo nunca pega o arquivo pela metade
  writing = writing.then(async () => {
    const out = fileURLToPath(OUT);
    await mkdir(dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(payload));
    for (let i = 0; ; i++) {
      try {
        await rename(tmp, out);
        break;
      } catch (e) {
        if (i >= 9) throw e; // Windows: arquivo aberto por um leitor; tenta de novo
        await sleep(100);
      }
    }
  });
  return writing;
}

async function main() {
  let st = null;
  if (HIST_FILE) {
    HIST = await loadJson(HIST_FILE, {});
    EXT = await loadJson(EXT_FILE, {});
    // esgotados vistos pelo live (ou pela coleta anterior) e referências do KaBuM continuam valendo
    st = await loadState(STATE_FILE);
    applyState(st, MEM());
  }
  const hx = () => (HIST ? { hist: HIST, ext: EXT } : {});
  const prev = await loadPrevious();
  const now = new Date().toISOString();
  const results = {};
  const partial = async () => {
    if (!PARTIAL) return;
    const { payload } = build(prev, results, new Date().toISOString(), hx());
    payload.partial = true;
    await save(payload);
    console.log('@@partial');
  };
  // KaBuM primeiro: o catálogo dele alimenta os preços de referência usados nos posts de cupom
  try {
    results.kabum = await kabum();
  } catch (e) {
    log('kabum falhou', e.message);
    results.kabum = { deals: [], ok: false };
  }
  buildRefs();
  await partial();
  const sources = { promobit, telegram, amazon, patoloco, ...(process.env.SKIP_BROWSER ? {} : { pichau, terabyte }) };
  await Promise.all(
    Object.entries(sources).map(async ([k, fn]) => {
      try {
        results[k] = await fn();
      } catch (e) {
        log(k, 'falhou', e.message);
        results[k] = { deals: [], ok: false };
      }
      await partial();
    })
  );

  try {
    await enrichMobos(results, prev);
  } catch (e) {
    log('fichas de placa-mãe falharam', e.message);
  }
  if (HIST) {
    // Zoom/Buscapé: só para o que passou dos 50% pelo preço anunciado e cujo histórico nosso ainda não encheu
    try {
      const stated = build(prev, results, now).payload.deals.sort((a, b) => b.discount - a.discount);
      await enrichExternal(stated, { hist: HIST, ext: EXT, fetchHtml: (u) => get(u, { tries: 1 }), now, log });
      await saveJson(EXT_FILE, EXT);
    } catch (e) {
      log('externo falhou', e.message);
    }
  }
  try {
    await saveHistory(results);
  } catch (e) {
    log('histórico não foi gravado', e.message); // a coleta segue mesmo assim
  }
  const { payload, prevById, prevCoupons } = build(prev, results, now, hx());
  const { deals, radar, coupons } = payload;
  const newDeals = deals.filter((d) => !prevById.has(d.id));
  const newRadar = radar.filter((d) => !prevById.has(d.id));
  const newCoupons = prev.updatedAt ? coupons.filter((c) => !prevCoupons.has(c.id)) : [];
  await notify(newDeals, prev.updatedAt ? newRadar : [], newCoupons);
  if (st) await saveJson(STATE_FILE, captureState(await loadState(STATE_FILE), MEM(), now, KEEP_HOURS));
  await save(payload);
  log(
    `total: ${deals.length} ofertas 50%+ (${newDeals.length} novas), ${radar.length} no radar, ${coupons.length} cupons` +
      ` · expirados nesta rodada: ${EXPIRED_IDS.size} ofertas, ${EXPIRED_CODES.size} códigos` +
      (HIST ? ` · ${payload.removedInflated} removidas por preço inflado` : '')
  );
}

export {
  makeDeal, parseTelegramPost, parseTmePage, tgText, build, save, notify, get, browserHtml, log, sleep, dedupe,
  EXPIRED_IDS, EXPIRED_CODES, COUPONS, REFS, TG_CHANNELS, MIN_DISCOUNT, KEEP_HOURS,
};

// só coleta quando executado direto (node scraper/scrape.mjs); importado pelo servidor ou pelos testes, não
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
