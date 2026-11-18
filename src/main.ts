import './styles.css'
import { iniciarFormulario, registrarOrigem } from './form'
import type { Dente, Estado } from './three/dente'

declare const __CLINICA__: { demo: boolean; whatsapp: string }

const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

registrarOrigem()
iniciarFormulario()

/* ---------- Topo, menu e barra do celular */
const topo = document.querySelector<HTMLElement>('.topo')
const barra = document.querySelector<HTMLElement>('.barra-movel')
const agendar = document.getElementById('agendar')
let agendarVisivel = false
if (agendar) new IntersectionObserver(([e]) => { agendarVisivel = e.isIntersecting; aoRolar() }).observe(agendar)
function aoRolar() {
  const y = window.scrollY
  topo?.classList.toggle('is-rolado', y > 8)
  barra?.classList.toggle('is-visivel', y > window.innerHeight * 0.6 && !agendarVisivel)
}
window.addEventListener('scroll', aoRolar, { passive: true })
aoRolar()

const botaoMenu = document.querySelector<HTMLButtonElement>('.menu__abrir')
const lista = document.getElementById('menu-lista')
botaoMenu?.addEventListener('click', () => {
  const aberto = botaoMenu.getAttribute('aria-expanded') === 'true'
  botaoMenu.setAttribute('aria-expanded', String(!aberto))
  lista?.classList.toggle('is-aberto', !aberto)
})
lista?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) {
    botaoMenu?.setAttribute('aria-expanded', 'false')
    lista.classList.remove('is-aberto')
  }
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lista?.classList.contains('is-aberto')) {
    botaoMenu?.setAttribute('aria-expanded', 'false')
    lista.classList.remove('is-aberto')
    botaoMenu?.focus()
  }
})

if (!__CLINICA__.demo) document.querySelector('[data-demo]')?.remove()

/* ---------- Dente 3D e estados por seção */
const palco = document.querySelector<HTMLElement>('.palco')
const canvas = document.querySelector<HTMLCanvasElement>('[data-dente]')
let dente: Dente | null = null
let estadoAtual: string = document.querySelector<HTMLElement>('[data-estado]')?.dataset.estado ?? 'inicio'

function aplicarEstado(estado: string) {
  estadoAtual = estado
  const fora = estado === 'fora'
  palco?.classList.toggle('is-fora', fora)
  dente?.pausar(fora)
  if (!fora) dente?.irPara(estado as Estado)
  if (estado === 'clareamento') demonstrarEscala()
}

const secoes = document.querySelectorAll<HTMLElement>('[data-estado]')
if (secoes.length) {
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) aplicarEstado(e.target.getAttribute('data-estado')!)
  }, { rootMargin: '-50% 0px -50% 0px' })
  secoes.forEach((s) => io.observe(s))
}

function webglOk() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

if (canvas && palco && webglOk()) {
  const carregar = () =>
    import('./three/dente').then(({ iniciarDente }) => {
      dente = iniciarDente(canvas, { reduzido, inicial: (estadoAtual === 'fora' ? 'inicio' : estadoAtual) as Estado })
      if (!dente) return
      palco.classList.add('is-pronto')
      aplicarEstado(estadoAtual)
    })
  const ocioso = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (document.readyState === 'complete') ocioso ? ocioso(carregar, { timeout: 1200 }) : setTimeout(carregar, 200)
  else window.addEventListener('load', () => (ocioso ? ocioso(carregar, { timeout: 1200 }) : setTimeout(carregar, 200)), { once: true })
}

/* ---------- Escala de cor (clareamento) */
const NOMES = ['A3', 'A2', 'A1', 'B1']
const escala = document.querySelector<HTMLInputElement>('[data-escala] input')
let tocouEscala = false
let demoTimer = 0
function mostrarCor(v: number, animar = true) {
  if (!escala) return
  escala.value = String(v)
  escala.setAttribute('aria-valuetext', NOMES[v])
  dente?.definirCor(v / 3, animar)
}
escala?.addEventListener('input', () => {
  tocouEscala = true
  clearInterval(demoTimer)
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
  }, 1100)
}

/* ---------- Abertura e arcada (GSAP só onde existe) */
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
