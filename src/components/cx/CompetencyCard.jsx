import { BADGE_BASE, CLASSIFICATION_STYLES, formatDecimal } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function CompetencyCard({ score }) {
  const classification = score.classification || 'Não avaliável'
  return (
    <article className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="break-words font-heading text-lg font-semibold">{score.competency}</h3>
      <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, CLASSIFICATION_STYLES[classification])}>{classification}</span></div>
      <p className="font-heading text-3xl font-semibold">{score.score == null ? 'Não avaliável' : `${formatDecimal(score.score)} de 10`}</p>
      {score.evidence && <blockquote className="whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-4 text-sm text-muted-foreground">{score.evidence}</blockquote>}
    </article>
  )
}
