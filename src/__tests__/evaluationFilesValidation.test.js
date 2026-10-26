import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({ supabase: { storage: { from: mock.from } }, supabaseConfigError: null }))
import { uploadEvaluationFile } from '../services/evaluationFiles.js'
beforeEach(() => {
  vi.clearAllMocks()
  mock.from.mockReturnValue({ upload: mock.upload })
  mock.upload.mockResolvedValue({ data: { path: 'ficticio' }, error: null })
})
it.each([
  ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp'],
  ['pdf', 'application/pdf'], ['txt', 'text/plain'], ['csv', 'text/csv'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
])('deduz MIME de %s quando file.type está vazio', async (extension, contentType) => {
  const file = new File(['conteúdo fictício'], `teste.${extension.toUpperCase()}`)
  await uploadEvaluationFile({ organizationId: 'org', evaluationId: 'av', file })
  expect(mock.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^org/av/.+\\.${extension}$`)), file, { upsert: false, contentType })
})
it('recusa arquivo vazio antes de acessar storage ou a rede', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    await expect(uploadEvaluationFile({ organizationId: 'org', evaluationId: 'av', file: new File([], 'vazio.png') })).rejects.toThrow('O arquivo vazio.png está vazio.')
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upload).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
