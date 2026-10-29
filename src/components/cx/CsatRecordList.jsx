import { csatBand, formatDate } from '@/lib/cx'

export default function CsatRecordList({ records, threshold = 4 }) {
  if (!records.length) return <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhuma avaliação real do cliente registrada.</p>
  return (
    <ul className="min-w-0 space-y-3">
      {records.map((record) => <li key={record.id} className="min-w-0 space-y-2 rounded-2xl border border-border bg-card p-5">
        <p className="font-heading text-2xl font-semibold">{record.score == null ? 'Sem nota' : `${record.score} / 5`}</p>
        {record.score != null && <p className="text-sm font-medium">{csatBand(record.score, threshold)}</p>}
        <p className="break-words text-xs text-muted-foreground">{record.source}{record.score != null && record.score_origin !== 'real' && ' · nota derivada'}</p>
        {record.comment && <p className="whitespace-pre-wrap break-words text-sm">{record.comment}</p>}
        {record.reason && <p className="whitespace-pre-wrap break-words text-sm">Motivo: {record.reason}</p>}
        {record.themes?.length > 0 && <p className="break-words text-sm">Temas: {Array.isArray(record.themes) ? record.themes.join(' · ') : record.themes}</p>}
        <p className="text-xs text-muted-foreground">{formatDate(record.created_at)}</p>
      </li>)}
    </ul>
  )
}
