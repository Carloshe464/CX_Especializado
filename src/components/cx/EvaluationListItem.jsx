import { Link } from 'react-router-dom'
import { BADGE_BASE, STATUS_LABELS, STATUS_STYLES, TREND_STYLES, csatBand, formatDate } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function EvaluationListItem({ evaluation, threshold }) {
  const { id, protocol, analystName, channel, status, createdAt, trend, realScore } = evaluation
  const title = protocol?.trim()
  const meta = [analystName?.trim() || 'Analista não informado', channel?.trim(), createdAt && formatDate(createdAt)]
    .filter(Boolean).join(' · ')

  return (
    <Link
      to={`/avaliacao/${id}`}
      className="block min-w-0 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h2 className={cn('break-words font-heading text-lg font-semibold', !title && 'text-muted-foreground')}>
        {title || 'Sem protocolo'}
      </h2>
      <p className="mt-1 break-words text-sm text-muted-foreground">{meta}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={cn(BADGE_BASE, STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
        {trend && <span className={cn(BADGE_BASE, TREND_STYLES[trend])}>{trend}</span>}
        {realScore != null && (
          <span className={cn(BADGE_BASE, 'bg-secondary text-secondary-foreground border-border')}>
            Nota real: {realScore} · {csatBand(realScore, threshold)}
          </span>
        )}
      </div>
    </Link>
  )
}
