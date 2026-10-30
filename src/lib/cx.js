// Biblioteca de domínio do Protocolo CX: constantes e regras puras, sem efeitos colaterais.

export const COMPETENCIES = Object.freeze([
  'Empatia e acolhimento',
  'Comunicação e clareza',
  'Eficiência do atendimento',
  'Conhecimento e condução técnica',
  'Experiência do cliente e Customer Success',
  'Gestão comunicacional durante o multiatendimento',
])
export const SEVERITIES = Object.freeze(['Crítica', 'Importante', 'Desejável'])
export const ORIGINS = Object.freeze(['Analista', 'Processo', 'Produto', 'Política empresarial', 'Indeterminada'])
export const CONFIDENCES = Object.freeze(['Alto', 'Médio', 'Baixo'])
export const TRENDS = Object.freeze(['Favorável', 'Incerta', 'Desfavorável'])
export const OPPORTUNITY_STATUS = Object.freeze(['pendente', 'aprovada', 'ajustada', 'rejeitada'])
export const CSAT_LEVELS = Object.freeze(['Ótimo', 'Bom', 'Neutro', 'Ruim', 'Péssimo'])
export const CHANNELS = Object.freeze(['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Outro'])
export const EVALUATION_STATUS = Object.freeze(['rascunho', 'transcrito', 'analisado', 'curado'])
export const DIAGNOSIS_STATUS = Object.freeze(['pendente', 'aprovado', 'rejeitado'])
export const CSAT_SOURCES = Object.freeze(['planilha', 'pesquisa', 'manual', 'arquivo'])
// D-019
export const COMMUNICATION_TECHNIQUES = Object.freeze([
  'Assertividade',
  'Rapport',
  'Escuta ativa',
  'Validação emocional',
  'Linguagem positiva',
  'Clareza e objetividade',
])
export const STATUS_LABELS = Object.freeze({
  rascunho: 'Rascunho',
  transcrito: 'Transcrição pronta',
  analisado: 'Em curadoria',
  curado: 'Curadoria concluída',
})
export const DIAGNOSIS_LABELS = Object.freeze({ pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' })
// Derivado — confirmar na comparação visual.
export const ACTION_LABELS = Object.freeze({
  aprovada: 'Oportunidade aprovada',
  ajustada: 'Oportunidade ajustada',
  rejeitada: 'Oportunidade rejeitada',
  'diagnóstico aprovado': 'Diagnóstico aprovado',
  'diagnóstico rejeitado': 'Diagnóstico rejeitado',
})
export const DEFAULT_CSAT_THRESHOLD = 4

export const BADGE_BASE = 'rounded-full border px-2.5 py-1 text-xs'
export const CLASSIFICATION_STYLES = Object.freeze({
  Excelente: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Bom: 'bg-teal-50 text-teal-800 border-teal-200',
  Atenção: 'bg-amber-50 text-amber-800 border-amber-200',
  Insatisfatório: 'bg-orange-50 text-orange-800 border-orange-200',
  Crítico: 'bg-red-50 text-red-800 border-red-200',
  'Não avaliável': 'bg-slate-100 text-slate-600 border-slate-200',
})
export const SEVERITY_STYLES = Object.freeze({
  Crítica: 'bg-red-50 text-red-800 border-red-200',
  Importante: 'bg-amber-50 text-amber-800 border-amber-200',
  Desejável: 'bg-sky-50 text-sky-800 border-sky-200',
})
export const TREND_STYLES = Object.freeze({
  Favorável: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Incerta: 'bg-amber-50 text-amber-800 border-amber-200',
  Desfavorável: 'bg-red-50 text-red-800 border-red-200',
})
export const STATUS_STYLES = Object.freeze({
  rascunho: 'bg-slate-50 text-slate-800 border-slate-200',
  transcrito: 'bg-sky-50 text-sky-800 border-sky-200',
  analisado: 'bg-amber-50 text-amber-800 border-amber-200',
  curado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
})
export const DIAGNOSIS_STYLES = Object.freeze({
  pendente: 'bg-amber-50 text-amber-800 border-amber-200',
  aprovado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejeitado: 'bg-red-50 text-red-800 border-red-200',
})
export const OPPORTUNITY_DECISION_STYLES = Object.freeze({
  aprovada: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ajustada: 'bg-sky-50 text-sky-800 border-sky-200',
  rejeitada: 'bg-red-50 text-red-800 border-red-200',
})
export const OPPORTUNITY_DECISION_LABELS = Object.freeze({ aprovada: 'Aprovada', ajustada: 'Ajustada', rejeitada: 'Rejeitada' })

const NOT_EVALUABLE = 'Não avaliável'

/**
 * Classifica a nota de uma competência (0–10) na faixa do protocolo.
 * Ausente, não numérica ou negativa → "Não avaliável".
 */
export function scoreClassification(score) {
  if (score === null || score === undefined) return NOT_EVALUABLE
  if (typeof score !== 'number' && (typeof score !== 'string' || score.trim() === '')) return NOT_EVALUABLE
  const n = Number(score)
  if (!Number.isFinite(n) || n < 0) return NOT_EVALUABLE
  if (n >= 9) return 'Excelente'
  if (n >= 7) return 'Bom'
  if (n >= 5) return 'Atenção'
  if (n >= 3) return 'Insatisfatório'
  return 'Crítico'
}

/**
 * Faixa de satisfação de uma nota CSAT (1–5) segundo a nota mínima de satisfação positiva.
 * Nota inválida → null; threshold inválido → 4.
 */
export function csatBand(score, threshold = DEFAULT_CSAT_THRESHOLD) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 1 || score > 5) return null
  const limit = Number.isInteger(threshold) && threshold >= 1 && threshold <= 5 ? threshold : DEFAULT_CSAT_THRESHOLD
  if (score >= limit) return 'Satisfação positiva'
  if (score === 3) return 'Neutro'
  return 'Insatisfação'
}

/**
 * Extrai a nota CSAT de um texto livre (vírgula aceita como decimal), arredondada.
 * Retorna um inteiro de 1 a 5 ou null.
 */
export function parseNota(value) {
  const match = String(value).replace(/,/g, '.').match(/\d+(\.\d+)?/)
  if (!match) return null
  const nota = Math.round(Number(match[0]))
  return nota >= 1 && nota <= 5 ? nota : null
}

const LEVEL_SCORES = Object.freeze({ ótimo: 5, bom: 4, neutro: 3, ruim: 2, péssimo: 1 })

/**
 * Converte o nível CSAT ("Ótimo" … "Péssimo") em nota 1–5, ignorando caixa e espaços nas pontas.
 * Vazio ou desconhecido → null.
 */
export function deriveScoreFromLevel(level) {
  if (typeof level !== 'string') return null
  return LEVEL_SCORES[level.trim().toLowerCase()] ?? null
}

/**
 * Converte o sentimento textual do cliente em nota 1–5 ("muito positivo" tem precedência sobre "positiv").
 * Sem correspondência → null.
 */
export function scoreFromSentiment(text) {
  if (typeof text !== 'string') return null
  const s = text.trim().toLowerCase()
  if (s.includes('muito positivo')) return 5
  if (s.includes('positiv')) return 4
  if (s.includes('muito negativ')) return 1
  if (s.includes('negativ')) return 2
  if (s.includes('neutr')) return 3
  return null
}

/**
 * Normaliza a tendência informada pela IA para Favorável, Incerta ou Desfavorável (padrão: Incerta).
 */
export function normalizeTrend(text) {
  const s = String(text ?? '').toLowerCase()
  if (s.includes('desfavor')) return 'Desfavorável'
  if (s.includes('favor')) return 'Favorável'
  return 'Incerta'
}

/**
 * Formata uma data em pt-BR ("15 de mar. de 2026"). Vazio → "—"; data inválida → o próprio valor.
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Formata um número com casas decimais fixas e vírgula decimal. Não numérico → "—".
 */
export function formatDecimal(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(digits).replace('.', ',')
}

/**
 * Média dos valores numéricos finitos da lista, ignorando os demais. Sem valores válidos → null.
 */
export function average(values) {
  const valid = (Array.isArray(values) ? values : []).filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) return null
  return valid.reduce((sum, v) => sum + v, 0) / valid.length
}

const OPPORTUNITY_TEXT_FIELDS = ['evidence', 'description', 'impact', 'recommendation', 'improved_example']

/**
 * Aplica os defaults do protocolo a uma oportunidade vinda da IA, sem alterar o objeto original.
 * Severidade, origem e confiança fora das listas recebem os defaults; status volta a "pendente".
 */
export function normalizeOpportunity(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const result = { ...source }
  for (const field of OPPORTUNITY_TEXT_FIELDS) {
    result[field] = source[field] === null || source[field] === undefined ? '' : String(source[field])
  }
  result.severity = SEVERITIES.includes(source.severity) ? source.severity : 'Desejável'
  result.origin = ORIGINS.includes(source.origin) ? source.origin : 'Indeterminada'
  result.confidence = CONFIDENCES.includes(source.confidence) ? source.confidence : 'Médio'
  result.status = 'pendente'
  const techniques = Array.isArray(source.communication_techniques) ? source.communication_techniques : []
  result.communication_techniques = [...new Set(techniques.filter((t) => COMMUNICATION_TECHNIQUES.includes(t)))]
  return result
}
