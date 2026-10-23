import { createContext, useContext } from 'react'

export const DEFAULT_SESSION = {
  status: 'signed_out',
  user: null,
  role: null,
  organizationId: null,
  needsOnboarding: false,
  passwordRecovery: false,
  refresh: async () => {},
  onSignOut: async () => {},
}
export const SessionContext = createContext(DEFAULT_SESSION)

export function useSession() {
  return useContext(SessionContext)
}
