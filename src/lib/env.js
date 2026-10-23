export function readSupabaseEnv(source = import.meta.env) {
  const url = source.VITE_SUPABASE_URL?.trim() || ''
  const key = (source.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || source.VITE_SUPABASE_ANON_KEY?.trim()) || ''
  const invalid = (error) => ({ url, key, isConfigured: false, error })

  if (key.startsWith('sb_secret_')) {
    return invalid('Chave secreta não pode ser usada no navegador')
  }

  if (key.split('.').length === 3) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      if (JSON.parse(atob(payload)).role === 'service_role') {
        return invalid('Chave secreta não pode ser usada no navegador')
      }
    } catch {
      return invalid('Chave pública do Supabase inválida.')
    }
  }

  if (!url || !key) {
    return invalid('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local.')
  }

  try {
    const parsed = new URL(url)
    const localHttp = parsed.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(parsed.hostname)
    if (parsed.protocol !== 'https:' && !localHttp) {
      return invalid('A URL do Supabase deve usar HTTPS (HTTP somente em localhost ou 127.0.0.1).')
    }
    if (parsed.username || parsed.password) {
      return invalid('A URL do Supabase não pode conter credenciais.')
    }
  } catch {
    return invalid('URL do Supabase inválida.')
  }

  return { url, key, isConfigured: true, error: null }
}

