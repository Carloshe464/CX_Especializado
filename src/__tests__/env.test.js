import { describe, expect, it } from 'vitest'
import { readSupabaseEnv } from '@/lib/env'

const publicConfig = {
  VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ficticia',
}
const jwt = (role) => `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ role })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.assinatura-ficticia`

describe('readSupabaseEnv', () => {
  it.each([
    {},
    { VITE_SUPABASE_URL: publicConfig.VITE_SUPABASE_URL },
    { VITE_SUPABASE_PUBLISHABLE_KEY: publicConfig.VITE_SUPABASE_PUBLISHABLE_KEY },
  ])('informa configuração ausente: %j', (source) => {
    expect(readSupabaseEnv(source)).toMatchObject({ isConfigured: false, error: expect.any(String) })
  })

  it.each(['url-invalida', 'http://exemplo.supabase.co', 'ftp://exemplo.test', 'http://localhost.exemplo.test'])(
    'rejeita URL inválida ou insegura: %s', (url) => {
      expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_URL: url }).isConfigured).toBe(false)
    },
  )

  it.each(['http://localhost:54321', 'http://127.0.0.1:54321'])('aceita Supabase local: %s', (url) => {
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_URL: url })).toMatchObject({ isConfigured: true, error: null })
  })

  it.each(['sb_secret_ficticia', jwt('service_role')])('rejeita chave secreta sintética: %s', (key) => {
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: key })).toMatchObject({
      isConfigured: false, error: 'Chave secreta não pode ser usada no navegador',
    })
  })

  it.each(['sb_publishable_ficticia', jwt('anon')])('aceita chave pública sintética: %s', (key) => {
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: key })).toEqual({
      url: publicConfig.VITE_SUPABASE_URL, key, isConfigured: true, error: null,
    })
  })

  it('aceita anon como fallback legado', () => {
    const key = jwt('anon')
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: publicConfig.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: key })).toMatchObject({
      key, isConfigured: true,
    })
  })

  it('prefere publishable e não contorna uma chave secreta usando o fallback', () => {
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_ANON_KEY: jwt('anon') }).key).toBe(publicConfig.VITE_SUPABASE_PUBLISHABLE_KEY)
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_ficticia', VITE_SUPABASE_ANON_KEY: jwt('anon') }).isConfigured).toBe(false)
  })

  it('normaliza espaços e rejeita JWT malformado e credenciais na URL', () => {
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: ' https://exemplo.test ', VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_ficticia ' }).isConfigured).toBe(true)
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: 'header.invalido.signature' }).isConfigured).toBe(false)
    expect(readSupabaseEnv({ ...publicConfig, VITE_SUPABASE_URL: 'https://usuario:senha@exemplo.test' }).isConfigured).toBe(false)
  })
})
