import { useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session'
import { isOrgManager } from '@/lib/permissions'
import { saveAnalystFeedback, feedbackErrorMessage } from '@/services/evaluationDetail'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

const COPY = Object.freeze({
  analista: { legend: 'Validação do analista', send: 'Enviar validação', update: 'Atualizar validação', saved: 'Validação salva.' },
  supervisor: { legend: 'Sua avaliação da orientação', send: 'Enviar avaliação', update: 'Atualizar avaliação', saved: 'Avaliação salva.' },
})

function findFeedback(feedback, role, target, opportunityId) {
  return feedback.find((item) => item.author_role === role && item.target_type === target && (item.opportunity_id ?? null) === opportunityId)
}

export default function AnalystValidation({ evaluation, runId, target, opportunityId = null, feedback = [] }) {
  const existing = findFeedback(feedback, 'analista', target, opportunityId)
  const session = useSession()
  const editable = session.role === 'analista' && Boolean(session.user?.id) && session.user.id === evaluation.analyst_user_id
  const form = (role, current) => <ValidationForm key={JSON.stringify([role, runId, target, opportunityId, current ?? null])} role={role} evaluationId={evaluation.id} runId={runId} target={target} opportunityId={opportunityId} existing={current} />
  // A chave atualiza o pré-preenchimento após refetch, sem apagar o formulário quando a RPC falha.
  if (editable) return form('analista', existing)
  const readOnly = (
    <div className="space-y-2 border-t border-border pt-4 text-sm">
      <p>{existing ? `Validação do analista: ${existing.liked ? 'Gostei' : 'Não gostei'} · ${existing.useful ? 'Útil' : 'Não útil'}` : 'O analista ainda não validou.'}</p>
      {existing?.comment && <p className="whitespace-pre-wrap break-words text-muted-foreground">{existing.comment}</p>}
    </div>
  )
  if (!isOrgManager(session, evaluation.organization_id)) return readOnly
  return <>{readOnly}{form('supervisor', findFeedback(feedback, 'supervisor', target, opportunityId))}</>
}

function ValidationForm({ role, evaluationId, runId, target, opportunityId, existing }) {
  const id = useId()
  const [liked, setLiked] = useState(existing?.liked ?? null)
  const [useful, setUseful] = useState(existing?.useful ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sending = useRef(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  async function submit(event) {
    event.preventDefault()
    if (sending.current || liked === null || useful === null || comment.length > 2000) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      await saveAnalystFeedback({ runId, target, opportunityId, liked, useful, comment })
      toast({ title: COPY[role].saved })
      void queryClient.invalidateQueries({ queryKey: ['evaluation', evaluationId] })
    } catch (failure) { setError(feedbackErrorMessage(failure)) }
    finally { sending.current = false; setBusy(false) }
  }

  return (
    <form aria-label={role === 'supervisor' ? (target === 'diagnostico' ? 'Sua avaliação do diagnóstico' : 'Sua avaliação da oportunidade') : target === 'diagnostico' ? 'Validação do diagnóstico' : 'Validação da oportunidade'} onSubmit={submit} className="min-w-0 space-y-4 border-t border-border pt-4">
      {role === 'supervisor' && <div className="space-y-1"><h3 className="text-sm font-semibold">{COPY.supervisor.legend}</h3>
        <p className="text-xs text-muted-foreground">Usada só na taxa de utilidade da IA. A decisão de curadoria é feita nos botões acima.</p>
      </div>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">{COPY[role].legend}</legend>
        {[
          ['liked', 'Você gostou desta orientação?', liked, setLiked, 'Gostei', 'Não gostei'],
          ['useful', 'Ela foi útil?', useful, setUseful, 'Útil', 'Não útil'],
        ].map(([name, label, value, change, yes, no]) => <div key={name} role="radiogroup" aria-labelledby={`${id}-${name}`} className="space-y-2">
          <p id={`${id}-${name}`} className="text-sm font-medium">{label}</p>
          <div className="flex flex-wrap gap-4">{[[true, yes], [false, no]].map(([choice, text]) => <label key={String(choice)} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`${id}-${name}`} value={String(choice)} checked={value === choice} onChange={() => change(choice)} className="accent-primary" />{text}
          </label>)}</div>
        </div>)}
        <div className="min-w-0 space-y-2"><label htmlFor={`${id}-comment`} className="text-sm font-medium">Comentário (opcional)</label>
          <Textarea id={`${id}-comment`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} aria-describedby={`${id}-count`} />
          <p id={`${id}-count`} className="text-xs text-muted-foreground">{comment.length} / 2000 caracteres</p>
        </div>
      </fieldset>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || liked === null || useful === null || comment.length > 2000}>{busy ? 'Enviando…' : existing ? COPY[role].update : COPY[role].send}</Button>
    </form>
  )
}
