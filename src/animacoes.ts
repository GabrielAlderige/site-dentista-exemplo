import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** O único momento orquestrado da página: o título sobe palavra por palavra junto com o dente. */
export function animarAbertura(titulo: HTMLElement) {
  const texto = titulo.textContent ?? ''
  titulo.setAttribute('aria-label', texto)
  titulo.innerHTML = texto
    .split(' ')
    .map((p) => `<span class="palavra" aria-hidden="true" style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.08em;margin-bottom:-0.08em"><span style="display:inline-block">${p}</span></span>`)
    .join(' ')
  const internas = titulo.querySelectorAll('.palavra > span')
  const resto = document.querySelectorAll('.abertura__local, .abertura__lead, .abertura__acoes, .abertura__fatos, .migalha')
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from(internas, { yPercent: 110, duration: 1.1, stagger: 0.045 })
    .from(resto, { opacity: 0, y: 14, duration: 0.9, stagger: 0.08 }, '-=0.75')
}

/** A arcada dentária se desenha conforme a rolagem e acende cada etapa da consulta. */
export function animarArco(traco: SVGPathElement) {
  const passos = document.querySelectorAll<HTMLElement>('.arco__passos li')
  const marcos = [0.02, 0.3, 0.7, 0.97]
  ScrollTrigger.create({
    trigger: '.arco',
    start: 'top 75%',
    end: 'bottom 45%',
    scrub: 0.6,
    onUpdate: ({ progress }) => {
      traco.style.strokeDashoffset = String(1 - progress)
      passos.forEach((li, i) => li.classList.toggle('is-ativo', progress >= marcos[i]))
    },
  })
}
