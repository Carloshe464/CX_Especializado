import { render, screen } from '@testing-library/react'
import { ClipboardList } from 'lucide-react'
import { expect, it } from 'vitest'
import StatCard from '@/components/cx/StatCard'
import PageHeader from '@/components/cx/PageHeader'
import EmptyState from '@/components/cx/EmptyState'
import LoadingSpinner from '@/components/cx/LoadingSpinner'

it('StatCard exibe label, zero como valor válido e hint opcional', () => {
  const view = render(<StatCard label="Avaliações" value={0} hint="Neste mês" />)
  expect(screen.getByText('Avaliações')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('Neste mês')).toBeInTheDocument()
  view.rerender(<StatCard label="Total" value={12} />)
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.queryByText('Neste mês')).not.toBeInTheDocument()
})

it('PageHeader renderiza título semântico, kicker, descrição e ação', () => {
  const view = render(<PageHeader kicker="Protocolo V1.1" title="Avaliações" description="Descrição sintética" actions={<button>Nova avaliação</button>} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Avaliações' })).toBeInTheDocument()
  expect(screen.getByText('Protocolo V1.1')).toBeInTheDocument()
  expect(screen.getByText('Descrição sintética')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nova avaliação' })).toBeInTheDocument()
  view.rerender(<PageHeader title="Só título" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('EmptyState renderiza ícone decorativo, título, descrição e ação', () => {
  const { container, rerender } = render(<EmptyState icon={ClipboardList} title="Nenhuma avaliação" description="Comece uma avaliação." action={<button>Criar avaliação</button>} />)
  expect(screen.getByRole('heading', { name: 'Nenhuma avaliação' })).toBeInTheDocument()
  expect(screen.getByText('Comece uma avaliação.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeInTheDocument()
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  rerender(<EmptyState title="Vazio" />)
  expect(container.querySelector('svg')).not.toBeInTheDocument()
})

it('LoadingSpinner anuncia label padrão e personalizado com role status', () => {
  const view = render(<LoadingSpinner />)
  expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  view.rerender(<LoadingSpinner label="Preparando avaliação…" />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparando avaliação…')
})
