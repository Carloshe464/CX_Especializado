import { createClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './env.js'

const config = readSupabaseEnv()

export const supabaseConfigError = config.error
export const supabase = config.isConfigured
  ? createClient(config.url, config.key, {
    // TASK-014 configurará sessões; a fundação não recupera nem renova sessões.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  : null

