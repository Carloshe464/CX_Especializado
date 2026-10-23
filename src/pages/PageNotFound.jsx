import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function PageNotFound() {
  return (
    <>
      <h1>Página não encontrada</h1>
      <p>Em construção.</p>
      <Button asChild><Link to="/">Voltar para o painel</Link></Button>
    </>
  )
}

