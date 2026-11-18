import './styles.css'
import { iniciarFormulario, registrarOrigem } from './form'
import type { Dente, Estado } from './three/dente'

declare const __CLINICA__: { demo: boolean; whatsapp: string }

const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

registrarOrigem()
iniciarFormulario()
if (!__CLINICA__.demo) document.querySelectorAll('[data-demo]').forEach((el) => el.remove())

/* ---------- Rolagem suave (Lenis) */
type LenisLike = { scrollTo: (alvo: number | string | HTMLElement, o?: { offset?: number; duration?: number; immediate?: boolean }) => void; raf: (t: number) => void; on: (ev: string, cb: () => void) => void }
let lenis: LenisLike | null = null
if (!reduzido) {
  import('lenis').then(({ default: Lenis }) => {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 }) as unknown as LenisLike
    const loop = (t: number) => { lenis!.raf(t); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
    lenis.on('scroll', aoRolar)
  })
}
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]')
  if (!a || !lenis) return
  const url = new URL(a.href)
  if (url.pathname !== location.pathname || !url.hash) return
  const alvo = document.querySelector<HTMLElement>(url.hash)
  if (!alvo) return
  e.preventDefault()
  lenis.scrollTo(alvo, { offset: -80, duration: 1.4 })
  history.replaceState(null, '', url.hash)
})

/* ---------- Topo, menu e barra do celular */
const barra = document.querySelector<HTMLElement>('.barra-movel')
const agendar = document.getElementById('agendar')
const botaoMenu = document.querySelector<HTMLButtonElement>('.menu__abrir')
const lista = document.getElementById('menu-lista')
function fecharMenu() {
  botaoMenu?.setAttribute('aria-expanded', 'false')
  lista?.classList.remove('is-aberto')
}
botaoMenu?.addEventListener('click', () => {
  const aberto = botaoMenu.getAttribute('aria-expanded') === 'true'
  botaoMenu.setAttribute('aria-expanded', String(!aberto))
  lista?.classList.toggle('is-aberto', !aberto)
})
lista?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) fecharMenu() })
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lista?.classList.contains('is-aberto')) { fecharMenu(); botaoMenu?.focus() }
})

/* ---------- Dente 3D */
const palco = document.querySelector<HTMLElement>('.palco')
const canvas = document.querySelector<HTMLCanvasElement>('[data-dente]')
let dente: Dente | null = null
let estadoAtual = ''

function webglOk() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/* ---------- Trilha de tratamentos (seção presa) */
const trilha = document.querySelector<HTMLElement>('[data-trilha]')
const ESTADOS_TRILHA: Estado[] = ['implante', 'clareamento', 'alinhador', 'prevencao']
const paineis = [...document.querySelectorAll<HTMLElement>('[data-painel]')]
const passos = [...document.querySelectorAll<HTMLButtonElement>('[data-passo]')]
const barraProgresso = document.querySelector<HTMLElement>('[data-barra]')
let passoAtual = -1

function progressoTrilha() {
  if (!trilha) return null
  const r = trilha.getBoundingClientRect()
  const total = r.height - window.innerHeight
  if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight * 0.5) return null
  return Math.min(1, Math.max(0, -r.top / total))
}

function mostrarPasso(i: number) {
  if (i === passoAtual) return
  passoAtual = i
  paineis.forEach((p, k) => p.classList.toggle('is-ativo', k === i))
  passos.forEach((b, k) => b.setAttribute('aria-current', String(k === i)))
}

passos.forEach((b, i) => b.addEventListener('click', () => {
  if (!trilha) return
  const total = trilha.offsetHeight - window.innerHeight
  const y = trilha.getBoundingClientRect().top + window.scrollY + total * ((i + 0.5) / 4)
  lenis ? lenis.scrollTo(y, { duration: 1.2 }) : window.scrollTo({ top: y, behavior: reduzido ? 'auto' : 'smooth' })
}))

/* ---------- Estado a partir da posição da página */
const secoes = [...document.querySelectorAll<HTMLElement>('[data-estado]')]
function estadoPelaRolagem(): string {
  const p = progressoTrilha()
  if (p !== null) {
    const i = Math.min(3, Math.floor(p * 4))
    mostrarPasso(i)
    if (barraProgresso) barraProgresso.style.transform = `scaleX(${p})`
    dente?.girarComRolagem(p)
    return ESTADOS_TRILHA[i]
  }
  const meio = window.innerHeight * 0.5
  for (const s of secoes) {
    const r = s.getBoundingClientRect()
    if (r.top <= meio && r.bottom >= meio) return s.dataset.estado!
  }
  return estadoAtual || secoes[0]?.dataset.estado || 'fora'
}

let agendado = false
function aoRolar() {
  if (agendado) return
  agendado = true
  requestAnimationFrame(() => {
    agendado = false
    const y = window.scrollY
    const agendarR = agendar?.getBoundingClientRect()
    const agendarVisivel = !!agendarR && agendarR.top < window.innerHeight && agendarR.bottom > 0
    const novo = estadoPelaRolagem()
    const naTrilha = progressoTrilha() !== null
    barra?.classList.toggle('is-visivel', y > window.innerHeight * 0.6 && !agendarVisivel && !naTrilha)
    if (novo !== estadoAtual) aplicarEstado(novo)
  })
}
window.addEventListener('scroll', aoRolar, { passive: true })
window.addEventListener('resize', aoRolar)

function aplicarEstado(estado: string) {
  estadoAtual = estado
  const fora = estado === 'fora'
  palco?.classList.toggle('is-fora', fora)
  dente?.pausar(fora)
  if (!fora) dente?.irPara(estado as Estado, !!trilha && ESTADOS_TRILHA.includes(estado as Estado))
  if (estado === 'clareamento') demonstrarEscala()
}

if (canvas && palco && webglOk()) {
  const carregar = () =>
    import('./three/dente').then(({ iniciarDente }) => {
      const inicial = estadoPelaRolagem()
      dente = iniciarDente(canvas, { reduzido, inicial: (inicial === 'fora' ? 'inicio' : inicial) as Estado })
      if (!dente) return
      palco.classList.add('is-pronto')
      estadoAtual = ''
      aoRolar()
    })
  const ocioso = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  const agenda = () => (ocioso ? ocioso(carregar, { timeout: 1200 }) : setTimeout(carregar, 200))
  if (document.readyState === 'complete') agenda()
  else window.addEventListener('load', agenda, { once: true })
}
aoRolar()

/* ---------- Escala de cor (clareamento) */
const NOMES = ['A3', 'A2', 'A1', 'B1']
const escala = document.querySelector<HTMLInputElement>('[data-escala] input')
let tocouEscala = false
let demoTimer = 0
function mostrarCor(v: number) {
  if (!escala) return
  escala.value = String(v)
  escala.setAttribute('aria-valuetext', NOMES[v])
  dente?.definirCor(v / 3)
}
escala?.addEventListener('input', () => {
  tocouEscala = true
  clearInterval(demoTimer)
  demoTimer = 0
  mostrarCor(Number(escala.value))
})
function demonstrarEscala() {
  if (!escala || tocouEscala || reduzido || demoTimer) return
  let v = 0
  mostrarCor(0)
  demoTimer = window.setInterval(() => {
    if (tocouEscala || estadoAtual !== 'clareamento') { clearInterval(demoTimer); demoTimer = 0; return }
    v = Math.min(3, v + 1)
    mostrarCor(v)
    if (v === 3) { clearInterval(demoTimer); demoTimer = 0 }
  }, 1000)
}

/* ---------- Abertura e arcada */
const titulo = document.querySelector<HTMLElement>('.abertura__titulo')
const arco = document.querySelector<SVGPathElement>('.arco__traco')
if (!reduzido && (titulo || arco)) {
  import('./animacoes').then(({ animarAbertura, animarArco }) => {
    if (titulo) animarAbertura(titulo)
    if (arco) animarArco(arco)
  })
} else if (arco) {
  arco.style.strokeDashoffset = '0'
  document.querySelectorAll('.arco__passos li').forEach((li) => li.classList.add('is-ativo'))
}
