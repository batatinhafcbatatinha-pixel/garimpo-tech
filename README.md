# garimpo

Ofertas de **informática com 50% de desconto ou mais**, cupons incluídos, nas principais lojas do Brasil. Só aparecem **produtos novos** de **marcas boas**.

**CPU · GPU · Monitores · Notebooks · SSD · RAM · Placas-mãe · Periféricos**

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

Deixe a janela aberta. No topo da página, **"Coletar a cada"** define o intervalo da coleta inteira: desligado, 10 ou 15 min, 30 min, 1, 3, 6, 12 ou 24 h. Cada coleta leva alguns minutos. Quando termina, a página atualiza sozinha e dispara os alertas, sem botão e sem F5. Para coletar na hora, feche e abra o `.bat` de novo.

No seu PC a Pichau e a Terabyte funcionam: o Cloudflare libera o Chrome headless vindo de IP residencial e bloqueia o que vem dos servidores do GitHub. Precisa do Node 20+ e do Chrome ou Edge instalados. Os dados e o intervalo ficam em `data/local/`, fora do git.

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

Canais padrão: `pcdofafapromo`, `ofertasbenevides`, `ofertasdecomputador`, `EconoMister`, `LinksBrazil`. Para trocar, use `TELEGRAM_CHANNELS=canal1,canal2` (variável de ambiente ou variável do repositório).

Filtros aplicados em todas as fontes: só produtos novos (descarta usado, recondicionado e open box), só informática e só marcas da lista boa de cada categoria. Duex, Positivo, Multilaser, Vaio/Compaq BR, Afox, Goline, BRX, Redragon e similares são bloqueadas (`scraper/classify.mjs`).

## Alertas

- **No navegador**: botão *Alertas*. Você escolhe a faixa de desconto, as categorias, o preço máximo e se quer aviso também do radar e de cupons de loja. Na versão local, os alertas chegam assim que cada coleta termina.
- **No celular**: app **ntfy** (Android/iOS). Assine os tópicos que aparecem no painel de alertas. A coleta local e a diária do GitHub mandam push para eles.

## Limitações

- Os sites do Mercado Livre, Magalu, Shopee e GK Informática bloqueiam até navegador automatizado. ML, Shopee e Magalu chegam pelo Telegram e Promobit; a GK ainda não tem fonte.
- O preço "de" é o que a loja anuncia, e lojas costumam inflar esse valor. Confira sempre na página antes de comprar.
- Cupons de Telegram esgotam rápido e alguns valem só para itens selecionados ou no app.
