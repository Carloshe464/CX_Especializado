// Permissões de interface: só decidem quais controles mostrar. A permissão real é do banco (RLS e RPCs).

/**
 * Gestor da organização: admin da plataforma ou supervisor da mesma organização.
 */
export function isOrgManager(session, organizationId) {
  if (session?.role === 'platform_admin') return true
  return session?.role === 'supervisor' && Boolean(session.organizationId) && session.organizationId === organizationId
}
