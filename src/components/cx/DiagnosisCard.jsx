import { BADGE_BASE, TREND_STYLES } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function DiagnosisCard({ run, children }) {
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-xl font-semibold">Diagnóstico da IA</h2>
      {run.trend && <div className="space-y-2"><p className="text-xs uppercase tracking-widest text-muted-foreground">Tendência de satisfação</p>
        <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, TREND_STYLES[run.trend])}>{run.trend}</span></div></div>}
      {run.summary_feedback && <p className="whitespace-pre-wrap break-words text-sm">{run.summary_feedback}</p>}
      {run.strengths && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><h3 className="text-xs uppercase tracking-widest">Pontos fortes</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{run.strengths}</p></div>}
      {run.uncertainties && <div><h3 className="text-sm font-medium">Incertezas</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{run.uncertainties}</p></div>}
      {children}
    </section>
  )
}
