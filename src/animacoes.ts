import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Entrada da página: o título se revela de baixo para cima, depois o resto, junto com o dente. */
export function animarAbertura(titulo: HTMLElement) {
  const resto = document.querySelectorAll('.abertura__local, .abertura__lead, .abertura__acoes, .migalha, .interna__abertura .escala, .selo-vidro')
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from(titulo, { clipPath: 'inset(0 0 100% 0)', y: 40, duration: 1.4 })
    .from(resto, { opacity: 0, y: 16, duration: 1, stagger: 0.07 }, '-=1')
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
