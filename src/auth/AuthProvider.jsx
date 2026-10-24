import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { SessionContext } from './session'

const RECOVERY_KEY = 'cx.passwordRecovery'
const NO_ACCESS = { userId: null, role: null, organizationId: null, failed: false }

function readRecoveryFlag() {
  try {
    return window.sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

function writeRecoveryFlag(active) {
  try {
    if (active) window.sessionStorage.setItem(RECOVERY_KEY, '1')
    else window.sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // Armazenamento indisponível: o fluxo segue só com o estado em memória.
  }
}

// Papel e organização vêm só do banco, pelas linhas próprias liberadas pela RLS (SEC-03).
// user_metadata e app_metadata nunca são usados para papel.
async function loadAccess(client, userId) {
  const [admin, member] = await Promise.all([
    client.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    client.from('memberships').select('role, organization_id').eq('user_id', userId).maybeSingle(),
  ])
  if (admin.error || member.error) return { userId, role: null, organizationId: null, failed: true }
  if (admin.data) {
    return { userId, role: 'platform_admin', organizationId: member.data?.organization_id ?? null, failed: false }
  }
  if (member.data) {
    return { userId, role: member.data.role, organizationId: member.data.organization_id, failed: false }
  }
  return { ...NO_ACCESS, userId }
}

function toUser(authUser) {
  if (!authUser) return null
  const metadata = authUser.user_metadata ?? {}
  return { id: authUser.id, email: authUser.email ?? '', fullName: metadata.full_name ?? metadata.name ?? null }
}

export function AuthProvider({ children, client = supabase }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // undefined = sessão ainda não lida; null = sem sessão.
  const [session, setSession] = useState(client ? undefined : null)
  const [access, setAccess] = useState(NO_ACCESS)
  const [passwordRecovery, setPasswordRecovery] = useState(readRecoveryFlag)

  useEffect(() => {
    if (!client) return undefined
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (active) setSession(data?.session ?? null)
    })
    // Sem chamadas ao Supabase dentro do callback (recomendação do supabase-js).
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession ?? null)
      if (event === 'PASSWORD_RECOVERY') {
        writeRecoveryFlag(true)
        setPasswordRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        writeRecoveryFlag(false)
        setPasswordRecovery(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!client || !userId) return undefined
    let active = true
    loadAccess(client, userId).then((result) => {
      if (active) setAccess(result)
    })
    return () => {
      active = false
    }
  }, [client, userId])

  const refresh = useCallback(async () => {
    if (!client || !userId) return
    setAccess(await loadAccess(client, userId))
  }, [client, userId])

  const clearPasswordRecovery = useCallback(() => {
    writeRecoveryFlag(false)
    setPasswordRecovery(false)
  }, [])

  const onSignOut = useCallback(async () => {
    if (client) await client.auth.signOut()
    writeRecoveryFlag(false)
    setPasswordRecovery(false)
    setSession(null)
    setAccess(NO_ACCESS)
    queryClient.clear()
    navigate('/login', { replace: true })
  }, [client, navigate, queryClient])

  const value = useMemo(() => {
    const status = session === undefined ? 'loading'
      : !session ? 'signed_out'
        : access.userId !== userId ? 'loading'
          : 'signed_in'
    const signedIn = status === 'signed_in'
    return {
      status,
      user: signedIn ? toUser(session.user) : null,
      role: signedIn ? access.role : null,
      organizationId: signedIn ? access.organizationId : null,
      needsOnboarding: signedIn && !access.failed && access.role === null,
      passwordRecovery: signedIn && passwordRecovery,
      clearPasswordRecovery,
      refresh,
      onSignOut,
    }
  }, [session, access, userId, passwordRecovery, clearPasswordRecovery, refresh, onSignOut])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
