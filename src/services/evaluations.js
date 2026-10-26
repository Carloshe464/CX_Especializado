import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'
import { DEFAULT_CSAT_THRESHOLD } from '../lib/cx.js'

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
