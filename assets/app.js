// Garimpo — front-end (vanilla JS, sem build)

const DATA_URL = 'data/deals.json';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ------------------------------------------------------------------ catálogo
const STORES = {
  amazon: { name: 'Amazon', c: '#ff9900' },
  kabum: { name: 'KaBuM!', c: '#ff6500' },
  pichau: { name: 'Pichau', c: '#e3262f' },
  terabyte: { name: 'Terabyte', c: '#25a8e0' },
  patoloco: { name: 'Pato Loco', c: '#ffc61a' },
  gk: { name: 'GK Informática', c: '#22c55e' },
  magalu: { name: 'Magalu', c: '#0086ff' },
  mercadolivre: { name: 'Mercado Livre', c: '#ffe600' },
  shopee: { name: 'Shopee', c: '#ee4d2d' },
  aliexpress: { name: 'AliExpress', c: '#ff4747' },
};

const ICON = {
  all: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  gpu: '<rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="9" cy="11.5" r="3"/><circle cx="16" cy="11.5" r="2"/><path d="M5 17v3M9 17v3"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  notebook: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4z"/><path d="M2 19h20l-2-4H4z"/>',
  ssd: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h6M7 13.5h4M17 10v4"/>',
  ram: '<path d="M3 7h18v8H3z"/><path d="M6 15v3M10 15v3M14 15v3M18 15v3M7 10h2M11 10h2M15 10h2"/>',
  mobo: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="6" height="6" rx="1"/><path d="M16 7v4M16 14h2M7 17h10"/>',
  periferico: '<path d="M7 7h10a5 5 0 0 1 5 5v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a5 5 0 0 1 5-5z"/><path d="M7 10v3M5.5 11.5h3M16 11h.01M18 13h.01"/>',
};

const CATS = [
  { id: 'all', label: 'Tudo' },
  { id: 'gpu', label: 'Placas de vídeo', short: 'GPU' },
  { id: 'cpu', label: 'Processadores', short: 'CPU' },
  { id: 'monitor', label: 'Monitores', short: 'Monitor' },
  { id: 'notebook', label: 'Notebooks', short: 'Notebook' },
  { id: 'ssd', label: 'SSD', short: 'SSD' },
  { id: 'ram', label: 'Memória RAM', short: 'RAM' },
  { id: 'mobo', label: 'Placas-mãe', short: 'Placa-mãe' },
  { id: 'periferico', label: 'Periféricos', short: 'Periféricos' },
];
const catLabel = (id) => CATS.find((c) => c.id === id)?.label || id;

const gb = (v) => (v >= 1000 ? `${+(v / 1024).toFixed(1)} TB` : `${v} GB`);
const inchBucket = (v) => (v <= 24 ? 'até 24"' : v <= 27 ? '25–27"' : v <= 32 ? '28–32"' : '34" ou mais');
const hzBucket = (v) => (v < 100 ? '60–75 Hz' : v < 144 ? '100–120 Hz' : v < 200 ? '144–180 Hz' : v < 300 ? '200–280 Hz' : '300 Hz+');
const order = (list) => (a, b) => list.indexOf(a) - list.indexOf(b);

// Filtros específicos de cada categoria: [chave, rótulo, formatação/bucket, ordenação]
const FACETS = {
  gpu: [
    ['fabricante', 'Chip'],
    ['serie', 'Série'],
    ['chip', 'Modelo'],
    ['vram', 'Memória (VRAM)', gb, 'num'],
    ['memoria', 'Tipo de memória'],
  ],
  cpu: [
    ['fabricante', 'Fabricante'],
    ['linha', 'Linha'],
    ['socket', 'Soquete'],
    ['x3d', '3D V-Cache', (v) => (v === 'Sim' ? 'Só X3D' : v)],
  ],
  monitor: [
    ['polegadas', 'Tamanho', inchBucket, order(['até 24"', '25–27"', '28–32"', '34" ou mais'])],
    ['resolucao', 'Resolução', null, order(['HD', 'Full HD', 'UltraWide FHD', 'QHD 1440p', 'UltraWide QHD', '4K UHD', '5K'])],
    ['hz', 'Taxa de atualização', hzBucket, order(['60–75 Hz', '100–120 Hz', '144–180 Hz', '200–280 Hz', '300 Hz+'])],
    ['painel', 'Tipo de tela'],
    ['curvo', 'Formato'],
  ],
  notebook: [
    ['ram', 'Memória RAM', gb, 'num'],
    ['armazenamento', 'Armazenamento', gb, 'num'],
    ['processador', 'Processador'],
    ['dedicada', 'Placa de vídeo'],
    ['gpu', 'GPU'],
    ['hz', 'Tela (Hz)', (v) => `${v} Hz`, 'num'],
    ['tela', 'Tamanho da tela', (v) => `${v}"`, 'num'],
  ],
  ssd: [
    ['capacidade', 'Capacidade', gb, 'num'],
    ['interface', 'Interface'],
    ['geracao', 'Geração PCIe'],
  ],
  ram: [
    ['capacidade', 'Capacidade', gb, 'num'],
    ['tipo', 'Tipo'],
    ['frequencia', 'Frequência', (v) => `${v} MHz`, 'num'],
    ['uso', 'Uso'],
    ['kit', 'Formato'],
  ],
  mobo: [
    ['plataforma', 'Plataforma'],
    ['chipset', 'Chipset'],
    ['ddr', 'Memória'],
    ['formato', 'Formato'],
    ['wifi', 'Wi-Fi'],
  ],
  periferico: [
    ['tipo', 'Tipo'],
    ['conexao', 'Conexão'],
    ['plataforma', 'Plataforma (controles)'],
    ['switch', 'Teclado'],
  ],
};

const facetValue = (deal, f) => {
  const raw = deal.specs?.[f[0]];
  if (raw == null) return null;
  return f[2] ? f[2](raw) : String(raw);
};

// Chips de especificação mostrados no card
function specLine(d) {
  const s = d.specs || {};
  const out = [];
  const push = (v) => v && out.push(v);
  switch (d.category) {
    case 'gpu': push(s.chip); push(s.vram && `${s.vram} GB`); push(s.memoria); break;
    case 'cpu': push(s.linha); push(s.modelo); push(s.socket); break;
    case 'monitor': push(s.polegadas && `${s.polegadas}"`); push(s.resolucao); push(s.hz && `${s.hz} Hz`); push(s.painel); break;
    case 'notebook': push(s.processador); push(s.ram && `${s.ram} GB RAM`); push(s.armazenamento && gb(s.armazenamento)); push(s.gpu); push(s.hz && `${s.hz} Hz`); break;
    case 'ssd': push(s.capacidade && gb(s.capacidade)); push(s.interface); push(s.geracao); break;
    case 'ram': push(s.capacidade && `${s.capacidade} GB`); push(s.tipo); push(s.frequencia && `${s.frequencia} MHz`); push(s.uso === 'Notebook' ? 'SODIMM' : null); break;
    case 'mobo': push(s.chipset); push(s.ddr); push(s.formato); push(s.wifi); break;
    case 'periferico': push(s.tipo); push(s.conexao); push(s.plataforma); push(s.switch); break;
  }
  return out.slice(0, 5);
}

// ------------------------------------------------------------------ estado
const DEFAULT = { view: 'deals', cat: 'all', q: '', disc: 50, pmin: '', pmax: '', coupon: false, stores: [], brands: [], spec: {}, sort: 'disc' };
let S = { ...DEFAULT, ...readHash() };
let ALL = [];
let RADAR = [];
let COUPONS = [];
let META = {};
const POOL = () => (S.view === 'radar' ? RADAR : ALL);
const when = (d) => d.postedAt || d.firstSeen;

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const o = {};
  if (['radar', 'coupons'].includes(p.get('v'))) o.view = p.get('v');
  if (p.get('cat')) o.cat = p.get('cat');
  if (p.get('q')) o.q = p.get('q');
  if (p.get('d')) o.disc = +p.get('d');
  if (p.get('min')) o.pmin = p.get('min');
  if (p.get('max')) o.pmax = p.get('max');
  if (p.get('cupom')) o.coupon = true;
  if (p.get('lojas')) o.stores = p.get('lojas').split(',');
  if (p.get('marcas')) o.brands = p.get('marcas').split(',');
  if (p.get('sort')) o.sort = p.get('sort');
  const spec = {};
  for (const [k, v] of p) if (k.startsWith('s.')) spec[k.slice(2)] = v.split('|');
  if (Object.keys(spec).length) o.spec = spec;
  return o;
}
function writeHash() {
  const p = new URLSearchParams();
  if (S.view !== 'deals') p.set('v', S.view);
  if (S.cat !== 'all') p.set('cat', S.cat);
  if (S.q) p.set('q', S.q);
  if (S.disc !== 50) p.set('d', S.disc);
  if (S.pmin) p.set('min', S.pmin);
  if (S.pmax) p.set('max', S.pmax);
  if (S.coupon) p.set('cupom', '1');
  if (S.stores.length) p.set('lojas', S.stores.join(','));
  if (S.brands.length) p.set('marcas', S.brands.join(','));
  if (S.sort !== 'disc') p.set('sort', S.sort);
  for (const [k, v] of Object.entries(S.spec)) if (v.length) p.set(`s.${k}`, v.join('|'));
  const h = p.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

// ------------------------------------------------------------------ filtragem
function baseFilter(d, skip) {
  if (skip !== 'cat' && S.cat !== 'all' && d.category !== S.cat) return false;
  if (S.view === 'deals' && d.discount < S.disc) return false;
  if (S.pmin && d.price < +S.pmin) return false;
  if (S.pmax && d.price > +S.pmax) return false;
  if (S.coupon && !d.coupon) return false;
  if (skip !== 'store' && S.stores.length && !S.stores.includes(d.store)) return false;
  if (skip !== 'brand' && S.brands.length && !S.brands.includes(d.brand)) return false;
  if (S.q) {
    const hay = norm(`${d.title} ${d.brand} ${STORES[d.store]?.name} ${specLine(d).join(' ')} ${d.coupon || ''}`);
    if (!norm(S.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (S.cat !== 'all') {
    for (const f of FACETS[S.cat] || []) {
      if (skip === `spec:${f[0]}`) continue;
      const sel = S.spec[f[0]];
      if (sel?.length && !sel.includes(facetValue(d, f))) return false;
    }
  }
  return true;
}

const SORTS = {
  disc: (a, b) => (b.discount ?? -1) - (a.discount ?? -1) || a.price - b.price,
  save: (a, b) => (b.oldPrice ? b.oldPrice - b.price : 0) - (a.oldPrice ? a.oldPrice - a.price : 0),
  new: (a, b) => (when(b) || '').localeCompare(when(a) || ''),
  low: (a, b) => a.price - b.price,
  high: (a, b) => b.price - a.price,
};

// ------------------------------------------------------------------ render
const grid = $('#grid');
const tpl = $('#cardTpl');
const ago = (iso) => {
  if (!iso) return '';
  const m = Math.max(0, (Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${Math.round(m)} min`;
  if (m < 60 * 24) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
};

function card(d) {
  const el = tpl.content.firstElementChild.cloneNode(true);
  const st = STORES[d.store] || { name: d.store, c: '#888' };
  el.style.setProperty('--c', st.c);
  const imgA = $('.card__img', el);
  imgA.href = d.url;
  imgA.dataset.cat = catLabel(d.category);
  const img = $('img', el);
  if (d.image) {
    img.src = d.image;
    img.alt = d.title;
    img.onerror = () => { img.remove(); imgA.classList.add('noimg'); };
  } else {
    img.remove();
    imgA.classList.add('noimg');
  }
  const badge = $('.badge', el);
  if (d.discount == null) {
    badge.textContent = d.coupon ? 'CUPOM' : 'RADAR';
    badge.classList.add('is-radar');
  } else {
    badge.textContent = `-${d.discount}%`;
    if (d.discount >= 70) badge.classList.add('is-insane');
    else if (d.discount >= 60) badge.classList.add('is-hot');
    else if (d.discount < 50) badge.classList.add('is-low');
  }
  if (when(d) && Date.now() - new Date(when(d)) < 3 * 3600e3) $('.fresh', el).hidden = false;
  const s = $('.store', el);
  s.textContent = st.name;
  s.style.setProperty('--c', st.c);
  $('.brand', el).textContent = d.brand;
  const t = $('time', el);
  t.dateTime = when(d) || '';
  t.textContent = ago(when(d));
  const a = $('.card__title a', el);
  a.href = d.url;
  a.textContent = d.title;
  a.title = d.title;
  $('.specs', el).append(...specLine(d).map((v) => Object.assign(document.createElement('li'), { textContent: v })));
  if (d.oldPrice) {
    $('.old', el).textContent = `R$ ${brl(d.oldPrice)}`;
    $('.save', el).textContent = `−R$ ${brl0(d.oldPrice - d.price)}`;
  } else {
    $('.old', el).textContent = d.coupon ? 'preço com cupom' : 'preço anunciado';
    $('.old', el).classList.add('is-label');
    $('.save', el).remove();
  }
  $('.now', el).innerHTML = `<small>R$</small>${brl(d.price)}`;
  if (d.via) {
    const v = Object.assign(document.createElement('span'), { className: 'via', textContent: `via ${d.via}` });
    $('.card__actions', el).after(v);
  }
  $('.go', el).href = d.url;
  if (d.coupon) {
    const c = $('.coupon', el);
    c.hidden = false;
    $('b', c).textContent = d.coupon;
    c.title = 'Copiar cupom';
    c.onclick = () => copy(d.coupon, c);
  }
  if (d.ref) {
    const r = $('.ref', el);
    r.hidden = false;
    r.textContent = `* "De" estimado: ${d.ref.toLowerCase()}.`;
  }
  return el;
}

function ticket(c) {
  const el = $('#couponTpl').content.firstElementChild.cloneNode(true);
  const st = STORES[c.store] || { name: c.store, c: '#888' };
  const s = $('.store', el);
  s.textContent = st.name;
  s.style.setProperty('--c', st.c);
  const t = $('time', el);
  t.dateTime = when(c) || '';
  t.textContent = ago(when(c));
  $('.ticket__title', el).textContent = c.discount || c.title || 'Cupom';
  if (c.rules || (c.title && c.title !== c.discount)) {
    const r = $('.ticket__rules', el);
    r.hidden = false;
    r.textContent = c.rules || c.title;
  }
  const b = $('.coupon', el);
  $('b', b).textContent = c.code;
  b.title = 'Copiar cupom';
  b.onclick = () => copy(c.code, b);
  if (c.url) {
    const g = $('.ticket__go', el);
    g.hidden = false;
    g.href = c.url;
  }
  const via = $('.ticket__via', el);
  via.textContent = c.via ? `via ${c.via}` : '';
  $('.ticket__foot', el).append(via);
  return el;
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn?.classList.add('is-copied');
  toast(`Cupom ${text} copiado`);
  setTimeout(() => btn?.classList.remove('is-copied'), 1800);
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2200);
}

function chip(label, pressed, onClick, extra = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.setAttribute('aria-pressed', String(pressed));
  if (extra.color) {
    const sw = document.createElement('i');
    sw.className = 'sw';
    sw.style.setProperty('--c', extra.color);
    b.append(sw);
  }
  b.append(label);
  if (extra.count != null) b.append(Object.assign(document.createElement('small'), { textContent: extra.count }));
  b.onclick = onClick;
  return b;
}

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const countBy = (list, fn) => {
  const m = new Map();
  for (const d of list) {
    const k = fn(d);
    if (k != null) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

function renderCats() {
  $('#cats').hidden = S.view === 'coupons';
  const pool = POOL().filter((d) => baseFilter(d, 'cat'));
  const counts = countBy(pool, (d) => d.category);
  const nav = $('#cats');
  nav.replaceChildren(
    ...CATS.map((c) => {
      const b = document.createElement('button');
      b.className = 'cat';
      b.type = 'button';
      b.setAttribute('aria-pressed', String(S.cat === c.id));
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[c.id]}</svg>${c.label}<small>${c.id === 'all' ? pool.length : counts.get(c.id) || 0}</small>`;
      b.onclick = () => { S.cat = c.id; S.spec = {}; update(); };
      return b;
    })
  );
}

function renderFacetGroup(container, title, entries) {
  if (!entries.length) return;
  const sec = document.createElement('section');
  sec.className = 'fgroup';
  sec.innerHTML = `<h3>${title}</h3>`;
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  wrap.append(...entries);
  sec.append(wrap);
  container.append(sec);
}

function renderFilters() {
  const isCoupons = S.view === 'coupons';
  $('#discGroup').hidden = S.view !== 'deals';
  for (const id of ['#pmin', '#onlyCoupon', '#brandChips', '#specFacets']) $(id).closest('.fgroup, #specFacets').hidden = isCoupons;
  // lojas
  const sc = isCoupons
    ? countBy(COUPONS.filter((c) => couponMatch(c, true)), (c) => c.store)
    : countBy(POOL().filter((d) => baseFilter(d, 'store')), (d) => d.store);
  $('#storeChips').replaceChildren(
    ...Object.entries(STORES).map(([k, v]) =>
      chip(v.name, S.stores.includes(k), () => { S.stores = toggle(S.stores, k); update(); }, { color: v.c, count: sc.get(k) || 0 })
    )
  );
  // marcas
  const bc = countBy(POOL().filter((d) => baseFilter(d, 'brand')), (d) => d.brand);
  for (const b of S.brands) if (!bc.has(b)) bc.set(b, 0);
  $('#brandChips').replaceChildren(
    ...[...bc.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([b, n]) => chip(b, S.brands.includes(b), () => { S.brands = toggle(S.brands, b); update(); }, { count: n }))
  );
  // specs da categoria
  const box = $('#specFacets');
  box.replaceChildren();
  if (S.cat !== 'all' && !isCoupons) {
    for (const f of FACETS[S.cat] || []) {
      const pool = POOL().filter((d) => baseFilter(d, `spec:${f[0]}`));
      const counts = countBy(pool, (d) => facetValue(d, f));
      const sel = S.spec[f[0]] || [];
      for (const v of sel) if (!counts.has(v)) counts.set(v, 0);
      if (!counts.size) continue;
      let keys = [...counts.keys()];
      if (f[3] === 'num') {
        const raw = new Map(pool.map((d) => [facetValue(d, f), d.specs[f[0]]]));
        keys.sort((a, b) => (raw.get(a) ?? 0) - (raw.get(b) ?? 0));
      } else if (typeof f[3] === 'function') keys.sort(f[3]);
      else keys.sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b, 'pt', { numeric: true }));
      renderFacetGroup(
        box,
        f[1],
        keys.map((v) =>
          chip(v, sel.includes(v), () => { S.spec = { ...S.spec, [f[0]]: toggle(sel, v) }; update(); }, { count: counts.get(v) })
        )
      );
    }
  }
  // atalhos de preço
  const presets = [[0, 500], [500, 1500], [1500, 3000], [3000, 6000], [6000, '']];
  $('#pricePresets').replaceChildren(
    ...presets.map(([a, b]) => {
      const lbl = b === '' ? `R$ ${brl0(a)}+` : a === 0 ? `até ${brl0(b)}` : `${brl0(a)}–${brl0(b)}`;
      const on = String(S.pmin || 0) === String(a) && String(S.pmax) === String(b);
      return chip(lbl, on, () => {
        if (on) { S.pmin = ''; S.pmax = ''; } else { S.pmin = a ? String(a) : ''; S.pmax = String(b); }
        syncInputs();
        update();
      });
    })
  );
}

function activeTags() {
  const tags = [];
  const add = (label, off) => tags.push([label, off]);
  if (S.disc > 50) add(`≥ ${S.disc}%`, () => (S.disc = 50));
  if (S.pmin || S.pmax) add(`R$ ${S.pmin || 0} – ${S.pmax || '∞'}`, () => { S.pmin = ''; S.pmax = ''; });
  if (S.coupon) add('Com cupom', () => (S.coupon = false));
  if (S.q) add(`“${S.q}”`, () => (S.q = ''));
  S.stores.forEach((s) => add(STORES[s]?.name || s, () => (S.stores = S.stores.filter((x) => x !== s))));
  S.brands.forEach((b) => add(b, () => (S.brands = S.brands.filter((x) => x !== b))));
  Object.entries(S.spec).forEach(([k, vs]) => vs.forEach((v) => add(v, () => (S.spec = { ...S.spec, [k]: vs.filter((x) => x !== v) }))));
  $('#activeTags').replaceChildren(
    ...tags.map(([l, off]) => {
      const b = document.createElement('button');
      b.className = 'tag';
      b.type = 'button';
      b.textContent = l;
      b.onclick = () => { off(); syncInputs(); update(); };
      return b;
    })
  );
  $('#activeCount').textContent = tags.length || '';
}

function couponMatch(c, skipStore) {
  if (!skipStore && S.stores.length && !S.stores.includes(c.store)) return false;
  if (S.q) {
    const hay = norm(`${c.code} ${c.title} ${c.discount} ${STORES[c.store]?.name}`);
    if (!norm(S.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

const NOTES = {
  radar: 'Posts de cupom em hardware (Telegram e Promobit) que não informam o preço “de” — não dá pra garantir os 50%, mas costumam ser os melhores preços do momento. Mostrando as últimas 48 h, só marcas boas.',
  coupons: 'Cupons gerais das lojas, das últimas 36 h. Muitos esgotam em minutos e alguns valem só para itens selecionados ou no app.',
};

function renderGrid() {
  $('#viewNote').hidden = !NOTES[S.view];
  $('#viewNote').textContent = NOTES[S.view] || '';
  $('.sort').hidden = S.view === 'coupons';
  $$('.views button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === S.view)));
  if (S.view === 'coupons') {
    const list = COUPONS.filter((c) => couponMatch(c));
    $('#count').innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'cupom' : 'cupons'}`;
    $('#empty').hidden = list.length > 0;
    grid.replaceChildren(...list.map((c, i) => Object.assign(ticket(c), { style: `animation-delay:${Math.min(i, 16) * 18}ms` })));
    return;
  }
  const list = POOL().filter((d) => baseFilter(d)).sort(SORTS[S.sort] || SORTS.disc);
  $('#count').innerHTML = `<b>${list.length}</b> ${list.length === 1 ? 'oferta' : 'ofertas'}${S.cat !== 'all' ? ` em ${catLabel(S.cat).toLowerCase()}` : ''}`;
  $('#empty').hidden = list.length > 0;
  const frag = document.createDocumentFragment();
  list.slice(0, 400).forEach((d, i) => {
    const c = card(d);
    c.style.animationDelay = `${Math.min(i, 16) * 18}ms`;
    frag.append(c);
  });
  grid.replaceChildren(frag);
}

function renderStats() {
  $('#stCount').textContent = $('#vDeals').textContent = ALL.length;
  $('#stBest').textContent = ALL.length ? `-${Math.max(...ALL.map((d) => d.discount))}%` : '—';
  $('#stRadar').textContent = $('#vRadar').textContent = RADAR.length;
  $('#stCoupons').textContent = $('#vCoupons').textContent = COUPONS.length;
  if (META.telegramChannels?.length) $('#tgList').textContent = META.telegramChannels.map((c) => `@${c}`).join(', ');
  const up = $('#updated');
  const stale = META.updatedAt && Date.now() - new Date(META.updatedAt) > 3 * 3600e3;
  up.classList.toggle('is-stale', !!stale);
  $('span', up).textContent = META.updatedAt ? `atualizado ${ago(META.updatedAt)}` : 'sem dados';
  const src = META.sources || {};
  const names = { promobit: 'Promobit', kabum: 'KaBuM API', amazon: 'Amazon', patoloco: 'Pato Loco', pichau: 'Pichau', terabyte: 'Terabyte', telegram: 'Telegram' };
  $('#sourceStatus').innerHTML = Object.entries(src)
    .map(([k, v]) => `<span class="src ${v.ok ? '' : 'is-off'}">${names[k] || k}: ${v.ok ? `${v.count}` : 'fora do ar'}</span>`)
    .join('');
}

function syncInputs() {
  $('#q').value = S.q;
  $('#disc').value = S.disc;
  $('#discOut').textContent = `${S.disc}%`;
  $('#pmin').value = S.pmin;
  $('#pmax').value = S.pmax;
  $('#onlyCoupon').checked = S.coupon;
  $('#sort').value = S.sort;
  paintRange($('#disc'));
}
function paintRange(r) {
  r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
}

function update() {
  writeHash();
  renderCats();
  renderFilters();
  activeTags();
  renderGrid();
}

// ------------------------------------------------------------------ eventos
let qT;
$('#q').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value.trim(); update(); }, 160); });
$('#disc').addEventListener('input', (e) => { S.disc = +e.target.value; $('#discOut').textContent = `${S.disc}%`; paintRange(e.target); update(); });
const onlyNum = (v) => v.replace(/\D/g, '');
for (const id of ['pmin', 'pmax']) {
  $(`#${id}`).addEventListener('input', (e) => {
    e.target.value = onlyNum(e.target.value);
    clearTimeout(qT);
    qT = setTimeout(() => { S[id] = e.target.value; update(); }, 250);
  });
}
$('#onlyCoupon').addEventListener('change', (e) => { S.coupon = e.target.checked; update(); });
$('#sort').addEventListener('change', (e) => { S.sort = e.target.value; update(); });
$$('.views button').forEach((b) =>
  b.addEventListener('click', () => {
    if (S.view === b.dataset.view) return;
    S.view = b.dataset.view;
    S.sort = S.view === 'radar' ? 'new' : 'disc';
    syncInputs();
    update();
  })
);
const clearAll = () => { S = { ...DEFAULT, cat: S.cat, sort: S.sort }; syncInputs(); update(); };
$('#clearBtn').onclick = clearAll;
$('#emptyClear').onclick = () => { S = { ...DEFAULT }; syncInputs(); update(); };
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') closeFilters();
});
// gaveta de filtros (mobile)
const openFilters = () => { $('#filters').classList.add('is-open'); $('#scrim').hidden = false; };
const closeFilters = () => { $('#filters').classList.remove('is-open'); $('#scrim').hidden = true; };
$('#openFilters').onclick = openFilters;
$('#closeFilters').onclick = closeFilters;
$('#scrim').onclick = closeFilters;
// tema
const applyTheme = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(store.get('theme', null));
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  applyTheme(next);
  store.set('theme', next);
};
window.addEventListener('hashchange', () => { S = { ...DEFAULT, ...readHash() }; syncInputs(); update(); });

// ------------------------------------------------------------------ dados
async function load() {
  const r = await fetch(`${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  META = j;
  ALL = (j.deals || []).filter((d) => d && d.price > 0);
  RADAR = (j.radar || []).filter((d) => d && d.price > 0);
  COUPONS = j.coupons || [];
  return ALL;
}

function skeletons() {
  grid.replaceChildren(...Array.from({ length: 8 }, () => Object.assign(document.createElement('div'), { className: 'skeleton' })));
}

// ------------------------------------------------------------------ alertas
const NDEF = { on: false, min: 60, max: 100, cats: [], maxPrice: '', radar: false, coupons: false };
let N = { ...NDEF, ...store.get('alerts', {}) };
let seen = new Set(store.get('seen', []));

const sheet = $('#notifSheet');
function paintDual() {
  const a = $('#nMin'), b = $('#nMax');
  const pa = ((a.value - 50) / 50) * 100, pb = ((b.value - 50) / 50) * 100;
  a.style.setProperty('--a', `${pa}%`);
  a.style.setProperty('--b', `${pb}%`);
  $('#nRangeOut').textContent = `${a.value}% – ${b.value}%`;
}
function permText() {
  const p = $('#nPerm');
  if (!('Notification' in window)) { p.textContent = 'Este navegador não suporta notificações.'; p.className = 'hint is-warn'; return; }
  const m = { granted: 'Permissão concedida ✓', denied: 'Notificações bloqueadas — libere no cadeado da barra de endereço.', default: 'O navegador vai pedir permissão ao salvar.' };
  p.textContent = m[Notification.permission];
  p.className = `hint ${Notification.permission === 'denied' ? 'is-warn' : ''}`;
}
let nCatsSel = [];
function renderNCats() {
  const box = $('#nCats');
  const all = chip('Todas', nCatsSel.length === 0, () => { nCatsSel = []; renderNCats(); });
  box.replaceChildren(
    all,
    ...CATS.filter((c) => c.id !== 'all').map((c) => chip(c.short || c.label, nCatsSel.includes(c.id), () => { nCatsSel = toggle(nCatsSel, c.id); renderNCats(); }))
  );
}
function openSheet() {
  $('#nOn').checked = N.on;
  $('#nMin').value = N.min;
  $('#nMax').value = N.max;
  $('#nMaxPrice').value = N.maxPrice;
  $('#nRadar').checked = !!N.radar;
  $('#nCoupons').checked = !!N.coupons;
  nCatsSel = [...N.cats];
  const h = $('#nEveryHint');
  const off = LOCAL && !LOCAL.every;
  h.textContent = !LOCAL
    ? 'Os alertas são checados quando você abre a página.'
    : off
      ? 'A coleta automática está desligada (topo da página): os alertas só chegam quando houver uma coleta nova.'
      : `Os alertas chegam assim que cada coleta termina (${$('#every').selectedOptions[0].text}). Deixe a página aberta, pode ficar em segundo plano.`;
  h.className = `hint ${off ? 'is-warn' : ''}`;
  paintDual();
  permText();
  renderNCats();
  // tópicos ntfy (push no celular, gerados pelo coletor)
  const topic = META.ntfyTopic;
  $('#phoneBox').hidden = !topic;
  if (topic) {
    $('#ntfyMin').textContent = META.ntfyMin || 60;
    $('#topics').replaceChildren(
      ...[['', 'Todas 50%+'], ...CATS.filter((c) => c.id !== 'all').map((c) => [`-${c.id}`, c.short || c.label]), ['-radar', 'Radar de cupons'], ['-cupons', 'Cupons de loja']].map(([suf, l]) =>
        Object.assign(document.createElement('a'), { href: `https://ntfy.sh/${topic}${suf}`, target: '_blank', rel: 'noopener', textContent: `${l} ↗`, title: `${topic}${suf}` })
      )
    );
  }
  sheet.showModal();
}
$('#notifBtn').onclick = openSheet;
$('#nMin').addEventListener('input', () => { if (+$('#nMin').value > +$('#nMax').value) $('#nMax').value = $('#nMin').value; paintDual(); });
$('#nMax').addEventListener('input', () => { if (+$('#nMax').value < +$('#nMin').value) $('#nMin').value = $('#nMax').value; paintDual(); });
$('#nMaxPrice').addEventListener('input', (e) => (e.target.value = onlyNum(e.target.value)));
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

$('#notifForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  N = {
    on: $('#nOn').checked,
    min: +$('#nMin').value,
    max: +$('#nMax').value,
    cats: nCatsSel,
    maxPrice: $('#nMaxPrice').value,
    radar: $('#nRadar').checked,
    coupons: $('#nCoupons').checked,
  };
  if (N.on && 'Notification' in window && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') { N.on = false; toast('Permissão negada pelo navegador'); }
  }
  store.set('alerts', N);
  // ao ativar, o que já está na tela conta como visto — só avisamos do que for novo
  if (N.on) { [...ALL, ...RADAR, ...COUPONS].forEach((d) => seen.add(d.id)); saveSeen(); }
  sheet.close();
  paintBell();
  toast(N.on ? `Alertas ligados: ${N.min}–${N.max}% · ${N.cats.length ? N.cats.map((c) => CATS.find((x) => x.id === c).short).join(', ') : 'todas as categorias'}` : 'Alertas desligados');
});

$('#nTest').onclick = async () => {
  if (!('Notification' in window)) return toast('Navegador sem suporte a notificações');
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return toast('Permissão negada');
  permText();
  const d = [...ALL].sort(SORTS.disc)[0];
  showNotif(d ? { ...d, test: true } : null);
};

function matchAlert(d) {
  if (d.discount < N.min || d.discount > N.max) return false;
  if (N.cats.length && !N.cats.includes(d.category)) return false;
  if (N.maxPrice && d.price > +N.maxPrice) return false;
  return true;
}
function saveSeen() { store.set('seen', [...seen].slice(-3000)); }

async function showNotif(d) {
  let title = 'Garimpo';
  let body = 'Notificações funcionando!';
  if (d?.couponItem) {
    title = d.title;
    body = d.body;
  } else if (d) {
    title = `${d.discount != null ? `-${d.discount}%` : '🎟 Radar'} · ${d.title.slice(0, 70)}`;
    body = `R$ ${brl(d.price)}${d.oldPrice ? ` (era R$ ${brl(d.oldPrice)})` : ''} · ${STORES[d.store]?.name}${d.coupon ? ` · cupom ${d.coupon}` : ''}`;
  }
  const opts = { body, icon: d?.image || 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: d?.id || 'test', data: { url: d?.url || location.href } };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(title, opts);
  } catch {}
  const n = new Notification(title, opts);
  n.onclick = () => window.open(opts.data.url, '_blank');
}

// Confere o que chegou de novo nos dados e dispara os alertas que batem com o filtro.
async function checkAlerts() {
  if (!N.on) return;
  const fresh = ALL.filter((d) => !seen.has(d.id));
  const freshRadar = RADAR.filter((d) => !seen.has(d.id));
  const freshCoupons = COUPONS.filter((c) => !seen.has(c.id));
  [...fresh, ...freshRadar, ...freshCoupons].forEach((d) => seen.add(d.id));
  saveSeen();
  if (N.radar) {
    const r = freshRadar.filter((d) => (!N.cats.length || N.cats.includes(d.category)) && (!N.maxPrice || d.price <= +N.maxPrice));
    for (const d of r.slice(0, 3)) await showNotif({ ...d, radarItem: true });
  }
  if (N.coupons) {
    for (const c of freshCoupons.slice(0, 3)) await showNotif({ couponItem: true, id: c.id, title: `Cupom ${STORES[c.store]?.name}: ${c.code}`, body: c.discount || c.title || '', url: c.url || location.href });
  }
  const hits = fresh.filter(matchAlert).sort(SORTS.disc);
  for (const d of hits.slice(0, 5)) await showNotif(d);
  if (hits.length > 5) showNotif({ id: 'more', discount: hits[5].discount, title: `+${hits.length - 5} ofertas novas no Garimpo`, price: hits[5].price, oldPrice: hits[5].oldPrice, store: hits[5].store, url: location.href });
}
function paintBell() { $('#notifDot').hidden = !N.on; }

// ------------------------------------------------------------------ modo local (node server.mjs)
// O servidor local coleta no intervalo escolhido aqui e avisa a página assim que termina;
// as ofertas novas aparecem na hora, sem precisar atualizar. No GitHub Pages a coleta é diária.
let LOCAL = null; // status do servidor local, ou null no site publicado
const fmtMin = (iso) => {
  const m = Math.round((new Date(iso) - Date.now()) / 60000);
  return m <= 0 ? 'agora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
function paintCollector() {
  const up = $('#updated');
  const label = $('span', up);
  if (!LOCAL) {
    up.classList.remove('is-running');
    label.textContent = META.updatedAt ? `atualizado ${ago(META.updatedAt)} · coleta diária` : 'sem dados';
    return;
  }
  up.classList.toggle('is-running', !!LOCAL.running);
  if (LOCAL.running) {
    label.textContent = 'coletando…';
    up.title = LOCAL.progress || 'Coletando ofertas nas lojas';
  } else {
    const parts = [META.updatedAt ? `atualizado ${ago(META.updatedAt)}` : 'sem dados'];
    if (LOCAL.nextAt) parts.push(`próxima em ${fmtMin(LOCAL.nextAt)}`);
    label.textContent = parts.join(' · ');
    up.title = LOCAL.lastError ? `Última coleta falhou: ${LOCAL.lastError}` : 'Última atualização dos dados';
  }
  $('#every').value = String(LOCAL.every);
}

async function connectLocal() {
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) return false;
    LOCAL = await r.json();
  } catch {
    return false;
  }
  $('#everyBox').hidden = false;
  paintCollector();
  $('#every').addEventListener('change', async (e) => {
    const every = +e.target.value;
    const r = await fetch('api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ every }) });
    if (r.ok) {
      LOCAL = await r.json();
      paintCollector();
      toast(every ? `Coletando ${e.target.selectedOptions[0].text}` : 'Coleta automática desligada');
    } else toast('Não consegui salvar o intervalo');
  });
  const es = new EventSource('api/events');
  es.addEventListener('status', (ev) => { LOCAL = JSON.parse(ev.data); paintCollector(); });
  es.addEventListener('progress', (ev) => { if (LOCAL) { LOCAL.progress = JSON.parse(ev.data).progress; paintCollector(); } });
  // coleta terminou: mostra na hora
  es.addEventListener('updated', async () => {
    try {
      await load();
      renderStats();
      update();
      toast(`Coleta concluída: ${ALL.length} ofertas 50%+, ${RADAR.length} no radar`);
      await checkAlerts();
    } catch {}
  });
  return true;
}

// ------------------------------------------------------------------ boot
(async () => {
  syncInputs();
  skeletons();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const isLocal = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) && (await connectLocal());
  try {
    await load();
  } catch {
    ALL = [];
  }
  renderStats();
  paintCollector();
  if (!ALL.length && !RADAR.length && isLocal && LOCAL?.running) $('#updated span').textContent = 'primeira coleta… (leva alguns minutos)';
  update();
  paintBell();
  checkAlerts();
  setInterval(() => { renderStats(); paintCollector(); }, 30000);
})();