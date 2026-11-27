# garimpo

Ofertas de **informática com 50% de desconto ou mais**, cupons incluídos, nas principais lojas do Brasil. Só aparecem **produtos novos** de **marcas boas**.

**CPU · GPU · Monitores · Notebooks · SSD · RAM · Placas-mãe**

## Como funciona

```
GitHub Actions (a cada 30 min)
  └─ scraper/scrape.mjs
       ├─ KaBuM: API pública do catálogo (ofertas relâmpago e preço regular)
       ├─ Amazon: busca com filtro de desconto
       ├─ Pato Loco: páginas de categoria
       └─ Promobit: agregador com cupons de Amazon, Magalu, Mercado Livre,
                    Shopee, KaBuM, Pichau e Terabyte
  └─ filtros: ≥ 50% · só novo · só marcas boas · só informática
  └─ data/deals.json  →  GitHub Pages (site estático)
```

- **Desconto** = 1 − preço / preço "de" informado pela loja. Quando um post de cupom não traz o preço "de", o coletor usa o preço regular do mesmo modelo no KaBuM. O card avisa quando isso acontece.
- **Marcas**: há uma lista de marcas boas por categoria e uma lista de bloqueio (Duex, Positivo, Multilaser, Vaio/Compaq BR, Afox, Goline, BRX…). Veja `scraper/classify.mjs`.
- **Specs** (VRAM, Hz, resolução, painel, capacidade, DDR, frequência…) são extraídas do título e viram filtros no site.

## Alertas

- **No navegador**: botão *Alertas* → escolha a faixa de desconto, as categorias e o preço máximo. Funciona com o site aberto (em segundo plano também). Instale como app pelo Chrome.
- **No celular, com o site fechado**: defina a variável `NTFY_TOPIC` do repositório (*Settings → Secrets and variables → Actions → Variables*). Depois assine `https://ntfy.sh/<tópico>` ou `<tópico>-gpu`, `-cpu`, `-monitor`, `-notebook`, `-ssd`, `-ram`, `-mobo` no app **ntfy**. O mínimo de desconto para o push é `NTFY_MIN_DISCOUNT` (padrão 60).

## Rodar localmente

```bash
node scraper/scrape.mjs          # gera data/deals.json
npx serve .                      # ou qualquer servidor estático
```

## Limitações

Pichau, Terabyte, Magalu, Mercado Livre, Shopee e GK Informática bloqueiam robôs. Por isso as ofertas dessas lojas chegam pelo Promobit (Pichau, Terabyte, Magalu, ML e Shopee). A GK Informática ainda não tem fonte. O preço "de" é o que a loja anuncia, então confira sempre na página antes de comprar.
