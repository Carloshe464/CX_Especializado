import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEvaluationFileUrl, uploadEvaluationFile, removeEvaluationFile } from '@/services/evaluationFiles'
import PrintFilesField from '@/components/cx/PrintFilesField'
import { Button } from '@/components/ui/button'

function Attachment({ file, index, removable, busy, onRemove }) {
  const url = useQuery({
    queryKey: ['evaluation_file_url', file.storage_path],
    queryFn: () => getEvaluationFileUrl(file.storage_path),
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
  })
  const image = file.kind === 'print' || file.mime_type?.startsWith('image/')
  const pdf = file.kind === 'pdf' || file.mime_type === 'application/pdf'
  return (
    <li className="min-w-0 space-y-3 rounded-xl border border-border p-3">
      {url.data && <a className="block break-words text-sm underline focus-visible:ring-2 focus-visible:ring-ring" href={url.data} target="_blank" rel="noopener noreferrer">
        {image ? <img src={url.data} alt={`Anexo ${index + 1}`} className="h-40 w-full rounded-lg object-contain" /> : pdf ? `Abrir PDF ${index + 1}` : `Abrir anexo ${index + 1}`}
      </a>}
      {url.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando anexo {index + 1}…</p>}
      {url.isError && <p role="alert" className="text-sm text-destructive">Não foi possível abrir o anexo {index + 1}. <Button type="button" variant="link" onClick={() => url.refetch()}>Tentar novamente</Button></p>}
      {removable && <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={`Remover anexo ${index + 1}`} onClick={() => onRemove(file.storage_path)}>Remover</Button>}
    </li>
  )
}

export default function PrintGallery({ evaluation, files }) {
  const [pendingFiles, setPendingFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sending = useRef(false)
  const queryClient = useQueryClient()
  const editable = ['rascunho', 'transcrito'].includes(evaluation.status)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evaluation', evaluation.id] })
  async function upload() {
    if (sending.current || !pendingFiles.length) return
    sending.current = true
    setBusy(true)
    setError(null)
    const failed = []
    try {
      for (const file of pendingFiles) {
        try { await uploadEvaluationFile({ organizationId: evaluation.organization_id, evaluationId: evaluation.id, file }) }
        catch { failed.push(file) }
      }
      setPendingFiles(failed)
      if (failed.length) setError('Não foi possível enviar todos os arquivos. Tente novamente.')
      void refresh()
    } finally { sending.current = false; setBusy(false) }
  }
  async function remove(path) {
    if (sending.current || !window.confirm('Remover este arquivo?')) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      await removeEvaluationFile(path)
      queryClient.removeQueries({ queryKey: ['evaluation_file_url', path] })
      void refresh()
    } catch { setError('Não foi possível remover o arquivo.') }
    finally { sending.current = false; setBusy(false) }
  }
  if (!files.length && !editable) return null
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
      {files.length > 0 && <><h2 className="font-heading text-xl font-semibold">Anexos</h2>
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">{files.map((file, index) => <Attachment key={file.id} file={file} index={index} removable={editable} busy={busy} onRemove={remove} />)}</ul>
      </>}
      {editable && <div className="min-w-0 space-y-4"><h2 className="font-heading text-xl font-semibold">Adicionar arquivos</h2>
        <PrintFilesField files={pendingFiles} onChange={setPendingFiles} disabled={busy} />
        <Button type="button" disabled={busy || !pendingFiles.length} onClick={upload}>{busy ? 'Enviando…' : 'Enviar arquivos'}</Button>
      </div>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    </section>
  )
}
