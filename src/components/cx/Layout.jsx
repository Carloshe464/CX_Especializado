import { HeartHandshake, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { visibleNavItems } from './navigation'

const ROLE_LABELS = {
  supervisor: 'SUPERVISOR',
  analista: 'ANALISTA',
  platform_admin: 'ADMIN GERAL', // Derivado — D-017.
}

function Brand({ small = false }) {
  return (
    <div className={small ? 'flex min-w-0 items-center gap-2' : 'flex items-center gap-3'}>
      <div className={small
        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground'
        : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground'}>
        <HeartHandshake className={small ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden="true" />
      </div>
      {/* Nome derivado — confirmar na comparação visual. */}
      <span className={small ? 'whitespace-nowrap font-heading text-base font-semibold' : 'font-heading text-lg font-semibold'}>Protocolo CX</span>
    </div>
  )
}

export default function Layout() {
  const { user, role, onSignOut } = useSession()
  const items = visibleNavItems(role)

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="px-6 py-7"><Brand /></div>
        <nav aria-label="Navegação principal (desktop)" className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive
              ? 'flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <footer className="mt-6 border-t border-border p-4">
          {user ? (
            <>
              <p className="truncate text-sm" title={user.email}>{user.email}</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{ROLE_LABELS[role]}</p>
              <Button variant="ghost" className="mt-3 w-full justify-start gap-2" onClick={onSignOut}>
                <LogOut className="h-4 w-4" aria-hidden="true" />Sair
              </Button>
            </>
          ) : <p className="text-sm text-muted-foreground">Sessão não iniciada</p>}
        </footer>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Brand small />
          {user && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap text-[11px] uppercase tracking-widest text-muted-foreground">{ROLE_LABELS[role]}</span>
              <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label="Sair" onClick={onSignOut}>
                <LogOut className="h-4 w-4" aria-hidden="true" />Sair
              </Button>
            </div>
          )}
        </div>
        <nav aria-label="Navegação principal (celular)" className="overflow-x-auto px-4 pb-3">
          <div className="flex w-max gap-2">
            {items.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive
                ? 'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                : 'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-secondary px-3 py-2 text-sm text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
