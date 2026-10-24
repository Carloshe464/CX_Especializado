import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import { useSession } from './session'

// Apresentação apenas: o acesso aos dados é garantido pela RLS e pelas RPCs.
export default function ProtectedRoute() {
  const { status, needsOnboarding } = useSession()
  const location = useLocation()
  const onOnboarding = location.pathname === '/onboarding'

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner label="Carregando sessão…" />
      </div>
    )
  }
  if (status !== 'signed_in') return <Navigate to="/login" replace state={{ from: location }} />
  if (needsOnboarding && !onOnboarding) return <Navigate to="/onboarding" replace />
  if (!needsOnboarding && onOnboarding) return <Navigate to="/" replace />
  return <Outlet />
}
