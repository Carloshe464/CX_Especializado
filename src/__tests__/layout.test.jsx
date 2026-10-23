import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/SessionContext'
import { useSession } from '@/auth/session'
import Layout from '@/components/cx/Layout'
import { visibleNavItems } from '@/components/cx/navigation'

const managers = ['Painel', 'Avaliações', 'Nova avaliação', 'Curadoria', 'Satisfação', 'Protocolo']
const analysts = ['Avaliações', 'Nova avaliação', 'Meu desenvolvimento']
const anonymous = ['Avaliações', 'Nova avaliação']
const roles = [
  ['supervisor', managers, 'SUPERVISOR'],
  ['platform_admin', managers, 'ADMIN GERAL'],
  ['analista', analysts, 'ANALISTA'],
]

function renderLayout(value) {
  return render(
    <SessionProvider value={value}>
      <MemoryRouter initialEntries={['/avaliacoes']}>
        <Routes><Route element={<Layout />}><Route path="/avaliacoes" element={<h1>Avaliações</h1>} /></Route></Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('navegação declarativa', () => {
  it.each([...roles.map(([role, expected]) => [role, expected]), [null, anonymous]])(
    'lista exata e ordenada para %s', (role, expected) => {
      expect(visibleNavItems(role).map((item) => item.label)).toEqual(expected)
      expect(visibleNavItems(role).map((item) => item.to)).toEqual(
        role === null ? ['/avaliacoes', '/nova-avaliacao']
          : role === 'analista' ? ['/avaliacoes', '/nova-avaliacao', '/meu-desenvolvimento']
            : ['/', '/avaliacoes', '/nova-avaliacao', '/curadoria', '/satisfacao', '/protocolo'],
      )
    },
  )
})

describe('Layout', () => {
  it.each(roles)('%s mostra menus, e-mail e rótulo corretos', (role, expected, label) => {
    renderLayout({ user: { email: 'analista@exemplo.test' }, role })
    for (const name of ['Navegação principal (desktop)', 'Navegação principal (celular)']) {
      const nav = screen.getByRole('navigation', { name })
      expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(expected)
      expect(within(nav).getByRole('link', { name: 'Avaliações' })).toHaveAttribute('aria-current', 'page')
      expect(within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1)
    }
    expect(screen.getByText('analista@exemplo.test')).toHaveClass('truncate')
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Avaliações' })).toBeInTheDocument()
  })

  it('marca o item ativo com os estilos desktop e celular', () => {
    renderLayout({ user: null, role: null })
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal (desktop)' }))
      .getByRole('link', { name: 'Avaliações' })).toHaveClass('bg-accent', 'text-accent-foreground')
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal (celular)' }))
      .getByRole('link', { name: 'Avaliações' })).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('sem sessão exibe só navegação pública de apresentação e nenhum botão Sair', () => {
    renderLayout()
    expect(screen.getByText('Sessão não iniciada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Navegação principal (desktop)' }))
      .getAllByRole('link').map((link) => link.textContent)).toEqual(anonymous)
  })

  it('Sair chama somente o callback recebido pelo contexto', async () => {
    const onSignOut = vi.fn()
    renderLayout({ user: { email: 'analista@exemplo.test' }, role: 'analista', onSignOut })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(screen.getByText('analista@exemplo.test')).toBeInTheDocument()
  })
})

function SessionProbe() {
  const { user, role, onSignOut } = useSession()
  return <button onClick={onSignOut}>{JSON.stringify({ user, role })}</button>
}

it('provider padrão e hook sem provider usam user/role nulos e callback inerte', async () => {
  const first = render(<SessionProvider><SessionProbe /></SessionProvider>)
  const button = screen.getByRole('button', { name: '{"user":null,"role":null}' })
  await userEvent.setup().click(button)
  expect(button).toBeInTheDocument()
  first.unmount()
  render(<SessionProbe />)
  expect(screen.getByRole('button')).toHaveTextContent('{"user":null,"role":null}')
})
