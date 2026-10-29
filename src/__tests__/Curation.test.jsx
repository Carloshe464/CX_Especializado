import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Curation from '../pages/Curation.jsx'

const mock = vi.hoisted(() => ({ queue: vi.fn(), recent: vi.fn() }))
vi.mock('../services/curation.js', () => ({ listCurationQueue: mock.queue, listRecentCuration: mock.recent }))

const row = (id, extra = {}) => ({ id, protocol: `CX-${id}`, analystName: 'Analista Fictícia', channel: 'Chat',
  createdAt: '2026-10-26T12:00:00Z', trend: 'Favorável', pendingOpportunities: 2, analystFlaggedNotUseful: false, ...extra })
const recent = (id, status) => ({ id, protocol: `CX-${id}`, analystName: 'Analista Exemplo',
  decidedAt: '2026-10-27T12:00:00Z', diagnosisStatus: status })
let queryClient
beforeEach(() => {
  mock.queue.mockReset().mockResolvedValue([row('1', { analystFlaggedNotUseful: true }), row('2', { trend: null, pendingOpportunities: 0 })])
  mock.recent.mockReset().mockResolvedValue([recent('3', 'aprovado'), recent('4', 'rejeitado')])
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
})
afterEach(() => queryClient.clear())
function show() {
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><Curation /></MemoryRouter></QueryClientProvider>)
}

it('mostra carregamentos independentes', async () => {
  let finishQueue, finishRecent
  mock.queue.mockReturnValue(new Promise((resolve) => { finishQueue = resolve }))
  mock.recent.mockReturnValue(new Promise((resolve) => { finishRecent = resolve }))
  show()
  expect(screen.getAllByRole('status')).toHaveLength(2)
  finishQueue([])
  finishRecent([])
  await screen.findByText('Nenhuma curadoria concluída ainda.')
})

it('exibe o contador, destaque, tendências e links sem depender do diagnóstico recente', async () => {
  show()
  const queue = await screen.findByRole('list', { name: 'Fila de curadoria' })
  expect(screen.getByRole('heading', { name: 'Em curadoria (2)' })).toBeInTheDocument()
  expect(within(queue).getByText('Analista marcou como não útil')).toBeInTheDocument()
  expect(within(queue).getByText('2 oportunidades pendentes')).toBeInTheDocument()
  expect(within(queue).getByText('Sem oportunidades pendentes')).toBeInTheDocument()
  expect(within(queue).getByText('Favorável')).toBeInTheDocument()
  expect(within(queue).getAllByRole('link')[0]).toHaveAttribute('href', '/avaliacao/1')
  expect(within(queue).getAllByRole('link')[1]).toHaveAttribute('href', '/avaliacao/2')
  const history = await screen.findByRole('list', { name: 'Curadoria recente' })
  expect(within(history).getByText('Aprovado')).toBeInTheDocument()
  expect(within(history).getByText('Rejeitado')).toBeInTheDocument()
  expect(within(history).getAllByRole('link')[0]).toHaveAttribute('href', '/avaliacao/3')
})

it('exibe vazios independentes', async () => {
  mock.queue.mockResolvedValue([])
  mock.recent.mockResolvedValue([])
  show()
  expect(await screen.findByText('Nenhuma análise aguardando curadoria')).toBeInTheDocument()
  expect(screen.getByText('Quando a IA analisar um atendimento, ele aparece aqui.')).toBeInTheDocument()
  expect(await screen.findByText('Nenhuma curadoria concluída ainda.')).toBeInTheDocument()
})

it('exibe o aviso com 200 itens', async () => {
  mock.queue.mockResolvedValue(Array.from({ length: 200 }, (_, i) => row(String(i))))
  show()
  expect(await screen.findByText('Mostrando as 200 análises mais antigas.')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Fila de curadoria' })).getAllByRole('link')).toHaveLength(200)
})

it('falha da fila não derruba a seção recente e retry refaz apenas a fila', async () => {
  mock.queue.mockRejectedValueOnce(new Error('Falha fictícia')).mockResolvedValueOnce([row('1')])
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a curadoria.')
  expect(await screen.findByRole('list', { name: 'Curadoria recente' })).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('list', { name: 'Fila de curadoria' })
  expect(mock.queue).toHaveBeenCalledTimes(2)
  expect(mock.recent).toHaveBeenCalledTimes(1)
})

it('falha da seção recente não derruba a fila e retry refaz apenas o histórico', async () => {
  mock.recent.mockRejectedValueOnce(new Error('Falha fictícia')).mockResolvedValueOnce([recent('3', 'aprovado')])
  show()
  await screen.findByRole('list', { name: 'Fila de curadoria' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a curadoria.')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(mock.recent).toHaveBeenCalledTimes(2))
  expect(mock.queue).toHaveBeenCalledTimes(1)
})
