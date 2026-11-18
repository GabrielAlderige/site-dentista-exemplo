/**
 * Verificação no navegador (Playwright + Chrome instalado).
 * Uso: node scripts/check.mjs [urlBaseComBarra] [pastaDeSaida]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2] || 'http://localhost:5301/'
const out = process.argv[3] || 'check-output'
mkdirSync(out, { recursive: true })
const problemas = []
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function nova(viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemas.push(`[${viewport.width}] console ${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => problemas.push(`[${viewport.width}] pageerror: ${e.message}`))
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) problemas.push(`[${viewport.width}] http ${r.status()} ${r.url()}`) })
  return { ctx, page }
}

async function ate(page, seletor, bloco = 'center') {
  await page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: 'instant', block: b }), [seletor, bloco])
  await page.waitForTimeout(1900)
}

for (const [nome, vp] of [['desk', { width: 1440, height: 900 }], ['movel', { width: 390, height: 844 }]]) {
  const { ctx, page } = await nova(vp, nome === 'movel' ? { isMobile: true, hasTouch: true } : {})
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: join(out, `${nome}-01-abertura.png`) })
  const pronto = await page.evaluate(() => document.querySelector('.palco')?.classList.contains('is-pronto'))
  if (!pronto) problemas.push(`[${nome}] 3D não carregou`)
  // trilha presa: rola até o meio de cada passo
  for (const [i, arq] of ['02-implante', '03-clareamento', '04-alinhador', '05-prevencao'].entries()) {
    await page.evaluate((k) => {
      const t = document.querySelector('[data-trilha]')
      const total = t.offsetHeight - window.innerHeight
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY + total * ((k + 0.5) / 4))
    }, i)
    await page.waitForTimeout(arq === '03-clareamento' ? 5000 : 2200)
    const ativo = await page.evaluate(() => document.querySelector('.painel-trat.is-ativo')?.dataset.painel)
    const esperado = ['implante', 'clareamento', 'alinhador', 'prevencao'][i]
    if (ativo !== esperado) problemas.push(`[${nome}] trilha passo ${i}: painel ${ativo}, esperado ${esperado}`)
    await page.screenshot({ path: join(out, `${nome}-${arq}.png`) })
  }
  const alvos = [['.arco', '06-consulta'], ['.bento', '07-estrutura'], ['#duvidas', '08-duvidas'], ['#agendar', '09-agendar'], ['.rodape', '10-rodape']]
  for (const [s, arq] of alvos) {
    await ate(page, s)
    await page.screenshot({ path: join(out, `${nome}-${arq}.png`) })
  }
  const larguraExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (larguraExtra > 1) problemas.push(`[${nome}] rolagem horizontal de ${larguraExtra}px`)

  if (nome === 'desk') {
    // formulário: vazio mostra erros
    await ate(page, '#form-agendar')
    await page.click('#form-agendar button[type=submit]')
    await page.waitForTimeout(300)
    const invalidos = await page.locator('#form-agendar [aria-invalid=true]').count()
    if (invalidos < 3) problemas.push(`[form] esperado 3 campos inválidos, veio ${invalidos}`)
    await page.screenshot({ path: join(out, `${nome}-11-form-erros.png`) })
    await page.fill('#f-nome', 'Maria Teste')
    await page.fill('#f-whats', '35999998888')
    const fmt = await page.inputValue('#f-whats')
    if (fmt !== '(35) 99999-8888') problemas.push(`[form] máscara do telefone: ${fmt}`)
    await page.selectOption('#f-trat', 'Clareamento dental')
    await page.check('input[name=consentimento]')
    await Promise.all([page.waitForURL(/obrigado/), page.click('#form-agendar button[type=submit]')])
    await page.waitForTimeout(800)
    const t = await page.textContent('h1')
    if (!t?.includes('Maria')) problemas.push(`[obrigado] título: ${t}`)
    await page.screenshot({ path: join(out, `${nome}-12-obrigado.png`) })
    await page.goto(new URL('leads/', base).href, { waitUntil: 'networkidle' })
    const linhas = await page.locator('[data-linhas] tr').count()
    if (linhas !== 1) problemas.push(`[painel] esperado 1 pedido, veio ${linhas}`)
    await page.screenshot({ path: join(out, `${nome}-13-painel.png`) })
  }

  for (const p of ['implantes-dentarios/', 'clareamento-dental/', 'alinhadores-invisiveis/', 'privacidade/']) {
    await page.goto(new URL(p, base).href, { waitUntil: 'networkidle' })
    await page.waitForTimeout(p === 'clareamento-dental/' ? 4500 : 2600)
    await page.screenshot({ path: join(out, `${nome}-p-${p.replace('/', '')}.png`) })
  }
  if (nome === 'movel') {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.click('.menu__abrir')
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${nome}-menu.png`) })
  }
  await ctx.close()
}

// SEO: JSON-LD e metas
{
  const { ctx, page } = await nova({ width: 1200, height: 800 })
  for (const p of ['', 'implantes-dentarios/']) {
    await page.goto(new URL(p, base).href)
    const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)['@type']))
    const h1 = await page.locator('h1').count()
    console.log(`SEO /${p}: JSON-LD = ${ld.join(', ')}; h1 = ${h1}; title = ${await page.title()}`)
    if (h1 !== 1) problemas.push(`[seo] /${p} tem ${h1} h1`)
  }
  await ctx.close()
}

await browser.close()
console.log(problemas.length ? `PROBLEMAS (${problemas.length}):\n${problemas.join('\n')}` : 'Nenhum problema encontrado.')
