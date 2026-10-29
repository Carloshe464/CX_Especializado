import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'

const BUCKET = 'evaluation-files'
const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'csv', 'xlsx'])
const MIME_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function storage() {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para acessar os arquivos das avaliações.')
  return supabase.storage.from(BUCKET)
}

export function buildEvaluationFilePath({ organizationId, evaluationId, fileName }) {
  const extension = fileName?.split('.').pop().toLowerCase()
  if (!fileName?.includes('.') || !EXTENSIONS.has(extension)) {
    throw new Error('Extensão de arquivo não permitida. Use PNG, JPG, JPEG, WEBP, PDF, TXT, CSV ou XLSX.')
  }
  return `${organizationId}/${evaluationId}/${crypto.randomUUID()}.${extension}`
}

export async function uploadEvaluationFile({ organizationId, evaluationId, file }) {
  if (file.size === 0) throw new Error(`O arquivo ${file.name} está vazio.`)
  const bucket = storage()
  const path = buildEvaluationFilePath({ organizationId, evaluationId, fileName: file.name })
  const contentType = file.type || MIME_TYPES[file.name.split('.').pop().toLowerCase()]
  const { data, error } = await bucket.upload(path, file, { upsert: false, contentType })
  if (error) throw error
  return data
}

export async function getEvaluationFileUrl(path) {
  const { data, error } = await storage().createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function listEvaluationFiles(evaluationId) {
  if (!supabase) throw new Error(supabaseConfigError || 'Configure o Supabase para acessar os arquivos das avaliações.')
  const { data, error } = await supabase.from('evaluation_files')
    .select('id, storage_path, kind, mime_type, size_bytes, created_at')
    .eq('evaluation_id', evaluationId).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function removeEvaluationFile(path) {
  const { error } = await storage().remove([path])
  if (error) throw error
}
