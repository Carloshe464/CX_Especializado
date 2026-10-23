import { createContext, useContext } from 'react'

export const DEFAULT_SESSION = { user: null, role: null, onSignOut: () => {} }
export const SessionContext = createContext(DEFAULT_SESSION)

export function useSession() {
  return useContext(SessionContext)
}
