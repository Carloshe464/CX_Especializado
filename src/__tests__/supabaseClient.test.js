import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('não cria cliente nem faz rede sem configuração', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { supabase, supabaseConfigError } = await import('@/lib/supabaseClient')
  expect(supabase).toBeNull()
  expect(supabaseConfigError).toContain('Configure')
  expect(fetch).not.toHaveBeenCalled()
})

it('cria um único cliente configurado sem rede nem recuperação automática de sessão', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_ficticia')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const first = await import('@/lib/supabaseClient')
  const second = await import('@/lib/supabaseClient')
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(first.supabase).toBeTruthy()
  expect(first.supabase).toBe(second.supabase)
  expect(first.supabaseConfigError).toBeNull()
  expect(first.supabase.auth.persistSession).toBe(false)
  expect(first.supabase.auth.autoRefreshToken).toBe(false)
  expect(first.supabase.auth.detectSessionInUrl).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})
