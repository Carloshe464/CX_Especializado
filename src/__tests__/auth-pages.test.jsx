import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/SessionContext'
import { NEUTRAL_RESET_MESSAGE } from '@/auth/messages'
import { createFakeSupabase } from '@/test/fakeSupabase'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Onboarding from '@/pages/Onboarding'

const mock = vi.hoisted(() => ({ client: null }))
vi.mock('@/lib/supabaseClient', () => ({
  get supabase() { return mock.client },
  supabaseConfigError: null,
}))

let client
beforeEach(() => {
  client = createFakeSupabase()
  mock.client = client
})
afterEach(() => vi.restoreAllMocks())

function renderPage(page, path, session) {
  return render(
    <SessionProvider value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={page} />
          <Route path="/" element={<h1>Destino inicial</h1>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('Login', () => {
  it('envia e-mail e senha para signInWithPassword', async () => {
    const user = userEvent.setup()
    renderPage(<Login />, '/login')
    await user.type(screen.getByLabelText('E-mail'), ' ana@exemplo.test ')
    await user.type(screen.getByLabelText('Senha'), 'senha-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@exemplo.test', password: 'senha-segura' })
  })

  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'E-mail ou senha incorretos.'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'Confirme seu e-mail antes de entrar.'],
    [{ code: 'over_request_rate_limit', message: 'x' }, 'Não foi possível entrar. Tente novamente.'],
  ])('mapeia o erro %j', async (error, message) => {
    client.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error })
    const user = userEvent.setup()
    renderPage(<Login />, '/login')
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.test')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(message)).toHaveAttribute('aria-live', 'polite')
  })

  it('desabilita o botão durante o envio', async () => {
    let resolve
    client.auth.signInWithPassword.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    renderPage(<Login />, '/login')
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.test')
    await user.type(screen.getByLabelText('Senha'), 'senha-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    resolve({ data: {}, error: null })
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('o botão Google chama signInWithOAuth com redirectTo = origin', async () => {
    renderPage(<Login />, '/login')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar com Google' }))
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('tem links para cadastro e recuperação', () => {
    renderPage(<Login />, '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/forgot-password')
  })
})

async function fillRegister(user, { password = 'senha-segura', confirm = password } = {}) {
  await user.type(screen.getByLabelText('Nome'), 'Ana Teste')
  await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.test')
  await user.type(screen.getByLabelText('Senha'), password)
  await user.type(screen.getByLabelText('Confirmar senha'), confirm)
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('Register', () => {
  it('recusa senha com menos de 8 caracteres', async () => {
    renderPage(<Register />, '/register')
    await fillRegister(userEvent.setup(), { password: '1234567' })
    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument()
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('recusa confirmação diferente', async () => {
    renderPage(<Register />, '/register')
    await fillRegister(userEvent.setup(), { confirm: 'outra-senha' })
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument()
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('chama signUp com full_name e emailRedirectTo e confirma o envio', async () => {
    renderPage(<Register />, '/register')
    await fillRegister(userEvent.setup())
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@exemplo.test',
      password: 'senha-segura',
      options: { data: { full_name: 'Ana Teste' }, emailRedirectTo: window.location.origin },
    })
    expect(await screen.findByText('Enviamos um link de confirmação para o seu e-mail.')).toBeInTheDocument()
  })

  it('também oferece o botão Google', () => {
    renderPage(<Register />, '/register')
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument()
  })
})

describe('ForgotPassword', () => {
  it.each([
    ['sucesso', async () => ({ data: {}, error: null })],
    ['erro', async () => ({ data: null, error: { message: 'User not found' } })],
    ['exceção', async () => { throw new Error('rede') }],
  ])('mostra a mesma mensagem neutra em caso de %s', async (_, implementation) => {
    client.auth.resetPasswordForEmail.mockImplementationOnce(implementation)
    const user = userEvent.setup()
    renderPage(<ForgotPassword />, '/forgot-password')
    await user.type(screen.getByLabelText('E-mail'), 'qualquer@exemplo.test')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(NEUTRAL_RESET_MESSAGE)).toBeInTheDocument()
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('qualquer@exemplo.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })
})

const signedIn = { status: 'signed_in', user: { id: 'u', email: 'ana@exemplo.test' }, role: null }

describe('ResetPassword', () => {
  it.each([
    ['sem sessão', { status: 'signed_out' }],
    ['com sessão comum, sem evento de recuperação', { ...signedIn, passwordRecovery: false }],
  ])('%s → link inválido', (_, session) => {
    renderPage(<ResetPassword />, '/reset-password', session)
    expect(screen.getByText('Link inválido ou expirado.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
  })

  it('com evento de recuperação chama updateUser e vai para /', async () => {
    const clearPasswordRecovery = vi.fn()
    const user = userEvent.setup()
    renderPage(<ResetPassword />, '/reset-password', { ...signedIn, passwordRecovery: true, clearPasswordRecovery })
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-1')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'nova-senha-1')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'nova-senha-1' })
    expect(clearPasswordRecovery).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: 'Destino inicial' })).toBeInTheDocument()
  })

  it('valida tamanho e confirmação antes de chamar updateUser', async () => {
    const user = userEvent.setup()
    renderPage(<ResetPassword />, '/reset-password', { ...signedIn, passwordRecovery: true })
    await user.type(screen.getByLabelText('Nova senha'), 'curta')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'curta')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument()
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('Onboarding', () => {
  const session = (extra = {}) => ({ ...signedIn, needsOnboarding: true, refresh: vi.fn(async () => {}), ...extra })

  it('"Entrar na empresa do meu e-mail" chama join_organization_by_domain e depois refresh', async () => {
    const value = session()
    renderPage(<Onboarding />, '/onboarding', value)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar na empresa do meu e-mail' }))
    expect(client.rpc).toHaveBeenCalledWith('join_organization_by_domain', undefined)
    expect(value.refresh).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: 'Destino inicial' })).toBeInTheDocument()
  })

  it('"Criar empresa" chama create_organization com nome e domínio', async () => {
    const value = session()
    const user = userEvent.setup()
    renderPage(<Onboarding />, '/onboarding', value)
    await user.type(screen.getByLabelText('Nome da empresa'), ' Empresa Teste ')
    await user.type(screen.getByLabelText('Domínio (opcional)'), 'exemplo.test')
    await user.click(screen.getByRole('button', { name: 'Criar empresa' }))
    expect(client.rpc).toHaveBeenCalledWith('create_organization', { p_name: 'Empresa Teste', p_domain: 'exemplo.test' })
    expect(value.refresh).toHaveBeenCalledOnce()
  })

  it('domínio vazio é enviado como null', async () => {
    const user = userEvent.setup()
    renderPage(<Onboarding />, '/onboarding', session())
    await user.type(screen.getByLabelText('Nome da empresa'), 'Empresa Teste')
    await user.click(screen.getByRole('button', { name: 'Criar empresa' }))
    expect(client.rpc).toHaveBeenCalledWith('create_organization', { p_name: 'Empresa Teste', p_domain: null })
  })

  it.each([
    ['join', 'CX002', 'Confirme o seu e-mail antes de entrar em uma empresa.'],
    ['create', 'CX002', 'Confirme o seu e-mail antes de criar uma empresa.'],
    ['join', 'CX003', 'Você já está vinculado a uma empresa.'],
    ['create', 'CX004', 'O nome da empresa deve ter entre 2 e 120 caracteres.'],
    ['create', 'CX005', 'O domínio da empresa deve ser o mesmo do seu e-mail verificado.'],
    ['create', 'CX006', 'Domínios de e-mail públicos não podem ser usados como domínio da empresa.'],
    ['create', 'CX007', 'Este domínio já pertence a outra empresa.'],
    ['create', 'CX008', 'Domínio em formato inválido.'],
    ['join', 'CX009', 'Nenhuma empresa cadastrada para o domínio do seu e-mail.'],
    ['join', 'PGRST301', 'Não foi possível concluir. Tente novamente.'],
    ['create', undefined, 'Não foi possível concluir. Tente novamente.'],
  ])('%s com %s mostra "%s" e não chama refresh', async (action, code, message) => {
    client.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'mensagem do servidor' } })
    const value = session()
    const user = userEvent.setup()
    renderPage(<Onboarding />, '/onboarding', value)
    if (action === 'join') {
      await user.click(screen.getByRole('button', { name: 'Entrar na empresa do meu e-mail' }))
    } else {
      await user.type(screen.getByLabelText('Nome da empresa'), 'Empresa Teste')
      await user.click(screen.getByRole('button', { name: 'Criar empresa' }))
    }
    expect(await screen.findByText(message)).toHaveAttribute('aria-live', 'polite')
    expect(value.refresh).not.toHaveBeenCalled()
  })

  it('desabilita os botões durante o envio', async () => {
    let resolve
    client.rpc.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    renderPage(<Onboarding />, '/onboarding', session())
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar na empresa do meu e-mail' }))
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Criar empresa' })).toBeDisabled()
    resolve({ data: null, error: { code: 'CX009' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar empresa' })).toBeEnabled())
  })

  it('"Sair" chama onSignOut', async () => {
    const onSignOut = vi.fn()
    renderPage(<Onboarding />, '/onboarding', session({ onSignOut }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
