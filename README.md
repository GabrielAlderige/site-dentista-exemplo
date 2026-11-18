# Site demonstrativo para clínica odontológica

Site de exemplo (clínica fictícia "Esmalte Odontologia") para apresentar a dentistas.
HTML estático + Vite + three.js + GSAP. No ar: https://gabrielalderige.github.io/site-dentista-exemplo/

## Adaptar para um dentista (5 minutos)

Tudo fica em **`clinica.config.json`**: nome, cidade, UF, endereço, telefone, WhatsApp (só dígitos com 55 + DDD),
horário, responsável técnico e CRO, URL e `formEndpoint`.

- `"demo": false` tira a faixa "site de demonstração" e para de gravar pedidos no painel local.
- `formEndpoint`: URL que recebe `POST` JSON com o pedido (Formspree, webhook do n8n, Make, planilha via Apps Script...).
  Campos: `nome, whatsapp, tratamento, periodo, mensagem, pagina, origem, recebidoEm`.
- Depois de trocar o nome, rode `npm run dev` e `node scripts/assets.mjs` para regerar a imagem de compartilhamento.

## O que já vem pronto

- Dente 3D procedural (nenhum modelo baixado) que muda a cada seção: implante (coroa, pilar e parafuso), clareamento
  (escala A3 → B1, controlada pelo paciente), alinhador (placa transparente) e prevenção.
- Formulário de agendamento com máscara de WhatsApp, validação, consentimento LGPD, anti-spam e registro da origem
  (Google Ads, Instagram, busca no Google, UTM).
- Página de obrigado (boa para medir conversão de anúncio) e painel `/leads/` com exportação em CSV (demonstração).
- SEO: uma página por tratamento com a cidade no título, JSON-LD `Dentist` + `FAQPage` + `BreadcrumbList` gerados
  no build a partir do conteúdo visível, canonical, Open Graph, sitemap e robots.
- Texto alinhado às regras de publicidade do CFO: sem preço, sem promessa de resultado, sem "antes e depois",
  com nome e CRO do responsável técnico no rodapé.

## Comandos

```bash
npm install
npm run dev                         # http://localhost:5301
npm run build                       # gera dist/
node scripts/check.mjs URL/ pasta   # screenshots + teste do formulário (servidor ligado)
node scripts/assets.mjs URL/        # ícones e og-image (servidor ligado)
```

Push na `main` publica sozinho no GitHub Pages (`.github/workflows/deploy.yml`).
