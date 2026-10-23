import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from './session'

// Telas de entrada: com sessão ativa, volta para a rota de origem ou para o painel.
export default function PublicOnlyRoute() {
  const { status } = useSession()
  const location = useLocation()
  if (status !== 'signed_in') return <Outlet />
  const from = location.state?.from
  const target = from?.pathname ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/'
  return <Navigate to={target} replace />
}
