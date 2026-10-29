import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'
import { CHANNELS, DEFAULT_CSAT_THRESHOLD } from '../lib/cx.js'

function client() {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para acessar as avaliações.')
  return supabase
}

export async function listEvaluations() {
  const { data, error } = await client()
    .from('evaluations')
    .select(`
      id, organization_id, protocol, analyst_name, channel, status, created_at,
      current_run:analysis_runs!evaluations_current_run_fkey(trend),
      csat_records(score, created_at)
    `)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error

  return (data ?? []).map((row) => {
    const latestScore = (row.csat_records ?? [])
      .filter(({ score }) => Number.isInteger(score) && score >= 1 && score <= 5)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    return {
      id: row.id,
      organizationId: row.organization_id,
      protocol: row.protocol,
      analystName: row.analyst_name,
      channel: row.channel,
      status: row.status,
      createdAt: row.created_at,
      trend: row.current_run?.trend ?? null,
      realScore: latestScore?.score ?? null,
    }
  })
}

export async function getCsatThresholds() {
  const { data, error } = await client()
    .from('app_settings')
    .select('organization_id, value')
    .eq('key', 'csat_positive_threshold')
  if (error) throw error
  return Object.fromEntries((data ?? []).map(({ organization_id, value }) => {
    const threshold = Number(value)
    return [organization_id, Number.isInteger(threshold) && threshold >= 1 && threshold <= 5
      ? threshold
      : DEFAULT_CSAT_THRESHOLD]
  }))
}

export function buildEvaluationPayload({ form, session, analyst, hasPrints }) {
  const own = session.role === 'analista'
  const hasText = Boolean(form.transcript?.trim())
  return {
    organization_id: session.organizationId,
    protocol: form.protocol?.trim() || null,
    channel: CHANNELS.includes(form.channel) ? form.channel : null,
    transcript: hasText ? form.transcript : null,
    source: hasPrints ? 'prints' : 'texto',
    status: hasText ? 'transcrito' : 'rascunho',
    analyst_user_id: own ? session.user.id : analyst.id,
    analyst_name: own ? session.user.fullName || session.user.email : analyst.name,
  }
}

export async function findEvaluationIdByProtocol(protocol, organizationId) {
  const normalized = protocol.trim().toLowerCase()
  const pattern = normalized.replace(/[\\%_*]/g, '\\$&')
  let query = client().from('evaluations').select('id, protocol').ilike('protocol', pattern)
  // O admin pode ler várias organizações; a busca de uma duplicata pertence à criação atual.
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).find((row) => row.protocol?.trim().toLowerCase() === normalized)?.id ?? null
}

export async function createEvaluation(payload) {
  const { data, error } = await client().from('evaluations')
    .insert(payload).select('id, organization_id').single()
  if (error?.code === '23505') {
    const duplicate = new Error('Já existe uma avaliação com este protocolo.')
    duplicate.code = 'PROTOCOLO_DUPLICADO'
    duplicate.existingId = payload.protocol
      ? await findEvaluationIdByProtocol(payload.protocol, payload.organization_id)
      : null
    throw duplicate
  }
  if (error) throw error
  return { id: data.id, organizationId: data.organization_id }
}

export async function updateEvaluationTranscript({ id, transcript }) {
  const hasText = Boolean(transcript?.trim())
  const { data, error } = await client().from('evaluations')
    .update({ transcript: hasText ? transcript : null, status: hasText ? 'transcrito' : 'rascunho' })
    .eq('id', id).select('id').single()
  if (error?.code === 'CX033' || error?.code === 'CX036') {
    throw new Error('A transcrição não pode mais ser alterada nesta etapa.')
  }
  if (error?.code === '42501' || error?.code === 'PGRST116' || (!error && !data)) {
    throw new Error('Você não tem permissão para alterar esta avaliação.')
  }
  if (error) throw new Error('Não foi possível salvar a transcrição. Tente novamente.')
  return data
}
