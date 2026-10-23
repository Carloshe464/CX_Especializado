import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthProvider'
import { useSession } from '@/auth/session'
import { createFakeSupabase, fakeSession } from '@/test/fakeSupabase'

vi.mock('@/lib/supabaseClient', () => ({ supabase: null, supabaseConfigError: null }))

afterEach(() => window.sessionStorage.clear())

function Probe() {
  const { status, user, role, organizationId, needsOnboarding, onSignOut } = useSession()
  return (
    <>
      <pre data-testid="state">{JSON.stringify({ status, user, role, organizationId, needsOnboarding })}</pre>
      <button onClick={onSignOut}>Sair</button>
    </>
  )
}

function renderProvider(client, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider client={client}>
          <Routes>
            <Route path="/" element={<Probe />} />
            <Route path="/login" element={<h1>Tela de login</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent)

describe('AuthProvider', () => {
  it('sem cliente configurado fica signed_out sem usuário', () => {
    renderProvider(null)
    expect(state()).toEqual({ status: 'signed_out', user: null, role: null, organizationId: null, needsOnboarding: false })
  })

  it('loading → signed_out quando não há sessão', async () => {
    const client = createFakeSupabase()
    renderProvider(client)
    expect(state().status).toBe('loading')
    await waitFor(() => expect(state().status).toBe('signed_out'))
    expect(client.from).not.toHaveBeenCalled()
  })

  it('loading → signed_in com papel vindo de memberships', async () => {
    const client = createFakeSupabase({
      session: fakeSession('user-1', 'ana@exemplo.test', { full_name: 'Ana' }),
      tables: { memberships: { data: { role: 'supervisor', organization_id: 'org-x' }, error: null } },
    })
    renderProvider(client)
    expect(state().status).toBe('loading')
    await waitFor(() => expect(state().status).toBe('signed_in'))
    expect(state()).toEqual({
      status: 'signed_in',
      user: { id: 'user-1', email: 'ana@exemplo.test', fullName: 'Ana' },
      role: 'supervisor',
      organizationId: 'org-x',
      needsOnboarding: false,
    })
    expect(client.from).toHaveBeenCalledWith('memberships')
    expect(client.from).toHaveBeenCalledWith('platform_admins')
  })

  it('linha em platform_admins vira platform_admin', async () => {
    const client = createFakeSupabase({
      session: fakeSession('admin-1'),
      tables: { platform_admins: { data: { user_id: 'admin-1' }, error: null } },
    })
    renderProvider(client)
    await waitFor(() => expect(state().status).toBe('signed_in'))
    expect(state()).toMatchObject({ role: 'platform_admin', needsOnboarding: false })
  })

  it('sem platform_admins nem memberships precisa de onboarding', async () => {
    renderProvider(createFakeSupabase({ session: fakeSession() }))
    await waitFor(() => expect(state().status).toBe('signed_in'))
    expect(state()).toMatchObject({ role: null, organizationId: null, needsOnboarding: true })
  })

  it('ignora role em user_metadata e app_metadata (SEC-03)', async () => {
    const session = fakeSession('user-2', 'falso@exemplo.test', { role: 'supervisor' })
    session.user.app_metadata = { role: 'platform_admin' }
    renderProvider(createFakeSupabase({ session }))
    await waitFor(() => expect(state().status).toBe('signed_in'))
    expect(state()).toMatchObject({ role: null, needsOnboarding: true })
  })

  it('erro ao ler o papel não inventa papel nem força onboarding', async () => {
    renderProvider(createFakeSupabase({
      session: fakeSession(),
      tables: { memberships: { data: null, error: { message: 'falha' } } },
    }))
    await waitFor(() => expect(state().status).toBe('signed_in'))
    expect(state()).toMatchObject({ role: null, needsOnboarding: false })
  })

  it('reage a SIGNED_IN e SIGNED_OUT do onAuthStateChange', async () => {
    const client = createFakeSupabase({
      tables: { memberships: { data: { role: 'analista', organization_id: 'org-x' }, error: null } },
    })
    renderProvider(client)
    await waitFor(() => expect(state().status).toBe('signed_out'))
    act(() => client.emit('SIGNED_IN', fakeSession('user-3')))
    await waitFor(() => expect(state()).toMatchObject({ status: 'signed_in', role: 'analista' }))
    act(() => client.emit('SIGNED_OUT', null))
    expect(state().status).toBe('signed_out')
  })

  it('cancela a inscrição ao desmontar', async () => {
    const client = createFakeSupabase()
    const view = renderProvider(client)
    await waitFor(() => expect(state().status).toBe('signed_out'))
    view.unmount()
    expect(client.unsubscribe).toHaveBeenCalledOnce()
  })

  it('Sair chama signOut, limpa o cache e vai para /login', async () => {
    const client = createFakeSupabase({
      session: fakeSession(),
      tables: { memberships: { data: { role: 'analista', organization_id: 'org-x' }, error: null } },
    })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['avaliacoes'], ['dado-sensivel'])
    renderProvider(client, queryClient)
    await waitFor(() => expect(state().status).toBe('signed_in'))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))
    expect(client.auth.signOut).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(['avaliacoes'])).toBeUndefined()
    expect(screen.getByRole('heading', { name: 'Tela de login' })).toBeInTheDocument()
  })
})
