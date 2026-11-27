# Modo live (Telegram) e histórico de preços — design

Data: 2026-11-27 · Branch: `main` (versão local). A branch `site` não muda.

## Por quê

1. **Preço "de" inflado.** As lojas sobem o preço "de" para o desconto parecer 50%+. Hoje o garimpo confia no que a loja anuncia (ou no preço regular do KaBuM). Queremos conferir contra o histórico real de preço e tirar da lista 50%+ o que não é desconto de verdade.
2. **Lives de loja.** Promoções relâmpago saem no Telegram e esgotam em minutos. A coleta roda no máximo a cada 10 min e lê tudo; precisamos de um modo que pegue os posts novos na hora, sem fazer o IP do usuário ser banido.

## Objetivos

- Botão **Live** na versão local: posts novos dos canais de Telegram entram na página e disparam alertas (navegador e ntfy) em segundos.
- Cada pessoa usa a **própria conta** do Telegram (opcional). Sem conta, o live funciona por leitura periódica de `t.me/s`.
- **Histórico nosso** de preços, gravado a cada coleta.
- **Histórico externo** (Zoom, Buscapé) só enquanto o nosso ainda não está cheio para aquele modelo.
- Oferta com desconto real abaixo de `MIN_DISCOUNT` **some da lista 50%+** (não vai para o Radar nem para lugar nenhum).

## Não-objetivos

- Verificar se cupom ainda funciona (descartado pelo usuário).
- Live e histórico na versão online (`site` / GitHub Actions).
- Varrer o catálogo do Zoom/Buscapé; só se consulta o que já é candidato a 50%+.
- Compartilhar uma conta de Telegram entre pessoas.

## Anti-objetivos (seria fracasso mesmo funcionando)

- IP do usuário bloqueado no Telegram, Zoom ou Buscapé.
- Conta do Telegram do usuário derrubada, ou o garimpo fazendo algo na conta sem ele pedir (entrar em canal, mandar mensagem).
- Sessão do Telegram vazando para o git ou para fora do PC.
- A coleta normal ficar quebrada ou mais lenta para quem não usa o live.

## Restrições

- Projeto hoje sem dependências npm. Node 20+, Chrome/Edge instalados.
- Tudo que é do usuário fica em `data/local/` (já no `.gitignore`).
- Reaproveitar o parser existente (`parseTelegramPost`), a lógica de expirados (`EXPIRED_IDS`, `EXPIRED_CODES`), o envio parcial (`@@partial` + SSE `/api/events`) e o `notify()` do ntfy.

## Abordagens consideradas

| Decisão | Opções | Escolhida | Por quê |
|---|---|---|---|
| Cliente Telegram | **gramjs** (npm `telegram`) · TDLib (nativo) | gramjs | JS puro, sem compilar. TDLib é ~30 MB nativo por sistema. |
| Guardar histórico | **JSON em `data/local/history.json`** · `node:sqlite` | JSON | Segue o padrão do projeto; `node:sqlite` exigiria Node 22.5+. |
| Histórico externo | **Chrome headless só para candidatos, com cache** · fetch direto · varredura ampla | headless + cache | Zoom/Buscapé têm Cloudflare; o headless já passa na Pichau/Terabyte do IP residencial. Poucas consultas = baixo risco. |
| Oferta inflada | **Sumir** · ir para o Radar com aviso | Sumir | Decisão do usuário. |
| Externo depois do nosso cheio | Continuar usando · **parar** | Parar | Decisão do usuário. |

gramjs é a primeira dependência do projeto: entra um `package.json` com ela, e o modo live com conta só carrega gramjs se estiver instalado (`import()` dinâmico). Sem ela, a coleta e o live por `t.me/s` funcionam normalmente; a página mostra "instale com `npm install`" no lugar do login. O `Abrir Garimpo.bat` roda `npm install` se `node_modules` não existir.

## Parte 1 — Modo live

### Na página

- Botão **Live** no topo (só versão local), ao lado de "Coletar a cada". Ligado: indicador pulsando e "último post há Xs".
- Painel do Telegram (aberto pelo botão ou por uma engrenagem ao lado):
  - Sem login: campos `api_id`, `api_hash` (com link e 2 linhas explicando my.telegram.org), telefone → código → senha de 2 etapas se houver. Botão "Usar sem conta" mantém o modo `t.me/s`.
  - Com login: "Conectado como Fulano", botão **Sair** (apaga a sessão e faz logout no Telegram).
- O estado do Live (ligado/desligado) é salvo nas configurações locais, como o "F5 coleta", e volta ligado se o servidor reiniciar. *(chamada minha)*

### No servidor (`server.mjs` + novo `scraper/live.mjs`)

- O live roda dentro do processo do servidor (não é um processo de coleta), independente do intervalo da coleta completa.
- Cada post novo ou **editado** passa por `parseTelegramPost`. Resultado:
  - oferta/radar/cupom novo → junta em `data/local/deals.json` (mesma estrutura e regras de `build`, incluindo a regra do histórico da Parte 2), manda evento SSE para a página e dispara alertas/ntfy;
  - post de "esgotado/encerrado" (inclusive edição de um post antigo) → remove a oferta e os códigos citados na hora.
- **Estado compartilhado** *(chamada minha)*: hoje `EXPIRED_IDS`, `EXPIRED_CODES`, `COUPONS` e os preços de referência do KaBuM (`refSamples`) vivem só na memória de uma coleta. Eles passam a ser salvos em `data/local/state.json`:
  - expirados com data, guardados por `KEEP_HOURS`;
  - referências do KaBuM substituídas a cada coleta completa.

  A coleta lê esse arquivo ao começar e o grava ao terminar; o live lê e grava a cada post. Assim um "esgotou" visto no live não é desfeito pela coleta seguinte, e um post do live sem preço "de" já usa o preço regular do KaBuM.
- `scrape.mjs` precisa virar importável: as funções de parse/build saem para um módulo, e o `main()` só roda quando o arquivo é executado direto. Assim o live usa as mesmas funções.
- Escrita em `deals.json` não pode colidir com a coleta completa rodando ao mesmo tempo: o servidor serializa (fila única de escrita) e, ao terminar a coleta, reaplica o que o live acrescentou depois do início dela. *(chamada minha; o builder escolhe o mecanismo)*

### Modo com conta (gramjs)

- Sessão (`StringSession`) salva em `data/local/telegram-session.txt`, junto com api_id/api_hash em `data/local/telegram.json`. Nunca sai do PC, nunca vai para log.
- Canais = `TELEGRAM_CHANNELS` (os mesmos da coleta). O Telegram só empurra posts de canais que a conta segue. Para os que a conta **não** segue, o garimpo **não entra sozinho**: o painel lista "não seguidos" com botão **Seguir** por canal (ação explícita do usuário). Os não seguidos continuam no modo `t.me/s`. *(chamada minha)*
- Sem polling: só eventos `NewMessage` e `EditedMessage` filtrados pelos canais. Reconexão automática do gramjs; respeitar `FLOOD_WAIT` se aparecer.
- O texto dos posts vem como texto+entidades, não HTML: converter para o mesmo formato texto que `tgText` produz (links das entidades viram URL solta no texto) antes de chamar o parser.

### Modo sem conta (`t.me/s`)

- Só a **primeira página** de cada canal, um canal por vez, 2–5 s entre canais; volta completa a cada 45–90 s sorteados.
- Guarda o maior `postId` visto por canal; processa só os maiores. Edições não são vistas aqui (limitação aceita).
- Em erro/429: espera dobrando (1 → 2 → 4 … até 15 min) por canal; 5 falhas seguidas pausam aquele canal por 30 min e a página mostra.

## Parte 2 — Histórico de preços

### Chave do produto *(chamada minha)*

- A chave de `dedupe()` não serve: inclui loja e faixa de preço, e fora CPU/GPU usa o título cru. É preciso uma **chave nova, `modelKey(d)`, igual entre lojas**, em `classify.mjs`: `categoria|marca|código do modelo`.
  - CPU: `specs.modelo` (ex.: `ryzen 7 5700x`).
  - GPU: fabricante da placa + linha + chip + VRAM (ex.: `asus|dual|rtx 4060|8gb`).
  - Demais categorias: o código de modelo extraído do título (token com letras e dígitos, tipo `SN770`, `KF432C16BB`, `G502`, `27G2SP`), mais capacidade quando houver (SSD/RAM).
- Sem código de modelo identificável, o item fica fora do histórico e da verificação, e segue a regra de hoje.
- O histórico é **por modelo, juntando todas as lojas**. A loja fica registrada no dia.
- O resultado do Zoom/Buscapé só é aceito se a `modelKey` do título dele for igual à da oferta.

### Histórico nosso (`data/local/history.json`)

- Formato: `{ [modelKey]: { title, category, days: { "2026-11-27": { [store]: { shelf, coupon? } } } } }`. `shelf` é o menor preço de prateleira do dia. `coupon` é o menor preço que só sai com cupom (posts de Telegram/Promobit com cupom). **O `coupon` não entra na referência.** Ele fica guardado só para consulta. *(chamada minha)*
- Gravado ao fim de cada coleta (e pelo live para itens com preço). Entra **todo item visto**, não só ofertas: na KaBuM a varredura já lê milhares de produtos com preço normal (o mesmo laço que alimenta `addRefSample`) — é isso que dá preço regular ao histórico. Pichau, Terabyte, Amazon, Pato Loco e Telegram entram com o que coletam.
- Mantém 90 dias; dias mais velhos são apagados ao gravar.

### Histórico externo (Zoom, depois Buscapé)

- **Primeiro passo: spike** de 1 hora — abrir no Chrome headless a busca e a página de produto do Zoom e do Buscapé e ver (a) se o Cloudflare deixa passar, (b) de onde sai o histórico (JSON embutido tipo `__NEXT_DATA__`, chamada de API, ou só gráfico). Se um site não der, ele fica fora e o design segue com o outro; se nenhum der, segue só com o nosso histórico.
- Consultado só para ofertas que passaram dos 50% pelo preço anunciado e cujo modelo **não** tem histórico cheio.
- Busca pelo nome do modelo; só aceita o resultado se a `modelKey` do título encontrado bater com a da oferta (senão, trata como "sem dado externo").
- Cache em `data/local/external-history.json` por `modelKey`, válido 24 h (inclusive resultado "não encontrado").
- Limite de 40 consultas por coleta, uma por vez, 3–6 s entre elas. Bloqueio/captcha → desliga aquele site pelo resto da coleta.
- Só roda na coleta completa, não no live (no live a oferta usa o histórico nosso + cache externo que já existir).

### Regra do "inflado"

- **Histórico cheio** = o modelo tem preço em pelo menos **20 dias diferentes dos últimos 30** no nosso histórico (qualquer loja). Cheio → usa só o nosso; o externo não é mais consultado para aquele modelo.
- **Referência** = mediana dos preços `shelf` diários dos **30 dias anteriores ao `firstSeen` da oferta**. Assim o preço da própria promoção, mesmo que ela dure dias, nunca entra na conta. *(chamada minha)*
- A verificação roda a cada `build()`. Como a janela termina no `firstSeen`, o resultado não piora conforme a oferta envelhece. Só muda quando chega dado novo do período anterior, por exemplo do externo. Fonte: o nosso histórico se cheio; senão, nosso + externo juntos (dias do externo preenchem os que faltam).
- Menos de 7 dias de dados no total (nosso + externo) → sem referência; a oferta segue a regra de hoje.
- `descontoReal = 1 − preço / referência`. Se `descontoReal < MIN_DISCOUNT` → a oferta **sai** de `deals` (não vai para o radar). Se passar, o desconto mostrado continua o anunciado.
- ~~Ofertas que só estão no Radar não passam por essa regra.~~ Mudança pedida pelo usuário depois da aprovação: itens do Radar (sem preço "de") com referência → desconto real ≥ MIN_DISCOUNT sobem para a 50%+ (preço "de" = mediana); abaixo, saem de tudo; sem referência, continuam no Radar.

### Na página

- No card de oferta 50%+ verificada: uma linha "menor preço em 30 dias: R$ X · mediana R$ Y" e a fonte ("histórico próprio" / "Zoom"). *(chamada minha)*
- No status das fontes: "N ofertas removidas por preço inflado". Sem lista das removidas. *(chamada minha)*

## Fica para o builder

- Mecanismo exato da fila de escrita entre coleta e live.
- Seletores/parse do Zoom e Buscapé (sai do spike).
- Visual exato do botão Live e do painel do Telegram, seguindo o estilo atual de `assets/styles.css`.
- Atualizar o README (branches, uso local, limitações).
