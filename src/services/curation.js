import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'

function client() {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para acessar a curadoria.')
  return supabase
}

export async function listCurationQueue() {
  const { data, error } = await client()
    .from('evaluations')
    .select(`
      id, protocol, analyst_name, channel, created_at, current_analysis_run_id,
      current_run:analysis_runs!evaluations_current_run_fkey(trend),
      opportunities(id, status, analysis_run_id),
      analysis_feedback(author_role, useful, analysis_run_id)
    `)
    .eq('status', 'analisado')
    .or('diagnosis_status.is.null,diagnosis_status.eq.pendente')
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error

  const queue = (data ?? []).map((row) => {
    const isCurrent = (item) => item.analysis_run_id === row.current_analysis_run_id
    return {
      id: row.id,
      protocol: row.protocol,
      analystName: row.analyst_name,
      channel: row.channel,
      createdAt: row.created_at,
      trend: row.current_run?.trend ?? null,
      pendingOpportunities: (row.opportunities ?? []).filter((opportunity) =>
        isCurrent(opportunity) && opportunity.status === 'pendente').length,
      analystFlaggedNotUseful: (row.analysis_feedback ?? []).some((feedback) =>
        isCurrent(feedback) && feedback.author_role === 'analista' && feedback.useful === false),
    }
  })

  // A ordenação estável preserva a antiguidade relativa da consulta em cada grupo.
  return [
    ...queue.filter((item) => item.analystFlaggedNotUseful),
    ...queue.filter((item) => !item.analystFlaggedNotUseful),
  ]
}

export async function listRecentCuration() {
  const { data, error } = await client()
    .from('evaluations')
    .select('id, protocol, analyst_name, diagnosis_status, updated_at')
    .eq('status', 'curado')
    .order('updated_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    protocol: row.protocol,
    analystName: row.analyst_name,
    diagnosisStatus: row.diagnosis_status,
    decidedAt: row.updated_at,
  }))
}

export async function decideOpportunity({ opportunityId, decision, note, adjusted }) {
  const { error } = await client().rpc('decide_opportunity', {
    p_opportunity: opportunityId,
    p_decision: decision,
    p_note: note?.trim() || null,
    p_adjusted: decision === 'ajustada' ? adjusted?.trim() || null : null,
  })
  if (error) throw error
}

export async function decideDiagnosis({ evaluationId, decision, review }) {
  const { error } = await client().rpc('decide_diagnosis', {
    p_evaluation: evaluationId,
    p_decision: decision,
    p_review: review?.trim() || null,
  })
  if (error) throw error
}

const ERROR_MESSAGES = Object.freeze({
  CX030: 'Somente o supervisor da organização pode decidir a curadoria.',
  CX025: 'Esta análise foi substituída. Recarregue a página.',
  CX026: 'A avaliação não tem análise concluída.',
  CX028: 'Decisão inválida. Recarregue a página.',
  CX029: 'Decisão inválida. Recarregue a página.',
})

export function curationErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] ?? 'Não foi possível salvar a decisão. Tente novamente.'
}
