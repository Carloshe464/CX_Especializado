import { DEFAULT_SESSION, SessionContext } from './session'

// Somente para testes: injeta uma sessão sintética. A aplicação usa o AuthProvider.
export function SessionProvider({ children, value = {} }) {
  const status = value.status ?? (value.user ? 'signed_in' : 'signed_out')
  return (
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...value, status }}>
      {children}
    </SessionContext.Provider>
  )
}
