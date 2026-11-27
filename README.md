# garimpo

Ofertas de **informática com 50% de desconto ou mais**, cupons incluídos, nas principais lojas do Brasil. Só aparecem **produtos novos** de **marcas boas**.

**CPU · GPU · Monitores · Notebooks · SSD · RAM · Placas-mãe · Fontes · Gabinetes · Coolers · Videogames · Controles · Teclados · Mouses · Fones**

Placa-mãe mostra quantos slots PCIe x16 tem (dá pra usar mais de uma placa de vídeo?), de que geração (PCIe 3.0/4.0/5.0) e quantos slots M.2 NVMe — lidos da ficha técnica do KaBuM, inclusive para ofertas de outras lojas. Processador e placa de vídeo também mostram a geração PCIe (e as linhas, quando a placa não é x16).

## Branches

| Branch | Para quê |
|---|---|
| **`main`** (esta) | Versão **local**, para rodar no seu PC. Você escolhe na página de quanto em quanto tempo a coleta roda, e as ofertas aparecem na tela assim que ela termina. |
| **`site`** | Versão **online**, publicada pelo GitHub Actions uma vez por dia em https://batatinhafcbatatinha-pixel.github.io/garimpo-tech/. Não tem o seletor de intervalo. |

## Usar no seu PC

Dois cliques em **`Abrir Garimpo.bat`**, ou:

```bash
node server.mjs --open     # http://localhost:4322
```

Deixe a janela aberta. No topo da página há duas opções:

- **"Coletar a cada"**: o intervalo da coleta inteira (desligado, 10 ou 15 min, 30 min, 1, 3, 6, 12 ou 24 h).
- **"F5 coleta"**: ligada, apertar F5 (recarregar a página) refaz a coleta inteira. Desligada, o F5 só recarrega a página.

Não precisa esperar a coleta acabar. As ofertas de cada fonte (KaBuM, Telegram, Promobit, Pichau…) aparecem na página assim que aquela fonte termina, e os alertas disparam na hora.

**Expirados:** ofertas e cupons encerrados são apagados, aqui e na versão online. São os que o Promobit deixou de aprovar, os posts do Telegram marcados como "esgotado" ou "encerrado", cupons com aviso "esgotou CÓDIGO" e ofertas relâmpago do KaBuM que passaram do horário. Itens das lojas lidas direto que sumiram da loja também saem.

## Modo live (só no PC)

Botão **Live** no topo da página. Ligado, os posts novos dos canais do Telegram entram na página e disparam os alertas em segundos, sem esperar a coleta. Serve para as lives de loja, quando a promoção esgota em minutos. Ele fica ligado até você desligar, mesmo se fechar e abrir o Garimpo.

O live funciona de dois jeitos (botão do avião de papel, ao lado do Live):

- **Com a sua conta do Telegram (recomendado):** o Telegram manda cada post na hora. O Garimpo não fica consultando os canais, então não há risco de o seu IP ser limitado. Para conectar:
  1. Em [my.telegram.org/apps](https://my.telegram.org/apps), crie um app (qualquer nome) e copie o `api_id` e o `api_hash`.
  2. No painel, preencha os dois e o seu telefone com DDI. Digite o código que chega no Telegram (e a senha, se a conta tiver verificação em duas etapas).

  Cada pessoa usa a própria conta. O Garimpo só **lê** os canais da lista: não manda mensagem e só entra num canal quando você clica em **Seguir**. Os canais que a conta não segue continuam sendo lidos pela prévia pública.

  A sessão fica em `data/local/telegram-session.txt`, fora do git. Ela dá acesso total à sua conta: não compartilhe esse arquivo. **Sair da conta** no painel apaga a sessão.
- **Sem conta:** lê só a primeira página da prévia pública (`t.me/s/<canal>`) de cada canal, um de cada vez, com 2 a 5 s entre eles, e repete a cada 45 a 90 s. Se o Telegram recusar, espera 1, 2, 4, 8 minutos (até 15). Depois de 5 falhas seguidas, aquele canal fica pausado por 30 min.

Para entrar com a conta, o Garimpo usa a biblioteca gramjs. O `Abrir Garimpo.bat` instala na primeira vez (`npm install`). Sem ela, o live funciona só pela prévia pública.

Se uma coleta completa estiver rodando ao mesmo tempo, o que o live trouxe é reaplicado quando ela termina. Os cupons esgotados também continuam fora.

## Histórico de preços (só no PC)

A cada coleta o Garimpo guarda o menor preço do dia de cada modelo, juntando todas as lojas (`data/local/history.json`, 90 dias). Da KaBuM entra todo produto lido, não só as ofertas, e é isso que dá o preço normal. Preço que só sai com cupom fica guardado à parte e não entra na conta.

Com isso, o desconto anunciado é conferido. A referência é a **mediana dos preços dos 30 dias antes de a oferta aparecer**. Se contra ela o desconto real fica abaixo de 50%, a oferta **some** da lista 50%+. Ela não vai para o radar nem para lugar nenhum. As que passam mostram no card "menor em 30 dias · mediana". O rodapé mostra quantas foram removidas por preço inflado.

Enquanto o nosso histórico de um modelo é curto, entra também o histórico do **Zoom** (o Buscapé fica de reserva; os dois têm os mesmos dados). A consulta vale só para ofertas que passaram dos 50% pelo preço anunciado, com no máximo 40 modelos por coleta, uma consulta por vez e cache de 24 h. Quando o modelo tem preço em 20 dos últimos 30 dias no nosso histórico, o Zoom deixa de ser consultado para ele. Com menos de 7 dias de dados, a oferta segue a regra antiga (preço "de" da loja).

O modelo é reconhecido pelo código no título (ex.: `5700X`, `SN770`, `G502`). Produto sem código de modelo identificável não passa por essa conferência.

No seu PC a Pichau e a Terabyte funcionam: o Cloudflare libera o Chrome headless vindo de IP residencial e bloqueia o que vem dos servidores do GitHub. Precisa do Node 20+ e do Chrome ou Edge instalados. Os dados, o intervalo, o histórico e a sessão do Telegram ficam em `data/local/`, fora do git.

Testes: `npm test`.

## Três visões

| Visão | O que é |
|---|---|
| **50%+ OFF** | Desconto comprovado: preço "de" anunciado pela loja (ou preço regular do mesmo modelo no KaBuM) contra o preço atual. |
| **Radar de cupons** | Posts de cupom em hardware (Telegram e Promobit) que não trazem o preço "de". Não dá para garantir os 50%, mas normalmente são os melhores preços do momento. |
| **Cupons de loja** | Cupons gerais, como "R$ 250 OFF acima de R$ 999" no Mercado Livre, Amazon, Shopee, Magalu, AliExpress e KaBuM. |

## Fontes

```
scraper/scrape.mjs → data/deals.json
  ├─ KaBuM          API pública do catálogo
  ├─ Pichau         Chrome headless (só funciona no PC)
  ├─ Terabyte       Chrome headless (no GitHub, só em parte)
  ├─ Amazon         busca com filtro de desconto
  ├─ Pato Loco      páginas de categoria
  ├─ Promobit       agregador (cupons de ML, Shopee, Magalu, Amazon, KaBuM, Pichau, Terabyte)
  └─ Telegram       prévia pública dos canais (t.me/s/<canal>): Mercado Livre, Shopee, AliExpress…
```

Canais padrão: `pcdofafapromo`, `ofertasbenevides`, `ofertasdecomputador`, `EconoMister`, `LinksBrazil`, `gamerdasofertas`, `linguicapromocoes`, `ofertasportateis`. Para trocar, use `TELEGRAM_CHANNELS=canal1,canal2` (variável de ambiente ou variável do repositório).

Filtros aplicados em todas as fontes: só produtos novos (descarta usado, recondicionado e open box), só informática e só marcas da lista boa de cada categoria. Duex, Positivo, Multilaser, Vaio/Compaq BR, Afox, Goline, BRX, Redragon e similares são bloqueadas (`scraper/classify.mjs`).

## Alertas

- **No navegador**: botão *Alertas*. Você escolhe a faixa de desconto, as categorias, o preço máximo e se quer aviso também do radar e de cupons de loja. Na versão local, os alertas chegam assim que cada coleta termina.
- **No celular**: app **ntfy** (Android/iOS). Assine os tópicos que aparecem no painel de alertas. A coleta local e a diária do GitHub mandam push para eles.

## Limitações

- Os sites do Mercado Livre, Magalu, Shopee e GK Informática bloqueiam até navegador automatizado. ML, Shopee e Magalu chegam pelo Telegram e Promobit; a GK ainda não tem fonte.
- Na versão online, e no PC enquanto o histórico de um modelo ainda é curto e o Zoom não tem esse modelo, o preço "de" é o que a loja anuncia. Lojas costumam inflar esse valor. Confira sempre na página antes de comprar.
- Cupons de Telegram esgotam rápido e alguns valem só para itens selecionados ou no app.
