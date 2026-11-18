/**
 * Gera os ícones PNG a partir de public/favicon.svg e a og-image.png (prévia no WhatsApp/Instagram)
 * a partir da própria página. Rode com o servidor de desenvolvimento ligado:
 *   node scripts/assets.mjs http://localhost:5301/
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const base = process.argv[2] || 'http://localhost:5301/'
const svg = readFileSync('public/favicon.svg', 'utf8')
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })

for (const [arq, px] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const page = await browser.newPage({ viewport: { width: px, height: px } })
  await page.setContent(`<style>html,body{margin:0}svg{width:${px}px;height:${px}px;display:block}</style>${svg}`)
  await page.screenshot({ path: `public/${arq}`, omitBackground: true })
  await page.close()
}

const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(base, { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '.demo-bar,.abertura__fatos,.abertura__acoes{display:none!important}.abertura__in{padding-top:2rem!important}' })
await page.waitForTimeout(4000)
await page.screenshot({ path: 'public/og-image.png' })
await browser.close()
console.log('ícones e og-image gerados')
