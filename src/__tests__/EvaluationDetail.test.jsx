import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SessionProvider } from '../auth/SessionContext.jsx'
import { createFakeSupabase } from '../test/fakeSupabase.js'
import { COMPETENCIES, formatDate } from '../lib/cx.js'
import EvaluationDetail from '../pages/EvaluationDetail.jsx'
const mocks = vi.hoisted(() => ({ client: null, toast: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({ get supabase() { return mocks.client }, supabaseConfigError: null }))
vi.mock('../components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
const id = '10000000-0000-4000-8000-000000000001'
const analyst = { role: 'analista', organizationId: 'org-x', user: { id: 'a', email: 'a@exemplo.test' } }
const row = { id, organization_id: 'org-x', protocol: 'CX-033', analyst_user_id: 'a', analyst_name: 'Ana Fictícia', created_by: 'a', channel: 'Chat', status: 'rascunho', transcript: 'Texto fictício', created_at: '2026-10-27T12:00:00Z', current_run: null, current_analysis_run_id: null }
let queryClient
beforeEach(() => {
  mocks.client = createFakeSupabase({ tables: {
    evaluations: { data: { ...row }, error: null },
    app_settings: { data: [{ organization_id: 'org-x', value: '5' }], error: null },
  } })
  mocks.toast.mockClear()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
})
afterEach(() => { queryClient.clear(); vi.restoreAllMocks() })
function show(session = analyst, route = id) {
  return render(<SessionProvider value={session}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/avaliacao/' + route]}><Routes><Route path="/avaliacao/:id" element={<EvaluationDetail />} /></Routes></MemoryRouter></QueryClientProvider></SessionProvider>)
}
function analyzed() {
  mocks.client.tables.evaluations.data = { ...row, status: 'analisado', diagnosis_status: 'pendente', current_analysis_run_id: 'run-atual', current_run: { id: 'run-atual', status: 'sucesso', prompt_version: 'V1.2', trend: 'Favorável', summary_feedback: 'Diagnóstico fictício', strengths: 'Acolhimento respeitoso', uncertainties: 'Sem contexto anterior' } }
  mocks.client.tables.evaluation_scores = { data: COMPETENCIES.map((competency, index) => ({ id: `s${index}`, competency, score: index === 0 ? 7 : index === 1 ? 8 : null, classification: index < 2 ? 'Bom' : 'Não avaliável', evidence: `Evidência ${index}` })).reverse(), error: null }
  mocks.client.tables.opportunities = { data: [{ id: 'opp-1', position: 0, severity: 'Importante', origin: 'Analista', confidence: 'Alto', description: 'Oportunidade fictícia', evidence: 'Trecho fictício', impact: 'Pode reduzir incerteza', recommendation: 'Recomendação fictícia', improved_example: 'Exemplo fictício', communication_techniques: ['Rapport', 'Escuta ativa'], status: 'pendente' }], error: null }
}
const feedback = { id: 'f1', target_type: 'diagnostico', opportunity_id: null, author_role: 'analista', liked: false, useful: true, comment: 'Comentário fictício' }
it('mostra carregamento', async () => {
  let release
  mocks.client.tables.evaluations = new Promise((resolve) => { release = resolve })
  show()
  expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  release({ data: null, error: null })
  await screen.findByText('Avaliação não encontrada ou você não tem acesso a ela.')
})
it('mostra erro e permite tentar novamente', async () => {
  const user = userEvent.setup()
  mocks.client.tables.evaluations = { data: null, error: { code: 'erro' } }
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a avaliação.')
  mocks.client.tables.evaluations = { data: { ...row }, error: null }
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: 'CX-033' })
})
it.each([id, 'inválido'])('não encontrada tem a mesma mensagem: %s', async (route) => {
  mocks.client.tables.evaluations.data = null
  show(analyst, route)
  await screen.findByText('Avaliação não encontrada ou você não tem acesso a ela.')
  expect(screen.getByRole('link', { name: 'Voltar para Avaliações' })).toHaveAttribute('href', '/avaliacoes')
})
it('cabeçalho sem execução e métricas vazias', async () => {
  mocks.client.tables.evaluations.data = { ...row, protocol: null, transcript: '   ' }
  show()
  await screen.findByRole('heading', { name: 'Atendimento' })
  expect(screen.getByText('PROTOCOLO CX')).toBeInTheDocument()
  expect(screen.getByText(`Analista Ana Fictícia · Chat · ${formatDate(row.created_at)}`)).toBeInTheDocument()
  expect(screen.getByText('Rascunho')).toBeInTheDocument()
  expect(screen.getByText('—')).toBeInTheDocument()
  expect(screen.getByText('Não')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← Avaliações' })).toHaveAttribute('href', '/avaliacoes')
})
it.each(['texto novo', '  '])('salva a transcrição e invalida as duas queries: %s', async (text) => {
  const user = userEvent.setup()
  show()
  const area = await screen.findByRole('textbox', { name: 'Transcrição do atendimento' })
  expect(area).toHaveClass('min-h-72', 'font-mono')
  expect(area).not.toHaveAttribute('maxlength')
  const save = screen.getByRole('button', { name: 'Salvar transcrição' })
  expect(save).toBeDisabled()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  await user.clear(area)
  await user.type(area, text)
  await user.click(save)
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Transcrição salva.' }))
  const updateQuery = mocks.client.from.mock.results.map(({ value }) => value).find((q) => q.update.mock.calls.length)
  expect(updateQuery.update).toHaveBeenCalledWith({ transcript: text.trim() ? text : null, status: text.trim() ? 'transcrito' : 'rascunho' })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluations'] })
})
it('salvar mostra estado de envio e erro sem apagar texto', async () => {
  const user = userEvent.setup()
  const original = mocks.client.from.getMockImplementation()
  let release
  mocks.client.from.mockImplementation((table) => {
    const q = original(table)
    q.single.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    return q
  })
  show()
  await user.type(await screen.findByRole('textbox', { name: 'Transcrição do atendimento' }), ' editado')
  await user.click(screen.getByRole('button', { name: 'Salvar transcrição' }))
  expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  release({ data: null, error: { code: 'CX036' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('A transcrição não pode mais ser alterada nesta etapa.')
  expect(screen.getByRole('textbox', { name: 'Transcrição do atendimento' })).toHaveValue('Texto fictício editado')
})
it('usuário sem edição vê pre e IA desabilitada', async () => {
  show({ ...analyst, user: { id: 'b' } })
  expect((await screen.findByText('Texto fictício')).tagName).toBe('PRE')
  expect(screen.queryByRole('textbox', { name: 'Transcrição do atendimento' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Analisar com a IA' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Analisar com a IA' })).toHaveAccessibleDescription('Disponível em breve')
})
it.each([
  { ...analyst, user: { id: 'criador' } },
  { ...analyst, role: 'supervisor', user: { id: 'gestor' } },
  { ...analyst, role: 'platform_admin', organizationId: null, user: { id: 'admin' } },
])('dono, supervisor ou admin pode editar antes da análise: $role', async (session) => {
  mocks.client.tables.evaluations.data.created_by = 'criador'
  show(session)
  await screen.findByRole('textbox', { name: 'Transcrição do atendimento' })
})
it('mostra a execução atual, seis competências ordenadas, diagnóstico e oportunidades', async () => {
  analyzed()
  show()
  await screen.findByRole('heading', { name: 'Competências' })
  expect(screen.getByText('PROTOCOLO V1.2')).toBeInTheDocument()
  expect(screen.getByText('7,5 / 10')).toBeInTheDocument()
  expect(screen.getByText('Sim')).toBeInTheDocument()
  const competencies = screen.getByRole('heading', { name: 'Competências' }).parentElement
  expect(within(competencies).getAllByRole('heading', { level: 3 }).map((e) => e.textContent)).toEqual([...COMPETENCIES])
  expect(within(competencies).getAllByText('Não avaliável').length).toBe(8)
  for (const text of ['7,0 de 10', 'Diagnóstico fictício', 'Favorável', 'Acolhimento respeitoso', 'Sem contexto anterior', 'Aguardando revisão do supervisor.', 'Oportunidade fictícia', 'Trecho fictício', 'Pode reduzir incerteza', 'Recomendação fictícia', 'Exemplo fictício', 'Rapport', 'Escuta ativa']) expect(screen.getByText(text)).toBeInTheDocument()
})
it('curadoria aprovada e oportunidade ajustada mostram decisões sem controles', async () => {
  analyzed()
  Object.assign(mocks.client.tables.evaluations.data, { status: 'curado', diagnosis_status: 'aprovado', supervisor_review: 'Parecer fictício' })
  Object.assign(mocks.client.tables.opportunities.data[0], { status: 'ajustada', supervisor_note: 'Nota fictícia', adjusted_recommendation: 'Ajuste fictício' })
  show({ ...analyst, role: 'supervisor' })
  await screen.findByText('Aprovado')
  for (const text of ['Parecer do supervisor', 'Parecer fictício', 'Ajustada', 'Nota do supervisor', 'Nota fictícia', 'Recomendação original da IA', 'Recomendação ajustada pelo supervisor', 'Ajuste fictício']) expect(screen.getByText(text)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Aprovar|Rejeitar|Ajustar/ })).not.toBeInTheDocument()
})
it('nenhuma oportunidade', async () => {
  analyzed()
  mocks.client.tables.opportunities.data = []
  show()
  await screen.findByText('A IA não identificou oportunidades relevantes neste atendimento.')
})
it.each([['em_andamento', 'A análise está em andamento.'], ['falha', 'A última análise não foi concluída.']])('execução %s não mostra cards de análise', async (status, text) => {
  analyzed()
  mocks.client.tables.evaluations.data.current_run.status = status
  show()
  await screen.findByText(text)
  expect(screen.queryByRole('heading', { name: 'Competências' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Diagnóstico da IA' })).not.toBeInTheDocument()
  expect(screen.queryByText('Oportunidade fictícia')).not.toBeInTheDocument()
})
it.each(['diagnostico', 'oportunidade'])('analista envia %s pela RPC e invalida', async (target) => {
  analyzed()
  const user = userEvent.setup()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  show()
  const form = await screen.findByRole('form', { name: target === 'diagnostico' ? 'Validação do diagnóstico' : 'Validação da oportunidade' })
  const controls = within(form)
  const submit = controls.getByRole('button', { name: 'Enviar validação' })
  expect(submit).toBeDisabled()
  await user.click(controls.getByRole('radio', { name: 'Não gostei' }))
  expect(submit).toBeDisabled()
  await user.click(controls.getByRole('radio', { name: 'Útil' }))
  await user.type(controls.getByRole('textbox'), 'Observação fictícia')
  await user.click(submit)
  expect(mocks.client.rpc).toHaveBeenCalledWith('submit_feedback', { p_run: 'run-atual', p_target: target, p_opportunity: target === 'diagnostico' ? null : 'opp-1', p_liked: false, p_useful: true, p_comment: 'Observação fictícia' })
  expect(mocks.toast).toHaveBeenCalledWith({ title: 'Validação salva.' })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] })
})
it('pré-preenche diagnóstico e oportunidade, e permite atualizar', async () => {
  analyzed()
  mocks.client.tables.analysis_feedback = { data: [feedback, { ...feedback, id: 'f2', target_type: 'oportunidade', opportunity_id: 'opp-1' }], error: null }
  const user = userEvent.setup()
  show()
  const form = within(await screen.findByRole('form', { name: 'Validação do diagnóstico' }))
  expect(form.getByRole('radio', { name: 'Não gostei' })).toBeChecked()
  expect(form.getByRole('radio', { name: 'Útil' })).toBeChecked()
  expect(form.getByRole('textbox')).toHaveValue('Comentário fictício')
  expect(screen.getAllByRole('button', { name: 'Atualizar validação' })).toHaveLength(2)
  await user.click(form.getByRole('radio', { name: 'Gostei' }))
  await user.click(form.getByRole('button', { name: 'Atualizar validação' }))
  expect(mocks.client.rpc.mock.calls[0][1].p_liked).toBe(true)
})
it('comentário respeita limite e contador', async () => {
  analyzed()
  const user = userEvent.setup()
  show()
  const form = within(await screen.findByRole('form', { name: 'Validação do diagnóstico' }))
  const area = form.getByRole('textbox')
  expect(area).toHaveAttribute('maxlength', '2000')
  await user.click(area)
  await user.paste('a'.repeat(2001))
  expect(area).toHaveValue('a'.repeat(2000))
  expect(form.getByText('2000 / 2000 caracteres')).toBeInTheDocument()
})
it.each([['CX023', 'Você não tem permissão para validar esta avaliação.'], ['CX025', 'Esta análise foi substituída. Recarregue a página.']])('erro %s mantém formulário', async (code, message) => {
  analyzed()
  mocks.client.tables.analysis_feedback = { data: [feedback], error: null }
  mocks.client.rpc.mockResolvedValue({ error: { code } })
  const user = userEvent.setup()
  show()
  const form = within(await screen.findByRole('form', { name: 'Validação do diagnóstico' }))
  await user.click(form.getByRole('button', { name: 'Atualizar validação' }))
  expect(await form.findByRole('alert')).toHaveTextContent(message)
  expect(form.getByRole('textbox')).toHaveValue('Comentário fictício')
})
it.each([false, true])('supervisor vê validação em leitura; existente %s', async (present) => {
  analyzed()
  mocks.client.tables.analysis_feedback = { data: present ? [feedback] : [], error: null }
  show({ ...analyst, role: 'supervisor', user: { id: 'supervisor' } })
  await screen.findByRole('heading', { name: 'Diagnóstico da IA' })
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  if (present) {
    expect(screen.getByText('Validação do analista: Não gostei · Útil')).toBeInTheDocument()
    expect(screen.getByText('Comentário fictício')).toBeInTheDocument()
  } else expect(screen.getAllByText('O analista ainda não validou.')).toHaveLength(2)
})
it('criador não analista não recebe formulário', async () => {
  analyzed()
  mocks.client.tables.evaluations.data.created_by = 'criador'
  show({ ...analyst, user: { id: 'criador' } })
  await screen.findByRole('heading', { name: 'Diagnóstico da IA' })
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
it('CSAT usa limiar da organização, distingue nota derivada e sem nota', async () => {
  mocks.client.tables.csat_records = { data: [
    { id: 'c1', score: 4, score_origin: 'real', source: 'pesquisa', comment: 'Comentário do cliente', reason: 'Motivo fictício', themes: 'Tema fictício', created_at: row.created_at },
    { id: 'c2', score: null, source: 'arquivo' },
    { id: 'c3', score: 5, score_origin: 'derivada_nivel', source: 'planilha' },
  ], error: null }
  show()
  await screen.findByText('Insatisfação')
  for (const text of ['4 / 5', 'Sem nota', 'planilha · nota derivada', 'Comentário do cliente', 'Motivo: Motivo fictício', 'Temas: Tema fictício']) expect(screen.getByText(text)).toBeInTheDocument()
})
it('CSAT vazio e limiar padrão', async () => {
  show()
  await screen.findByText('Nenhuma avaliação real do cliente registrada.')
})
it('galeria mostra imagem e PDF com URL assinada segura', async () => {
  mocks.client.tables.evaluation_files = { data: [{ id: 'im', storage_path: 'org/av/im.png', kind: 'print' }, { id: 'pdf', storage_path: 'org/av/f.pdf', kind: 'pdf', created_by: 'a' }], error: null }
  show()
  const image = await screen.findByRole('img', { name: 'Anexo 1' })
  expect(image.parentElement).toHaveAttribute('target', '_blank')
  expect(image.parentElement).toHaveAttribute('rel', 'noopener noreferrer')
  expect(await screen.findByRole('link', { name: 'Abrir PDF 2' })).toHaveAttribute('href', 'https://arquivos.exemplo.test/anexo')
})
it.each([false, true])('remove anexo e trata erro do Storage: %s', async (fail) => {
  mocks.client.tables.evaluation_files = { data: [{ id: 'pdf', storage_path: 'org/av/f.pdf', kind: 'pdf', created_by: 'a' }], error: null }
  const remove = vi.fn(async () => ({ data: fail ? [] : [{ name: 'f.pdf' }], error: null }))
  mocks.client.storage.from.mockReturnValue({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://exemplo.test/pdf' } })), remove })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Remover anexo 1' }))
  expect(confirm).toHaveBeenCalledWith('Remover este arquivo?')
  expect(remove).toHaveBeenCalledWith(['org/av/f.pdf'])
  if (fail) {
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível remover o arquivo.')
    expect(screen.getByRole('link', { name: 'Abrir PDF 1' })).toBeInTheDocument()
    expect(invalidate).not.toHaveBeenCalled()
  } else expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] })
})
it('cancelar confirmação não remove', async () => {
  mocks.client.tables.evaluation_files = { data: [{ id: 'pdf', storage_path: 'org/av/f.pdf', kind: 'pdf', created_by: 'a' }], error: null }
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const user = userEvent.setup()
  show()
  await user.click(await screen.findByRole('button', { name: 'Remover anexo 1' }))
  expect(mocks.client.storage.from.mock.results.flatMap(({ value }) => value.remove.mock.calls)).toHaveLength(0)
})
it('reusa validação e envia arquivos um a um, invalidando a tela', async () => {
  const upload = vi.fn(async () => ({ data: { path: 'org/av/f.pdf' }, error: null }))
  mocks.client.storage.from.mockReturnValue({ upload })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const user = userEvent.setup({ applyAccept: false })
  show()
  const input = await screen.findByLabelText('Anexar prints ou PDF')
  await user.upload(input, [new File(['x'], 'f.pdf', { type: 'application/pdf' }), new File(['x'], 'im.png', { type: 'image/png' }), new File(['x'], 'recusado.exe'), new File([], 'vazio.pdf')])
  expect(screen.getByRole('alert')).toHaveTextContent('Formato não aceito')
  expect(screen.getByRole('alert')).toHaveTextContent('está vazio')
  await user.click(screen.getByRole('button', { name: 'Enviar arquivos' }))
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(2))
  expect(upload.mock.calls[0][0]).toMatch(/^org-x\/10000000-0000-4000-8000-000000000001\/.+\.pdf$/)
  expect(upload.mock.calls[1][0]).toMatch(/\.png$/)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluation', id] })
})
it('CSAT sem configuração usa o limiar padrão 4', async () => {
  mocks.client.tables.app_settings = { data: [], error: null }
  mocks.client.tables.csat_records = { data: [{ id: 'csat', score: 4, score_origin: 'real', source: 'manual' }], error: null }
  show()
  await screen.findByText('Satisfação positiva')
  expect(screen.queryByText(/nota derivada/)).not.toBeInTheDocument()
})
it('admin vê validação somente leitura e diagnóstico rejeitado', async () => {
  analyzed()
  mocks.client.tables.evaluations.data.diagnosis_status = 'rejeitado'
  mocks.client.tables.analysis_feedback = { data: [{ ...feedback, liked: true, useful: false }], error: null }
  show({ ...analyst, role: 'platform_admin', organizationId: null })
  await screen.findByText('Rejeitado')
  expect(screen.getByText('Validação do analista: Gostei · Não útil')).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
it('envio de validação fica desabilitado durante a RPC', async () => {
  analyzed()
  mocks.client.tables.analysis_feedback = { data: [feedback], error: null }
  let release
  mocks.client.rpc.mockImplementation(() => new Promise((resolve) => { release = resolve }))
  const user = userEvent.setup()
  show()
  const form = within(await screen.findByRole('form', { name: 'Validação do diagnóstico' }))
  await user.click(form.getByRole('button', { name: 'Atualizar validação' }))
  expect(form.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
  expect(form.getByRole('textbox')).toBeDisabled()
  release({ data: null, error: null })
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Validação salva.' }))
})
it('galeria oculta sem arquivos para estado sem edição', async () => {
  analyzed()
  mocks.client.tables.evaluations.data.current_run.status = 'falha'
  show()
  await screen.findByText('A última análise não foi concluída.')
  expect(screen.queryByRole('heading', { name: 'Anexos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Adicionar arquivos' })).not.toBeInTheDocument()
})

it('analista não vê Remover no arquivo enviado pelo supervisor', async () => {
  mocks.client.tables.evaluation_files = { data: [
    { id: 'supervisor-file', storage_path: 'org/av/supervisor.pdf', kind: 'pdf', created_by: 'supervisor' },
    { id: 'own-file', storage_path: 'org/av/own.pdf', kind: 'pdf', created_by: 'a' },
  ], error: null }
  show()
  await screen.findByRole('link', { name: 'Abrir PDF 1' })
  expect(screen.queryByRole('button', { name: 'Remover anexo 1' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remover anexo 2' })).toBeInTheDocument()
})
it.each([
  ['supervisor', 'org-x', true],
  ['supervisor', 'org-y', false],
  ['platform_admin', null, true],
  ['analista', 'org-x', false],
])('%s em %s só recebe controle de gestor na organização correta: %s', async (role, organizationId, removable) => {
  mocks.client.tables.evaluation_files = { data: [{ id: 'file', storage_path: 'org/av/f.pdf', kind: 'pdf', created_by: 'outro' }], error: null }
  show({ role, organizationId, user: { id: 'gestor' } })
  await screen.findByRole('link', { name: 'Abrir PDF 1' })
  const button = screen.queryByRole('button', { name: 'Remover anexo 1' })
  if (removable) expect(button).toBeInTheDocument()
  else expect(button).not.toBeInTheDocument()
})
