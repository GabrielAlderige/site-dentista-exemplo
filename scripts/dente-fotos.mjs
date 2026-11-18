/** Fotos do dente 3D em vários ângulos (ele gira sozinho). Uso: node scripts/dente-fotos.mjs URL/ pasta */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2] || 'http://localhost:5301/'
const out = process.argv[3] || 'check-output/dente'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const erros = []
page.on('pageerror', (e) => erros.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
await page.goto(base, { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '.selos{display:none!important}' })
await page.waitForTimeout(3000)
const recorte = { x: 760, y: 120, width: 640, height: 720 }
for (let i = 0; i < 4; i++) {
  await page.screenshot({ path: join(out, `angulo-${i}.png`), clip: recorte })
  await page.waitForTimeout(3200)
}
await browser.close()
console.log(erros.length ? `ERROS:\n${erros.join('\n')}` : 'ok')
