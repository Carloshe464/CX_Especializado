import { supabase, supabaseConfigError } from '../lib/supabaseClient.js'

const BUCKET = 'evaluation-files'
const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'csv', 'xlsx'])

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
  const bucket = storage()
  const path = buildEvaluationFilePath({ organizationId, evaluationId, fileName: file.name })
  const { data, error } = await bucket.upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error
  return data
}

export async function getEvaluationFileUrl(path) {
  const { data, error } = await storage().createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
