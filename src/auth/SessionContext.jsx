import { DEFAULT_SESSION, SessionContext } from './session'

// TODO(TASK-014): substituir pelo estado real do Supabase Auth.
export function SessionProvider({ children, value = DEFAULT_SESSION }) {
  return (
    <SessionContext.Provider value={{ ...DEFAULT_SESSION, ...value }}>
      {children}
    </SessionContext.Provider>
  )
}
