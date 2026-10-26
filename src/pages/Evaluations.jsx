import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Upload } from 'lucide-react'
import PageHeader from '@/components/cx/PageHeader'
import EmptyState from '@/components/cx/EmptyState'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import EvaluationListItem from '@/components/cx/EvaluationListItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listEvaluations, getCsatThreshold } from '@/services/evaluations'

function normalizeSearch(value) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function Evaluations() {
  const [search, setSearch] = useState('')
  const evaluations = useQuery({ queryKey: ['evaluations'], queryFn: listEvaluations })
  const threshold = useQuery({ queryKey: ['app_settings', 'csat_positive_threshold'], queryFn: getCsatThreshold })
  const rows = evaluations.data ?? []
  const term = normalizeSearch(search.trim())
  const filtered = rows.filter((row) => [row.protocol, row.analystName, row.channel]
    .some((value) => normalizeSearch(value).includes(term)))
  const newEvaluation = <Button asChild><Link to="/nova-avaliacao"><Plus aria-hidden="true" />Nova avaliação</Link></Button>

  let content
  if (evaluations.isError || threshold.isError) {
    content = (
      <div role="alert" className="rounded-2xl border border-border p-6 text-center">
        <p>Não foi possível carregar as avaliações.</p>
        <Button variant="outline" className="mt-4" onClick={() => {
          void evaluations.refetch()
          void threshold.refetch()
        }}>Tentar novamente</Button>
      </div>
    )
  } else if (evaluations.isPending || threshold.isPending) {
    content = <LoadingSpinner />
  } else if (rows.length === 0) {
    content = <EmptyState icon={ClipboardList} title="Nenhuma avaliação ainda" description="Registre o primeiro atendimento para começar." action={newEvaluation} />
  } else if (filtered.length === 0) {
    content = (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="break-words">Nenhuma avaliação encontrada para “{search}”.</p>
        <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>Limpar busca</Button>
      </div>
    )
  } else {
    content = (
      <ul className="space-y-3" aria-label="Lista de avaliações">
        {filtered.map((evaluation) => (
          <li key={evaluation.id} className="min-w-0"><EvaluationListItem evaluation={evaluation} threshold={threshold.data} /></li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Atendimentos registrados e o andamento da análise"
        actions={<>
          {newEvaluation}
          <div>
            <Button variant="outline" disabled aria-describedby="import-coming-soon"><Upload aria-hidden="true" />Importar planilha</Button>
            <p id="import-coming-soon" className="mt-1 text-xs text-muted-foreground">Disponível em breve</p>
          </div>
        </>}
      />
      <Input type="search" aria-label="Buscar avaliações" placeholder="Buscar por protocolo, analista ou canal" value={search} onChange={(event) => setSearch(event.target.value)} className="mb-6" />
      {content}
      {!evaluations.isError && !threshold.isError && !evaluations.isPending && !threshold.isPending && rows.length === 200 && (
        <p className="mt-6 text-sm text-muted-foreground">Mostrando as 200 avaliações mais recentes.</p>
      )}
    </>
  )
}
