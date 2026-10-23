import { BookOpen, CirclePlus, ClipboardList, LayoutDashboard, ShieldCheck, Smile, Sprout } from 'lucide-react'

// Apresentação apenas; autorização pertence ao banco e às rotas (TASK-012/TASK-014).
// Ícones derivados: confirmar na comparação visual.
export const NAV_ITEMS = [
  { label: 'Painel', to: '/', icon: LayoutDashboard, roles: ['supervisor', 'platform_admin'] },
  { label: 'Avaliações', to: '/avaliacoes', icon: ClipboardList, roles: [null, 'analista', 'supervisor', 'platform_admin'] },
  { label: 'Nova avaliação', to: '/nova-avaliacao', icon: CirclePlus, roles: [null, 'analista', 'supervisor', 'platform_admin'] },
  { label: 'Curadoria', to: '/curadoria', icon: ShieldCheck, roles: ['supervisor', 'platform_admin'] },
  { label: 'Satisfação', to: '/satisfacao', icon: Smile, roles: ['supervisor', 'platform_admin'] },
  { label: 'Protocolo', to: '/protocolo', icon: BookOpen, roles: ['supervisor', 'platform_admin'] },
  { label: 'Meu desenvolvimento', to: '/meu-desenvolvimento', icon: Sprout, roles: ['analista'] },
]

export function visibleNavItems(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
