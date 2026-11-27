# garimpo

Ofertas de **informática com 50% de desconto ou mais**, cupons incluídos, nas principais lojas do Brasil. Só aparecem **produtos novos** de **marcas boas**.

**CPU · GPU · Monitores · Notebooks · SSD · RAM · Placas-mãe · Periféricos**

🔗 https://batatinhafcbatatinha-pixel.github.io/garimpo-tech/

## Três visões

| Visão | O que é |
|---|---|
| **50%+ OFF** | Desconto comprovado: preço "de" anunciado pela loja (ou preço regular do mesmo modelo no KaBuM) contra o preço atual. |
| **Radar de cupons** | Posts de cupom em hardware (Telegram e Promobit) que não trazem o preço "de". Não dá para garantir os 50%, mas normalmente são os melhores preços do momento. Cobre as últimas 48 h. |
| **Cupons de loja** | Cupons gerais, como "R$ 250 OFF acima de R$ 999" no Mercado Livre, Amazon, Shopee, Magalu, AliExpress e KaBuM. Cobre as últimas 36 h. |

## Fontes

```
GitHub Actions (a cada 30 min) → scraper/scrape.mjs → data/deals.json → GitHub Pages
  ├─ KaBuM          API pública do catálogo
  ├─ Pichau         Chrome headless (Cloudflare recusa fetch/curl e libera navegador de verdade)
  ├─ Terabyte       Chrome headless
  ├─ Amazon         busca com filtro de desconto
  ├─ Pato Loco      páginas de categoria
  ├─ Promobit       agregador (cupons de ML, Shopee, Magalu, Amazon, KaBuM, Pichau, Terabyte)
  └─ Telegram       prévia pública dos canais (t.me/s/<canal>): Mercado Livre, Shopee, AliExpress…
```

Canais padrão: `pcdofafapromo`, `ofertasbenevides`, `ofertasdecomputador`, `EconoMister`, `LinksBrazil`. Para trocar, defina a variável `TELEGRAM_CHANNELS` do repositório (separados por vírgula).

Filtros aplicados em todas as fontes: só produtos novos (descarta usado, recondicionado e open box), só informática e só marcas da lista boa de cada categoria. Duex, Positivo, Multilaser, Vaio/Compaq BR, Afox, Goline, BRX, Redragon e similares são bloqueadas (`scraper/classify.mjs`).

## Alertas

- **No navegador**: botão *Alertas*. Você escolhe a faixa de desconto, as categorias, o preço máximo e se quer aviso também do radar e de cupons de loja. Funciona com o site aberto ou instalado como app.
- **No celular, com o site fechado**: app **ntfy** (Android/iOS). Assine `https://ntfy.sh/<tópico>` (ofertas 50%+), `<tópico>-gpu`, `-cpu`… por categoria, `<tópico>-radar` e `<tópico>-cupons`. O tópico fica na variável `NTFY_TOPIC` e os links aparecem no painel de alertas do site.

## Rodar localmente

```bash
node scraper/scrape.mjs                      # tudo (precisa de Chrome ou Edge para Pichau/Terabyte)
SKIP_BROWSER=1 node scraper/scrape.mjs       # sem as lojas que exigem navegador (mais rápido)
npx serve .                                  # qualquer servidor estático
```

## Limitações

- Os sites do Mercado Livre, Magalu, Shopee e GK Informática bloqueiam até navegador automatizado. ML, Shopee e Magalu chegam pelo Telegram e Promobit; a GK ainda não tem fonte.
- O preço "de" é o que a loja anuncia, e lojas costumam inflar esse valor. Confira sempre na página antes de comprar.
- Cupons de Telegram esgotam rápido e alguns valem só para itens selecionados ou no app.
