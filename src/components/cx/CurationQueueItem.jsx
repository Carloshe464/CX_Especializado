import { Link } from 'react-router-dom'
import { BADGE_BASE, TREND_STYLES, formatDate } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function CurationQueueItem({ evaluation }) {
  const { id, protocol, analystName, channel, createdAt, trend,
    pendingOpportunities, analystFlaggedNotUseful } = evaluation
  const title = protocol?.trim()
  const meta = [analystName?.trim() || 'Analista não informado', channel?.trim(), createdAt && formatDate(createdAt)]
    .filter(Boolean).join(' · ')

  return (
    <Link
      to={`/avaliacao/${id}`}
      className="block min-w-0 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 className={cn('break-words font-heading text-lg font-semibold', !title && 'text-muted-foreground')}>
        {title || 'Sem protocolo'}
      </h3>
      <p className="mt-1 break-words text-sm text-muted-foreground">{meta}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {trend && <span className={cn(BADGE_BASE, TREND_STYLES[trend])}>{trend}</span>}
        <span className={cn(BADGE_BASE, 'border-border bg-secondary text-secondary-foreground')}>
          {pendingOpportunities === 0
            ? 'Sem oportunidades pendentes'
            : `${pendingOpportunities} oportunidade${pendingOpportunities === 1 ? '' : 's'} pendente${pendingOpportunities === 1 ? '' : 's'}`}
        </span>
        {analystFlaggedNotUseful && (
          <span className={cn(BADGE_BASE, 'border-destructive/40 bg-destructive/10 text-destructive')}>
            Analista marcou como não útil
          </span>
        )}
      </div>
    </Link>
  )
}
