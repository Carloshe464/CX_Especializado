import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SessionProvider } from '../auth/SessionContext.jsx'
import { createFakeSupabase } from '../test/fakeSupabase.js'
import { COMPETENCIES, DIAGNOSIS_STYLES, OPPORTUNITY_DECISION_STYLES } from '../lib/cx.js'
import EvaluationDetail from '../pages/EvaluationDetail.jsx'
import CurationCard from '../components/cx/CurationCard.jsx'
import OpportunityCard from '../components/cx/OpportunityCard.jsx'

const mocks = vi.hoisted(() => ({ client: null, toast: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({ get supabase() { return mocks.client }, supabaseConfigError: null }))
vi.mock('../components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }), toast: mocks.toast }))

const id = '10000000-0000-4000-8000-000000000036'
const supervisor = { role: 'supervisor', organizationId: 'org-x', user: { id: 'sup-x', email: 'sup@exemplo.test' } }
const analyst = { role: 'analista', organizationId: 'org-x', user: { id: 'a', email: 'a@exemplo.test' } }
const baseOpportunity = { severity: 'Importante', origin: 'Analista', confidence: 'Alto', evidence: 'Trecho fictício', impact: 'Impacto fictício', recommendation: 'Recomendação fictícia', improved_example: 'Exemplo fictício', communication_techniques: [] }
const analystFeedback = { id: 'f-a', target_type: 'diagnostico', opportunity_id: null, author_role: 'analista', liked: true, useful: true, comment: 'Comentário do analista' }
const supervisorFeedback = { id: 'f-s', target_type: 'diagnostico', opportunity_id: null, author_role: 'supervisor', liked: false, useful: false, comment: 'Comentário do supervisor' }
let queryClient
beforeEach(() => {
  mocks.client = createFakeSupabase({ tables: {
    evaluations: { data: { id, organization_id: 'org-x', protocol: 'CX-036', analyst_user_id: 'a', analyst_name: 'Ana Fictícia', created_by: 'a', channel: 'Chat', status: 'analisado', diagnosis_status: 'pendente', supervisor_review: null, transcript: 'Texto fictício', created_at: '2026-10-29T12:00:00Z', current_analysis_run_id: 'run-atual', current_run: { id: 'run-atual', status: 'sucesso', prompt_version: 'V1.2', trend: 'Favorável', summary_feedback: 'Diagnóstico fictício' } }, error: null },
    evaluation_scores: { data: COMPETENCIES.map((competency, index) => ({ id: `s${index}`, competency, score: 8, classification: 'Bom' })), error: null },
    opportunities: { data: [
      { ...baseOpportunity, id: 'opp-p', position: 0, description: 'Oportunidade pendente', status: 'pendente' },
      { ...baseOpportunity, id: 'opp-a', position: 1, description: 'Oportunidade aprovada', status: 'aprovada' },
    ], error: null },
    analysis_feedback: { data: [], error: null },
    app_settings: { data: [], error: null },
  } })
  mocks.toast.mockClear()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
})
afterEach(() => { queryClient.clear(); vi.restoreAllMocks() })
function show(session = supervisor) {
  return render(<SessionProvider value={session}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/avaliacao/' + id]}><Routes><Route path="/avaliacao/:id" element={<EvaluationDetail />} /></Routes></MemoryRouter></QueryClientProvider></SessionProvider>)
}
const card = (description) => screen.getByRole('heading', { name: description }).closest('article')
const curation = () => screen.getByRole('heading', { name: 'Curadoria' }).closest('section')

it('supervisor da organização vê decisões de diagnóstico e só na oportunidade pendente', async () => {
  show()
  await screen.findByRole('heading', { name: 'Oportunidade pendente' })
  expect(within(curation()).getByRole('button', { name: 'Aprovar diagnóstico' })).toBeInTheDocument()
  expect(within(curation()).getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument()
  for (const name of ['Aprovar', 'Ajustar', 'Rejeitar']) expect(within(card('Oportunidade pendente')).getByRole('button', { name })).toBeInTheDocument()
  expect(within(card('Oportunidade aprovada')).queryByRole('button', { name: /^(Aprovar|Ajustar|Rejeitar)$/ })).not.toBeInTheDocument()
})
it('aprovar oportunidade chama decide_opportunity e invalida a avaliação', async () => {
  const user = userEvent.setup()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  show()
  await screen.findByRole('heading', { name: 'Oportunidade pendente' })
  await user.click(within(card('Oportunidade pendente')).getByRole('button', { name: 'Aprovar' }))
  expect(mocks.client.rpc).toHaveBeenCalledWith('decide_opportunity', { p_opportunity: 'opp-p', p_decision: 'aprovada', p_note: null, p_adjusted: null })
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] }))
})
it('aprovar diagnóstico chama decide_diagnosis', async () => {
  const user = userEvent.setup()
  show()
  await screen.findByRole('heading', { name: 'Curadoria' })
  await user.type(within(curation()).getByRole('textbox', { name: 'Parecer do supervisor' }), 'Parecer fictício')
  await user.click(within(curation()).getByRole('button', { name: 'Aprovar diagnóstico' }))
  expect(mocks.client.rpc).toHaveBeenCalledWith('decide_diagnosis', { p_evaluation: id, p_decision: 'aprovado', p_review: 'Parecer fictício' })
})
it('diagnóstico já decidido não tem formulário e mostra o parecer', async () => {
  Object.assign(mocks.client.tables.evaluations.data, { status: 'curado', diagnosis_status: 'aprovado', supervisor_review: 'Parecer registrado' })
  show()
  await screen.findByText('Parecer registrado')
  expect(within(curation()).getByText('Aprovado')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Aprovar diagnóstico' })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Parecer do supervisor' })).not.toBeInTheDocument()
})
it('gestor vê a validação do analista em leitura e a própria avaliação, enviada pela RPC', async () => {
  mocks.client.tables.analysis_feedback.data = [analystFeedback]
  const user = userEvent.setup()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  show()
  await screen.findByText('Validação do analista: Gostei · Útil')
  expect(screen.getByText('Comentário do analista')).toBeInTheDocument()
  const form = within(screen.getByRole('form', { name: 'Sua avaliação do diagnóstico' }))
  expect(form.getByRole('heading', { name: 'Sua avaliação da orientação' })).toBeInTheDocument()
  expect(form.getByText('Usada só na taxa de utilidade da IA. A decisão de curadoria é feita nos botões acima.')).toBeInTheDocument()
  // Não pré-preenche com a linha do analista.
  expect(form.getByRole('radio', { name: 'Gostei' })).not.toBeChecked()
  expect(form.getByRole('radio', { name: 'Útil' })).not.toBeChecked()
  expect(form.getByRole('textbox')).toHaveValue('')
  await user.click(form.getByRole('radio', { name: 'Gostei' }))
  await user.click(form.getByRole('radio', { name: 'Não útil' }))
  await user.click(form.getByRole('button', { name: 'Enviar avaliação' }))
  expect(mocks.client.rpc).toHaveBeenCalledWith('submit_feedback', { p_run: 'run-atual', p_target: 'diagnostico', p_opportunity: null, p_liked: true, p_useful: false, p_comment: '' })
  expect(mocks.toast).toHaveBeenCalledWith({ title: 'Avaliação salva.' })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] })
})
it('avaliação do gestor vem pré-preenchida com a linha supervisor', async () => {
  mocks.client.tables.analysis_feedback.data = [analystFeedback, supervisorFeedback]
  show()
  const form = within(await screen.findByRole('form', { name: 'Sua avaliação do diagnóstico' }))
  expect(form.getByRole('radio', { name: 'Não gostei' })).toBeChecked()
  expect(form.getByRole('radio', { name: 'Não útil' })).toBeChecked()
  expect(form.getByRole('textbox')).toHaveValue('Comentário do supervisor')
  expect(form.getByRole('button', { name: 'Atualizar avaliação' })).toBeInTheDocument()
  expect(screen.getByText('Validação do analista: Gostei · Útil')).toBeInTheDocument()
})
it('gestor envia a avaliação de uma oportunidade com o id dela', async () => {
  const user = userEvent.setup()
  show()
  await screen.findByRole('heading', { name: 'Oportunidade pendente' })
  const form = within(within(card('Oportunidade pendente')).getByRole('form', { name: 'Sua avaliação da oportunidade' }))
  await user.click(form.getByRole('radio', { name: 'Não gostei' }))
  await user.click(form.getByRole('radio', { name: 'Útil' }))
  await user.click(form.getByRole('button', { name: 'Enviar avaliação' }))
  expect(mocks.client.rpc).toHaveBeenCalledWith('submit_feedback', { p_run: 'run-atual', p_target: 'oportunidade', p_opportunity: 'opp-p', p_liked: false, p_useful: true, p_comment: '' })
})
it('analista dono: sem decisões, mantém o próprio formulário e não vê a avaliação do supervisor', async () => {
  mocks.client.tables.analysis_feedback.data = [analystFeedback, supervisorFeedback]
  show(analyst)
  const form = within(await screen.findByRole('form', { name: 'Validação do diagnóstico' }))
  expect(form.getByRole('radio', { name: 'Gostei' })).toBeChecked()
  expect(form.getByRole('textbox')).toHaveValue('Comentário do analista')
  expect(screen.queryByRole('button', { name: /^(Aprovar|Ajustar|Rejeitar|Aprovar diagnóstico)$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Parecer do supervisor' })).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: /^Sua avaliação/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Comentário do supervisor')).not.toBeInTheDocument()
  expect(screen.queryByText('Sua avaliação da orientação')).not.toBeInTheDocument()
})
it('supervisor de outra organização não recebe controles de gestor', async () => {
  show({ ...supervisor, organizationId: 'org-y' })
  await screen.findByRole('heading', { name: 'Oportunidade pendente' })
  expect(screen.queryByRole('button', { name: /^(Aprovar|Ajustar|Rejeitar|Aprovar diagnóstico)$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
it('admin da plataforma vê os controles', async () => {
  show({ role: 'platform_admin', organizationId: null, user: { id: 'admin' } })
  await screen.findByRole('heading', { name: 'Oportunidade pendente' })
  expect(within(curation()).getByRole('button', { name: 'Aprovar diagnóstico' })).toBeInTheDocument()
  expect(within(card('Oportunidade pendente')).getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
  expect(screen.getByRole('form', { name: 'Sua avaliação do diagnóstico' })).toBeInTheDocument()
})
it.each(['pendente', 'aprovado', 'rejeitado'])('CurationCard usa DIAGNOSIS_STYLES: %s', (status) => {
  render(<CurationCard evaluation={{ diagnosis_status: status }} />)
  const badge = screen.getByText({ pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' }[status])
  expect(badge).toHaveClass(...DIAGNOSIS_STYLES[status].split(' '))
})
it.each([['aprovada', 'Aprovada'], ['ajustada', 'Ajustada'], ['rejeitada', 'Rejeitada']])('OpportunityCard usa OPPORTUNITY_DECISION_STYLES: %s', (status, label) => {
  render(<OpportunityCard opportunity={{ id: 'o', description: 'Oportunidade', status }} />)
  expect(screen.getByText(label)).toHaveClass(...OPPORTUNITY_DECISION_STYLES[status].split(' '))
})
