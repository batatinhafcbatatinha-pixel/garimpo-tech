# Modo live e histórico de preços — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão Live que traz posts novos do Telegram em segundos (conta própria via gramjs ou `t.me/s`), e verificação do desconto contra histórico de preços (nosso + Zoom/Buscapé até o nosso encher), tirando da lista 50%+ o que for inflado.

**Architecture:** `scrape.mjs` vira importável (exporta parse/build; `main()` só roda direto). Histórico em `scraper/history.mjs` (puro, testável), alimentado pela coleta e aplicado dentro de `build()`. Externo em `scraper/external.mjs` (Chrome headless + cache). Live em `scraper/live.mjs` rodando dentro de `server.mjs`, reusando `parseTelegramPost` e `build()`; conta do Telegram isolada em `scraper/tg-account.mjs` (único arquivo que importa gramjs). Estado que sobrevive entre processos (expirados, referências KaBuM) em `data/local/state.json`.

**Tech Stack:** Node 20+ (local: `%USERPROFILE%\tools\node-v26.13.1-win-x64`, fora do PATH do shell — exporte antes de rodar), `node:test`, gramjs (npm `telegram`), Chrome/Edge headless já usado pelo projeto.

**Spec:** `docs/superpowers/specs/2026-11-27-modo-live-e-historico-design.md`

## Global Constraints

- Só a branch `main` muda. A branch `site` e o workflow `.github/workflows/update.yml` não mudam.
- Histórico, externo e live só ligam quando `DATA_FILE` está definido (versão local). Sem `DATA_FILE`, `scrape.mjs` se comporta exatamente como hoje.
- Única dependência npm: `telegram` (gramjs), versão exata fixada no `package.json`. Ela só é carregada por `import()` dinâmico em `tg-account.mjs`; sem `node_modules`, tudo o mais funciona.
- Tudo do usuário em `data/local/` (já no `.gitignore`). Sessão do Telegram nunca em log, nunca fora do PC.
- O garimpo nunca entra em canal nem manda mensagem sem clique explícito do usuário.
- Textos da interface em português, no tom do README atual.
- Testes: `node --test test/` (pasta nova `test/`). Rodar com `export PATH="$HOME/tools/node-v26.13.1-win-x64:$PATH"` no bash.
- Números do spec: histórico 90 dias; cheio = ≥ 20 dias com preço nos últimos 30; sem referência se < 7 dias de dados; referência = mediana dos `shelf` diários dos 30 dias anteriores ao `firstSeen`; externo: máx. 40 consultas/coleta, 3–6 s entre elas, cache 24 h; `t.me/s`: 1ª página, 2–5 s entre canais, volta a cada 45–90 s, backoff 1→2→4… até 15 min, 5 falhas seguidas = pausa de 30 min.

## Review Focus

1. **Coleta completa rodando enquanto o live grava** — o post do live (ou o "esgotou") tem que continuar na página depois que a coleta termina. Teste em Task 9 (`reapplyAfterCollect`).
2. **Página maliciosa chamando `localhost:4322/api/telegram/*`** — login/logout/join só aceitam `Origin` igual ao do próprio servidor; senão 403. Teste em Task 9.
3. **Arquivo `history.json`/`state.json` corrompido ou ausente** — coleta segue sem histórico, não quebra. Teste em Task 3 e Task 5.
4. **Zoom/Buscapé devolvendo produto parecido mas diferente** (ex.: RTX 4060 Ti para RTX 4060) — resultado descartado pela `modelKey`. Teste em Task 7.
5. **gramjs não instalado ou sessão revogada pelo celular** — live cai para `t.me/s` e a página mostra o motivo, sem travar o servidor. Teste em Task 8.

---

### Task 1: `scrape.mjs` importável + base de testes

**Files:**
- Modify: `scraper/scrape.mjs` (exports; guarda do `main()`; extrair parse da página `t.me/s` de `telegram()` linhas 588–633)
- Create: `package.json`, `test/scrape.test.mjs`, `test/fixtures/tme-page.html`

**Interfaces:**
- Produces (exports de `scraper/scrape.mjs`): `makeDeal`, `parseTelegramPost(text, meta)`, `tgText(html)`, `parseTmePage(html) -> Array<{channel, postId:number, postedAt, image, text}>`, `build(prev, results, now, opts?)`, `save(payload)`, `notify(newDeals, newRadar, newCoupons, topic = NTFY_TOPIC)`, `get`, `browserHtml`, `EXPIRED_IDS`, `EXPIRED_CODES`, `COUPONS`, `REFS`, `TG_CHANNELS`, `MIN_DISCOUNT`, `KEEP_HOURS`, `log`, `sleep`.

- [ ] **Step 1:** `package.json` com `{"name":"garimpo","private":true,"type":"module","scripts":{"test":"node --test test/"}}` (sem dependências ainda).
- [ ] **Step 2:** Salvar `test/fixtures/tme-page.html`: baixar `https://t.me/s/pcdofafapromo` uma vez e cortar para 3 posts (um de produto com `R$` e cupom, um "Esgotou CODIGO", um de cupom de loja).
- [ ] **Step 3: Testes que falham** em `test/scrape.test.mjs`:
  - `import` de `../scraper/scrape.mjs` não dispara coleta (nenhum `fetch`: troque `globalThis.fetch` por um que lança antes do import).
  - `parseTmePage(fixture)` retorna 3 posts com `channel === 'pcdofafapromo'`, `postId` numérico, `text` contendo `R$` no primeiro.
  - `parseTelegramPost` do post "Esgotou X" retorna `undefined` e adiciona `X` em `EXPIRED_CODES`.
- [ ] **Step 4:** Rodar `node --test test/` → FAIL (nada exportado; import roda `main()`).
- [ ] **Step 5:** Implementar: `export` nos nomes acima; `telegram()` passa a usar `parseTmePage`; final do arquivo vira `if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(...)`. `notify` ganha o parâmetro `topic`.
- [ ] **Step 6:** `node --test test/` → PASS. E `SKIP_BROWSER=1 DATA_FILE=data/local/test-deals.json node scraper/scrape.mjs` ainda coleta e grava (apague o arquivo depois).
- [ ] **Step 7:** Commit `Coletor importável e primeiros testes`.

### Task 2: `modelKey` igual entre lojas

**Files:**
- Modify: `scraper/classify.mjs`
- Test: `test/modelkey.test.mjs`

**Interfaces:**
- Produces: `export function modelKey(d: {category, brand, title, specs}) -> string | null`, formato `categoria|marca|código` em minúsculas sem acento.

Regras (spec): CPU → `cpu|<marca>|<specs.modelo>`; GPU → `gpu|<marca>|<linha>|<chip>|<vram>gb` (linha = primeira palavra da série da placa no título após a marca, ex. `dual`, `ventus`, `windforce`; se não achar, omite o pedaço); demais → código do modelo do título: token de 4+ caracteres com letra **e** dígito, que não seja medida (`16gb`, `1tb`, `3200mhz`, `144hz`, `27pol`, `ddr4`, `pcie4`, `gen4`) — o primeiro que sobrar; SSD/RAM acrescentam `|<capacidade>`. Sem código → `null`.

- [ ] **Step 1: Testes que falham:**
  - `modelKey` de "Processador AMD Ryzen 7 5700X AM4" (KaBuM) === de "Ryzen 7 5700X 3.4GHz Box" (Telegram), e começa com `cpu|amd|5700x`.
  - "Placa de Vídeo ASUS Dual RTX 4060 8GB" ≠ "ASUS Dual RTX 4060 Ti 8GB".
  - "SSD WD Black SN770 1TB NVMe" === "WD_BLACK SN770 1TB M.2 2280" → `ssd|wd|sn770|1000` (capacidade conforme `specs.capacidade`).
  - "Mouse Logitech G502 Hero" → contém `g502`.
  - "Teclado Gamer RGB ABNT2" → `null`.
- [ ] **Step 2:** `node --test test/modelkey.test.mjs` → FAIL.
- [ ] **Step 3:** Implementar `modelKey` em `classify.mjs` usando `strip`, `detectBrand` já existentes.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `Chave de modelo entre lojas`.

### Task 3: Histórico (`scraper/history.mjs`)

**Files:**
- Create: `scraper/history.mjs`, `test/history.test.mjs`

**Interfaces:**
- Produces:
  - `loadJson(path, fallback) -> Promise<object>` (arquivo ausente ou JSON inválido → `fallback`, com log)
  - `saveJson(path, obj) -> Promise<void>` (temporário + rename, como `save()`)
  - `recordPrice(hist, { key, title, category, store, price, coupon:boolean }, day:'YYYY-MM-DD')` — guarda o menor do dia em `days[day][store].shelf` ou `.coupon`
  - `prune(hist, today, keepDays = 90)`
  - `isFull(hist, key, today) -> boolean` (≥ 20 dias distintos com `shelf` nos 30 dias até hoje)
  - `reference(hist, ext, key, firstSeen:ISO) -> { median, min, days, source:'nosso'|'nosso+zoom'|'nosso+buscape' } | null` — dias dos 30 anteriores à data de `firstSeen` (exclusive); por dia, menor `shelf` entre lojas; se não cheio, dias faltantes vêm de `ext[key].days`; < 7 dias → `null`
  - `verify(deals, hist, ext, minDiscount) -> { kept, removed:number }` — `realDiscount = round((1 − price/median)·100)`; `< minDiscount` → removida; mantida ganha `d.hist = { min30, median30, source }`; sem chave ou sem referência → mantida sem `hist`

- [ ] **Step 1: Testes que falham** (datas fixas, ex. hoje `2026-11-27`):
  - `recordPrice` duas vezes no dia com 900 e 850 → `shelf === 850`; com `coupon:true` 700 → `coupon === 700`, `shelf` continua 850.
  - `prune` remove dia de 91 dias atrás, mantém 90.
  - `isFull`: 20 dias → true; 19 → false; 20 dias mas só `coupon` → false.
  - `reference`: 10 dias a 1000 antes do `firstSeen` + 5 dias a 400 **depois** do `firstSeen` → `median === 1000`.
  - `reference`: 6 dias → `null`; 4 nossos + 3 do `ext` → não-null, `source === 'nosso+zoom'`.
  - `reference` com histórico cheio ignora `ext` (`source === 'nosso'`).
  - `verify`: preço 600, mediana 1000 (40%) com min 50 → `removed === 1`, `kept` vazio; preço 450 → mantida com `hist.median30 === 1000`.
  - `loadJson` de arquivo com `{quebrado` → devolve `fallback`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `Histórico de preços: gravação e referência`.

### Task 4: Histórico ligado à coleta e ao `build()`

**Files:**
- Modify: `scraper/scrape.mjs` (`kabum()` laço linha ~341; `main()`; `build()`)
- Test: `test/build-history.test.mjs`

**Interfaces:**
- Consumes: Task 2 `modelKey`, Task 3 `recordPrice/prune/verify/loadJson/saveJson`.
- Produces: `build(prev, results, now, { hist, ext } = {})` — com `hist`, aplica `verify` em `deals` (nunca no radar) e grava `payload.sources.historico = { ok:true, count: removed }`; payload passa a ter `removedInflated: number`. `HIST_FILE = join(dirname(DATA_FILE), 'history.json')` quando `DATA_FILE` existe.

- [ ] **Step 1: Teste que falha:** `build({deals:[]}, { kabum:{ ok:true, deals:[dealInflado, dealBom] } }, now, { hist, ext:{} })` com `hist` de 10 dias a 1000 para a chave de ambos: `dealInflado` (600, "de" 1300) some de `payload.deals` **e** não está em `payload.radar`; `dealBom` (450) fica com `hist`; `payload.removedInflated === 1`. Sem `opts` → os dois ficam (comportamento atual).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar `verify` dentro de `build`. Em `main()`, quando `DATA_FILE`: carregar `hist` no início; no laço do KaBuM, para **todo** item disponível não-openbox, montar o item via `detectCategory/detectBrand/extractSpecs/modelKey` e `recordPrice(..., coupon:false)` com `price_with_discount || price`; no fim, `recordPrice` de cada deal/radar de `results` (`coupon: !!d.coupon`), `prune`, `saveJson`. `partial()` e o build final recebem `{ hist, ext }`.
- [ ] **Step 4:** PASS; coleta local real (`SKIP_BROWSER=1`) cria `data/local/history.json` com milhares de chaves.
- [ ] **Step 5:** Commit `Coleta grava histórico e tira ofertas infladas`.

### Task 5: Estado entre processos (`state.json`)

**Files:**
- Create: `scraper/state.mjs`, `test/state.test.mjs`
- Modify: `scraper/scrape.mjs` (`main()` início e fim; `buildRefs`)

**Interfaces:**
- Produces: `loadState(path) -> { expiredIds:{[id]:iso}, expiredCodes:{[code]:iso}, refs:{[key]:number} }`; `applyState(st)` — semeia `EXPIRED_IDS`, `EXPIRED_CODES`, `REFS`; `captureState(prevSt, now, keepHours) -> st` — junta os sets atuais com data `now` para os novos, descarta > `keepHours`, `refs` = `REFS` atual se não vazio, senão os anteriores. `STATE_FILE = join(dirname(DATA_FILE), 'state.json')`.

- [ ] **Step 1: Testes que falham:** código expirado salvo há 10 h volta após `applyState`; salvo há 73 h (keep 72) some em `captureState`; `refs` vazio no processo mantém `refs` anteriores; arquivo ausente → estado vazio sem erro.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar; `main()` chama `applyState(loadState())` antes de tudo e salva `captureState` antes do `save(payload)` final.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `Expirados e referências guardados entre coletas`.

### Task 6: Spike Zoom / Buscapé (descartável)

**Files:**
- Create: `scratch/spike-external.mjs` (não commitar o script; commitar só as notas)
- Modify: este plano, seção "Resultado do spike" no fim

- [ ] **Step 1:** Com `browserHtml` exportado (Task 1), abrir no Chrome headless a busca `https://www.zoom.com.br/search?q=ryzen%207%205700x` e a página de um produto; idem `https://www.buscape.com.br/search?q=ryzen%207%205700x`.
- [ ] **Step 2:** Anotar para cada site: passou do Cloudflare? Onde está o histórico (`__NEXT_DATA__`, chamada XHR com JSON, só SVG)? Quantos dias vêm? Qual seletor/caminho dá a lista de resultados com título e URL?
- [ ] **Step 3:** Salvar HTML/JSON reduzidos em `test/fixtures/zoom-search.html`, `zoom-product.html` (e Buscapé, se passou).
- [ ] **Step 4:** Escrever o resultado no fim deste plano e commitar fixtures + plano: `Spike: histórico no Zoom/Buscapé`. Se nenhum site passou, Task 7 vira só "pular" (marcar como não aplicável) e o resto segue.

### Task 7: Histórico externo (`scraper/external.mjs`)

**Files:**
- Create: `scraper/external.mjs`, `test/external.test.mjs`
- Modify: `scraper/scrape.mjs` (`main()`, entre `enrichMobos` e o build final)

**Interfaces:**
- Consumes: `browserHtml`, `modelKey`, `isFull`, `loadJson/saveJson`.
- Produces:
  - adaptadores `SITES = { zoom: { search(html) -> [{title,url}], history(html) -> {[day]:price} }, buscape: {...} }` (parse puro, a partir do spike)
  - `enrichExternal(candidates, { hist, ext, fetchHtml, now, limit = 40, pause = [3000, 6000] }) -> { looked, hits }` — candidatos = deals com desconto anunciado ≥ MIN, com chave, sem `isFull`, sem cache < 24 h em `ext[key].at`. Uma consulta por vez. Aceita resultado só se `modelKey({category, brand, title: resultado.title})` === chave da oferta. Grava `ext[key] = { at, source, days }` (inclusive `days: {}` para "não encontrado"). Captcha/bloqueio (HTML sem resultados e com marcador de desafio do Cloudflare) desliga o site pelo resto da chamada.
  - `EXT_FILE = join(dirname(DATA_FILE), 'external-history.json')`.

- [ ] **Step 1: Testes que falham** (com `fetchHtml` falso lendo fixtures):
  - parse das fixtures do spike dá ≥ 1 resultado e ≥ 7 dias de preço.
  - resultado "RTX 4060 Ti" para oferta "RTX 4060" → descartado, `ext[key].days` vazio.
  - 50 candidatos → só 40 chamadas a `fetchHtml`.
  - cache de 2 h → não consulta; cache de 25 h → consulta.
  - modelo cheio → não consulta.
  - 1ª resposta é desafio do Cloudflare no Zoom → nenhuma outra chamada ao Zoom, segue no Buscapé.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar; em `main()` (só com `DATA_FILE`), chamar `enrichExternal` com os deals de `build` parcial, salvar `ext`, depois o build final usa `{ hist, ext }`.
- [ ] **Step 4:** PASS; coleta local real loga `externo: N consultas, M com histórico`.
- [ ] **Step 5:** Commit `Histórico do Zoom/Buscapé enquanto o nosso enche`.

### Task 8: Live — núcleo, modo `t.me/s` e conta (gramjs)

**Files:**
- Create: `scraper/live.mjs`, `scraper/tg-account.mjs`, `test/live.test.mjs`
- Modify: `package.json` (dependência `telegram` com versão exata via `npm install telegram --save-exact`)

**Interfaces:**
- Consumes: Task 1 exports, Task 3/5.
- Produces (`live.mjs`):
  - `createLive({ dataFile, localDir, channels, getTopic, onChange, log, fetchText = get, now = () => new Date() })` → `{ start(), stop(), status(), handlePosts(posts), reapplyAfterCollect(sinceIso), login(...), ... }`
  - `status()` → `{ on, mode:'account'|'tme', user, lastPostAt, error, gramjs:boolean, channels:[{ name, joined, paused, until }] }`
  - `handlePosts(posts: Array<{channel, postId, postedAt, image, text, edited?}>)` — `parseTelegramPost` em cada; lê `deals.json` como `prev`; `build(prev, { live:{ ok:true, deals } }, now, { hist, ext })`; `save`; `captureState` + salvar; `notify` dos novos com `getTopic()`; guarda `{ at, deals, expiredIds, expiredCodes }` em `journal`; chama `onChange()`.
  - `reapplyAfterCollect(sinceIso)` — reaplica tudo do `journal` com `at >= sinceIso` (deals e expirados) sobre o `deals.json` novo; esvazia o que for mais velho.
  - Poller `t.me/s` interno: `nextDelay(failures) -> ms` (0 falhas: 45–90 s sorteado; n falhas: `min(2^(n-1)·60 s, 15 min)`; ≥ 5 → pausa 30 min); guarda `lastId[channel]`, só passa posts com `postId > lastId` (na 1ª leitura só registra o maior id, não processa o passado).
- Produces (`tg-account.mjs`):
  - `available() -> Promise<boolean>` (consegue `import('telegram')`)
  - `startLogin({ apiId, apiHash, phone }) -> { step:'code' }`, `submitCode(code) -> { step:'password'|'done' }`, `submitPassword(pw) -> { step:'done' }`, `logout()`
  - `connect({ onPost, onError }) -> { user, joined:Set<string> }` — sessão de `data/local/telegram-session.txt`, credenciais de `data/local/telegram.json`; handlers `NewMessage` e `EditedMessage` filtrados pelos canais; `onPost({channel, postId, postedAt, image:null, text, edited})`
  - `join(channel)`
  - `entitiesToText(message) -> string` — texto com a URL de cada entidade `MessageEntityTextUrl` inserida como ` url ` logo após o trecho (mesmo formato que `tgText` produz)
- No live: canais seguidos pela conta → eventos; não seguidos (ou sem conta) → poller. Erro de sessão (`AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`) ou gramjs ausente → tudo no poller, `status().error` com o motivo. `FLOOD_WAIT_X` → espera X s.

- [ ] **Step 1: Testes que falham** (`live.test.mjs`, com `dataFile` em diretório temporário e `fetchText` falso):
  - 1ª volta do poller com fixture → nenhum post processado; 2ª volta com post de id maior → `handlePosts` chamado com 1 post.
  - `nextDelay(0)` entre 45 000 e 90 000; `nextDelay(1) === 60000`; `nextDelay(4) === 480000`; `nextDelay(5)` = 30 min.
  - `handlePosts` com post de produto → aparece em `radar`/`deals` do `deals.json`; depois post "Esgotou CODE" → oferta com esse cupom some.
  - `reapplyAfterCollect`: grava post via `handlePosts`, sobrescreve `deals.json` com um payload "da coleta" sem ele, chama `reapplyAfterCollect(início)` → post volta; um "esgotou" registrado também continua valendo.
  - `entitiesToText` com mensagem falsa `{ message:'Monitor X R$ 899 Comprar', entities:[{className:'MessageEntityTextUrl', offset:18, length:7, url:'https://meli.la/abc'}] }` → contém `https://meli.la/abc`, e `parseTelegramPost` do resultado acha a URL.
  - `available()` falso (mock) → `status().mode === 'tme'` e `error` preenchido ao tentar modo conta.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npm install telegram --save-exact`; implementar os dois arquivos.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `Modo live: t.me/s e conta do Telegram`.

### Task 9: Servidor — endpoints do live e reconciliação com a coleta

**Files:**
- Modify: `server.mjs`
- Test: `test/server.test.mjs` (sobe o servidor numa porta livre com `PORT`, `LOCAL_DIR` temporário via env `GARIMPO_LOCAL_DIR`)

**Interfaces:**
- Consumes: `createLive` (Task 8).
- Produces HTTP:
  - `GET /api/live` → `live.status()`
  - `POST /api/live` `{ on:boolean }` → liga/desliga, salva `settings.live`
  - `POST /api/telegram/login` `{ apiId, apiHash, phone }`, `/code` `{ code }`, `/password` `{ password }`, `/logout`, `/join` `{ channel }`
  - SSE: `event: live` com `status()` a cada mudança; `event: partial` após cada `handlePosts`
- `settings.live` restaurado no boot (liga o live se estava ligado). Ao fim de cada coleta com sucesso: `live.reapplyAfterCollect(state.startedAt)` **antes** do `send('updated')`. Coleta recebe `NTFY_TOPIC` como hoje; live recebe `getTopic: () => settings.ntfyTopic`.
- Todo `POST` exige `Origin` ausente ou igual a `http://localhost:PORT`/`http://127.0.0.1:PORT`; senão 403.

- [ ] **Step 1: Testes que falham:** `POST /api/telegram/login` com `Origin: https://evil.example` → 403; `POST /api/live {on:true}` → `GET /api/live` mostra `on:true` e `settings.json` tem `live:true`; respostas nunca contêm `apiHash` nem a sessão.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar (e `GARIMPO_LOCAL_DIR` opcional para os testes).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `Servidor: live, login do Telegram e coleta convivendo`.

### Task 10: Página — botão Live, painel do Telegram, linha do histórico

**Files:**
- Modify: `index.html` (topbar, ao lado de `#f5Box`; template do card), `assets/app.js` (`connectLocal`, `card`, `renderStats`), `assets/styles.css`

**Interfaces:**
- Consumes: endpoints da Task 9; `d.hist` (Task 3); `META.removedInflated` (Task 4).

- [ ] **Step 1:** Botão `#liveBtn` (só local, `hidden` no site): desligado "Live"; ligado com bolinha pulsando e título "último post há Xs" (`status().lastPostAt`); clique → `POST /api/live`.
- [ ] **Step 2:** Painel (reusar o padrão de "sheet" do painel de Alertas, `openSheet`): sem login → passo 1 `api_id`/`api_hash` com link para `https://my.telegram.org/apps` e duas linhas de explicação; passo 2 telefone; passo 3 código; passo 4 senha (se pedida); botão "Usar sem conta". Com login → "Conectado como <nome>", lista de canais com estado (seguido / lido pelo t.me/s / pausado até HH:MM) e botão **Seguir** nos não seguidos; botão **Sair**. Se `gramjs:false`: aviso "Para entrar com sua conta, rode `npm install` na pasta do Garimpo".
- [ ] **Step 3:** No card com `d.hist`: linha "menor em 30 dias R$ X · mediana R$ Y · <histórico próprio|Zoom|Buscapé>".
- [ ] **Step 4:** Em `renderStats`/nota da visão 50%+: "N ofertas removidas por preço inflado" quando `META.removedInflated > 0`.
- [ ] **Step 5: Verificação manual** com `node server.mjs --open`: ligar Live → indicador pulsa; desligar e religar o servidor → volta ligado; card com histórico mostra a linha; site publicado (abrir `index.html` sem servidor) não mostra o botão.
- [ ] **Step 6:** Commit `Página: botão Live e painel do Telegram`.

### Task 11: README e `.bat`

**Files:**
- Modify: `README.md`, `Abrir Garimpo.bat`

- [ ] **Step 1:** `.bat`: depois de achar o node, `if not exist node_modules\telegram call npm install --no-fund --no-audit` (falha do npm não impede abrir o servidor).
- [ ] **Step 2:** README: seção "Modo live" (com conta / sem conta, o que o garimpo faz e não faz na conta, onde fica a sessão), seção "Histórico de preços" (nosso, Zoom/Buscapé até encher, regra de 20/30 dias, oferta inflada some), atualizar "Limitações" (tirar "O preço 'de' é o que a loja anuncia" ou ajustar para "até o histórico encher").
- [ ] **Step 3:** `node --test test/` → tudo PASS.
- [ ] **Step 4:** Commit `README: modo live e histórico`.

---

## Resultado do spike

Feito em 2026-11-27, do PC (IP residencial):

- **Zoom e Buscapé são a mesma plataforma** (mesmo Next.js, mesmos dados). Os dois responderam 200 a um `fetch` comum com user-agent de navegador: **não precisa de Chrome headless**.
- **Busca:** `https://www.zoom.com.br/search?q=<termo>` → `__NEXT_DATA__` → `props.initialReduxState.hits.hits[]` com `name` e `url` (`/processador/<slug>`). Itens com `url` começando em `/lead?` são ofertas avulsas, não produto: ignorar.
- **Produto:** `https://www.zoom.com.br<url>` → `__NEXT_DATA__` → `props.initialReduxState.priceHistory.priceHistory[<id>].days[]` com `{ date: "AAAA-MM-DD", price }`. **40 dias**.
- Buscapé (`www.buscape.com.br`, mesmos caminhos) fica como reserva quando o Zoom bloquear.
- Fixtures: `test/fixtures/zoom-search.html`, `test/fixtures/zoom-product.html`.
