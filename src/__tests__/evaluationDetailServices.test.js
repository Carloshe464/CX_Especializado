import { beforeEach, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../test/fakeSupabase.js'
import { COMPETENCIES } from '../lib/cx.js'
const mock = vi.hoisted(() => ({ client: null }))
vi.mock('../lib/supabaseClient.js', () => ({ get supabase() { return mock.client }, supabaseConfigError: null }))
import { getEvaluationDetail, saveAnalystFeedback, feedbackErrorMessage } from '../services/evaluationDetail.js'
import { updateEvaluationTranscript, findEvaluationIdByProtocol } from '../services/evaluations.js'
import { listEvaluationFiles, removeEvaluationFile } from '../services/evaluationFiles.js'

const id = '10000000-0000-4000-8000-000000000001'
const run = { id: 'run-atual', status: 'sucesso' }
const row = { id, organization_id: 'org-x', current_analysis_run_id: run.id, current_run: run }
beforeEach(() => { mock.client = createFakeSupabase({ tables: { evaluations: { data: row, error: null } } }) })
const queryFor = (table) => mock.client.from.mock.results[mock.client.from.mock.calls.findIndex(([name]) => name === table)].value
const columns = (query) => query.select.mock.calls[0][0].replace(/\s+/g, '')

it.each([undefined, null, '', 'id-ficticio', '10000000-0000-4000-8000-000000000001x'])('id inválido %s não consulta a rede', async (invalid) => {
  await expect(getEvaluationDetail(invalid)).resolves.toBeNull()
  expect(mock.client.from).not.toHaveBeenCalled()
})
it('normaliza dados, ordena competências e consulta apenas a execução atual', async () => {
  mock.client.tables.evaluation_scores = { data: [{ competency: COMPETENCIES[5] }, { competency: COMPETENCIES[0] }], error: null }
  const result = await getEvaluationDetail(id)
  expect(result).toMatchObject({ evaluation: { id }, run, opportunities: [], feedback: [], csatRecords: [], files: [] })
  expect(result.evaluation).not.toHaveProperty('current_run')
  expect(result.scores.map((s) => s.competency)).toEqual([COMPETENCIES[0], COMPETENCIES[5]])
  expect(queryFor('evaluations').eq).toHaveBeenCalledWith('id', id)
  expect(queryFor('evaluations').maybeSingle).toHaveBeenCalledOnce()
  expect(columns(queryFor('evaluations'))).toBe('id,organization_id,protocol,analyst_user_id,analyst_name,channel,source,status,transcript,diagnosis_status,supervisor_review,current_analysis_run_id,created_by,created_at,current_run:analysis_runs!evaluations_current_run_fkey(id,run_number,status,prompt_version,trend,strengths,summary_feedback,uncertainties,finished_at)')
  for (const table of ['evaluation_scores', 'opportunities', 'analysis_feedback']) {
    expect(queryFor(table).eq).toHaveBeenCalledExactlyOnceWith('analysis_run_id', run.id)
    expect(columns(queryFor(table))).not.toContain('*')
  }
  expect(columns(queryFor('evaluation_scores'))).toBe('id,competency,score,classification,evidence')
  expect(columns(queryFor('opportunities'))).toBe('id,position,severity,origin,confidence,description,evidence,impact,recommendation,improved_example,communication_techniques,status,supervisor_note,adjusted_recommendation')
  expect(columns(queryFor('analysis_feedback'))).toBe('id,target_type,opportunity_id,author_role,liked,useful,comment,updated_at')
  expect(queryFor('opportunities').order).toHaveBeenCalledWith('position')
  expect(columns(queryFor('csat_records'))).toBe('id,score,score_origin,level,source,comment,reason,themes,created_at')
  expect(queryFor('csat_records').eq).toHaveBeenCalledWith('evaluation_id', id)
  expect(queryFor('csat_records').order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(queryFor('csat_records').limit).toHaveBeenCalledWith(50)
})
it('inicia todas as consultas filhas antes de aguardar a conclusão', async () => {
  const original = mock.client.from.getMockImplementation()
  const started = []
  const releases = []
  mock.client.from.mockImplementation((table) => {
    const query = original(table)
    if (table !== 'evaluations') query.then = (resolve) => new Promise((release) => {
      started.push(table)
      releases.push(() => release(resolve({ data: [], error: null })))
    })
    return query
  })
  const request = getEvaluationDetail(id)
  await vi.waitFor(() => expect(started).toHaveLength(5))
  releases.forEach((release) => release())
  await request
})
it('sem execução não consulta tabelas de análise', async () => {
  mock.client.tables.evaluations.data = { ...row, current_analysis_run_id: null, current_run: null }
  expect(await getEvaluationDetail(id)).toMatchObject({ run: null, scores: [], opportunities: [], feedback: [] })
  expect(mock.client.from.mock.calls.map(([table]) => table)).toEqual(['evaluations', 'csat_records', 'evaluation_files'])
})
it('linha invisível resulta em null sem consultas filhas', async () => {
  mock.client.tables.evaluations.data = null
  await expect(getEvaluationDetail(id)).resolves.toBeNull()
  expect(mock.client.from).toHaveBeenCalledOnce()
})
it.each(['evaluations', 'evaluation_scores', 'opportunities', 'analysis_feedback', 'csat_records', 'evaluation_files'])('propaga erro de %s', async (table) => {
  const error = { code: '42501' }
  mock.client.tables[table] = { data: null, error }
  await expect(getEvaluationDetail(id)).rejects.toBe(error)
})
it.each(['diagnostico', 'oportunidade'])('envia parâmetros exatos da RPC para %s', async (target) => {
  await saveAnalystFeedback({ runId: run.id, target, opportunityId: 'opp-1', liked: false, useful: true, comment: 'Fictício' })
  expect(mock.client.rpc).toHaveBeenCalledExactlyOnceWith('submit_feedback', { p_run: run.id, p_target: target, p_opportunity: target === 'diagnostico' ? null : 'opp-1', p_liked: false, p_useful: true, p_comment: 'Fictício' })
})
it('propaga falha da RPC', async () => {
  const error = { code: 'CX025' }
  mock.client.rpc.mockResolvedValue({ error })
  await expect(saveAnalystFeedback({})).rejects.toBe(error)
})
it.each([
  ['CX023', 'Você não tem permissão para validar esta avaliação.'],
  ['CX025', 'Esta análise foi substituída. Recarregue a página.'],
  ['CX026', 'A análise ainda não terminou.'],
  ['CX024', 'Validação inválida. Recarregue a página.'],
  ['CX027', 'Validação inválida. Recarregue a página.'],
  ['outro', 'Não foi possível salvar a validação. Tente novamente.'],
])('traduz %s', (code, message) => { expect(feedbackErrorMessage({ code })).toBe(message) })
it.each([['  texto fictício  ', 'transcrito'], [' \n ', 'rascunho']])('atualiza somente as duas colunas permitidas: %s', async (transcript, status) => {
  mock.client.tables.evaluations.data = { id }
  await expect(updateEvaluationTranscript({ id, transcript })).resolves.toEqual({ id })
  const q = queryFor('evaluations')
  expect(q.update).toHaveBeenCalledWith({ transcript: status === 'rascunho' ? null : transcript, status })
  expect(Object.keys(q.update.mock.calls[0][0]).sort()).toEqual(['status', 'transcript'])
  expect(q.eq).toHaveBeenCalledWith('id', id)
  expect(q.select).toHaveBeenCalledWith('id')
  expect(q.single).toHaveBeenCalledOnce()
})
it.each([
  ['CX033', 'A transcrição não pode mais ser alterada nesta etapa.'],
  ['CX036', 'A transcrição não pode mais ser alterada nesta etapa.'],
  ['42501', 'Você não tem permissão para alterar esta avaliação.'],
  ['PGRST116', 'Você não tem permissão para alterar esta avaliação.'],
  [null, 'Você não tem permissão para alterar esta avaliação.'],
  ['outro', 'Não foi possível salvar a transcrição. Tente novamente.'],
])('traduz erro da transcrição %s', async (code, message) => {
  mock.client.tables.evaluations = { data: null, error: code ? { code } : null }
  await expect(updateEvaluationTranscript({ id, transcript: 'texto' })).rejects.toThrow(message)
})
it('lista arquivos com colunas explícitas e ordem', async () => {
  await expect(listEvaluationFiles(id)).resolves.toEqual([])
  const q = queryFor('evaluation_files')
  expect(q.select).toHaveBeenCalledWith('id, storage_path, kind, mime_type, size_bytes, created_at, created_by')
  expect(q.eq).toHaveBeenCalledWith('evaluation_id', id)
  expect(q.order).toHaveBeenCalledWith('created_at')
})
it.each([false, true])('remove no Storage e propaga falha: %s', async (fail) => {
  const remove = vi.fn(async () => ({ data: fail ? null : [{ name: 'f.pdf' }], error: fail ? { code: '42501' } : null }))
  mock.client.storage.from.mockReturnValue({ remove })
  if (fail) await expect(removeEvaluationFile('org/av/f.pdf')).rejects.toEqual({ code: '42501' })
  else await expect(removeEvaluationFile('org/av/f.pdf')).resolves.toBeUndefined()
  expect(mock.client.storage.from).toHaveBeenCalledWith('evaluation-files')
  expect(remove).toHaveBeenCalledExactlyOnceWith(['org/av/f.pdf'])
})
it.each([[], null, undefined])('recusa remoção sem objetos retornados: %s', async (data) => {
  const remove = vi.fn(async () => ({ data, error: null }))
  mock.client.storage.from.mockReturnValue({ remove })
  await expect(removeEvaluationFile('org/av/f.pdf')).rejects.toThrow('Não foi possível remover o arquivo.')
  expect(remove).toHaveBeenCalledExactlyOnceWith(['org/av/f.pdf'])
})
it('escapa todos os curingas, sem curingas nas pontas e confirma igualdade', async () => {
  mock.client.tables.evaluations = { data: [{ id: 'outro', protocol: 'prefixo a%_*\\b' }, { id, protocol: ' A%_*\\B ' }], error: null }
  await expect(findEvaluationIdByProtocol(' a%_*\\b ', 'org-x')).resolves.toBe(id)
  expect(queryFor('evaluations').ilike).toHaveBeenCalledWith('protocol', 'a\\%\\_\\*\\\\b')
})
it('sem cliente, erros claros e nenhuma rede', async () => {
  const client = mock.client
  mock.client = null
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    for (const action of [() => getEvaluationDetail(id), () => saveAnalystFeedback({}), () => updateEvaluationTranscript({ id }), () => listEvaluationFiles(id), () => removeEvaluationFile('path')]) {
      await expect(action()).rejects.toThrow('Configure o Supabase')
    }
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
