import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { curationErrorMessage, decideOpportunity } from '@/services/curation'

export default function OpportunityDecisionForm({ opportunity, evaluationId, onDecided }) {
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const [mode, setMode] = useState(null)
  const [note, setNote] = useState('')
  const [adjusted, setAdjusted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [decided, setDecided] = useState(false)

  if (decided || opportunity?.status !== 'pendente') return null

  async function submit(decision) {
    if (busyRef.current) return
    const normalizedNote = note.trim()
    if ((decision === 'ajustada' || decision === 'rejeitada') && !normalizedNote) {
      setError(decision === 'ajustada' ? 'Informe a nota do supervisor.' : 'Informe a justificativa.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await decideOpportunity({
        opportunityId: opportunity.id,
        decision,
        note: decision === 'aprovada' ? null : normalizedNote,
        adjusted: decision === 'ajustada' ? adjusted.trim() || null : null,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evaluation', evaluationId] }),
        queryClient.invalidateQueries({ queryKey: ['evaluations'] }),
        queryClient.invalidateQueries({ queryKey: ['curation'] }),
      ])
      toast({ title: 'Decisão registrada.' })
      setDecided(true)
      onDecided?.()
      setMode(null)
    } catch (cause) {
      setError(curationErrorMessage(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function cancel() {
    setMode(null)
    setError('')
  }

  return (
    <div className="min-w-0 space-y-3">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void submit('aprovada')}>{busy ? 'Salvando…' : 'Aprovar'}</Button>
          <Button disabled={busy} variant="outline" onClick={() => { setError(''); setMode('ajustada') }}>Ajustar</Button>
          <Button disabled={busy} variant="destructive" onClick={() => { setError(''); setMode('rejeitada') }}>Rejeitar</Button>
        </div>
      ) : (
        <div className="min-w-0 space-y-3 rounded-xl border border-border p-4">
          <div className="space-y-1">
            <Label htmlFor={`curation-note-${opportunity.id}`}>
              {mode === 'ajustada' ? 'Nota do supervisor' : 'Justificativa'}
            </Label>
            <Textarea
              id={`curation-note-${opportunity.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              disabled={busy}
              required
            />
          </div>
          {mode === 'ajustada' && (
            <div className="space-y-1">
              <Label htmlFor={`curation-adjusted-${opportunity.id}`}>Recomendação ajustada (opcional)</Label>
              <Textarea
                id={`curation-adjusted-${opportunity.id}`}
                value={adjusted}
                onChange={(event) => setAdjusted(event.target.value)}
                maxLength={2000}
                disabled={busy}
                aria-describedby={`curation-hint-${opportunity.id}`}
              />
              <p id={`curation-hint-${opportunity.id}`} className="text-xs text-muted-foreground">
                Deixe em branco para manter a recomendação da IA.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void submit(mode)}>
              {busy ? 'Salvando…' : mode === 'ajustada' ? 'Salvar ajuste' : 'Confirmar rejeição'}
            </Button>
            <Button disabled={busy} variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
