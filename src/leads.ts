import './main'
import { lerPedidos, salvarPedidos, soDigitos, type Pedido } from './form'

const corpo = document.querySelector<HTMLTableSectionElement>('[data-linhas]')!
const vazio = document.querySelector<HTMLElement>('[data-vazio]')!
const resumo = document.querySelector<HTMLElement>('[data-resumo]')!

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function desenhar() {
  const lista = lerPedidos()
  vazio.hidden = lista.length > 0
  resumo.textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}` : 'Nenhum pedido ainda'
  corpo.innerHTML = lista
    .map((p) => {
      const wa = `https://wa.me/55${soDigitos(p.whatsapp)}?text=${encodeURIComponent(`Olá, ${p.nome.split(' ')[0]}! Aqui é da clínica, recebemos seu pedido de horário.`)}`
      return `<tr>
        <td>${quando(p.recebidoEm)}</td>
        <td>${esc(p.nome)}</td>
        <td><a href="${wa}" target="_blank" rel="noopener">${esc(p.whatsapp)}</a></td>
        <td>${esc(p.tratamento)}</td>
        <td>${esc(p.periodo)}</td>
        <td><span class="selo">${esc(p.origem)}</span></td>
        <td>${esc(p.mensagem || '')}</td>
      </tr>`
    })
    .join('')
}

document.querySelector('[data-exemplo]')?.addEventListener('click', () => {
  const exemplo: Pedido = {
    id: String(Date.now()),
    recebidoEm: new Date().toISOString(),
    nome: 'Paciente de teste',
    whatsapp: '(35) 90000-0000',
    tratamento: 'Implante dentário',
    periodo: 'Tarde',
    mensagem: 'Pedido criado pelo botão de teste.',
    pagina: document.title,
    origem: 'Busca no Google',
  }
  salvarPedidos([exemplo, ...lerPedidos()])
  desenhar()
})

document.querySelector('[data-limpar]')?.addEventListener('click', () => {
  if (confirm('Apagar todos os pedidos deste navegador?')) {
    salvarPedidos([])
    desenhar()
  }
})

document.querySelector('[data-csv]')?.addEventListener('click', () => {
  const lista = lerPedidos()
  const cab = ['Recebido', 'Nome', 'WhatsApp', 'Tratamento', 'Período', 'Origem', 'Mensagem']
  const cel = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const linhas = lista.map((p) => [quando(p.recebidoEm), p.nome, p.whatsapp, p.tratamento, p.periodo, p.origem, p.mensagem].map(cel).join(';'))
  const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pedidos-de-horario.csv' })
  a.click()
  URL.revokeObjectURL(a.href)
})

desenhar()
