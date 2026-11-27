# garimpo (versão online)

Esta é a branch **`site`**, a versão publicada em **https://batatinhafcbatatinha-pixel.github.io/garimpo-tech/**.

- **Coleta:** o GitHub Actions coleta as ofertas uma vez por dia, às 09:00 (horário de Brasília). O workflow fica na branch `main`, porque o GitHub só dispara agendamentos a partir da branch principal, e publica o conteúdo desta branch.
- **Atualizar:** não há botão nem seletor de intervalo. O F5 sempre traz a última coleta.
- **Versão local:** quem quiser escolher o intervalo da coleta e ver as ofertas na hora deve usar a branch `main`, rodando no próprio PC. Lá a Pichau e a Terabyte também funcionam por completo.

Ofertas de **informática com 50% de desconto ou mais**, cupons incluídos: CPU, GPU, monitores, notebooks, SSD, RAM, placas-mãe, fontes, gabinetes, coolers, videogames, controles, teclados, mouses e fones. Só aparecem produtos novos de marcas boas. Placa-mãe mostra quantos slots PCIe x16 tem (dá pra usar mais de uma placa de vídeo?), de que geração (PCIe 3.0/4.0/5.0) e quantos slots M.2 NVMe; processador e placa de vídeo também mostram a geração PCIe. Há três visões:

- **50%+ OFF:** desconto comprovado.
- **Radar de cupons:** posts de Telegram e Promobit sem preço "de".
- **Cupons de loja:** cupons gerais das lojas.

**Fontes:** KaBuM (API), Amazon, Pato Loco, Terabyte (em parte), Promobit e os canais públicos do Telegram @pcdofafapromo, @ofertasbenevides, @ofertasdecomputador, @EconoMister, @LinksBrazil, @gamerdasofertas e @linguicapromocoes. A Pichau bloqueia os servidores do GitHub. Mercado Livre, Shopee e Magalu chegam pelo Telegram e pelo Promobit.

**Expirados:** a cada coleta são apagados os itens encerrados: ofertas que o Promobit deixou de aprovar, posts do Telegram marcados como "esgotado", cupons esgotados e ofertas relâmpago do KaBuM que passaram do horário.

O desconto é calculado sobre o preço "de" anunciado pela loja, então confira sempre na página antes de comprar.
