import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '@/App'

vi.mock('@/lib/supabaseClient', () => ({
  supabaseConfigError: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local.',
  supabase: null,
}))

afterEach(() => {
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

it('sem configuração leva ao login e informa o desenvolvedor', () => {
  vi.stubEnv('DEV', true)
  render(<App />)
  expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/login')
  expect(screen.getByText(/Configure VITE_SUPABASE_URL/, { selector: 'div[role="status"]' })).toBeInTheDocument()
})

it('não exibe o aviso de configuração em produção', () => {
  vi.stubEnv('DEV', false)
  render(<App />)
  expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  expect(screen.queryByText(/Configure VITE_SUPABASE_URL/)).not.toBeInTheDocument()
})

it('sem configuração não inventa usuário nem papel', () => {
  render(<App />)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  expect(screen.queryByText(/SUPERVISOR|ANALISTA|ADMIN GERAL/)).not.toBeInTheDocument()
})
