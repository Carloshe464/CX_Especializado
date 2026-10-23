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

it('cria um único cliente com sessão persistente, renovação automática e fluxo PKCE', async () => {
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
  expect(first.supabase.auth.persistSession).toBe(true)
  expect(first.supabase.auth.autoRefreshToken).toBe(true)
  expect(first.supabase.auth.detectSessionInUrl).toBe(true)
  expect(first.supabase.auth.flowType).toBe('pkce')
  // Sem sessão salva e sem código na URL, nada vai para a rede.
  expect(fetch).not.toHaveBeenCalled()
  first.supabase.auth.stopAutoRefresh()
})
