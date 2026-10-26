import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../auth/session.js'
import { createFakeSupabase } from '../test/fakeSupabase.js'
import NewEvaluation from '../pages/NewEvaluation.jsx'

const mock = vi.hoisted(() => ({ client: null, toast: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({ get supabase() { return mock.client }, supabaseConfigError: null }))
vi.mock('../components/ui/use-toast.js', () => ({ useToast: () => ({ toast: mock.toast }) }))
const analyst = { role: 'analista', organizationId: 'org-x', user: { id: 'user-a', fullName: 'Ana Fictícia', email: 'ana@exemplo.test' } }
let queryClient, create, upload, invalidate
beforeEach(() => {
  mock.toast.mockClear()
  mock.client = createFakeSupabase({ tables: {
    memberships: { data: [{ user_id: 'user-a' }], error: null },
    profiles: { data: [{ id: 'user-a', full_name: 'Ana Fictícia', email: 'ana@exemplo.test' }], error: null },
  } })
  create = vi.fn(async () => ({ data: { id: 'av-032', organization_id: 'org-x' }, error: null }))
  const from = mock.client.from.getMockImplementation()
  mock.client.from.mockImplementation((table) => {
    const query = from(table)
    if (table === 'evaluations') query.single = create
    return query
  })
  upload = vi.fn(async () => ({ data: { path: 'ficticio' }, error: null }))
  mock.client.storage = { from: vi.fn(() => ({ upload })) }
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { queryClient.clear(); delete HTMLElement.prototype.scrollIntoView; vi.unstubAllGlobals() })
function show(session = analyst) {
  return render(<QueryClientProvider client={queryClient}><SessionContext.Provider value={session}>
    <MemoryRouter initialEntries={['/nova-avaliacao']}><Routes>
      <Route path="/nova-avaliacao" element={<NewEvaluation />} />
      <Route path="/avaliacao/:id" element={<h1>Detalhe fictício</h1>} />
    </Routes></MemoryRouter>
  </SessionContext.Provider></QueryClientProvider>)
}
async function choose(label, name) {
  const trigger = screen.getByRole('combobox', { name: label })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const option = await screen.findByRole('option', { name, exact: true })
  option.focus()
  await userEvent.setup().keyboard('[Enter]')
}
function selectedFiles() { return screen.getByRole('list', { name: 'Arquivos selecionados' }) }
async function prints(files) {
  const user = userEvent.setup({ applyAccept: false })
  await user.click(screen.getByRole('tab', { name: 'Prints do chat' }))
  await user.upload(screen.getByLabelText('Anexar prints ou PDF'), files)
}
it('trava analista, aceita texto sem limite, monta payload e navega após invalidar a lista', async () => {
  show()
  expect(screen.getByLabelText('Analista responsável')).toBeDisabled()
  expect(screen.getByLabelText('Analista responsável')).toHaveValue('Ana Fictícia')
  expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeDisabled()
  const text = screen.getByLabelText('Transcrição do atendimento')
  expect(text).not.toHaveAttribute('maxlength')
  fireEvent.change(text, { target: { value: 'Conversa fictícia' } })
  fireEvent.change(screen.getByLabelText('Protocolo'), { target: { value: ' CX-032 ' } })
  await choose('Canal', 'Chat')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  await screen.findByRole('heading', { name: 'Detalhe fictício' })
  const insert = mock.client.from.mock.results.find(({ value }) => value.insert.mock.calls.length)?.value.insert
  expect(insert).toHaveBeenCalledWith({ organization_id: 'org-x', protocol: 'CX-032', channel: 'Chat', transcript: 'Conversa fictícia',
    source: 'texto', status: 'transcrito', analyst_user_id: 'user-a', analyst_name: 'Ana Fictícia' })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['evaluations'] })
  expect(mock.client.from).toHaveBeenCalledExactlyOnceWith('evaluations')
})
it.each(['supervisor', 'platform_admin'])('%s escolhe um analista obrigatório da organização', async (role) => {
  show({ ...analyst, role })
  fireEvent.change(screen.getByLabelText('Transcrição do atendimento'), { target: { value: 'Conversa fictícia' } })
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Analista responsável' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeDisabled()
  expect(queryClient.getQueryData(['org_analysts', 'org-x'])).toEqual([{ id: 'user-a', name: 'Ana Fictícia' }])
  await choose('Analista responsável', 'Ana Fictícia')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  await screen.findByRole('heading', { name: 'Detalhe fictício' })
  expect(mock.client.from.mock.results.find(({ value }) => value.insert.mock.calls.length).value.insert)
    .toHaveBeenCalledWith(expect.objectContaining({ analyst_user_id: 'user-a', analyst_name: 'Ana Fictícia' }))
})
it('lista de analistas vazia explica o bloqueio', async () => {
  mock.client.tables.memberships = { data: [], error: null }
  show({ ...analyst, role: 'supervisor' })
  expect(await screen.findByText('Nenhum analista na organização ainda. Convide analistas para registrar avaliações.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Transcrição do atendimento'), { target: { value: 'Texto' } })
  expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeDisabled()
})
it('sem organização não mostra formulário nem consulta analistas', () => {
  show({ ...analyst, role: 'platform_admin', organizationId: null })
  expect(screen.getByRole('alert')).toHaveTextContent('Para registrar avaliações, entre com um usuário vinculado a uma organização.')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(mock.client.from).not.toHaveBeenCalled()
})
it('adiciona dois arquivos e remove um', async () => {
  show()
  await prints([new File(['png fictício'], 'um.png', { type: 'image/png' }), new File(['pdf fictício'], 'dois.pdf', { type: 'application/pdf' })])
  expect(within(selectedFiles()).getAllByRole('listitem')).toHaveLength(2)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Remover um.png' }))
  expect(within(selectedFiles()).getAllByRole('listitem')).toHaveLength(1)
  expect(within(selectedFiles()).getByText('dois.pdf')).toBeInTheDocument()
})
it('rejeita extensão, vazio e mais de 20 MB sem incluir na lista', async () => {
  const large = new File(['x'], 'grande.png', { type: 'image/png' })
  Object.defineProperty(large, 'size', { value: 20 * 1024 * 1024 + 1 })
  show()
  await prints([new File(['x'], 'invalido.exe'), new File([], 'vazio.png', { type: 'image/png' }), large])
  expect(screen.getByRole('alert')).toHaveTextContent('Formato não aceito: invalido.exe. Use PNG, JPG, WEBP ou PDF.')
  expect(screen.getByRole('alert')).toHaveTextContent('O arquivo vazio.png está vazio.')
  expect(screen.getByRole('alert')).toHaveTextContent('O arquivo grande.png passa de 20 MB.')
  expect(within(selectedFiles()).queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeDisabled()
  expect(upload).not.toHaveBeenCalled()
})
it('cria só com prints em rascunho e envia um por vez na ordem', async () => {
  let finishFirst
  upload.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve }))
  const files = [new File(['x'], 'um.png', { type: 'image/png' }), new File(['y'], 'dois.pdf', { type: 'application/pdf' })]
  show()
  await prints(files)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
  expect(upload.mock.calls[0][1]).toBe(files[0])
  expect(screen.getByLabelText('Anexar prints ou PDF')).toBeDisabled()
  expect(mock.client.from.mock.results.find(({ value }) => value.insert.mock.calls.length).value.insert)
    .toHaveBeenCalledWith(expect.objectContaining({ source: 'prints', status: 'rascunho', transcript: null }))
  await act(async () => { finishFirst({ data: {}, error: null }) })
  await screen.findByRole('heading', { name: 'Detalhe fictício' })
  expect(upload).toHaveBeenCalledTimes(2)
  expect(upload.mock.calls[1][1]).toBe(files[1])
  expect(upload.mock.calls[0][0]).toMatch(/^org-x\/av-032\/.+\.png$/)
})
it('falha de um anexo mostra toast e continua sem apagar a avaliação', async () => {
  upload.mockRejectedValueOnce(new Error('Falha fictícia'))
  show()
  await prints([new File(['x'], 'um.png'), new File(['y'], 'dois.pdf')])
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  await screen.findByRole('heading', { name: 'Detalhe fictício' })
  expect(upload).toHaveBeenCalledTimes(2)
  expect(mock.toast).toHaveBeenCalledWith({ title: 'Avaliação criada, mas 1 arquivo(s) não foram enviados.' })
  expect(create).toHaveBeenCalledTimes(1)
  expect(invalidate).toHaveBeenCalled()
})
it('extração e importação permanecem desabilitadas', async () => {
  show()
  await userEvent.setup().click(screen.getByRole('tab', { name: 'Prints do chat' }))
  expect(screen.getByRole('button', { name: 'Extrair transcrição com IA' })).toBeDisabled()
  expect(screen.getByText('Disponível em breve')).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('tab', { name: 'Importar planilha' }))
  expect(screen.getByText('A importação de planilhas chega em breve.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Importar planilha' })).toBeDisabled()
})
it.each(['existente', null])('duplicata preserva texto e só mostra link se visível: %s', async (existingId) => {
  create.mockResolvedValue({ data: null, error: { code: '23505' } })
  mock.client.tables.evaluations = { data: existingId ? [{ id: existingId, protocol: 'CX-032' }] : [], error: null }
  show()
  fireEvent.change(screen.getByLabelText('Protocolo'), { target: { value: 'CX-032' } })
  fireEvent.change(screen.getByLabelText('Transcrição do atendimento'), { target: { value: 'Texto a preservar' } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(existingId ? 'Já existe uma avaliação com o protocolo CX-032.' : 'Já existe uma avaliação com este protocolo na sua organização. Fale com o supervisor.')
  if (existingId) expect(screen.getByRole('link', { name: 'Abrir avaliação existente' })).toHaveAttribute('href', '/avaliacao/existente')
  else expect(screen.queryByRole('link', { name: 'Abrir avaliação existente' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Transcrição do atendimento')).toHaveValue('Texto a preservar')
  expect(screen.queryByRole('heading', { name: 'Detalhe fictício' })).not.toBeInTheDocument()
  expect(upload).not.toHaveBeenCalled()
})
it.each([
  [{ code: '42501' }, 'Você não tem permissão para registrar esta avaliação.'],
  [{ message: 'new row violates row-level security policy' }, 'Você não tem permissão para registrar esta avaliação.'],
  [{ code: '500' }, 'Não foi possível criar a avaliação. Tente novamente.'],
])('traduz erros sem perder a transcrição: %s', async (error, message) => {
  create.mockResolvedValue({ data: null, error })
  show()
  fireEvent.change(screen.getByLabelText('Transcrição do atendimento'), { target: { value: 'Texto a preservar' } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Criar avaliação' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByLabelText('Transcrição do atendimento')).toHaveValue('Texto a preservar')
})
it('bloqueia duplo envio e todos os campos enquanto cria', async () => {
  let finish
  create.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  show()
  fireEvent.change(screen.getByLabelText('Transcrição do atendimento'), { target: { value: 'Texto' } })
  const form = screen.getByRole('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(screen.getByRole('button', { name: 'Criando…' })).toBeDisabled()
  expect(screen.getByLabelText('Protocolo')).toBeDisabled()
  expect(screen.getByLabelText('Transcrição do atendimento')).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Canal' })).toBeDisabled()
  expect(create).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ data: { id: 'av-032', organization_id: 'org-x' }, error: null }) })
  await screen.findByRole('heading', { name: 'Detalhe fictício' })
})
