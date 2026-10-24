import { Navigate } from 'react-router-dom'
import { useSession } from './session'

// Redirecionamentos por papel da referência (REF §3). Use `allow` ou `deny`.
export default function RequireRole({ allow, deny, redirectTo, children }) {
  const { role } = useSession()
  const blocked = allow ? !allow.includes(role) : Boolean(deny?.includes(role))
  return blocked ? <Navigate to={redirectTo} replace /> : children
}
