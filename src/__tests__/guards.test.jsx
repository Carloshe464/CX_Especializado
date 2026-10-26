import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/SessionContext'
import { AppRoutes } from '@/App'
import ProtectedRoute from '@/auth/ProtectedRoute'

vi.mock('@/lib/supabaseClient', () => ({ supabase: null, supabaseConfigError: null }))

function LoginProbe() {
  const location = useLocation()
  return <h1>Login com origem {location.state?.from?.pathname ?? 'nenhuma'}</h1>
}

function renderGuard(path, session) {
  return render(
    <SessionProvider value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<h1>Onboarding</h1>} />
            <Route path="/" element={<h1>Início</h1>} />
            <Route path="/avaliacoes" element={<h1>Avaliações</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

const member = (role) => ({ status: 'signed_in', user: { id: 'u', email: 'u@exemplo.test' }, role, organizationId: 'org-x' })

describe('ProtectedRoute', () => {
  it('mostra o spinner em tela cheia enquanto carrega', () => {
    renderGuard('/avaliacoes', { status: 'loading' })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão…')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('sem sessão redireciona para /login preservando a origem', () => {
    renderGuard('/avaliacoes', { status: 'signed_out' })
    expect(screen.getByRole('heading', { name: 'Login com origem /avaliacoes' })).toBeInTheDocument()
  })

  it('sem vínculo redireciona para /onboarding', () => {
    renderGuard('/avaliacoes', { ...member(null), needsOnboarding: true })
    expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument()
  })

  it('sem vínculo permanece em /onboarding', () => {
    renderGuard('/onboarding', { ...member(null), needsOnboarding: true })
    expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument()
  })

  it('com vínculo, /onboarding volta para /', () => {
    renderGuard('/onboarding', member('analista'))
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument()
  })

  it('com vínculo libera a rota interna', () => {
    renderGuard('/avaliacoes', member('analista'))
    expect(screen.getByRole('heading', { name: 'Avaliações' })).toBeInTheDocument()
  })
})

function renderApp(path, session) {
  return render(
    <SessionProvider value={session}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
    </SessionProvider>,
  )
}

describe('RequireRole (redirecionamentos da REF §3)', () => {
  it('analista em / vai para /meu-desenvolvimento', async () => {
    renderApp('/', member('analista'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu desenvolvimento' })).toBeInTheDocument()
  })

  it.each(['/curadoria', '/satisfacao'])('analista em %s vai para / e depois para /meu-desenvolvimento', async (path) => {
    renderApp(path, member('analista'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu desenvolvimento' })).toBeInTheDocument()
  })

  it.each([
    ['supervisor', '/', 'Painel'],
    ['supervisor', '/curadoria', 'Curadoria'],
    ['supervisor', '/satisfacao', 'Satisfação'],
    ['platform_admin', '/', 'Painel'],
    ['platform_admin', '/curadoria', 'Curadoria'],
    ['platform_admin', '/satisfacao', 'Satisfação'],
  ])('%s acessa %s', async (role, path, title) => {
    renderApp(path, member(role))
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('nenhum outro redirecionamento: supervisor acessa /meu-desenvolvimento', async () => {
    renderApp('/meu-desenvolvimento', member('supervisor'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu desenvolvimento' })).toBeInTheDocument()
  })
})

describe('telas de autenticação com sessão ativa', () => {
  it.each(['/login', '/register', '/forgot-password'])('%s com usuário logado vai para /', async (path) => {
    renderApp(path, member('supervisor'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument()
  })

  it('/login com usuário logado volta para a rota de origem', async () => {
    render(
      <SessionProvider value={member('supervisor')}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/protocolo' } } }]}>
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Protocolo' })).toBeInTheDocument()
  })
})
