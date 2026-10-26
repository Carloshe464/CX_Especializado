import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../test/fakeSupabase.js'

const mocks = vi.hoisted(() => ({ client: null }))
vi.mock('../lib/supabaseClient.js', () => ({
  get supabase() { return mocks.client },
  supabaseConfigError: null,
}))
import { listEvaluations, getCsatThresholds } from '../services/evaluations.js'

beforeEach(() => { mocks.client = createFakeSupabase() })

describe('listEvaluations', () => {
  it('consulta uma vez, com a FK da execução atual, ordem e limite, sem filtro de usuário', async () => {
    mocks.client.tables.evaluations = { data: [{
      id: 'avaliacao-1', organization_id: 'org-a', protocol: 'CX-001', analyst_name: 'João Fictício', channel: 'Chat',
      status: 'curado', created_at: '2026-10-26T12:00:00Z', current_run: { trend: 'Favorável' },
      csat_records: [
        { score: 2, created_at: '2026-10-22T10:00:00Z' },
        { score: null, created_at: '2026-10-26T10:00:00Z' },
        { score: 5, created_at: '2026-10-25T10:00:00Z' },
        { score: 3, created_at: '2026-10-24T10:00:00Z' },
      ],
    }], error: null }
    await expect(listEvaluations()).resolves.toEqual([{
      id: 'avaliacao-1', organizationId: 'org-a', protocol: 'CX-001', analystName: 'João Fictício', channel: 'Chat',
      status: 'curado', createdAt: '2026-10-26T12:00:00Z', trend: 'Favorável', realScore: 5,
    }])
    expect(mocks.client.from).toHaveBeenCalledExactlyOnceWith('evaluations')
    const query = mocks.client.from.mock.results[0].value
    expect(query.select.mock.calls[0][0].replace(/\s/g, '')).toBe(
      'id,organization_id,protocol,analyst_name,channel,status,created_at,current_run:analysis_runs!evaluations_current_run_fkey(trend),csat_records(score,created_at)',
    )
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(200)
    expect(query.eq).not.toHaveBeenCalled()
  })

  it.each([null, {}, { trend: null }])('normaliza a tendência e nota ausentes: %s', async (current_run) => {
    mocks.client.tables.evaluations = { data: [{ id: 'sem-analise', current_run }], error: null }
    expect((await listEvaluations())[0]).toMatchObject({ trend: null, realScore: null })
  })

  it('ignora notas fora de 1–5, fracionárias e ausentes', async () => {
    mocks.client.tables.evaluations = { data: [{ csat_records: [
      ...[null, 0, 6, 2.5, '5'].map((score) => ({ score, created_at: '2026-10-26T10:00:00Z' })),
      { score: 1, created_at: '2026-10-20T10:00:00Z' },
    ] }], error: null }
    expect((await listEvaluations())[0].realScore).toBe(1)
  })

  it('devolve lista vazia', async () => {
    await expect(listEvaluations()).resolves.toEqual([])
  })
})

describe('getCsatThresholds', () => {
  it.each(['1', '2', '3', '4', '5'])('converte o valor textual %s em inteiro', async (value) => {
    mocks.client.tables.app_settings = { data: [{ organization_id: 'org-a', value }], error: null }
    await expect(getCsatThresholds()).resolves.toEqual({ 'org-a': Number(value) })
    const query = mocks.client.from.mock.results[0].value
    expect(mocks.client.from).toHaveBeenCalledWith('app_settings')
    expect(query.select).toHaveBeenCalledWith('organization_id, value')
    expect(query.eq).toHaveBeenCalledWith('key', 'csat_positive_threshold')
    expect(query.maybeSingle).not.toHaveBeenCalled()
  })
  it.each([null, undefined, '', 'inválido', '0', '6', '3.5'])('usa 4 para valor ausente/inválido: %s', async (value) => {
    mocks.client.tables.app_settings = { data: [{ organization_id: 'org-a', value }], error: null }
    await expect(getCsatThresholds()).resolves.toEqual({ 'org-a': 4 })
  })

  it('mantém limiares independentes e aplica o padrão apenas ao valor inválido', async () => {
    mocks.client.tables.app_settings = { data: [
      { organization_id: 'org-a', value: '4' },
      { organization_id: 'org-b', value: '5' },
      { organization_id: 'org-invalida', value: 'inválido' },
    ], error: null }
    await expect(getCsatThresholds()).resolves.toEqual({ 'org-a': 4, 'org-b': 5, 'org-invalida': 4 })
  })

  it.each([[], null])('sem configurações devolve mapa vazio: %s', async (data) => {
    mocks.client.tables.app_settings = { data, error: null }
    await expect(getCsatThresholds()).resolves.toEqual({})
  })
})

it.each([
  ['evaluations', listEvaluations], ['app_settings', getCsatThresholds],
])('propaga o erro de %s', async (table, action) => {
  const error = new Error('Falha fictícia')
  mocks.client.tables[table] = { data: null, error }
  await expect(action()).rejects.toBe(error)
})

it('sem cliente, informa configuração ausente e não chama a rede', async () => {
  const from = mocks.client.from
  mocks.client = null
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(listEvaluations()).rejects.toThrow('Configure o Supabase para acessar as avaliações.')
    await expect(getCsatThresholds()).rejects.toThrow('Configure o Supabase')
    expect(from).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
