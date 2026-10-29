import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import PageHeader from '@/components/cx/PageHeader'
import EmptyState from '@/components/cx/EmptyState'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import CurationQueueItem from '@/components/cx/CurationQueueItem'
import { Button } from '@/components/ui/button'
import { BADGE_BASE, DIAGNOSIS_LABELS, formatDate } from '@/lib/cx'
import { cn } from '@/lib/utils'
import { listCurationQueue, listRecentCuration } from '@/services/curation'

function QueryError({ retry }) {
  return (
    <div role="alert" className="rounded-2xl border border-border p-6 text-center">
      <p>Não foi possível carregar a curadoria.</p>
      <Button variant="outline" className="mt-4" onClick={() => void retry()}>
        Tentar novamente
      </Button>
    </div>
  )
}

function QueueContent({ query }) {
  if (query.isError) return <QueryError retry={query.refetch} />
  if (query.isPending) return <LoadingSpinner />
  if (query.data.length === 0) {
    return <EmptyState icon={ShieldCheck} title="Nenhuma análise aguardando curadoria" description="Quando a IA analisar um atendimento, ele aparece aqui." />
  }
  return (
    <>
      <ul className="space-y-3" aria-label="Fila de curadoria">
        {query.data.map((evaluation) => (
          <li className="min-w-0" key={evaluation.id}>
            <CurationQueueItem evaluation={evaluation} />
          </li>
        ))}
      </ul>
      {query.data.length === 200 && (
        <p className="mt-4 text-sm text-muted-foreground">Mostrando as 200 análises mais antigas.</p>
      )}
    </>
  )
}

function RecentContent({ query }) {
  if (query.isError) return <QueryError retry={query.refetch} />
  if (query.isPending) return <LoadingSpinner />
  if (query.data.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma curadoria concluída ainda.</p>
  return (
    <ul className="space-y-2" aria-label="Curadoria recente">
      {query.data.map(({ id, protocol, analystName, diagnosisStatus, decidedAt }) => (
        <li key={id} className="min-w-0">
          <Link
            to={`/avaliacao/${id}`}
            className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block break-words font-semibold">{protocol?.trim() || 'Sem protocolo'}</span>
              <span className="block break-words text-sm text-muted-foreground">
                {analystName?.trim() || 'Analista não informado'} · {formatDate(decidedAt)}
              </span>
            </span>
            {diagnosisStatus && (
              <span className={cn(BADGE_BASE, diagnosisStatus === 'aprovado'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-destructive/40 bg-destructive/10 text-destructive')}>
                {DIAGNOSIS_LABELS[diagnosisStatus] ?? diagnosisStatus}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function Curation() {
  const queue = useQuery({ queryKey: ['curation', 'queue'], queryFn: listCurationQueue })
  const recent = useQuery({ queryKey: ['curation', 'recent'], queryFn: listRecentCuration })

  return (
    <>
      <PageHeader title="Curadoria" description="Revise as análises da IA antes de liberá-las como referência" />
      <section aria-labelledby="curation-queue-heading" className="mb-10">
        <h2 id="curation-queue-heading" className="mb-4 font-heading text-xl font-semibold">
          Em curadoria ({queue.data?.length ?? 0})
        </h2>
        <QueueContent query={queue} />
      </section>
      <section aria-labelledby="curation-recent-heading">
        <h2 id="curation-recent-heading" className="mb-4 font-heading text-xl font-semibold">Curadoria recente</h2>
        <RecentContent query={recent} />
      </section>
    </>
  )
}
