import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '@/App'

vi.mock('@/lib/supabaseClient', () => ({
  supabaseConfigError: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local.',
  supabase: null,
}))

afterEach(() => vi.unstubAllEnvs())

it('continua funcionando sem configuração e informa o desenvolvedor', () => {
  vi.stubEnv('DEV', true)
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Configure VITE_SUPABASE_URL')
})

it('não exibe o aviso de configuração em produção', () => {
  vi.stubEnv('DEV', false)
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
