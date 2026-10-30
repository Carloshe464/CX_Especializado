import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session'
import { getEvaluationDetail } from '@/services/evaluationDetail'
import { getCsatThresholds, updateEvaluationTranscript } from '@/services/evaluations'
import { average, BADGE_BASE, COMPETENCIES, formatDate, formatDecimal, STATUS_LABELS, STATUS_STYLES } from '@/lib/cx'
import { isOrgManager } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import LoadingSpinner from '@/components/cx/LoadingSpinner'
import StatCard from '@/components/cx/StatCard'
import CompetencyCard from '@/components/cx/CompetencyCard'
import DiagnosisCard from '@/components/cx/DiagnosisCard'
import CurationCard from '@/components/cx/CurationCard'
import OpportunityCard from '@/components/cx/OpportunityCard'
import AnalystValidation from '@/components/cx/AnalystValidation'
import OpportunityDecisionForm from '@/components/cx/OpportunityDecisionForm'
import DiagnosisDecisionForm from '@/components/cx/DiagnosisDecisionForm'
import PrintGallery from '@/components/cx/PrintGallery'
import CsatRecordList from '@/components/cx/CsatRecordList'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

function Transcript({ evaluation }) {
  const session = useSession()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [text, setText] = useState(evaluation.transcript ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sending = useRef(false)
  const manager = isOrgManager(session, evaluation.organization_id)
  const editable = ['rascunho', 'transcrito'].includes(evaluation.status) && Boolean(session.user?.id) &&
    (manager || evaluation.created_by === session.user.id || evaluation.analyst_user_id === session.user.id)
  async function save() {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      await updateEvaluationTranscript({ id: evaluation.id, transcript: text })
      toast({ title: 'Transcrição salva.' })
      void queryClient.invalidateQueries({ queryKey: ['evaluation', evaluation.id] })
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] })
    } catch (failure) { setError(failure.message) }
    finally { sending.current = false; setBusy(false) }
  }
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-xl font-semibold">Transcrição</h2>
      {editable ? <>
        <Textarea aria-label="Transcrição do atendimento" className="min-h-72 font-mono" value={text} disabled={busy} onChange={(event) => setText(event.target.value)} />
        <Button type="button" disabled={busy || text === (evaluation.transcript ?? '')} onClick={save}>{busy ? 'Salvando…' : 'Salvar transcrição'}</Button>
      </> : <pre className="whitespace-pre-wrap break-words font-mono text-sm">{evaluation.transcript || 'Nenhuma transcrição registrada.'}</pre>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div><Button type="button" disabled aria-describedby="analysis-coming-soon">Analisar com a IA</Button>
        <p id="analysis-coming-soon" className="mt-1 text-xs text-muted-foreground">Disponível em breve</p>
      </div>
    </section>
  )
}

export default function EvaluationDetail() {
  const { id } = useParams()
  const session = useSession()
  const detail = useQuery({ queryKey: ['evaluation', id], queryFn: () => getEvaluationDetail(id) })
  const thresholds = useQuery({ queryKey: ['app_settings', 'csat_positive_threshold'], queryFn: getCsatThresholds })
  if (detail.isPending) return <LoadingSpinner />
  if (detail.isError) return <div role="alert" className="space-y-4"><h1 className="font-heading text-3xl font-semibold">Avaliação</h1><p>Não foi possível carregar a avaliação.</p><Button onClick={() => detail.refetch()}>Tentar novamente</Button></div>
  if (!detail.data) return <div className="space-y-4"><h1 className="font-heading text-3xl font-semibold">Avaliação</h1><p>Avaliação não encontrada ou você não tem acesso a ela.</p><Link to="/avaliacoes" className="underline">Voltar para Avaliações</Link></div>
  const { evaluation, run, scores, opportunities, feedback, csatRecords, files } = detail.data
  const threshold = thresholds.data?.[evaluation.organization_id] ?? 4
  const mean = average(scores.map(({ score }) => score))
  const analyzed = run?.status === 'sucesso'
  const manager = isOrgManager(session, evaluation.organization_id)
  const meta = [evaluation.analyst_name && `Analista ${evaluation.analyst_name}`, evaluation.channel, evaluation.created_at && formatDate(evaluation.created_at)].filter(Boolean).join(' · ')
  const validation = (target, opportunityId = null) => <AnalystValidation evaluation={evaluation} runId={run.id} target={target} opportunityId={opportunityId} feedback={feedback} />
  return (
    <div className="min-w-0 space-y-8 [overflow-wrap:anywhere]">
      <header className="min-w-0 space-y-3">
        <Link to="/avaliacoes" className="text-sm text-muted-foreground underline">← Avaliações</Link>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{run ? `PROTOCOLO ${run.prompt_version}` : 'PROTOCOLO CX'}</p>
        <h1 className="break-words font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{evaluation.protocol || 'Atendimento'}</h1>
        {meta && <p className="break-words text-sm text-muted-foreground">{meta}</p>}
        <div className="flex flex-wrap gap-2"><span className={cn(BADGE_BASE, STATUS_STYLES[evaluation.status])}>{STATUS_LABELS[evaluation.status]}</span></div>
      </header>
      <div className="grid min-w-0 gap-4 sm:grid-cols-3">
        <StatCard label="Média das competências" value={mean === null ? '—' : `${formatDecimal(mean)} / 10`} />
        <StatCard label="Oportunidades" value={opportunities.length} />
        <StatCard label="Transcrição revisada" value={evaluation.transcript?.trim() ? 'Sim' : 'Não'} />
      </div>
      {analyzed ? <>
        <div className="grid min-w-0 gap-6 xl:grid-cols-3">
          <section className="min-w-0 space-y-4 xl:col-span-2"><h2 className="font-heading text-xl font-semibold">Competências</h2>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">{COMPETENCIES.map((competency) => <CompetencyCard key={competency} score={scores.find((score) => score.competency === competency) ?? { competency, score: null }} />)}</div>
          </section>
          <div className="min-w-0 space-y-6">
            <DiagnosisCard run={run}>{validation('diagnostico')}</DiagnosisCard>
            <CurationCard evaluation={evaluation}>
              {manager && <DiagnosisDecisionForm evaluation={{ id: evaluation.id, status: evaluation.status, diagnosisStatus: evaluation.diagnosis_status }} />}
            </CurationCard>
            <section className="min-w-0 space-y-4"><h2 className="font-heading text-xl font-semibold">Satisfação real</h2><CsatRecordList records={csatRecords} threshold={threshold} /></section>
          </div>
        </div>
        <section className="min-w-0 space-y-4"><h2 className="font-heading text-xl font-semibold">Oportunidades de melhoria</h2>
          {opportunities.length ? opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity}>
            {manager && <OpportunityDecisionForm opportunity={opportunity} evaluationId={evaluation.id} />}
            {validation('oportunidade', opportunity.id)}
          </OpportunityCard>) : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">A IA não identificou oportunidades relevantes neste atendimento.</p>}
        </section>
      </> : <>
        {run?.status === 'em_andamento' && <p role="status">A análise está em andamento.</p>}
        {run?.status === 'falha' && <p role="status">A última análise não foi concluída.</p>}
        <PrintGallery key={evaluation.id} evaluation={evaluation} files={files} />
        <Transcript key={JSON.stringify([evaluation.id, evaluation.transcript, evaluation.status])} evaluation={evaluation} />
        <section className="min-w-0 space-y-4"><h2 className="font-heading text-xl font-semibold">Avaliação real do cliente</h2><CsatRecordList records={csatRecords} threshold={threshold} /></section>
      </>}
    </div>
  )
}
