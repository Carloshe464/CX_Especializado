import { createClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './env.js'

const config = readSupabaseEnv()

export const supabaseConfigError = config.error
export const supabase = config.isConfigured
  ? createClient(config.url, config.key, {
    // PKCE: o código de retorno (OAuth, confirmação e recuperação) é trocado no navegador.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  : null
