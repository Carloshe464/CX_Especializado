import { BADGE_BASE, DIAGNOSIS_LABELS } from '@/lib/cx'
import { cn } from '@/lib/utils'

const styles = {
  pendente: 'border-amber-200 bg-amber-50 text-amber-800',
  aprovado: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejeitado: 'border-red-200 bg-red-50 text-red-800',
}

export default function CurationCard({ evaluation }) {
  const status = evaluation.diagnosis_status || 'pendente'
  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-xl font-semibold">Curadoria</h2>
      <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, styles[status])}>{DIAGNOSIS_LABELS[status]}</span></div>
      {status === 'pendente' && <p className="text-sm text-muted-foreground">Aguardando revisão do supervisor.</p>}
      {evaluation.supervisor_review && <div><h3 className="text-sm font-medium">Parecer do supervisor</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{evaluation.supervisor_review}</p></div>}
    </section>
  )
}
