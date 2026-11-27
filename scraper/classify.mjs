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
  // consoles
  playstation: B('Sony / PlayStation', /\b(sony|playstation|ps5)\b/),
  xboxc: B('Microsoft / Xbox', /\b(microsoft|xbox)\b/),
  nintendo: B('Nintendo', /\b(nintendo|switch (2|oled|lite))\b/),
  valve: B('Valve', /\b(valve|steam deck)\b/),
  // acessórios oficiais: só o nome do produto conta ("compatível com PS5" não faz o fone ser da Sony)
  nintendopad: B('Nintendo', /\b(joy-?con|pro controller|controle pro)\b/),
  psaudio: B('Sony / PlayStation', /\b(pulse (3d|elite|explore)|playstation pulse)\b/),
  xboxaudio: B('Microsoft / Xbox', /\bxbox (wireless )?headset\b/),
  // áudio
  sonyaudio: B('Sony', /\bsony\b/),
  jbl: B('JBL', /\bjbl\b/),
  sennheiser: B('Sennheiser', /\b(sennheiser|epos)\b/),
  audiotechnica: B('Audio-Technica', /\baudio-? ?technica\b/),
  edifier: B('Edifier', /\bedifier\b/),
  soundcore: B('Soundcore / Anker', /\b(soundcore|anker)\b/),
  astro: B('Astro', /\bastro (a\d0|gaming)\b/),
  bose: B('Bose', /\bbose\b/),
  // refrigeração, gabinete e fonte
  coolermaster: B('Cooler Master', /\bcooler ?master\b/),
  deepcool: B('DeepCool', /\bdeep ?cool\b/),
  noctua: B('Noctua', /\bnoctua\b/),
  nzxt: B('NZXT', /\bnzxt\b/),
  lianli: B('Lian Li', /\blian ?li\b/),
  bequiet: B('be quiet!', /\bbe ?quiet\b/),
  thermalright: B('Thermalright', /\bthermalright\b/),
  arctic: B('Arctic', /\barctic (freezer|liquid|p\d{2,3})\b|^arctic\b/),
  thermaltake: B('Thermaltake', /\bthermaltake\b/),
  montech: B('Montech', /\bmontech\b/),
  fractal: B('Fractal Design', /\bfractal\b/),
  phanteks: B('Phanteks', /\bphanteks\b/),
  hyte: B('HYTE', /\bhyte\b/),
  seasonic: B('Seasonic', /\bsea ?sonic\b/),
  superflower: B('Super Flower', /\bsuper ?flower\b/),
  fsp: B('FSP', /\bfsp\b/),
  pccooler: B('PCCooler', /\bpc ?cooler\b/),
  idcooling: B('ID-Cooling', /\bid-? ?cooling\b/),
  zowie: B('BenQ Zowie', /\bzowie\b/),
};

const CAT_BRANDS = {
  gpu: ['asus', 'msi', 'gigabyte', 'asrock', 'zotac', 'galax', 'pny', 'palit', 'gainward', 'inno3d', 'sapphire', 'powercolor', 'xfx', 'colorful', 'evga', 'nvidia', 'amd', 'intel'],
  cpu: ['amd', 'intel'],
  mobo: ['asus', 'msi', 'gigabyte', 'asrock'],
  monitor: ['samsung', 'lg', 'dell', 'alienware', 'aoc', 'asus', 'acer', 'msi', 'gigabyte', 'benq', 'viewsonic', 'philips', 'lenovo', 'hp', 'xiaomi', 'apple'],
  ssd: ['samsung', 'kingston', 'wd', 'crucial', 'seagate', 'xpg', 'corsair', 'lexar', 'solidigm', 'teamgroup', 'msi', 'gigabyte', 'patriot'],
  ram: ['kingston', 'corsair', 'gskill', 'crucial', 'xpg', 'teamgroup', 'patriot', 'samsung', 'lexar'],
  notebook: ['acer', 'asus', 'lenovo', 'dell', 'alienware', 'hp', 'samsung', 'apple', 'msi', 'gigabyte', 'razer', 'lg'],
  periferico: ['logitech', 'razer', 'hyperx', 'corsair', 'steelseries', 'gamesir', '8bitdo', 'xbox', 'sony', 'keychron', 'akko', 'glorious', 'flydigi', 'rog', 'kingston', 'nintendopad'],
  console: ['playstation', 'xboxc', 'nintendo', 'valve', 'rog', 'lenovo', 'msi'],
  teclado: ['logitech', 'razer', 'hyperx', 'corsair', 'steelseries', 'keychron', 'akko', 'glorious', 'rog', 'coolermaster', 'xpg', 'msi', 'kingston'],
  mouse: ['logitech', 'razer', 'hyperx', 'corsair', 'steelseries', 'glorious', 'rog', 'zowie', 'benq', 'coolermaster', 'xpg', 'msi', 'kingston', 'apple'],
  fone: ['logitech', 'razer', 'hyperx', 'corsair', 'steelseries', 'jbl', 'sonyaudio', 'psaudio', 'xboxaudio', 'sennheiser', 'audiotechnica', 'edifier', 'soundcore', 'astro', 'bose', 'samsung', 'apple', 'xiaomi', 'rog', 'kingston', 'lg'],
  cooler: ['deepcool', 'coolermaster', 'noctua', 'corsair', 'nzxt', 'lianli', 'bequiet', 'thermalright', 'arctic', 'msi', 'rog', 'gigabyte', 'thermaltake', 'montech', 'pccooler', 'idcooling', 'xpg'],
  gabinete: ['nzxt', 'lianli', 'corsair', 'coolermaster', 'deepcool', 'montech', 'fractal', 'bequiet', 'phanteks', 'thermaltake', 'hyte', 'rog', 'msi', 'xpg', 'gigabyte'],
  fonte: ['corsair', 'xpg', 'msi', 'coolermaster', 'deepcool', 'bequiet', 'seasonic', 'evga', 'rog', 'gigabyte', 'thermaltake', 'superflower', 'montech', 'lianli', 'asrock', 'nzxt', 'fsp'],
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
  if (/^(pc|kit|combo|computador|cpu gamer|desktop)\b/.test(t0) && !/^kit (com )?(\d+ )?(fans?|ventoinhas?)\b/.test(t0)) return null;
  const accessory = /^(capa|case|mochila|maleta|bolsa|suporte|carregador|fonte|bateria|cooler|base|memoria|ssd|tela|teclado|pelicula|adaptador|cabo|hub|dock|skin|protetor|mouse|kit)\b/;
  // linhas de notebook que às vezes vêm sem a palavra "notebook" no título
  const nbLine = /\b(galaxy book\s?\d?|ideapad|vivobook|zenbook|expertbook|inspiron|latitude|xps 1[3-7]|aspire (go|\d)|swift (go|\d)|nitro v ?\d|predator helios|legion (5|7|pro|slim)|lenovo loq|thinkpad|thinkbook|yoga (slim|pro|\d)|victus|omen (transcend|\d)|pavilion (plus|aero|\d)|tuf gaming f\d|rog (strix|zephyrus|flow) [gm]\d|zephyrus g\d|lg gram|alienware m\d|alienware x\d|katana|cyborg 15|thin gf63|stealth \d)\b/;
  const isNotebook = /\b(notebook|laptop|macbook|chromebook|ultrabook)\b/.test(t) || nbLine.test(t) || /\bnotebook/.test(m);
  if (isNotebook && !accessory.test(t0) && !/\bpara (notebook|laptop|macbook)\b/.test(t)) return 'notebook';
  const first2 = t0.split(' ').slice(0, 2).join(' ');
  const notAcc = !/\b(capa|case|suporte|carregador|pad|mousepad|grip|bateria|cabo|adaptador|almofada|espuma|keycaps?|switches)\b/.test(first2);
  if (/^(controle|controller|gamepad|joystick)\b/.test(t0) && notAcc) return 'periferico';
  if (/^mouse\b/.test(t0) && notAcc && !/^mouse ?pad|^mouse e teclado/.test(t0)) return 'mouse';
  if (/^teclado\b/.test(t0) && notAcc && !/\b(e mouse|\+ ?mouse|musical|piano|yamaha|casio)\b/.test(t)) return 'teclado';
  if (/^(headset|fones?( de ouvido)?|headphones?|earbuds?|(apple )?airpods|galaxy buds|redmi buds|soundcore)\b/.test(t0) && notAcc && !/\b(suporte|case para|capa para|estojo)\b/.test(t)) return 'fone';
  if (/^(gamesir|8bitdo|flydigi)\b/.test(t0) || /\b(controller|controle)\b.*\b(xbox|series x|ps5|switch|hall effect|tmr)\b/.test(t)) return 'periferico';
  // videogame: "Console PlayStation 5 Slim", "Nintendo Switch 2", "Xbox Series S 512GB", "Steam Deck OLED"
  if (
    !/^(jogo|game|controle|capa|case|suporte|cabo|carregador|base|headset|fone|skin|pelicula|volante|cartao|gift|assinatura|kit|dock|bolsa|estojo|protetor)\b/.test(t0) &&
    (/^console\b/.test(t0) ||
      /^(sony )?(playstation 5|ps5)( pro| slim| digital| edicao)?\b/.test(t0) ||
      /^(microsoft )?xbox series [xs]\b/.test(t0) ||
      /^(nintendo )?switch (2|oled|lite)\b|^nintendo switch\b/.test(t0) ||
      /^(valve )?steam deck\b|^(asus )?rog (xbox )?ally\b|^(lenovo )?legion go\b/.test(t0))
  )
    return 'console';
  // refrigeração: "Water Cooler ...", "Air Cooler ...", "Cooler para Processador ...", "Kit 3 Fans ..."
  if (/^(water ?cooler|air ?cooler|cooler|watercooler|ventoinhas?|fans?|kit (com )?(\d+ )?(fans?|ventoinhas?)|refrigeracao liquida)\b/.test(t0) && !/\b(notebook|laptop|celular|smartphone|console|ps[45]|xbox|geladeira|bebida|termico para|garrafa)\b/.test(t)) return 'cooler';
  if (/^gabinete\b/.test(t0) && !/\b(hd|ssd|externo|case para hd|nas)\b/.test(t)) return 'gabinete';
  if (/^fonte\b/.test(t0) && /\b(atx|sfx|\d{3,4} ?w|80 ?plus|pfc|modular)\b/.test(t) && !/\b(notebook|laptop|carregador|celular|bancada|ajustavel|chaveada|led|cftv|camera|roteador)\b/.test(t)) return 'fonte';
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
      const p = gpuPcie(chip);
      s.pcie = p ? `PCIe ${p.gen}.0${p.lanes < 16 ? ` x${p.lanes}` : ''}` : null;
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
      const pg = cpuPcie(s.fabricante, s.modelo);
      s.pcie = pg ? `PCIe ${pg}.0` : null;
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
    case 'console': {
      s.plataforma = /\b(playstation|ps5)\b/.test(t) ? 'PlayStation' : /\bxbox\b/.test(t) && !/\bally\b/.test(t) ? 'Xbox' : /\b(nintendo|switch)\b/.test(t) ? 'Nintendo' : 'PC portátil';
      s.modelo =
        /\bps5 pro|playstation 5 pro\b/.test(t) ? 'PS5 Pro'
        : /\b(ps5|playstation 5)\b/.test(t) ? (/\bslim\b/.test(t) ? 'PS5 Slim' : 'PS5')
        : /\bseries x\b/.test(t) ? 'Xbox Series X'
        : /\bseries s\b/.test(t) ? 'Xbox Series S'
        : /\bswitch 2\b/.test(t) ? 'Switch 2'
        : /\bswitch oled\b|\boled\b.*\bswitch\b/.test(t) ? 'Switch OLED'
        : /\bswitch lite\b/.test(t) ? 'Switch Lite'
        : /\bswitch\b/.test(t) ? 'Switch'
        : /\bsteam deck\b/.test(t) ? 'Steam Deck'
        : /\bally\b/.test(t) ? 'ROG Ally'
        : /\blegion go\b/.test(t) ? 'Legion Go'
        : null;
      s.midia = /\b(digital|sem leitor|all digital)\b/.test(t) ? 'Digital' : /\b(com leitor|midia fisica|standard|edicao padrao)\b/.test(t) ? 'Com leitor de disco' : null;
      const c = gbs.find((g) => g.v >= 32);
      s.armazenamento = c ? Math.round(c.v) : null;
      break;
    }
    case 'teclado': {
      s.conexao = /\b(sem fio|wireless|bluetooth|2\.4 ?ghz|lightspeed|hyperspeed|tri-?mode)\b/.test(t) ? 'Sem fio' : 'Com fio';
      s.switch = /\b(magnetic|magnetico|hall effect|rapid trigger)\b/.test(t) ? 'Magnético' : /\bmecanico\b|\bswitch (red|blue|brown|yellow|black|silver|optic)/.test(t) ? 'Mecânico' : /\bmembrana\b/.test(t) ? 'Membrana' : null;
      s.formato = /\b(tkl|tenkeyless|80 ?%)\b/.test(t) ? 'TKL' : /\b75 ?%/.test(t) ? '75%' : /\b65 ?%/.test(t) ? '65%' : /\b60 ?%/.test(t) ? '60%' : /\b(full ?size|100 ?%)\b/.test(t) ? 'Full size' : null;
      s.layout = /\babnt ?2?\b/.test(t) ? 'ABNT2' : /\b(us|ansi|internacional)\b/.test(t) ? 'US' : null;
      break;
    }
    case 'mouse': {
      s.conexao = /\b(sem fio|wireless|bluetooth|2\.4 ?ghz|lightspeed|hyperspeed)\b/.test(t) ? 'Sem fio' : 'Com fio';
      const dpi = [...t.matchAll(/(\d{1,2}[.,]?\d{3})\s?dpi\b/g)].map((m) => +m[1].replace(/[.,]/g, '')).filter((v) => v >= 400 && v <= 60000);
      s.dpi = dpi.length ? Math.max(...dpi) : null;
      const g = /\b(\d{2,3})\s?g\b/.exec(t);
      s.peso = g && +g[1] >= 30 && +g[1] <= 160 ? +g[1] : null;
      break;
    }
    case 'fone': {
      s.tipo = /\bheadset\b|\bmicrofone\b.*\bgamer\b|\bgamer\b.*\bmicrofone\b/.test(t) ? 'Headset gamer' : /\b(earbuds?|tws|in-?ear|intra|airpods|buds)\b/.test(t) ? 'Intra-auricular' : 'Headphone';
      s.conexao = /\b(sem fio|wireless|bluetooth|2\.4 ?ghz|lightspeed|true wireless|tws)\b/.test(t) ? 'Sem fio' : 'Com fio';
      s.anc = /\b(anc|cancelamento (ativo )?de ruido|noise cancel)/.test(t) ? 'Com cancelamento de ruído' : null;
      s.surround = /\b(7\.1|surround|spatial|dolby atmos)\b/.test(t) ? 'Surround' : null;
      break;
    }
    case 'cooler': {
      s.tipo = /\b(water ?cooler|watercooler|refrigeracao liquida|aio)\b/.test(t) ? 'Water cooler' : /^(kit (com )?(\d+ )?)?(fans?|ventoinhas?)\b/.test(t) || /^ventoinha/.test(t) ? 'Ventoinha' : 'Air cooler';
      if (s.tipo === 'Water cooler') {
        const r = /\b(120|240|280|360|420)\s?mm\b/.exec(t);
        s.radiador = r ? +r[1] : null;
      }
      s.rgb = /\bargb\b/.test(t) ? 'ARGB' : /\brgb\b/.test(t) ? 'RGB' : /\b(sem (a)?rgb|non-?rgb)\b/.test(t) ? 'Sem RGB' : null;
      s.lcd = /\b(lcd|display|tela)\b/.test(t) ? 'Com tela' : null;
      break;
    }
    case 'gabinete': {
      s.formato = /\bfull[ -]?tower\b/.test(t) ? 'Full Tower' : /\bmid[ -]?tower\b/.test(t) ? 'Mid Tower' : /\b(mini[ -]?tower|mini[ -]?itx|sff)\b/.test(t) ? 'Mini / ITX' : /\b(micro[ -]?atx|m-?atx)\b/.test(t) && !/\b(e-?atx|\batx\b.*\batx\b)/.test(t) ? 'Micro-ATX' : null;
      s.vidro = /\bvidro\b|\btempered glass\b/.test(t) ? 'Vidro temperado' : null;
      s.aquario = /\b(aquario|panoramic|dual chamber|sem coluna)\b/.test(t) ? 'Aquário' : null;
      // "2x Vent 200mm + 1x FAN" = 3 ventoinhas
      const fans = [...t.matchAll(/\b(?:com )?(\d)\s?x?\s?(?:fans?|ventoinhas?|coolers?|vent)\b/g)].reduce((a, m) => a + +m[1], 0);
      s.fans = fans || (/\bsem (fans?|ventoinhas?|cooler)\b/.test(t) ? 0 : null);
      break;
    }
    case 'fonte': {
      const w = [...t.matchAll(/\b(\d{3,4})\s?w\b/g)].map((m) => +m[1]).filter((v) => v >= 300 && v <= 2000);
      s.potencia = w.length ? Math.max(...w) : null;
      const c = /80 ?plus (white|bronze|silver|gold|platinum|titanium)/.exec(t) || /\bcybenetics (bronze|silver|gold|platinum|titanium)\b/.exec(t);
      s.certificacao = c ? `80 Plus ${c[1][0].toUpperCase()}${c[1].slice(1)}` : /80 ?plus\b/.test(t) ? '80 Plus' : null;
      s.modular = /\b(full ?modular|totalmente modular|100% modular)\b/.test(t) ? 'Full modular' : /\bsemi[ -]?modular\b/.test(t) ? 'Semi modular' : /\bmodular\b/.test(t) && !/\bnao modular\b/.test(t) ? 'Full modular' : null;
      s.atx3 = /\batx ?3\.?[01]?\b|\bpcie ?5\.[01]\b|12v-?2x6|12vhpwr/.test(t) ? 'ATX 3 / PCIe 5' : null;
      break;
    }
    case 'mobo': {
      const ch = /\b([abhxz]\d{3})m?\b/.exec(t);
      s.chipset = ch ? ch[1].toUpperCase() : null;
      s.plataforma = /\b(am4|am5|a520|b450|b550|x570|a620|b650|x670|b850|x870)m?\b/.test(t) ? 'AMD' : 'Intel';
      s.ddr = /\bddr5\b/.test(t) ? 'DDR5' : /\bddr4\b/.test(t) ? 'DDR4' : null;
      s.formato = /\bmini[ -]?itx\b/.test(t) ? 'Mini-ITX' : /\b(micro ?atx|m-?atx|matx)\b/.test(t) || /\b[abhxz]\d{3}m\b/.test(t) ? 'Micro-ATX' : /\batx\b/.test(t) ? 'ATX' : null;
      s.wifi = /\bwi-?fi\b/.test(t) ? 'Wi-Fi' : null;
      // slots: quase nunca vêm no título; a coleta completa com a ficha técnica (moboSlotsFromSpec)
      const m2 = /\b(\d)\s?x?\s?(slots? )?m\.2\b/.exec(t);
      if (m2) s.m2 = +m2[1];
      else if (/\b(m\.2|nvme)\b/.test(t)) s.m2 = 'Sim';
      const x16 = /\b(\d)\s?x?\s?(slots? )?pci-?e?[^,]{0,10}x16\b/.exec(t);
      if (x16) s.pcie16 = +x16[1];
      const pg = moboPcie(t);
      s.pcie = pg ? `PCIe ${pg}.0` : null;
      break;
    }
  }
  for (const k of Object.keys(s)) if (s[k] == null) delete s[k];
  return s;
}

// ---------- Ficha técnica da placa-mãe ----------
// Cada fabricante escreve de um jeito:
//   ASUS:     "Slots de Expansão: 1 x slot PCIe 4.0 x16 ... Suporta um total de 2 slots M.2"
//   MSI:      "SLOTs: - 1x slot PCI-E x16 ... PCI_E1 Gen PCIe 4.0 suporta até x16 ... M.2_1, M.2_2"
//   Gigabyte: "1 slot PCI Express x16 (PCIEX16) ... 1 slot PCI Express x16 (PCIEX4) ... 1 x conector M.2"
// Quando a ficha repete o mesmo slot por geração de processador ("Ryzen 7000" / "Ryzen 8000"), só a 1ª variante conta.
const ENT = { atilde: 'ã', otilde: 'õ', ccedil: 'ç', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ecirc: 'ê', ocirc: 'ô', acirc: 'â', agrave: 'à', amp: '&', deg: '°', nbsp: ' ' };
function sheetLines(html) {
  const txt = html
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z]+);/gi, (e, n) => ENT[n.toLowerCase()] ?? ' ');
  return [...new Set(txt.split('\n').map((l) => strip(l).replace(/^[-*•·\s]+/, '')).filter(Boolean))];
}
function slotsFrom(lines) {
  const out = {};
  // PCIe x16 físicos (e a geração mais alta entre eles)
  const head = lines.findIndex((l) => /^(slots? de expansao|slots?|expansion slots?|expansao)\s*:?$/.test(l) || /^slots? de expansao\b/.test(l));
  const region = head >= 0 ? lines.slice(head + 1, head + 30) : lines;
  let procSeen = 0, skip = false, x16 = 0, found = false, gen = 0;
  for (const l of region) {
    if (head >= 0 && /^(armazenamento|storage|interface de armazenamento|rede|lan|usb|audio|conectores (internos|traseiros)|wireless)\b/.test(l)) break;
    // geração: a maior citada para um slot x16 ("pcle", com L, aparece em fichas da Gigabyte)
    const g = /pc[il][ -]?e(?:xpress)?\s*(?:gen\s*)?([345])\.0\b[^¶]{0,40}?x16|gen\s*([345])\b[^¶]{0,40}?x16/.exec(l);
    if (g) gen = Math.max(gen, +(g[1] || g[2]));
    if (/^processadores?\b|^cpu\b/.test(l) && l.length < 90 && !/slot/.test(l)) { procSeen++; skip = procSeen > 1; continue; }
    if (/\bchipset\b/.test(l)) skip = false;
    if (skip) continue;
    const m = /\b(\d)\s?x?\s?(?:slots?\s)?pc[il][ -]?e(?:xpress)?\b[^¶]*?\bx16\b/.exec(l);
    if (m && +m[1] <= 4) { x16 += +m[1]; found = true; }
  }
  if (found) out.pcie16 = x16;
  if (gen) out.pcieGen = gen;
  // M.2: total declarado > ids M.2_n distintos > soma dos "N x conector/slot M.2"
  const all = lines.join(' ¶ ');
  const tot = /total (?:suporta |de |suporta um total de )*(\d) slots? m\.2/.exec(all) || /\b(\d)\s?x\s?(?:slots?\s)?m\.2 (?:slots?|\(chave m|\(key m)/.exec(all);
  if (tot) out.m2 = +tot[1];
  else {
    const ids = new Set([...all.matchAll(/\bm\.?2_(\d)\b/g)].map((m) => m[1]));
    if (ids.size) out.m2 = ids.size;
    else {
      // A Gigabyte lista cada conector ("1 x conector M.2 (M2A_CPU)", "1 x ... (M2B_SB)") e depois
      // repete o total ("2 x conectores M.2 soquete 3"): vale o maior entre a soma dos conectores
      // identificados e a maior contagem de uma linha só — somar tudo contaria em dobro.
      const hits = lines
        .filter((l) => !/wi-?fi|wireless|key-?e|chave e|sem fio/.test(l))
        .map((l) => ({ l, m: /^(\d)\s?x?\s?(?:conector(?:es)?|slots?)\s+m\.2\b/.exec(l) }))
        .filter((h) => h.m);
      const byId = hits.filter((h) => /\(m\.?2[a-z]?_?\w*\)/.test(h.l)).reduce((a, h) => a + +h.m[1], 0);
      const single = Math.max(0, ...hits.map((h) => +h.m[1]));
      const n = Math.max(byId, single);
      if (n) out.m2 = n;
    }
  }
  return out;
}
// html = ficha técnica; desc = descrição (só completa o que a ficha não disse)
export function moboSlotsFromSpec(html, desc = '') {
  const a = slotsFrom(sheetLines(html || ''));
  if (a.pcie16 != null && a.m2 != null && a.pcieGen) return a;
  const b = slotsFrom(sheetLines(desc || ''));
  return { ...b, ...a };
}

// ---------- Geração PCIe ----------
// Placa-mãe pelo chipset (quando a ficha não diz): geração do slot x16 principal.
// Chipsets em que isso varia de modelo para modelo (B850, B760, B860, H810) ficam sem.
const CHIPSET_PCIE = { a320: 3, b350: 3, x370: 3, b450: 3, x470: 3, a520: 3, b550: 4, x570: 4, a620: 4, b650: 4, b650e: 5, x670: 4, x670e: 5, x870: 5, x870e: 5, h410: 3, b460: 3, h470: 3, z490: 3, h510: 3, b560: 4, z590: 4, h610: 4, b660: 4, z690: 5, z790: 5, z890: 5 };
function moboPcie(t) {
  const m = /pcie?\s*([345])\.0\s*x16/.exec(t);
  if (m) return +m[1];
  const ch = /\b([abhxz]\d{3}e?)m?\b/.exec(t);
  return ch ? CHIPSET_PCIE[ch[1]] || null : null;
}
// Processador pelo modelo.
function cpuPcie(fab, modelo) {
  if (!modelo) return null;
  const mm = /^(\d{3,5})([A-Z0-9]*)$/.exec(modelo);
  if (!mm) return null;
  const n = mm[1], suf = mm[2];
  if (fab === 'AMD') {
    if (n.length !== 4) return null;
    const d = n[0];
    if (d === '9' || d === '7') return 5;
    if (d === '8') return 4; // Ryzen 8000G/F (APUs Phoenix)
    if (d === '5') {
      // APUs Cezanne (5600G, 5500GT...) e os 5500/5700 "sem letra" são PCIe 3.0; o resto (5600, 5700X, X3D...) é 4.0
      if (suf.includes('G') || (!suf && ['5500', '5700', '5300'].includes(n))) return 3;
      return 4;
    }
    if (d === '4') return 3;
    if (d === '3') return suf.startsWith('G') ? 3 : 4;
    return 3;
  }
  if (fab === 'Intel') {
    if (n.length === 3) return 5; // Core Ultra 200S (ex.: 265K)
    if (n.length === 5) {
      const g = +n.slice(0, 2);
      return g >= 12 ? 5 : g === 11 ? 4 : 3;
    }
    return 3;
  }
  return null;
}
// Placa de vídeo pelo chip: geração e nº de linhas (só quando não é x16).
function gpuPcie(chip) {
  if (!chip) return null;
  const c = chip.replace(/\s+/g, ' ');
  let gen = null;
  if (/^RTX 50/.test(c) || /^RX 9/.test(c)) gen = 5;
  else if (/^RTX [34]0/.test(c) || /^RX [567]\d{3}/.test(c) || /^Arc/.test(c)) gen = 4;
  else if (/^RTX 20|^GTX/.test(c) || /^RX [45]\d{2}$/.test(c)) gen = 3;
  if (!gen) return null;
  const lanes =
    /^RTX (5050|5060|4060|3050)/.test(c) || /^RX (7600|66[05]0|6600|5500)/.test(c) || /^Arc (B5[78]0|A380)/.test(c) ? 8
    : /^RX (6500|6400)/.test(c) ? 4
    : 16;
  return { gen, lanes };
}
export { fmtStorage };
