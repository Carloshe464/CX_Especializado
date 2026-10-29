import { beforeEach, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../test/fakeSupabase.js'
const mock = vi.hoisted(() => ({ client: null }))
vi.mock('../lib/supabaseClient.js', () => ({ get supabase() { return mock.client }, supabaseConfigError: null }))
import { buildEvaluationPayload, createEvaluation, findEvaluationIdByProtocol } from '../services/evaluations.js'
import { listOrgAnalysts } from '../services/organizationMembers.js'

const session = { organizationId: 'org-x', role: 'analista', user: { id: 'user-a', fullName: 'Ana Fictícia', email: 'ana@exemplo.test' } }
const analyst = { id: 'user-b', name: 'Bruno Fictício' }
const form = { protocol: ' CX-032 ', channel: 'Chat', transcript: ' Conversa fictícia sem dados pessoais. ' }
beforeEach(() => { mock.client = createFakeSupabase() })

it('monta somente as oito colunas concedidas para o próprio analista', () => {
  const payload = buildEvaluationPayload({ form, session, analyst, hasPrints: false })
  expect(payload).toEqual({ organization_id: 'org-x', protocol: 'CX-032', channel: 'Chat', transcript: form.transcript,
    source: 'texto', status: 'transcrito', analyst_user_id: 'user-a', analyst_name: 'Ana Fictícia' })
  expect(Object.keys(payload).sort()).toEqual(['organization_id', 'protocol', 'channel', 'transcript', 'source', 'status', 'analyst_user_id', 'analyst_name'].sort())
})
it.each(['supervisor', 'platform_admin'])('%s usa o analista escolhido', (role) => {
  expect(buildEvaluationPayload({ form, session: { ...session, role }, analyst, hasPrints: true }))
    .toMatchObject({ analyst_user_id: analyst.id, analyst_name: analyst.name, source: 'prints', status: 'transcrito' })
})
it('usa e-mail quando o nome do usuário falta', () => {
  expect(buildEvaluationPayload({ form, session: { ...session, user: { ...session.user, fullName: '' } } }))
    .toMatchObject({ analyst_name: session.user.email })
})
it('normaliza vazios e canal inválido; prints sem texto nascem em rascunho', () => {
  expect(buildEvaluationPayload({ form: { protocol: '  ', channel: 'fax', transcript: ' \n ' }, session, hasPrints: true }))
    .toMatchObject({ protocol: null, channel: null, transcript: null, source: 'prints', status: 'rascunho' })
})
it('preserva transcrição com mais de 200 mil caracteres e espaços', () => {
  const transcript = '  ' + 'texto fictício '.repeat(16000) + '\n'
  expect(buildEvaluationPayload({ form: { ...form, transcript }, session }).transcript).toBe(transcript)
})
it('insere e retorna somente id e organizationId', async () => {
  mock.client.tables.evaluations = { data: { id: 'av-032', organization_id: 'org-x' }, error: null }
  await expect(createEvaluation(form)).resolves.toEqual({ id: 'av-032', organizationId: 'org-x' })
  const query = mock.client.from.mock.results[0].value
  expect(query.insert).toHaveBeenCalledWith(form)
  expect(query.select).toHaveBeenCalledWith('id, organization_id')
  expect(query.single).toHaveBeenCalledOnce()
})
it.each(['existente', null])('traduz 23505 e encontra somente a duplicata visível: %s', async (existingId) => {
  const from = mock.client.from.getMockImplementation()
  mock.client.from.mockImplementation((table) => {
    const query = from(table)
    query.single.mockResolvedValue({ data: null, error: { code: '23505' } })
    return query
  })
  mock.client.tables.evaluations = { data: existingId ? [{ id: existingId, protocol: '  cx-032  ' }] : [], error: null }
  await expect(createEvaluation({ protocol: 'CX-032', organization_id: 'org-x' }))
    .rejects.toMatchObject({ code: 'PROTOCOLO_DUPLICADO', existingId })
  expect(mock.client.from.mock.results[1].value.eq).toHaveBeenCalledWith('organization_id', 'org-x')
})
it('escapa curingas no ilike e confirma a igualdade por trim e caixa', async () => {
  mock.client.tables.evaluations = { data: [{ id: 'nao', protocol: 'prefixo A%_\\B' }, { id: 'sim', protocol: '  a%_\\b  ' }], error: null }
  await expect(findEvaluationIdByProtocol(' A%_\\B ')).resolves.toBe('sim')
  expect(mock.client.from.mock.results[0].value.ilike).toHaveBeenCalledWith('protocol', 'a\\%\\_\\\\b')
})
it.each([createEvaluation, findEvaluationIdByProtocol])('propaga erros de avaliação', async (action) => {
  const error = { code: '42501', message: 'Erro fictício' }
  mock.client.tables.evaluations = { data: null, error }
  await expect(action('CX-032')).rejects.toBe(error)
})
it('busca os analistas em duas consultas, ordena em pt-BR e usa e-mail de reserva', async () => {
  mock.client.tables.memberships = { data: [{ user_id: 'b' }, { user_id: 'a' }], error: null }
  mock.client.tables.profiles = { data: [{ id: 'b', full_name: '  ', email: 'bruno@exemplo.test' }, { id: 'a', full_name: '  Ágata Fictícia  ', email: 'agata@exemplo.test' }], error: null }
  await expect(listOrgAnalysts('org-x')).resolves.toEqual([{ id: 'a', name: 'Ágata Fictícia' }, { id: 'b', name: 'bruno@exemplo.test' }])
  expect(mock.client.from.mock.calls).toEqual([['memberships'], ['profiles']])
  const [members, profiles] = mock.client.from.mock.results.map(({ value }) => value)
  expect(members.select).toHaveBeenCalledWith('user_id')
  expect(members.eq.mock.calls).toEqual([['organization_id', 'org-x'], ['role', 'analista']])
  expect(profiles.select).toHaveBeenCalledWith('id, full_name, email')
  expect(profiles.in).toHaveBeenCalledWith('id', ['b', 'a'])
})
it('não consulta profiles quando não há vínculos', async () => {
  await expect(listOrgAnalysts('org-x')).resolves.toEqual([])
  expect(mock.client.from).toHaveBeenCalledExactlyOnceWith('memberships')
})
it.each(['memberships', 'profiles'])('propaga falha de %s', async (table) => {
  mock.client.tables.memberships = { data: [{ user_id: 'a' }], error: null }
  const error = new Error('Falha fictícia')
  mock.client.tables[table] = { data: null, error }
  await expect(listOrgAnalysts('org-x')).rejects.toBe(error)
})
it('serviços sem cliente não fazem rede', async () => {
  const from = mock.client.from
  mock.client = null
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(createEvaluation({})).rejects.toThrow('Configure o Supabase')
    await expect(findEvaluationIdByProtocol('x')).rejects.toThrow('Configure o Supabase')
    await expect(listOrgAnalysts('org-x')).rejects.toThrow('Configure o Supabase')
    expect(from).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
