// Classificação de produtos: categoria, marca (só marcas boas), filtros de "novo" e extração de specs.

export const strip = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[”“″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- Produtos não-novos ----------
const NOT_NEW = /\b(usad[oa]s?|semi ?nov[oa]s?|recondicionad[oa]s?|refurbished|refurb|open ?box|vitrine|reembalad[oa]|remanufaturad[oa]|mostruario|recertificad[oa]|grade [abc]|outlet de devolu)/;
export const isNew = (title) => !NOT_NEW.test(strip(title));

// ---------- Marcas ----------
// Marcas bloqueadas explicitamente (ganham de qualquer marca boa citada no título,
// ex.: "Placa de vídeo Afox NVIDIA ..." ou "Notebook Positivo Intel ...").
const BLOCKED = [
  'duex', 'positivo', 'multilaser', 'multi laser', 'vaio', 'compaq', 'afox', 'goline', 'brx', 'knup', 'vinik',
  'mancer', 'bluecase', 'pcyes', 'arktek', 'macrovip', 'vx pro', 'vxpro', 'husky', 'rise mode', 'best memory',
  'netac', 'kllisre', 'machinist', 'huananzhi', 'jieshuo', 'atermiter', 'goldenfir', 'kingspec', 'walram',
  'shuoshi', 'superframe', 'clanm', 'mllse', 'bestoss', 'aitek', 'redragon', 'hoopson',
  'tectoy', 'philco', 'britania', 'mondial', 'ultra pc', 'ultrapc', 'gamemax', 'k-mex', 'kmex', 'exbom',
  'leadership', 'lehmox', 'c3tech', 'c3 tech', 'pctop', 'ciccy',
  'tgt', 'tagb', 'nhh', 'aigo', 'colorfire', 'hikvision', 'hiksemi', 'ramaxel', 'tcl semp',
];

// Marcas boas por categoria. Chave = nome exibido; valor = regex no título normalizado.
const B = (name, re) => ({ name, re });
const BRAND = {
  asus: B('ASUS', /\b(asus|rog|tuf gaming|proart|zenbook|vivobook|zephyrus|strix)\b/),
  msi: B('MSI', /\bmsi\b/),
  gigabyte: B('Gigabyte', /\b(gigabyte|aorus|aero)\b/),
  asrock: B('ASRock', /\basrock\b/),
  zotac: B('Zotac', /\bzotac\b/),
  galax: B('Galax', /\bgalax\b/),
  pny: B('PNY', /\bpny\b/),
  palit: B('Palit', /\bpalit\b/),
  gainward: B('Gainward', /\bgainward\b/),
  inno3d: B('Inno3D', /\binno ?3d\b/),
  sapphire: B('Sapphire', /\bsapphire\b/),
  powercolor: B('PowerColor', /\bpower ?color\b/),
  xfx: B('XFX', /\bxfx\b/),
  colorful: B('Colorful', /\bcolorful\b/),
  evga: B('EVGA', /\bevga\b/),
  nvidia: B('NVIDIA', /\b(nvidia|founders edition)\b/),
  amd: B('AMD', /\b(amd|ryzen|radeon)\b/),
  intel: B('Intel', /\b(intel|core i[3579]|core ultra)\b/),
  samsung: B('Samsung', /\b(samsung|odyssey|galaxy book)\b/),
  lg: B('LG', /\b(lg|ultragear|ultrawide lg|gram)\b/),
  dell: B('Dell', /\b(dell|inspiron|latitude|xps|vostro|g15 dell)\b/),
  alienware: B('Alienware', /\balienware\b/),
  aoc: B('AOC', /\baoc\b/),
  acer: B('Acer', /\b(acer|nitro|predator|aspire|swift)\b/),
  benq: B('BenQ', /\b(benq|zowie)\b/),
  viewsonic: B('ViewSonic', /\bviewsonic\b/),
  philips: B('Philips', /\bphilips\b/),
  lenovo: B('Lenovo', /\b(lenovo|ideapad|legion|thinkpad|thinkbook|yoga|loq)\b/),
  hp: B('HP', /\b(hp|omen|victus|pavilion|elitebook|probook)\b/),
  apple: B('Apple', /\b(apple|macbook)\b/),
  razer: B('Razer', /\brazer\b/),
  xiaomi: B('Xiaomi', /\bxiaomi\b/),
  kingston: B('Kingston', /\b(kingston|fury beast|fury renegade|hyperx)\b/),
  corsair: B('Corsair', /\bcorsair\b/),
  crucial: B('Crucial', /\bcrucial\b/),
  wd: B('WD', /\b(western digital|wd ?(black|blue|green|red)|wd_black|\bwd\b|sandisk)\b/),
  seagate: B('Seagate', /\b(seagate|firecuda|barracuda)\b/),
  xpg: B('XPG / ADATA', /\b(xpg|adata)\b/),
  lexar: B('Lexar', /\blexar\b/),
  solidigm: B('Solidigm', /\bsolidigm\b/),
  teamgroup: B('TeamGroup', /\b(team ?group|t-?force|t-?create)\b/),
  gskill: B('G.Skill', /\bg\.? ?skill\b/),
  patriot: B('Patriot', /\b(patriot|viper)\b/),
  logitech: B('Logitech', /\b(logitech|logi g)\b/),
  hyperx: B('HyperX', /\bhyperx\b/),
  steelseries: B('SteelSeries', /\bsteel ?series\b/),
  gamesir: B('GameSir', /\bgamesir\b/),
  '8bitdo': B('8BitDo', /\b8 ?bitdo\b/),
  xbox: B('Microsoft / Xbox', /\b(microsoft|xbox wireless|controle xbox|controle sem fio xbox)\b/),
  sony: B('Sony / PlayStation', /\b(sony|dualsense|dualshock)\b/),
  keychron: B('Keychron', /\bkeychron\b/),
  akko: B('Akko', /\bakko\b/),
  glorious: B('Glorious', /\bglorious\b/),
  flydigi: B('Flydigi', /\bflydigi\b/),
  rog: B('ASUS', /\b(asus|rog)\b/),
};

const CAT_BRANDS = {
  gpu: ['asus', 'msi', 'gigabyte', 'asrock', 'zotac', 'galax', 'pny', 'palit', 'gainward', 'inno3d', 'sapphire', 'powercolor', 'xfx', 'colorful', 'evga', 'nvidia', 'amd', 'intel'],
  cpu: ['amd', 'intel'],
  mobo: ['asus', 'msi', 'gigabyte', 'asrock'],
  monitor: ['samsung', 'lg', 'dell', 'alienware', 'aoc', 'asus', 'acer', 'msi', 'gigabyte', 'benq', 'viewsonic', 'philips', 'lenovo', 'hp', 'xiaomi', 'apple'],
  ssd: ['samsung', 'kingston', 'wd', 'crucial', 'seagate', 'xpg', 'corsair', 'lexar', 'solidigm', 'teamgroup', 'msi', 'gigabyte', 'patriot'],
  ram: ['kingston', 'corsair', 'gskill', 'crucial', 'xpg', 'teamgroup', 'patriot', 'samsung', 'lexar'],
  notebook: ['acer', 'asus', 'lenovo', 'dell', 'alienware', 'hp', 'samsung', 'apple', 'msi', 'gigabyte', 'razer', 'lg'],
  periferico: ['logitech', 'razer', 'hyperx', 'corsair', 'steelseries', 'gamesir', '8bitdo', 'xbox', 'sony', 'keychron', 'akko', 'glorious', 'flydigi', 'rog', 'kingston'],
};

const blockedRe = new RegExp(`\\b(${BLOCKED.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`);

export function detectBrand(category, title, hint) {
  const t = strip(title);
  const h = strip(hint);
  if (blockedRe.test(t) || (h && blockedRe.test(h))) return null;
  const keys = CAT_BRANDS[category] || [];
  // para placas de vídeo, preferir a fabricante da placa (ASUS, Galax...) em vez do chip (NVIDIA/AMD)
  const chipMakers = new Set(['nvidia', 'amd', 'intel']);
  let best = null;
  for (const k of keys) {
    const m = BRAND[k].re.exec(t);
    if (!m) continue;
    const score = (category === 'gpu' && chipMakers.has(k) ? 1000 : 0) + m.index;
    if (!best || score < best.score) best = { k, score };
  }
  if (!best && h) {
    for (const k of keys) if (BRAND[k].re.test(h)) return BRAND[k].name;
  }
  return best ? BRAND[best.k].name : null;
}

// ---------- Categoria ----------
export function detectCategory(title, menuHint = '') {
  const t = strip(title);
  const m = strip(menuHint);
  const bad = /\b(capa|case para|gabinete|cooler|suporte|adaptador|cabo|pelicula|mochila|bolsa|carregador|kit upgrade|pc gamer|computador|desktop completo|all in one|mini pc|console|playstation|xbox|celular|smartphone|tablet|smart tv|televis|webcam|teclado|mouse|headset|fone|caixa de som|roteador|impressora|pendrive|cartao de memoria|micro ?sd|hd externo|ssd externo|portatil|enclosure|dissipador|heatsink|water ?cooler|pasta termica|fonte)\b/;
  const t0 = t.replace(/^(baixou|corre|imperdivel|menor preco|black friday|oferta|promo|relampago|exclusivo|app)[!:.\- ]+/g, '');
  if (/^(pc|kit|combo|computador|cpu gamer|desktop)\b/.test(t0)) return null;
  const accessory = /^(capa|case|mochila|maleta|bolsa|suporte|carregador|fonte|bateria|cooler|base|memoria|ssd|tela|teclado|pelicula|adaptador|cabo|hub|dock|skin|protetor|mouse|kit)\b/;
  // linhas de notebook que às vezes vêm sem a palavra "notebook" no título
  const nbLine = /\b(galaxy book\s?\d?|ideapad|vivobook|zenbook|expertbook|inspiron|latitude|xps 1[3-7]|aspire (go|\d)|swift (go|\d)|nitro v ?\d|predator helios|legion (5|7|pro|slim)|lenovo loq|thinkpad|thinkbook|yoga (slim|pro|\d)|victus|omen (transcend|\d)|pavilion (plus|aero|\d)|tuf gaming f\d|rog (strix|zephyrus|flow) [gm]\d|zephyrus g\d|lg gram|alienware m\d|alienware x\d|katana|cyborg 15|thin gf63|stealth \d)\b/;
  const isNotebook = /\b(notebook|laptop|macbook|chromebook|ultrabook)\b/.test(t) || nbLine.test(t) || /\bnotebook/.test(m);
  if (isNotebook && !accessory.test(t0) && !/\bpara (notebook|laptop|macbook)\b/.test(t)) return 'notebook';
  if (/^(controle|controller|gamepad|joystick|mouse|teclado|headset|fone (de ouvido )?gamer)\b/.test(t0) && !/\b(capa|case|suporte|carregador|pad|mousepad|grip|bateria)\b/.test(t0.split(' ').slice(0, 2).join(' '))) return 'periferico';
  if (/^(gamesir|8bitdo|flydigi)\b/.test(t0) || /\b(controller|controle)\b.*\b(xbox|series x|ps5|switch|hall effect|tmr)\b/.test(t)) return 'periferico';
  if (bad.test(t) && !/\bmonitor\b/.test(t)) return null;
  if (/\bmonitor\b/.test(t) && !/\b(pressao|cardiaco|bebe|baba|glicose|braco|suporte)\b/.test(t)) return 'monitor';
  if (/placa[ -]?(de )?video|\bgeforce\b|\b(rtx|gtx) ?\d{3,4}\b|\bradeon\b|\brx ?\d{4}\b|\barc [ab]\d{3}\b/.test(t) || /placa de video/.test(m)) return 'gpu';
  if (/placa[ -]?mae|motherboard|\b(b450|b550|b650|b760|b850|x570|x670|x870|z690|z790|z890|h610|h810|a520|a620)m?\b/.test(t) && !/\bprocessador\b/.test(t)) return 'mobo';
  if (/\bssd\b|\bnvme\b|\bm\.2\b.*\b(gb|tb)\b/.test(t)) return 'ssd';
  if (/\bprocessador\b|\bryzen [3579] ?\d{4}|\bcore (i[3579]|ultra [579])[ -]?\d{3,5}/.test(t) || /\bprocessador/.test(m)) return 'cpu';
  if (/\b(memoria|memoria ram)\b.*\bddr[345]\b|\bddr[45]\b.*\b\d+ ?gb\b|\b\d+ ?gb\b.*\bddr[45]\b/.test(t) || /memoria ram/.test(m)) return 'ram';
  return null;
}

// ---------- Specs ----------
const num = (s) => parseFloat(String(s).replace(',', '.'));

function gbValues(t) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)\s?(gb|tb)\b/g;
  let m;
  while ((m = re.exec(t))) {
    const v = num(m[1]) * (m[2] === 'tb' ? 1024 : 1);
    const before = t.slice(Math.max(0, m.index - 14), m.index);
    const after = t.slice(re.lastIndex, re.lastIndex + 10);
    out.push({ v, before, after, idx: m.index });
  }
  return out;
}

const fmtStorage = (gb) => (gb >= 1000 ? `${Math.round((gb / 1024) * 10) / 10} TB` : `${gb} GB`);

function resolution(t) {
  if (/\b(5k|5120)\b/.test(t)) return '5K';
  if (/\b(4k|uhd|3840|2160p)\b/.test(t)) return '4K UHD';
  if (/\b(3440|wqhd ultrawide|uwqhd)\b/.test(t)) return 'UltraWide QHD';
  if (/\b(2560 ?x ?1080|wfhd|ultrawide)\b/.test(t)) return 'UltraWide FHD';
  if (/\b(qhd|wqhd|2k|1440p?|2560)\b/.test(t)) return 'QHD 1440p';
  if (/\b(full ?hd|fhd|1080p?|1920)\b/.test(t)) return 'Full HD';
  if (/\b(wuxga|1920 ?x ?1200)\b/.test(t)) return 'Full HD';
  if (/\b(hd|1366)\b/.test(t)) return 'HD';
  return null;
}
function panel(t) {
  if (/\bqd-?oled\b/.test(t)) return 'QD-OLED';
  if (/\boled\b/.test(t)) return 'OLED';
  if (/\bmini ?led\b/.test(t)) return 'Mini LED';
  if (/\b(ips|nano ?ips|fast ips|ads)\b/.test(t)) return 'IPS';
  if (/\bva\b/.test(t)) return 'VA';
  if (/\btn\b/.test(t)) return 'TN';
  return null;
}
function inches(t) {
  const m = /(\d{2}(?:[.,]\d)?)\s?(?:"|''|pol\b|polegadas|inch|\bpol\.)/.exec(t) || /\b(1[3-8](?:[.,]\d)?|2[1-9](?:[.,]\d)?|3[0-9]|4[0-9])\s?(?:"|'')/.exec(t);
  return m ? num(m[1]) : null;
}
function hz(t) {
  const all = [...t.matchAll(/(\d{2,3})\s?hz\b/g)].map((m) => +m[1]).filter((v) => v >= 50 && v <= 600);
  return all.length ? Math.max(...all) : null;
}
function cpuLine(t) {
  let m;
  if ((m = /\bryzen (ai )?([3579])\b/.exec(t))) return `Ryzen ${m[2]}`;
  if ((m = /\bcore ultra ([579])\b/.exec(t))) return `Core Ultra ${m[1]}`;
  if ((m = /\b(?:core )?i([3579])[ -]?\d{4,5}/.exec(t)) || (m = /\bcore i([3579])\b/.exec(t))) return `Core i${m[1]}`;
  if (/\b(apple )?m[1-5]( pro| max)?\b/.test(t) && /macbook/.test(t)) return 'Apple M';
  if (/\bsnapdragon\b/.test(t)) return 'Snapdragon';
  if (/\b(celeron|pentium|athlon)\b/.test(t)) return 'Entrada';
  return null;
}
function gpuChip(t) {
  let m;
  if ((m = /\b(rtx|gtx) ?(\d{4}|\d{3})( ?ti super| ?ti| ?super)?\b/.exec(t))) return `${m[1].toUpperCase()} ${m[2]}${(m[3] || '').toUpperCase()}`;
  if ((m = /\brx ?(\d{4})( ?xtx| ?xt| ?gre)?\b/.exec(t))) return `RX ${m[1]}${(m[2] || '').toUpperCase()}`;
  if ((m = /\barc ([ab]\d{3})\b/.exec(t))) return `Arc ${m[1].toUpperCase()}`;
  return null;
}
const gpuMaker = (chip) => (!chip ? null : chip.startsWith('R') && !chip.startsWith('RTX') ? 'AMD' : chip.startsWith('Arc') ? 'Intel' : 'NVIDIA');
const gpuSeries = (chip) => {
  if (!chip) return null;
  let m;
  if ((m = /^RTX (\d{2})/.exec(chip))) return `RTX ${m[1]}xx`;
  if ((m = /^GTX/.exec(chip))) return 'GTX';
  if ((m = /^RX (\d)/.exec(chip))) return `RX ${m[1]}000`;
  if (chip.startsWith('Arc')) return 'Intel Arc';
  return null;
};

export function extractSpecs(category, title) {
  const t = strip(title);
  const gbs = gbValues(t);
  const s = {};
  switch (category) {
    case 'gpu': {
      const chip = gpuChip(t);
      s.chip = chip;
      s.fabricante = gpuMaker(chip);
      s.serie = gpuSeries(chip);
      const v = gbs.find((g) => g.v >= 2 && g.v <= 48);
      s.vram = v ? v.v : null;
      const mt = /\bgddr ?(\d)x?\b/.exec(t);
      s.memoria = mt ? `GDDR${mt[1]}${/gddr ?\dx/.test(t) ? 'X' : ''}` : null;
      break;
    }
    case 'cpu': {
      s.fabricante = /\b(amd|ryzen)\b/.test(t) ? 'AMD' : /\b(intel|core)\b/.test(t) ? 'Intel' : null;
      s.linha = cpuLine(t);
      const sock = /\b(am4|am5|lga ?1700|lga ?1851|lga ?1200)\b/.exec(t);
      s.socket = sock ? sock[1].toUpperCase().replace(/LGA ?/, 'LGA ') : null;
      const mdl =
        /\bryzen (?:ai )?[3579] (?:pro )?(\d{3,4}[a-z0-9]*)\b/.exec(t) ||
        /\bcore ultra [579] (\d{3}[a-z]*)\b/.exec(t) ||
        /\b(?:core )?i[3579][ -](\d{4,5}[a-z]*)\b/.exec(t);
      s.modelo = mdl ? mdl[1].toUpperCase() : null;
      s.x3d = /x3d/.test(t) ? 'Sim' : null;
      break;
    }
    case 'monitor': {
      s.polegadas = inches(t);
      s.resolucao = resolution(t);
      s.hz = hz(t);
      s.painel = panel(t);
      s.curvo = /\bcurvo\b|\bcurved\b/.test(t) ? 'Curvo' : 'Plano';
      break;
    }
    case 'ssd': {
      const c = gbs.find((g) => g.v >= 120);
      s.capacidade = c ? Math.round(c.v) : null;
      s.interface = /\bsata\b/.test(t) && !/\bnvme\b/.test(t) ? 'SATA' : /\b(nvme|pcie|m\.2)\b/.test(t) ? 'NVMe' : null;
      const g = /\b(?:gen ?|pcie ?)([345])(?:\.0)?\b/.exec(t);
      s.geracao = g ? `Gen ${g[1]}` : null;
      s.dissipador = /\b(heatsink|dissipador)\b/.test(t) ? 'Sim' : null;
      break;
    }
    case 'ram': {
      const kit = /\b(\d)x ?(\d+) ?gb\b/.exec(t) || /\b(\d+) ?gb ?\((\d)x/.exec(t);
      let total = null;
      if (kit) total = /\((\d)x/.test(kit[0]) ? +kit[1] : +kit[1] * +kit[2];
      if (!total) {
        const c = gbs.find((g) => g.v >= 4 && g.v <= 256);
        total = c ? c.v : null;
      }
      s.capacidade = total;
      const ty = /\bddr([345])\b/.exec(t);
      s.tipo = ty ? `DDR${ty[1]}` : null;
      const f = /\b(\d{4})\s?mhz\b/.exec(t) || /\bddr[45][ -](\d{4})\b/.exec(t) || /\b(\d{4})\s?mt\/s\b/.exec(t);
      s.frequencia = f ? +f[1] : null;
      s.uso = /\b(sodimm|so-dimm|notebook|laptop)\b/.test(t) ? 'Notebook' : 'Desktop';
      s.kit = kit ? 'Kit' : 'Módulo';
      break;
    }
    case 'notebook': {
      const clean = gbs.filter((g) => !/gddr/.test(g.after) && !/(rtx|gtx|rx|vram|video)\s?[\w ]*$/.test(g.before));
      const ram = clean.find((g) => g.v >= 4 && g.v <= 64 && !/ssd/.test(g.after.slice(0, 6)));
      const sto = clean.find((g) => g.v >= 128);
      s.ram = ram ? ram.v : null;
      s.armazenamento = sto ? Math.round(sto.v) : null;
      s.processador = cpuLine(t);
      const chip = gpuChip(t);
      s.gpu = chip || (/\b(rtx|geforce)\b/.test(t) ? 'RTX' : null);
      s.dedicada = s.gpu ? 'Dedicada' : 'Integrada';
      s.tela = inches(t);
      s.hz = hz(t);
      s.painel = panel(t);
      break;
    }
    case 'periferico': {
      s.tipo = /\b(controle|controller|gamepad|joystick)\b/.test(t) ? 'Controle' : /\bmouse\b/.test(t) ? 'Mouse' : /\bteclado\b/.test(t) ? 'Teclado' : /\b(headset|fone)\b/.test(t) ? 'Headset' : null;
      s.conexao = /\b(sem fio|wireless|bluetooth|2\.4 ?ghz|lightspeed|hyperspeed)\b/.test(t) ? 'Sem fio' : 'Com fio';
      if (s.tipo === 'Teclado') s.switch = /\bmecanico\b/.test(t) ? 'Mecânico' : /\bmagnetic|hall effect|rapid trigger\b/.test(t) ? 'Magnético' : null;
      if (s.tipo === 'Controle') s.plataforma = /\bxbox\b/.test(t) ? 'Xbox / PC' : /\b(ps5|playstation|dualsense)\b/.test(t) ? 'PlayStation' : /\bswitch\b/.test(t) ? 'Switch' : 'PC';
      break;
    }
    case 'mobo': {
      const ch = /\b([abhxz]\d{3})m?\b/.exec(t);
      s.chipset = ch ? ch[1].toUpperCase() : null;
      s.plataforma = /\b(am4|am5|a520|b450|b550|x570|a620|b650|x670|b850|x870)\b/.test(t) ? 'AMD' : 'Intel';
      s.ddr = /\bddr5\b/.test(t) ? 'DDR5' : /\bddr4\b/.test(t) ? 'DDR4' : null;
      s.formato = /\bmini[ -]?itx\b/.test(t) ? 'Mini-ITX' : /\b(micro ?atx|m-?atx|matx)\b/.test(t) || /\b[abhxz]\d{3}m\b/.test(t) ? 'Micro-ATX' : /\batx\b/.test(t) ? 'ATX' : null;
      s.wifi = /\bwi-?fi\b/.test(t) ? 'Wi-Fi' : null;
      break;
    }
  }
  for (const k of Object.keys(s)) if (s[k] == null) delete s[k];
  return s;
}

export { fmtStorage };
