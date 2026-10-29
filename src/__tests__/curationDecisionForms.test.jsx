import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OpportunityDecisionForm from '../components/cx/OpportunityDecisionForm.jsx'
import DiagnosisDecisionForm from '../components/cx/DiagnosisDecisionForm.jsx'

const mocks = vi.hoisted(() => ({ opportunity: vi.fn(), diagnosis: vi.fn(), toast: vi.fn() }))
vi.mock('../services/curation.js', () => ({
  decideOpportunity: mocks.opportunity,
  decideDiagnosis: mocks.diagnosis,
  curationErrorMessage: (error) => ({
    CX030: 'Somente o supervisor da organização pode decidir a curadoria.',
    CX025: 'Esta análise foi substituída. Recarregue a página.',
    CX026: 'A avaliação não tem análise concluída.',
  }[error?.code] || 'Não foi possível salvar a decisão. Tente novamente.'),
}))
vi.mock('../components/ui/use-toast.js', () => ({ toast: mocks.toast }))

let queryClient, invalidate
const opportunity = { id: 'opp-a', status: 'pendente' }
const evaluation = { id: 'av-a', status: 'analisado', diagnosisStatus: 'pendente' }
beforeEach(() => {
  mocks.opportunity.mockReset().mockResolvedValue(undefined)
  mocks.diagnosis.mockReset().mockResolvedValue(undefined)
  mocks.toast.mockReset()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  invalidate = vi.spyOn(queryClient, 'invalidateQueries')
})
afterEach(() => queryClient.clear())
function show(element) { return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>) }
function expectInvalidation() {
  for (const queryKey of [['evaluation', 'av-a'], ['evaluations'], ['curation']]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey })
  }
}

it('formulário de oportunidade só aparece em pendente', () => {
  const { container } = show(<OpportunityDecisionForm opportunity={{ ...opportunity, status: 'aprovada' }} evaluationId="av-a" />)
  expect(container).toBeEmptyDOMElement()
})

it('aprova oportunidade sem nota, dispara toast e invalida as três consultas', async () => {
  const decided = vi.fn()
  show(<OpportunityDecisionForm opportunity={opportunity} evaluationId="av-a" onDecided={decided} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Aprovar' }))
  await waitFor(() => expect(decided).toHaveBeenCalledOnce())
  expect(mocks.opportunity).toHaveBeenCalledExactlyOnceWith({ opportunityId: 'opp-a', decision: 'aprovada', note: null, adjusted: null })
  expect(mocks.toast).toHaveBeenCalledWith({ title: 'Decisão registrada.' })
  expectInvalidation()
})

it('ajustar exige nota, mantém a recomendação original quando em branco e remove espaços', async () => {
  const user = userEvent.setup()
  show(<OpportunityDecisionForm opportunity={opportunity} evaluationId="av-a" />)
  await user.click(screen.getByRole('button', { name: 'Ajustar' }))
  const note = screen.getByRole('textbox', { name: 'Nota do supervisor' })
  const adjusted = screen.getByRole('textbox', { name: 'Recomendação ajustada (opcional)' })
  expect(note).toHaveAttribute('maxlength', '2000')
  expect(adjusted).toHaveAttribute('maxlength', '2000')
  expect(screen.getByText('Deixe em branco para manter a recomendação da IA.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Salvar ajuste' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Informe a nota do supervisor.')
  expect(mocks.opportunity).not.toHaveBeenCalled()
  fireEvent.change(note, { target: { value: ' Nota necessária ' } })
  await user.click(screen.getByRole('button', { name: 'Salvar ajuste' }))
  await waitFor(() => expect(mocks.opportunity).toHaveBeenCalledOnce())
  expect(mocks.opportunity).toHaveBeenCalledWith({ opportunityId: 'opp-a', decision: 'ajustada', note: 'Nota necessária', adjusted: null })
})

it('ajustar envia recomendação aparada', async () => {
  const user = userEvent.setup()
  show(<OpportunityDecisionForm opportunity={opportunity} evaluationId="av-a" />)
  await user.click(screen.getByRole('button', { name: 'Ajustar' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Nota do supervisor' }), { target: { value: 'Motivo' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Recomendação ajustada (opcional)' }), { target: { value: '  Recomendar conversa  ' } })
  await user.click(screen.getByRole('button', { name: 'Salvar ajuste' }))
  await waitFor(() => expect(mocks.opportunity).toHaveBeenCalledWith({
    opportunityId: 'opp-a', decision: 'ajustada', note: 'Motivo', adjusted: 'Recomendar conversa',
  }))
})

it('rejeitar exige justificativa; cancelar não envia nada', async () => {
  const user = userEvent.setup()
  show(<OpportunityDecisionForm opportunity={opportunity} evaluationId="av-a" />)
  await user.click(screen.getByRole('button', { name: 'Rejeitar' }))
  await user.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Informe a justificativa.')
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(mocks.opportunity).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Rejeitar' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Justificativa' }), { target: { value: ' Não aplicável ' } })
  await user.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
  await waitFor(() => expect(mocks.opportunity).toHaveBeenCalledWith({
    opportunityId: 'opp-a', decision: 'rejeitada', note: 'Não aplicável', adjusted: null,
  }))
})

it('bloqueia envio duplo e campos, preserva texto e traduz CX030', async () => {
  let fail
  mocks.opportunity.mockImplementation(() => new Promise((_, reject) => { fail = reject }))
  show(<OpportunityDecisionForm opportunity={opportunity} evaluationId="av-a" />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Ajustar' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Nota do supervisor' }), { target: { value: 'Texto preservado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar ajuste' }))
  expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: 'Nota do supervisor' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  expect(mocks.opportunity).toHaveBeenCalledOnce()
  await act(async () => { fail({ code: 'CX030' }) })
  expect(screen.getByRole('alert')).toHaveTextContent('Somente o supervisor da organização pode decidir a curadoria.')
  expect(screen.getByRole('textbox', { name: 'Nota do supervisor' })).toHaveValue('Texto preservado')
})

it.each([
  [{ ...evaluation, status: 'curado' }],
  [{ ...evaluation, diagnosisStatus: 'aprovado' }],
  [{ ...evaluation, diagnosisStatus: 'rejeitado' }],
])('diagnóstico não aparece após decisão: %s', (item) => {
  const { container } = show(<DiagnosisDecisionForm evaluation={item} />)
  expect(container).toBeEmptyDOMElement()
})

it('diagnóstico aprova sem parecer e invalida consultas', async () => {
  const decided = vi.fn()
  show(<DiagnosisDecisionForm evaluation={evaluation} onDecided={decided} />)
  expect(screen.getByText('Ao decidir o diagnóstico, a curadoria desta avaliação é concluída.')).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Aprovar diagnóstico' }))
  await waitFor(() => expect(decided).toHaveBeenCalledOnce())
  expect(mocks.diagnosis).toHaveBeenCalledWith({ evaluationId: 'av-a', decision: 'aprovado', review: null })
  expect(mocks.toast).toHaveBeenCalledWith({ title: 'Decisão registrada.' })
  expectInvalidation()
})

it('rejeita somente com parecer e desabilita durante envio', async () => {
  let finish
  mocks.diagnosis.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const user = userEvent.setup()
  show(<DiagnosisDecisionForm evaluation={{ ...evaluation, diagnosisStatus: null }} />)
  const input = screen.getByRole('textbox', { name: 'Parecer do supervisor' })
  expect(input).toHaveAttribute('maxlength', '2000')
  await user.click(screen.getByRole('button', { name: 'Rejeitar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Informe o parecer para rejeitar.')
  expect(mocks.diagnosis).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: '  Parecer fundamentado  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }))
  expect(input).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeDisabled()
  expect(mocks.diagnosis).toHaveBeenCalledExactlyOnceWith({ evaluationId: 'av-a', decision: 'rejeitado', review: 'Parecer fundamentado' })
  await act(async () => { finish() })
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce())
})

it.each(['CX026', 'CX025'])('diagnóstico traduz %s e preserva parecer', async (code) => {
  mocks.diagnosis.mockRejectedValue({ code })
  const user = userEvent.setup()
  show(<DiagnosisDecisionForm evaluation={evaluation} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Parecer do supervisor' }), { target: { value: 'Texto mantido' } })
  await user.click(screen.getByRole('button', { name: 'Aprovar diagnóstico' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(code === 'CX026'
    ? 'A avaliação não tem análise concluída.'
    : 'Esta análise foi substituída. Recarregue a página.')
  expect(screen.getByRole('textbox', { name: 'Parecer do supervisor' })).toHaveValue('Texto mantido')
})
