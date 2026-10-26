import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createFakeSupabase } from '../test/fakeSupabase.js'
import Evaluations from '../pages/Evaluations.jsx'

const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('../lib/supabaseClient.js', () => ({
  get supabase() { return mocks.client },
  supabaseConfigError: null,
}))

const rows = [
  { id: 'a', protocol: 'CX-001', analyst_name: 'João Fictício', channel: 'Chat', status: 'rascunho', current_run: null },
  { id: 'b', protocol: 'CX-002', analyst_name: 'Lívia Exemplo', channel: 'WhatsApp', status: 'transcrito', current_run: { trend: 'Incerta' } },
  { id: 'c', protocol: 'CX-003', analyst_name: 'José Teste', channel: 'Telefone', status: 'analisado', current_run: { trend: 'Favorável' } },
  { id: 'd', protocol: null, analyst_name: null, channel: null, status: 'curado', current_run: { trend: 'Desfavorável' } },
].map((row, i) => ({ ...row, organization_id: 'org-a', created_at: '2026-10-26T12:00:00Z', csat_records: i < 3 ? [{ score: [5, 3, 4][i], created_at: '2026-10-26T12:00:00Z' }] : [] }))

let queryClient
beforeEach(() => {
  mocks.client = createFakeSupabase({ tables: {
    evaluations: { data: rows, error: null },
    app_settings: { data: [{ organization_id: 'org-a', value: '4' }], error: null },
  } })
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
})
afterEach(() => queryClient.clear())

function show() {
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><Evaluations /></MemoryRouter></QueryClientProvider>)
}

it('mostra carregamento enquanto aguarda as consultas', async () => {
  let finish
  mocks.client.tables.evaluations = new Promise((resolve) => { finish = resolve })
  show()
  expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  finish({ data: [], error: null })
  await screen.findByText('Nenhuma avaliação ainda')
})

it('exibe os quatro status, tendências, notas e links corretos', async () => {
  show()
  const list = await screen.findByRole('list', { name: 'Lista de avaliações' })
  for (const label of ['Rascunho', 'Transcrição pronta', 'Em curadoria', 'Curadoria concluída']) {
    expect(within(list).getByText(label)).toBeInTheDocument()
  }
  for (const trend of ['Incerta', 'Favorável', 'Desfavorável']) expect(within(list).getByText(trend)).toBeInTheDocument()
  const first = within(list).getAllByRole('link')[0]
  expect(within(first).queryByText(/Favorável|Incerta|Desfavorável/)).not.toBeInTheDocument()
  expect(screen.getByText('Nota real: 5 · Satisfação positiva')).toBeInTheDocument()
  expect(screen.getByText('Nota real: 3 · Neutro')).toBeInTheDocument()
  expect(screen.getByText('Nota real: 4 · Satisfação positiva')).toBeInTheDocument()
  for (const [i, link] of within(list).getAllByRole('link').entries()) expect(link).toHaveAttribute('href', `/avaliacao/${rows[i].id}`)
  const fallback = screen.getByRole('link', { name: /Sem protocolo/ })
  expect(within(fallback).getByText('Analista não informado · 26 de out. de 2026')).toBeInTheDocument()
  expect(within(fallback).queryByText(/Nota real/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Importar planilha' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Importar planilha' })).toHaveAccessibleDescription('Disponível em breve')
  expect(screen.getByRole('link', { name: 'Nova avaliação' })).toHaveAttribute('href', '/nova-avaliacao')
  expect(screen.queryByText('Mostrando as 200 avaliações mais recentes.')).not.toBeInTheDocument()
  expect(queryClient.getQueryData(['app_settings', 'csat_positive_threshold'])).toEqual({ 'org-a': 4 })
  expect(queryClient.getQueryData(['evaluations'])).toHaveLength(4)
})

it('usa o limiar da organização: nota 4 com limiar 5 é Insatisfação', async () => {
  mocks.client.tables.app_settings = { data: [{ organization_id: 'org-a', value: '5' }], error: null }
  show()
  expect(await screen.findByText('Nota real: 4 · Insatisfação')).toBeInTheDocument()
})

it('exibe para o admin a nota 4 com a faixa de cada organização, incluindo a sem configuração', async () => {
  mocks.client.tables.evaluations = { data: ['org-a', 'org-b', 'org-sem-config'].map((organization_id) => ({
    ...rows[2], id: organization_id, organization_id, protocol: organization_id,
  })), error: null }
  mocks.client.tables.app_settings = { data: [
    { organization_id: 'org-a', value: '4' },
    { organization_id: 'org-b', value: '5' },
  ], error: null }
  show()
  await screen.findByRole('list', { name: 'Lista de avaliações' })
  expect(within(screen.getByRole('link', { name: /^org-a / })).getByText('Nota real: 4 · Satisfação positiva')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /^org-b / })).getByText('Nota real: 4 · Insatisfação')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /^org-sem-config / })).getByText('Nota real: 4 · Satisfação positiva')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each([
  ['cx-002', 'CX-002'], ['joao', 'CX-001'], ['TELEFONE', 'CX-003'],
])('busca por %s sem diferenciar caixa nem acentos', async (search, protocol) => {
  const user = userEvent.setup()
  show()
  await screen.findByRole('list')
  await user.type(screen.getByRole('searchbox', { name: 'Buscar avaliações' }), search)
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(within(screen.getByRole('list')).getByText(protocol)).toBeInTheDocument()
  expect(mocks.client.from).toHaveBeenCalledTimes(2)
})

it('mostra busca sem resultado e limpa o campo', async () => {
  const user = userEvent.setup()
  show()
  await screen.findByRole('list')
  const input = screen.getByRole('searchbox')
  await user.type(input, 'inexistente')
  expect(screen.getByText('Nenhuma avaliação encontrada para “inexistente”.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
  expect(input).toHaveValue('')
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
})

it('mostra o vazio com ação para criar avaliação', async () => {
  mocks.client.tables.evaluations = { data: [], error: null }
  show()
  expect(await screen.findByText('Nenhuma avaliação ainda')).toBeInTheDocument()
  expect(screen.getByText('Registre o primeiro atendimento para começar.')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Nova avaliação' })).toHaveLength(2)
})

it.each(['evaluations', 'app_settings'])('permite tentar novamente após falha em %s', async (table) => {
  const user = userEvent.setup()
  mocks.client.tables[table] = { data: null, error: new Error('Falha fictícia') }
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as avaliações.')
  mocks.client.tables[table] = { data: table === 'evaluations' ? rows : [{ organization_id: 'org-a', value: '4' }], error: null }
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('list')
  await waitFor(() => expect(mocks.client.from.mock.calls.filter(([name]) => name === table)).toHaveLength(2))
})

it('avisa quando a consulta atinge o limite de 200, mesmo após busca', async () => {
  const user = userEvent.setup()
  mocks.client.tables.evaluations = { data: Array.from({ length: 200 }, (_, i) => ({ ...rows[0], id: `av-${i}`, protocol: `PROTO-${i}` })), error: null }
  show()
  expect(await screen.findByText('Mostrando as 200 avaliações mais recentes.')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(200)
  await user.type(screen.getByRole('searchbox'), 'PROTO-199')
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('Mostrando as 200 avaliações mais recentes.')).toBeInTheDocument()
})
