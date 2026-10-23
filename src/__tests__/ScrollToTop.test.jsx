import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import ScrollToTop from '@/components/ScrollToTop'

it('rola ao montar e ao mudar pathname, sem rolar por mudança apenas da query', () => {
  window.scrollTo.mockClear()
  render(
    <MemoryRouter initialEntries={['/avaliacoes']}>
      <ScrollToTop />
      <Link to="/curadoria">Curadoria</Link>
      <Link to="/curadoria?filtro=pendente">Filtrar</Link>
    </MemoryRouter>,
  )
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  expect(window.scrollTo).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('link', { name: 'Curadoria' }))
  expect(window.scrollTo).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('link', { name: 'Filtrar' }))
  expect(window.scrollTo).toHaveBeenCalledTimes(2)
})
