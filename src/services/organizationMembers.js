import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'

export async function listOrgAnalysts(organizationId) {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para consultar os analistas.')
  const { data: memberships, error } = await supabase.from('memberships').select('user_id')
    .eq('organization_id', organizationId).eq('role', 'analista')
  if (error) throw error
  if (!memberships?.length) return []
  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select('id, full_name, email').in('id', memberships.map(({ user_id }) => user_id))
  if (profilesError) throw profilesError
  return (profiles ?? []).map(({ id, full_name, email }) => ({ id, name: full_name?.trim() || email }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
