import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { curationErrorMessage, decideDiagnosis } from '@/services/curation'

export default function DiagnosisDecisionForm({ evaluation, onDecided }) {
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const [review, setReview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [decided, setDecided] = useState(false)

  if (decided || evaluation?.status !== 'analisado' ||
    (evaluation.diagnosisStatus != null && evaluation.diagnosisStatus !== 'pendente')) return null

  async function submit(decision) {
    if (busyRef.current) return
    const normalizedReview = review.trim()
    if (decision === 'rejeitado' && !normalizedReview) {
      setError('Informe o parecer para rejeitar.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await decideDiagnosis({ evaluationId: evaluation.id, decision, review: normalizedReview || null })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['evaluation', evaluation.id] }),
        queryClient.invalidateQueries({ queryKey: ['evaluations'] }),
        queryClient.invalidateQueries({ queryKey: ['curation'] }),
      ])
      toast({ title: 'Decisão registrada.' })
      setDecided(true)
      onDecided?.()
    } catch (cause) {
      setError(curationErrorMessage(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`diagnosis-review-${evaluation.id}`}>Parecer do supervisor</Label>
        <Textarea
          id={`diagnosis-review-${evaluation.id}`}
          value={review}
          onChange={(event) => setReview(event.target.value)}
          maxLength={2000}
          disabled={busy}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Ao decidir o diagnóstico, a curadoria desta avaliação é concluída.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void submit('aprovado')}>
          {busy ? 'Salvando…' : 'Aprovar diagnóstico'}
        </Button>
        <Button disabled={busy} variant="destructive" onClick={() => void submit('rejeitado')}>Rejeitar</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
