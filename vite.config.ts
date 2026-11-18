import { defineConfig, type Plugin } from 'vite'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Site multipágina em HTML estático (o conteúdo já vem no HTML, bom para o Google).
 * Este plugin:
 *  - inclui os pedaços comuns (<!--@include nome-->) de /partials
 *  - troca {{chave}} pelos dados de clinica.config.json
 *  - gera canonical, Open Graph, Twitter e JSON-LD (Dentist, FAQPage, BreadcrumbList) por página
 *  - gera sitemap.xml e robots.txt no build
 */
const root = __dirname
const cfg = JSON.parse(readFileSync(join(root, 'clinica.config.json'), 'utf8'))
const base = process.env.BASE_PATH || '/'
const siteUrl = String(cfg.url).replace(/\/$/, '')

const pages = ['index.html', ...readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'index.html')) && !['node_modules', 'dist', 'partials', 'public', 'src', 'scripts'].includes(d.name))
  .map((d) => `${d.name}/index.html`)]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const digits = (s: string) => String(s).replace(/\D/g, '')

const tokens: Record<string, string> = {
  ...Object.fromEntries(Object.entries(cfg).filter(([, v]) => typeof v === 'string') as [string, string][]),
  base,
  ano: String(new Date().getFullYear()),
  telLink: `tel:+55${digits(cfg.telefone)}`,
  waLink: `https://wa.me/${digits(cfg.whatsapp)}?text=${encodeURIComponent(`Olá! Vim pelo site da ${cfg.nome} e gostaria de agendar uma avaliação.`)}`,
  mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cfg.endereco}, ${cfg.cidade} - ${cfg.uf}`)}`,
}

function fill(html: string) {
  return html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m))
}

function includes(html: string): string {
  return html.replace(/<!--@include (\w+)-->/g, (_, name) => includes(readFileSync(join(root, 'partials', `${name}.html`), 'utf8')))
}

function dentistLd() {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': `${siteUrl}/#clinica`,
    name: cfg.nome,
    url: `${siteUrl}/`,
    image: `${siteUrl}/og-image.png`,
    logo: `${siteUrl}/icon-512.png`,
    telephone: `+55 ${cfg.telefone}`,
    medicalSpecialty: 'Dentistry',
    areaServed: { '@type': 'City', name: cfg.cidade },
    address: {
      '@type': 'PostalAddress',
      streetAddress: cfg.endereco,
      addressLocality: cfg.cidade,
      addressRegion: cfg.uf,
      postalCode: cfg.cep,
      addressCountry: 'BR',
    },
    openingHoursSpecification: cfg.horarios.map((h: { dias: string[]; abre: string; fecha: string }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.dias.map((d) => `https://schema.org/${d}`),
      opens: h.abre,
      closes: h.fecha,
    })),
    availableService: [
      { '@type': 'MedicalProcedure', name: 'Implante dentário', url: `${siteUrl}/implantes-dentarios/` },
      { '@type': 'MedicalProcedure', name: 'Clareamento dental', url: `${siteUrl}/clareamento-dental/` },
      { '@type': 'MedicalProcedure', name: 'Alinhadores invisíveis', url: `${siteUrl}/alinhadores-invisiveis/` },
    ],
  }
  if (cfg.email) ld.email = cfg.email
  return ld
}

function seo(): Plugin {
  return {
    name: 'clinica-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        html = fill(includes(html))
        const path = ctx.path.replace(/index\.html$/, '')
        const title = strip(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? cfg.nome)
        const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
        const noindex = /<meta name="robots" content="noindex/.test(html)
        const url = `${siteUrl}${path}`

        const head: string[] = [
          `<link rel="canonical" href="${url}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:locale" content="pt_BR">`,
          `<meta property="og:site_name" content="${esc(cfg.nome)}">`,
          `<meta property="og:title" content="${esc(title)}">`,
          `<meta property="og:description" content="${desc}">`,
          `<meta property="og:url" content="${url}">`,
          `<meta property="og:image" content="${siteUrl}/og-image.png">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta property="og:image:alt" content="Dente de porcelana em 3D da ${esc(cfg.nome)}">`,
          `<meta name="twitter:card" content="summary_large_image">`,
          `<meta name="twitter:title" content="${esc(title)}">`,
          `<meta name="twitter:description" content="${desc}">`,
          `<meta name="twitter:image" content="${siteUrl}/og-image.png">`,
        ]

        const graph: unknown[] = []
        if (!noindex) graph.push(dentistLd())
        if (path === '/') {
          graph.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.nome, url: `${siteUrl}/`, inLanguage: 'pt-BR' })
        } else if (!noindex) {
          const h1 = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? title)
          graph.push({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: `${siteUrl}/` },
              { '@type': 'ListItem', position: 2, name: h1, item: url },
            ],
          })
        }
        // FAQ: o JSON-LD nasce das perguntas visíveis na página — uma fonte só
        const faqs = [...html.matchAll(/<details class="faq-item"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>/g)]
        if (faqs.length && !noindex) {
          graph.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(([, q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
          })
        }
        for (const g of graph) head.push(`<script type="application/ld+json">${JSON.stringify(g)}</script>`)
        return html.replace('</head>', `${head.join('\n    ')}\n  </head>`)
      },
    },
    generateBundle() {
      const indexable = pages.filter((p) => !/noindex/.test(readFileSync(join(root, p), 'utf8')))
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...indexable.map((p) => `  <url><loc>${siteUrl}/${p.replace(/index\.html$/, '')}</loc></url>`),
        '</urlset>',
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `${xml}\n` })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nDisallow: /leads/\nSitemap: ${siteUrl}/sitemap.xml\n` })
    },
  }
}

export default defineConfig({
  base,
  plugins: [seo()],
  define: { __CLINICA__: JSON.stringify(cfg) },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p.replace(/\/?index\.html$/, '') || 'home', resolve(root, p)])),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
        },
      },
    },
  },
})
