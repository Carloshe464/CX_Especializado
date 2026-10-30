import { BADGE_BASE, OPPORTUNITY_DECISION_LABELS, OPPORTUNITY_DECISION_STYLES, SEVERITY_STYLES } from '@/lib/cx'
import { cn } from '@/lib/utils'

export default function OpportunityCard({ opportunity: item, children }) {
  const decided = item.status && item.status !== 'pendente'
  const fields = [
    ['Impacto', item.impact],
    [item.status === 'ajustada' ? 'Recomendação original da IA' : 'Recomendação', item.recommendation],
    ['Exemplo melhorado', item.improved_example],
  ]
  return (
    <article className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {item.severity && <span className={cn(BADGE_BASE, SEVERITY_STYLES[item.severity])}>{item.severity}</span>}
        {item.origin && <span className={cn(BADGE_BASE, 'bg-secondary')}>{item.origin}</span>}
        {item.confidence && <span className={BADGE_BASE}>Confiança: {item.confidence}</span>}
      </div>
      <h3 className="break-words font-heading text-lg font-semibold">{item.description}</h3>
      {item.evidence && <blockquote className="whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-4 text-sm text-muted-foreground">{item.evidence}</blockquote>}
      {fields.map(([label, text]) => text && <div key={label}><h4 className="text-sm font-medium">{label}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{text}</p></div>)}
      {item.communication_techniques?.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Técnicas de comunicação">{item.communication_techniques.map((technique) => <span key={technique} className={cn(BADGE_BASE, 'bg-secondary')}>{technique}</span>)}</div>}
      {decided && <div className="space-y-3 rounded-xl bg-secondary p-4">
        <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, OPPORTUNITY_DECISION_STYLES[item.status])}>{OPPORTUNITY_DECISION_LABELS[item.status]}</span></div>
        {item.supervisor_note && <div><h4 className="text-sm font-medium">Nota do supervisor</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.supervisor_note}</p></div>}
        {item.status === 'ajustada' && item.adjusted_recommendation && <div><h4 className="text-sm font-medium">Recomendação ajustada pelo supervisor</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.adjusted_recommendation}</p></div>}
      </div>}
      {children}
    </article>
  )
}
