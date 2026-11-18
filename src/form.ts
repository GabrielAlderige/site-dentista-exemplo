declare const __CLINICA__: { nome: string; formEndpoint: string; whatsapp: string; demo: boolean }

export interface Pedido {
  id: string
  recebidoEm: string
  nome: string
  whatsapp: string
  tratamento: string
  periodo: string
  mensagem: string
  pagina: string
  origem: string
}

export const CHAVE_PEDIDOS = 'clinica-demo-pedidos'
const CHAVE_ORIGEM = 'clinica-demo-origem'
const base = import.meta.env.BASE_URL

export function lerPedidos(): Pedido[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_PEDIDOS) || '[]') } catch { return [] }
}
export function salvarPedidos(lista: Pedido[]) {
  try { localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(lista)) } catch { /* modo privado */ }
}

/** Guarda de onde o paciente veio (Google Ads, Instagram, indicação...) para aparecer no pedido. */
export function registrarOrigem() {
  try {
    if (sessionStorage.getItem(CHAVE_ORIGEM)) return
    const u = new URL(location.href)
    let origem = 'Acesso direto'
    if (u.searchParams.get('gclid')) origem = 'Google Ads'
    else if (u.searchParams.get('fbclid')) origem = 'Facebook / Instagram'
    else if (u.searchParams.get('utm_source')) origem = [u.searchParams.get('utm_source'), u.searchParams.get('utm_campaign')].filter(Boolean).join(' / ')
    else if (document.referrer && new URL(document.referrer).host !== location.host) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, '')
      origem = /google\./.test(h) ? 'Busca no Google' : /instagram|facebook/.test(h) ? 'Instagram / Facebook' : h
    }
    sessionStorage.setItem(CHAVE_ORIGEM, origem)
  } catch { /* sem storage */ }
}
function lerOrigem() {
  try { return sessionStorage.getItem(CHAVE_ORIGEM) || 'Acesso direto' } catch { return 'Acesso direto' }
}

export const soDigitos = (s: string) => s.replace(/\D/g, '')
export function formatarTelefone(s: string) {
  const d = soDigitos(s).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function marcarErro(campo: HTMLElement | null, erro: HTMLElement | null, ruim: boolean) {
  if (!campo || !erro) return
  campo.setAttribute('aria-invalid', String(ruim))
  if (ruim) campo.setAttribute('aria-describedby', erro.id)
  else campo.removeAttribute('aria-describedby')
  erro.hidden = !ruim
}

export function iniciarFormulario() {
  const form = document.getElementById('form-agendar') as HTMLFormElement | null
  if (!form) return
  const nome = form.elements.namedItem('nome') as HTMLInputElement
  const whats = form.elements.namedItem('whatsapp') as HTMLInputElement
  const trat = form.elements.namedItem('tratamento') as HTMLSelectElement
  const consent = form.elements.namedItem('consentimento') as HTMLInputElement
  const status = form.querySelector<HTMLElement>('.form__status')!
  const botao = form.querySelector<HTMLButtonElement>('button[type=submit]')!

  const pre = document.body.dataset.tratamento
  if (pre) trat.value = pre

  whats.addEventListener('input', () => {
    whats.value = formatarTelefone(whats.value)
    if (whats.getAttribute('aria-invalid') === 'true') validar(false)
  })
  nome.addEventListener('input', () => { if (nome.getAttribute('aria-invalid') === 'true') validar(false) })

  function validar(focar: boolean) {
    const nomeRuim = nome.value.trim().length < 2
    const d = soDigitos(whats.value)
    const whatsRuim = d.length < 10 || d.length > 11
    const consentRuim = !consent.checked
    marcarErro(nome, document.getElementById('f-nome-erro'), nomeRuim)
    marcarErro(whats, document.getElementById('f-whats-erro'), whatsRuim)
    marcarErro(consent, document.getElementById('f-consent-erro'), consentRuim)
    if (focar) (nomeRuim ? nome : whatsRuim ? whats : consentRuim ? consent : null)?.focus()
    return !nomeRuim && !whatsRuim && !consentRuim
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    status.textContent = ''
    status.classList.remove('is-erro')
    if (!validar(true)) return

    const dados = new FormData(form)
    const pedido: Pedido = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      recebidoEm: new Date().toISOString(),
      nome: nome.value.trim(),
      whatsapp: whats.value,
      tratamento: String(dados.get('tratamento') || ''),
      periodo: String(dados.get('periodo') || ''),
      mensagem: String(dados.get('mensagem') || '').trim(),
      pagina: document.title,
      origem: lerOrigem(),
    }
    const destino = `${base}obrigado/?nome=${encodeURIComponent(pedido.nome.split(' ')[0])}&t=${encodeURIComponent(pedido.tratamento)}`

    // robô preencheu o campo escondido: segue o fluxo sem registrar nada
    if (String(dados.get('site') || '')) { location.href = destino; return }

    botao.disabled = true
    botao.textContent = 'Enviando...'
    try {
      if (__CLINICA__.formEndpoint) {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 15000)
        const r = await fetch(__CLINICA__.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(pedido),
          signal: ctrl.signal,
        })
        clearTimeout(t)
        if (!r.ok) throw new Error(String(r.status))
      }
      if (__CLINICA__.demo) salvarPedidos([pedido, ...lerPedidos()].slice(0, 200))
      location.href = destino
    } catch {
      botao.disabled = false
      botao.textContent = 'Pedir horário'
      status.classList.add('is-erro')
      status.textContent = 'O pedido não foi enviado. Confira sua internet e tente de novo, ou chame a clínica pelo WhatsApp.'
    }
  })
}
