import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../test/fakeSupabase.js'

const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('../lib/supabaseClient.js', () => ({
  get supabase() { return mocks.client },
  supabaseConfigError: null,
}))
import { listCurationQueue, listRecentCuration, decideOpportunity, decideDiagnosis, curationErrorMessage } from '../services/curation.js'

beforeEach(() => { mocks.client = createFakeSupabase() })

const queueRow = (id, run = `run-${id}`, extra = {}) => ({
  id, protocol: `CX-${id}`, analyst_name: `Analista ${id}`, channel: 'Chat',
  created_at: '2026-10-25T12:00:00Z', current_analysis_run_id: run,
  current_run: { trend: 'Favorável' }, opportunities: [], analysis_feedback: [], ...extra,
})

describe('listCurationQueue', () => {
  it('usa colunas explícitas, FK atual, filtros, ordem crescente e limite 200', async () => {
    mocks.client.tables.evaluations = { data: [queueRow('1')], error: null }
    const result = await listCurationQueue()
    expect(result).toEqual([{ id: '1', protocol: 'CX-1', analystName: 'Analista 1', channel: 'Chat',
      createdAt: '2026-10-25T12:00:00Z', trend: 'Favorável', pendingOpportunities: 0, analystFlaggedNotUseful: false }])
    expect(mocks.client.from).toHaveBeenCalledExactlyOnceWith('evaluations')
    const q = mocks.client.from.mock.results[0].value
    expect(q.select.mock.calls[0][0].replace(/\s/g, '')).toBe(
      'id,protocol,analyst_name,channel,created_at,current_analysis_run_id,' +
      'current_run:analysis_runs!evaluations_current_run_fkey(trend),' +
      'opportunities(id,status,analysis_run_id),analysis_feedback(author_role,useful,analysis_run_id)',
    )
    expect(q.eq).toHaveBeenCalledExactlyOnceWith('status', 'analisado')
    expect(q.or).toHaveBeenCalledExactlyOnceWith('diagnosis_status.is.null,diagnosis_status.eq.pendente')
    expect(q.order).toHaveBeenCalledExactlyOnceWith('created_at', { ascending: true })
    expect(q.limit).toHaveBeenCalledExactlyOnceWith(200)
  })

  it('prioriza apenas útil=false do analista na execução atual, sem perder a ordem interna', async () => {
    mocks.client.tables.evaluations = { data: [
      queueRow('1', 'atual-1', { opportunities: [{ status: 'pendente', analysis_run_id: 'antiga' }] }),
      queueRow('2', 'atual-2', {
        opportunities: [{ status: 'pendente', analysis_run_id: 'atual-2' },
          { status: 'aprovada', analysis_run_id: 'atual-2' }, { status: 'pendente', analysis_run_id: 'antiga' }],
        analysis_feedback: [{ author_role: 'analista', useful: false, analysis_run_id: 'atual-2' }],
      }),
      queueRow('3', 'atual-3', { analysis_feedback: [
        { author_role: 'supervisor', useful: false, analysis_run_id: 'atual-3' },
        { author_role: 'analista', useful: false, analysis_run_id: 'antiga' },
      ] }),
      queueRow('4', 'atual-4', { analysis_feedback: [{ author_role: 'analista', useful: false, analysis_run_id: 'atual-4' }] }),
    ], error: null }
    const result = await listCurationQueue()
    expect(result.map(({ id }) => id)).toEqual(['2', '4', '1', '3'])
    expect(result.map(({ pendingOpportunities }) => pendingOpportunities)).toEqual([1, 0, 0, 0])
    expect(result.map(({ analystFlaggedNotUseful }) => analystFlaggedNotUseful)).toEqual([true, true, false, false])
  })

  it('normaliza tendência e relacionamentos ausentes', async () => {
    mocks.client.tables.evaluations = { data: [queueRow('1', null, { current_run: null, opportunities: null, analysis_feedback: null })], error: null }
    expect((await listCurationQueue())[0]).toMatchObject({ trend: null, pendingOpportunities: 0, analystFlaggedNotUseful: false })
  })
})

describe('listRecentCuration', () => {
  it('usa filtro, ordem, limite 10 e normaliza resultado', async () => {
    mocks.client.tables.evaluations = { data: [{ id: 'av', protocol: 'CX-1', analyst_name: 'Pessoa Exemplo',
      diagnosis_status: 'rejeitado', updated_at: '2026-10-27T12:00:00Z' }], error: null }
    expect(await listRecentCuration()).toEqual([{ id: 'av', protocol: 'CX-1', analystName: 'Pessoa Exemplo',
      diagnosisStatus: 'rejeitado', decidedAt: '2026-10-27T12:00:00Z' }])
    const q = mocks.client.from.mock.results[0].value
    expect(q.select).toHaveBeenCalledWith('id, protocol, analyst_name, diagnosis_status, updated_at')
    expect(q.eq).toHaveBeenCalledWith('status', 'curado')
    expect(q.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(q.limit).toHaveBeenCalledWith(10)
  })
})

describe('decisões via RPC', () => {
  it('envia todos os parâmetros e só mantém adjusted quando ajustada', async () => {
    await decideOpportunity({ opportunityId: 'o1', decision: 'ajustada', note: ' Nota ', adjusted: ' Texto ' })
    await decideOpportunity({ opportunityId: 'o1', decision: 'aprovada', note: null, adjusted: 'Ignorar' })
    await decideOpportunity({ opportunityId: 'o1', decision: 'rejeitada', note: ' Motivo ', adjusted: 'Ignorar' })
    expect(mocks.client.rpc.mock.calls).toEqual([
      ['decide_opportunity', { p_opportunity: 'o1', p_decision: 'ajustada', p_note: 'Nota', p_adjusted: 'Texto' }],
      ['decide_opportunity', { p_opportunity: 'o1', p_decision: 'aprovada', p_note: null, p_adjusted: null }],
      ['decide_opportunity', { p_opportunity: 'o1', p_decision: 'rejeitada', p_note: 'Motivo', p_adjusted: null }],
    ])
  })
  it('envia decisão de diagnóstico com parecer opcional', async () => {
    await decideDiagnosis({ evaluationId: 'av1', decision: 'aprovado', review: '' })
    await decideDiagnosis({ evaluationId: 'av2', decision: 'rejeitado', review: ' Razão ' })
    expect(mocks.client.rpc.mock.calls).toEqual([
      ['decide_diagnosis', { p_evaluation: 'av1', p_decision: 'aprovado', p_review: null }],
      ['decide_diagnosis', { p_evaluation: 'av2', p_decision: 'rejeitado', p_review: 'Razão' }],
    ])
  })
  it('propaga erros das duas RPCs e das consultas', async () => {
    const error = { code: 'CX030' }
    mocks.client.rpc.mockResolvedValue({ data: null, error })
    await expect(decideOpportunity({ opportunityId: 'o1', decision: 'aprovada' })).rejects.toBe(error)
    await expect(decideDiagnosis({ evaluationId: 'av1', decision: 'aprovado' })).rejects.toBe(error)
    mocks.client.tables.evaluations = { data: null, error }
    await expect(listCurationQueue()).rejects.toBe(error)
    await expect(listRecentCuration()).rejects.toBe(error)
  })
  it.each([
    ['CX030', 'Somente o supervisor da organização pode decidir a curadoria.'],
    ['CX025', 'Esta análise foi substituída. Recarregue a página.'],
    ['CX026', 'A avaliação não tem análise concluída.'],
    ['CX028', 'Decisão inválida. Recarregue a página.'],
    ['CX029', 'Decisão inválida. Recarregue a página.'],
    [undefined, 'Não foi possível salvar a decisão. Tente novamente.'],
  ])('traduz erro %s', (code, message) => {
    expect(curationErrorMessage({ code })).toBe(message)
  })
  it('sem cliente, falha antes de fazer chamadas de rede', async () => {
    const from = mocks.client.from
    const rpc = mocks.client.rpc
    mocks.client = null
    await expect(listCurationQueue()).rejects.toThrow('Configure o Supabase')
    await expect(listRecentCuration()).rejects.toThrow('Configure o Supabase')
    await expect(decideOpportunity({ opportunityId: 'o' })).rejects.toThrow('Configure o Supabase')
    await expect(decideDiagnosis({ evaluationId: 'a' })).rejects.toThrow('Configure o Supabase')
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
