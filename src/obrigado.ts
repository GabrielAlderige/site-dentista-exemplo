import './main'

declare const __CLINICA__: { nome: string; whatsapp: string; demo: boolean }

const q = new URLSearchParams(location.search)
const nome = (q.get('nome') || '').slice(0, 40)
const trat = (q.get('t') || '').slice(0, 60)

const titulo = document.querySelector('[data-obrigado-titulo]')
if (titulo && nome) titulo.textContent = `Pedido recebido, ${nome}`

const link = document.querySelector<HTMLAnchorElement>('[data-whats-obrigado]')
if (link) {
  const texto = `Olá! Sou ${nome || 'paciente'} e acabei de pedir um horário pelo site${trat ? ` para ${trat.toLowerCase()}` : ''}.`
  link.href = `https://wa.me/${__CLINICA__.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}
if (!__CLINICA__.demo) document.querySelectorAll('[data-demo]').forEach((el) => el.remove())
