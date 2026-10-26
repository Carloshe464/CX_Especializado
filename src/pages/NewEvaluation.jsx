import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/session'
import { CHANNELS } from '@/lib/cx'
import { buildEvaluationPayload, createEvaluation } from '@/services/evaluations'
import { listOrgAnalysts } from '@/services/organizationMembers'
import { uploadEvaluationFile } from '@/services/evaluationFiles'
import PageHeader from '@/components/cx/PageHeader'
import PrintFilesField from '@/components/cx/PrintFilesField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function NewEvaluation() {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ protocol: '', channel: '', transcript: '' })
  const [analystId, setAnalystId] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState(null)
  const own = session.role === 'analista'
  const analysts = useQuery({
    queryKey: ['org_analysts', session.organizationId],
    queryFn: () => listOrgAnalysts(session.organizationId),
    enabled: Boolean(session.organizationId) && !own,
  })
  const analyst = analysts.data?.find(({ id }) => id === analystId)
  const canSubmit = Boolean(session.organizationId && (form.transcript.trim() || files.length) && (own || analyst) && !busy)
  function update(field, value) { setForm((previous) => ({ ...previous, [field]: value })) }

  async function submit(event) {
    event.preventDefault()
    if (sending.current || !canSubmit) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      const created = await createEvaluation(buildEvaluationPayload({ form, session, analyst, hasPrints: files.length > 0 }))
      let failed = 0
      for (const file of files) {
        try {
          await uploadEvaluationFile({ organizationId: created.organizationId, evaluationId: created.id, file })
        } catch { failed += 1 }
      }
      if (failed) toast({ title: `Avaliação criada, mas ${failed} arquivo(s) não foram enviados.` })
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      navigate('/avaliacao/' + created.id)
    } catch (failure) {
      if (failure.code === 'PROTOCOLO_DUPLICADO') {
        setError({
          message: failure.existingId
            ? `Já existe uma avaliação com o protocolo ${form.protocol.trim()}.`
            : 'Já existe uma avaliação com este protocolo na sua organização. Fale com o supervisor.',
          existingId: failure.existingId,
        })
      } else if (failure.code === '42501' || /row.level security|\bRLS\b/i.test(failure.message ?? '')) {
        setError({ message: 'Você não tem permissão para registrar esta avaliação.' })
      } else setError({ message: 'Não foi possível criar a avaliação. Tente novamente.' })
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Nova avaliação" description="Registre o atendimento para análise" />
      {!session.organizationId ? (
        <p role="alert">Para registrar avaliações, entre com um usuário vinculado a uma organização.</p>
      ) : (
        <form onSubmit={submit} aria-label="Nova avaliação" className="min-w-0 space-y-6">
          <fieldset disabled={busy} className="min-w-0 space-y-6">
            <legend className="sr-only">Dados do atendimento</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-2"><Label htmlFor="protocol">Protocolo</Label>
                <Input id="protocol" value={form.protocol} onChange={(event) => update('protocol', event.target.value)} />
              </div>
              <div className="min-w-0 space-y-2"><Label htmlFor="channel">Canal</Label>
                <Select value={form.channel} onValueChange={(value) => update('channel', value)} disabled={busy}>
                  <SelectTrigger id="channel"><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                  <SelectContent>{CHANNELS.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2"><Label htmlFor="analyst">Analista responsável</Label>
                {own ? <Input id="analyst" disabled value={session.user.fullName || session.user.email} /> : (
                  <Select value={analystId} onValueChange={setAnalystId} disabled={busy || analysts.isPending || analysts.isError} required>
                    <SelectTrigger id="analyst"><SelectValue placeholder={analysts.isPending ? 'Carregando analistas…' : 'Selecione o analista'} /></SelectTrigger>
                    <SelectContent>{analysts.data?.map(({ id, name }) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {!own && analysts.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum analista na organização ainda. Convide analistas para registrar avaliações.</p>}
                {!own && analysts.isError && <div role="alert" className="text-sm text-destructive">Não foi possível carregar os analistas. <Button type="button" variant="link" onClick={() => analysts.refetch()}>Tentar novamente</Button></div>}
              </div>
            </div>
            <Tabs defaultValue="text" className="min-w-0">
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="text" disabled={busy} className="min-w-0 whitespace-normal px-1">Colar conversa</TabsTrigger>
                <TabsTrigger value="prints" disabled={busy} className="min-w-0 whitespace-normal px-1">Prints do chat</TabsTrigger>
                <TabsTrigger value="sheet" disabled={busy} className="min-w-0 whitespace-normal px-1">Importar planilha</TabsTrigger>
              </TabsList>
              <TabsContent value="text"><Textarea aria-label="Transcrição do atendimento" className="min-h-72 font-mono" value={form.transcript} onChange={(event) => update('transcript', event.target.value)} /></TabsContent>
              <TabsContent value="prints"><PrintFilesField files={files} onChange={setFiles} disabled={busy} /></TabsContent>
              <TabsContent value="sheet" className="space-y-4"><p>A importação de planilhas chega em breve.</p><Button type="button" variant="outline" disabled>Importar planilha</Button></TabsContent>
            </Tabs>
          </fieldset>
          {error && <div role="alert" className="break-words text-sm text-destructive"><p>{error.message}</p>
            {error.existingId && <Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={'/avaliacao/' + error.existingId}>Abrir avaliação existente</Link>}
          </div>}
          <Button type="submit" disabled={!canSubmit}>{busy ? 'Criando…' : 'Criar avaliação'}</Button>
        </form>
      )}
    </>
  )
}
