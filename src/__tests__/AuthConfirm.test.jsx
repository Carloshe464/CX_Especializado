import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthProvider'
import { useSession } from '@/auth/session'
import AuthConfirm from '@/pages/AuthConfirm'
import ResetPassword from '@/pages/ResetPassword'
import { createFakeSupabase, fakeSession } from '@/test/fakeSupabase'

const mock = vi.hoisted(() => ({ client: null }))
vi.mock('@/lib/supabaseClient', () => ({
  get supabase() { return mock.client },
  supabaseConfigError: null,
}))

let client
beforeEach(() => { client = createFakeSupabase(); mock.client = client })
afterEach(() => window.sessionStorage.clear())

function Probe() {
  const location = useLocation()
  const { status } = useSession()
  const navigate = useNavigate()
  return <>
    <output data-testid="url">{location.pathname + location.search + location.hash}</output>
    <output data-testid="status">{status}</output>
    <button onClick={() => navigate(-1)}>Voltar</button>
  </>
}

function renderAt(search, { strict = false, session = null } = {}) {
  if (session) client.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  const tree = <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/antes', '/auth/confirm' + search]} initialIndex={1}>
      <AuthProvider client={mock.client}>
        <Probe />
        <Routes>
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<h1>Destino inicial</h1>} />
          <Route path="/antes" element={<h1>Página anterior</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

it.each(['email', 'email_change'])('confirma %s e substitui a URL por /', async (type) => {
  renderAt(`?token_hash=hash-ficticio&type=${type}`, { session: fakeSession() })
  expect(await screen.findByRole('heading', { name: 'Destino inicial' })).toBeInTheDocument()
  expect(client.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: 'hash-ficticio', type })
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/$/)
  act(() => screen.getByRole('button', { name: 'Voltar' }).click())
  expect(await screen.findByRole('heading', { name: 'Página anterior' })).toBeInTheDocument()
})

it('recovery libera o formulário pelo evento PASSWORD_RECOVERY e consome uma única vez em StrictMode', async () => {
  let resolve
  client.auth.verifyOtp.mockReturnValue(new Promise((done) => { resolve = done }))
  renderAt('?token_hash=hash-ficticio&type=recovery', { strict: true })
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed_out'))
  expect(client.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: 'hash-ficticio', type: 'recovery' })
  await act(async () => {
    const session = fakeSession()
    client.emit('PASSWORD_RECOVERY', session)
    resolve({ data: { session, user: session.user }, error: null })
  })
  expect(await screen.findByLabelText('Nova senha')).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeEnabled()
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/reset-password$/)
  expect(window.sessionStorage.getItem('cx.passwordRecovery')).toBe('1')
  expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1)
})

it.each([
  '?token_hash=hash-ficticio&type=invite',
  '?token_hash=hash-ficticio&type=sms',
  '?type=email',
  '?token_hash=&type=email',
  '?token_hash=hash-ficticio',
])('rejeita parâmetros inválidos sem consultar o servidor: %s', async (search) => {
  renderAt(search)
  expect(await screen.findByText('Link inválido ou expirado.')).toBeInTheDocument()
  expect(client.auth.verifyOtp).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^\/auth\/confirm$/))
  expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute('href', '/forgot-password')
})

it('erro do verifyOtp tem mensagem neutra e remove os parâmetros', async () => {
  client.auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Detalhe interno que não deve aparecer' } })
  renderAt('?token_hash=hash-ficticio&type=email')
  expect(await screen.findByText('Link inválido ou expirado.')).toBeInTheDocument()
  expect(screen.queryByText(/Detalhe interno/)).not.toBeInTheDocument()
  expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^\/auth\/confirm$/))
})

it('falha de rede é tratada sem expor detalhes', async () => {
  client.auth.verifyOtp.mockRejectedValue(new Error('Falha de rede'))
  renderAt('?token_hash=hash-ficticio&type=recovery')
  expect(await screen.findByText('Link inválido ou expirado.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
})

it('sem cliente configurado mostra erro sem rede', async () => {
  mock.client = null
  const fetch = vi.spyOn(globalThis, 'fetch')
  renderAt('?token_hash=hash-ficticio&type=email')
  expect(await screen.findByText('Link inválido ou expirado.')).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  fetch.mockRestore()
})
