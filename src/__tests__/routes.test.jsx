import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/App'
import { SessionProvider } from '@/auth/SessionContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/supabaseClient', () => ({ supabase: null, supabaseConfigError: null }))

const supervisor = { status: 'signed_in', user: { id: 'u', email: 'sup@exemplo.test' }, role: 'supervisor', organizationId: 'org-x' }

const internal = [
  ['/', 'Painel'],
  ['/avaliacoes', 'Avaliações'],
  ['/nova-avaliacao', 'Nova avaliação'],
  ['/avaliacao/id-ficticio', 'Avaliação'],
  ['/curadoria', 'Curadoria'],
  ['/meu-desenvolvimento', 'Meu desenvolvimento'],
  ['/satisfacao', 'Satisfação'],
  ['/protocolo', 'Protocolo'],
]

const publicRoutes = [
  ['/login', 'Entrar'],
  ['/register', 'Criar conta'],
  ['/forgot-password', 'Esqueci minha senha'],
  ['/reset-password', 'Redefinir senha'],
  ['/auth/confirm', 'Confirmar acesso'],
  ['/pesquisa/token-ficticio', 'Pesquisa de satisfação'],
  ['/rota-inexistente', 'Página não encontrada'],
]

function renderAt(path, session) {
  return render(
    <SessionProvider value={session}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
      </QueryClientProvider>
    </SessionProvider>,
  )
}

describe('rotas internas', () => {
  it.each(internal)('%s exige sessão e leva ao login', (path) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it.each(internal)('%s renderiza %s dentro do layout para supervisor', async (path, title) => {
    renderAt(path, supervisor)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    if (path === '/avaliacoes') {
      expect(screen.getByRole('searchbox', { name: 'Buscar avaliações' })).toBeInTheDocument()
    } else if (path === '/nova-avaliacao') {
      expect(screen.getByRole('form', { name: 'Nova avaliação' })).toBeInTheDocument()
    } else if (path === '/avaliacao/id-ficticio') {
      expect(screen.getByText('Avaliação não encontrada ou você não tem acesso a ela.')).toBeInTheDocument()
    } else {
      expect(screen.getByText('Em construção.')).toBeInTheDocument()
    }
    expect(screen.getByRole('navigation', { name: 'Navegação principal (desktop)' })).toBeInTheDocument()
  })
})

describe('rotas públicas', () => {
  it.each(publicRoutes)('%s renderiza %s sem sessão e sem o menu interno', async (path, title) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('/pesquisa/:token continua pública mesmo com sessão', async () => {
    renderAt('/pesquisa/token-ficticio', supervisor)
    expect(await screen.findByRole('heading', { level: 1, name: 'Pesquisa de satisfação' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('o botão da 404 navega para o painel como link acessível', async () => {
    const user = userEvent.setup()
    renderAt('/inexistente', supervisor)
    const link = screen.getByRole('link', { name: 'Voltar para o painel' })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveClass('bg-primary')
    await user.click(link)
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  })
})
