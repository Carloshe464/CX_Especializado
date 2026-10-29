import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'
import { COMPETENCIES } from '../lib/cx.js'
import { listEvaluationFiles } from './evaluationFiles.js'

function client() {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para acessar as avaliações.')
  return supabase
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getEvaluationDetail(id) {
  if (typeof id !== 'string' || !UUID.test(id)) return null
  const db = client()
  const { data, error } = await db.from('evaluations').select(`
    id, organization_id, protocol, analyst_user_id, analyst_name, channel, source, status,
    transcript, diagnosis_status, supervisor_review, current_analysis_run_id, created_by, created_at,
    current_run:analysis_runs!evaluations_current_run_fkey(id, run_number, status, prompt_version,
      trend, strengths, summary_feedback, uncertainties, finished_at)
  `).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { current_run: run = null, ...evaluation } = data
  const empty = Promise.resolve({ data: [], error: null })
  const [scores, opportunities, feedback, csat, files] = await Promise.all([
    run ? db.from('evaluation_scores').select('id, competency, score, classification, evidence').eq('analysis_run_id', run.id) : empty,
    run ? db.from('opportunities').select(`id, position, severity, origin, confidence, description, evidence,
      impact, recommendation, improved_example, communication_techniques, status, supervisor_note,
      adjusted_recommendation`).eq('analysis_run_id', run.id).order('position') : empty,
    run ? db.from('analysis_feedback').select('id, target_type, opportunity_id, author_role, liked, useful, comment, updated_at')
      .eq('analysis_run_id', run.id) : empty,
    db.from('csat_records').select('id, score, score_origin, level, source, comment, reason, themes, created_at')
      .eq('evaluation_id', id).order('created_at', { ascending: false }).limit(50),
    listEvaluationFiles(id),
  ])
  for (const result of [scores, opportunities, feedback, csat]) if (result.error) throw result.error
  return {
    evaluation, run,
    scores: [...(scores.data ?? [])].sort((a, b) => COMPETENCIES.indexOf(a.competency) - COMPETENCIES.indexOf(b.competency)),
    opportunities: opportunities.data ?? [], feedback: feedback.data ?? [], csatRecords: csat.data ?? [], files,
  }
}

export async function saveAnalystFeedback({ runId, target, opportunityId, liked, useful, comment }) {
  const { data, error } = await client().rpc('submit_feedback', {
    p_run: runId, p_target: target, p_opportunity: target === 'diagnostico' ? null : opportunityId,
    p_liked: liked, p_useful: useful, p_comment: comment,
  })
  if (error) throw error
  return data
}

export function feedbackErrorMessage(error) {
  switch (error?.code) {
    case 'CX023': return 'Você não tem permissão para validar esta avaliação.'
    case 'CX025': return 'Esta análise foi substituída. Recarregue a página.'
    case 'CX026': return 'A análise ainda não terminou.'
    case 'CX024':
    case 'CX027': return 'Validação inválida. Recarregue a página.'
    default: return 'Não foi possível salvar a validação. Tente novamente.'
  }
}
