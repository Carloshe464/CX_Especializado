import { BADGE_BASE, DIAGNOSIS_LABELS, DIAGNOSIS_STYLES } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function CurationCard({ evaluation, children }) {
  const status = evaluation.diagnosis_status || 'pendente'
  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-xl font-semibold">Curadoria</h2>
      <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, DIAGNOSIS_STYLES[status])}>{DIAGNOSIS_LABELS[status]}</span></div>
      {status === 'pendente' && <p className="text-sm text-muted-foreground">Aguardando revisão do supervisor.</p>}
      {evaluation.supervisor_review && <div><h3 className="text-sm font-medium">Parecer do supervisor</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{evaluation.supervisor_review}</p></div>}
      {children}
    </section>
  )
}
