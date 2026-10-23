import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/App'

const routes = [
  ['/login', 'Entrar', false],
  ['/register', 'Criar conta', false],
  ['/forgot-password', 'Esqueci minha senha', false],
  ['/reset-password', 'Redefinir senha', false],
  ['/pesquisa/token-ficticio', 'Pesquisa de satisfação', false],
  ['/', 'Painel', true],
  ['/avaliacoes', 'Avaliações', true],
  ['/nova-avaliacao', 'Nova avaliação', true],
  ['/avaliacao/id-ficticio', 'Avaliação', true],
  ['/curadoria', 'Curadoria', true],
  ['/meu-desenvolvimento', 'Meu desenvolvimento', true],
  ['/satisfacao', 'Satisfação', true],
  ['/protocolo', 'Protocolo', true],
  ['/rota-inexistente', 'Página não encontrada', false],
]

describe('rotas provisórias', () => {
  it.each(routes)('%s renderiza %s com o layout esperado', (path, title, hasLayout) => {
    render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByText('Em construção.')).toBeInTheDocument()
    expect(Boolean(screen.queryByRole('main'))).toBe(hasLayout)
  })

  it('o botão da 404 navega para o painel como link acessível', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/inexistente']}><AppRoutes /></MemoryRouter>)
    const link = screen.getByRole('link', { name: 'Voltar para o painel' })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveClass('bg-primary')
    await user.click(link)
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  })
})
