import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: null, from: vi.fn(), upload: vi.fn(), sign: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({
  get supabase() { return mocks.client },
  supabaseConfigError: 'Configure o Supabase para usar os arquivos.',
}))

import { buildEvaluationFilePath, uploadEvaluationFile, getEvaluationFileUrl } from '../services/evaluationFiles.js'

const organizationId = 'b1000000-0000-4000-8000-000000000001'
const evaluationId = 'c1000000-0000-4000-8000-000000000001'
const uuid = 'd1000000-0000-4000-8000-000000000001'
const path = `${organizationId}/${evaluationId}/${uuid}.png`

beforeEach(() => {
  vi.clearAllMocks()
  mocks.client = { storage: { from: mocks.from } }
  mocks.from.mockReturnValue({ upload: mocks.upload, createSignedUrl: mocks.sign })
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid)
})
afterEach(() => vi.restoreAllMocks())

describe('buildEvaluationFilePath', () => {
  it.each(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'csv', 'xlsx'])('aceita %s e normaliza a extensão', (ext) => {
    expect(buildEvaluationFilePath({ organizationId, evaluationId, fileName: `cliente.nome.${ext.toUpperCase()}` }))
      .toBe(`${organizationId}/${evaluationId}/${uuid}.${ext}`)
  })
  it.each(['arquivo.exe', 'arquivo.svg', 'arquivo', 'png', '.env', 'arquivo.', '', undefined])('recusa extensão inválida em %s', (fileName) => {
    expect(() => buildEvaluationFilePath({ organizationId, evaluationId, fileName }))
      .toThrow('Extensão de arquivo não permitida')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('gera um UUID novo a cada arquivo', () => {
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(uuid).mockReturnValueOnce('d1000000-0000-4000-8000-000000000002')
    const args = { organizationId, evaluationId, fileName: 'print.png' }
    expect(buildEvaluationFilePath(args)).not.toBe(buildEvaluationFilePath(args))
  })
})

it('envia o arquivo ao bucket privado sem sobrescrever', async () => {
  const file = new File(['imagem sintética'], 'print.PNG', { type: 'image/png' })
  mocks.upload.mockResolvedValue({ data: { path }, error: null })
  await expect(uploadEvaluationFile({ organizationId, evaluationId, file })).resolves.toEqual({ path })
  expect(mocks.from).toHaveBeenCalledWith('evaluation-files')
  expect(mocks.upload).toHaveBeenCalledWith(path, file, { upsert: false, contentType: 'image/png' })
})

it('não envia arquivo com extensão inválida', async () => {
  await expect(uploadEvaluationFile({ organizationId, evaluationId, file: new File(['x'], 'x.exe') }))
    .rejects.toThrow('Extensão de arquivo não permitida')
  expect(mocks.upload).not.toHaveBeenCalled()
})

it('devolve a URL assinada com TTL de 3600 segundos', async () => {
  mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://exemplo.test/arquivo-assinado' }, error: null })
  await expect(getEvaluationFileUrl(path)).resolves.toBe('https://exemplo.test/arquivo-assinado')
  expect(mocks.from).toHaveBeenCalledWith('evaluation-files')
  expect(mocks.sign).toHaveBeenCalledWith(path, 3600)
})

it('propaga a falha de upload', async () => {
  const error = new Error('Envio recusado')
  mocks.upload.mockResolvedValue({ data: null, error })
  await expect(uploadEvaluationFile({ organizationId, evaluationId, file: new File(['x'], 'x.png') })).rejects.toBe(error)
})

it('propaga a falha de assinatura', async () => {
  const error = new Error('Arquivo indisponível')
  mocks.sign.mockResolvedValue({ data: null, error })
  await expect(getEvaluationFileUrl(path)).rejects.toBe(error)
})

it('sem cliente, informa a configuração ausente e não faz rede', async () => {
  mocks.client = null
  const fetch = vi.spyOn(globalThis, 'fetch')
  await expect(uploadEvaluationFile({ organizationId, evaluationId, file: new File(['x'], 'x.png') })).rejects.toThrow('Configure o Supabase')
  await expect(getEvaluationFileUrl(path)).rejects.toThrow('Configure o Supabase')
  expect(mocks.from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
