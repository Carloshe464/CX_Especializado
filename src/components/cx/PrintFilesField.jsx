import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PrintFilesField({ files, onChange, disabled }) {
  const [errors, setErrors] = useState([])
  function addFiles(event) {
    const accepted = []
    const rejected = []
    for (const file of event.target.files) {
      if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) {
        rejected.push(`Formato não aceito: ${file.name}. Use PNG, JPG, WEBP ou PDF.`)
      } else if (file.size === 0) {
        rejected.push(`O arquivo ${file.name} está vazio.`)
      } else if (file.size > 20 * 1024 * 1024) {
        rejected.push(`O arquivo ${file.name} passa de 20 MB.`)
      } else accepted.push(file)
    }
    onChange([...files, ...accepted])
    setErrors(rejected)
    event.target.value = ''
  }
  return (
    <div className="min-w-0 space-y-4">
      <Label htmlFor="print-files">Anexar prints ou PDF</Label>
      <Input id="print-files" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" disabled={disabled} onChange={addFiles} />
      {errors.length > 0 && <div role="alert" className="break-words text-sm text-destructive">{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
      <ul className="space-y-2" aria-label="Arquivos selecionados">
        {files.map((file, i) => (
          <li key={i} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(file.size / (file.size >= 1024 * 1024 ? 1024 * 1024 : 1024))} {file.size >= 1024 * 1024 ? 'MB' : 'KB'}</p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={() => onChange(files.filter((_, index) => index !== i))}>Remover</Button>
          </li>
        ))}
      </ul>
      <div><Button type="button" variant="outline" disabled aria-describedby="extract-coming-soon">Extrair transcrição com IA</Button>
        <p id="extract-coming-soon" className="mt-1 text-xs text-muted-foreground">Disponível em breve</p>
      </div>
    </div>
  )
}
