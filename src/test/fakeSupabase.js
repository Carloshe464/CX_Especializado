import { vi } from 'vitest'

// Cliente Supabase falso, sem rede. `tables` define o retorno de maybeSingle() por tabela.
export function createFakeSupabase({ session = null, tables = {} } = {}) {
  const listeners = new Set()
  const unsubscribe = vi.fn()
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: vi.fn((callback) => {
        listeners.add(callback)
        return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); unsubscribe() } } } }
      }),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: {}, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table) => {
      const query = {
        select: vi.fn(() => query),
        insert: vi.fn(() => query),
        update: vi.fn(() => query),
        single: vi.fn(async () => tables[table] ?? { data: null, error: null }),
        in: vi.fn(() => query),
        ilike: vi.fn(() => query),
        eq: vi.fn(() => query),
        or: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        then: (resolve, reject) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
        maybeSingle: vi.fn(async () => tables[table] ?? { data: null, error: null }),
      }
      return query
    }),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'arquivo-ficticio' }, error: null })),
        remove: vi.fn(async () => ({ data: [], error: null })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://arquivos.exemplo.test/anexo' }, error: null })),
      })),
    },
    emit(event, nextSession) {
      listeners.forEach((listener) => listener(event, nextSession))
    },
    unsubscribe,
    tables,
  }
  return client
}

export function fakeSession(id = 'user-1', email = 'pessoa@exemplo.test', userMetadata = {}) {
  return { access_token: 'token-ficticio', user: { id, email, user_metadata: userMetadata, app_metadata: {} } }
}
