import { describe, expect, it } from 'vitest'
import * as cx from '@/lib/cx'
import {
  average,
  csatBand,
  deriveScoreFromLevel,
  formatDate,
  formatDecimal,
  normalizeOpportunity,
  normalizeTrend,
  parseNota,
  scoreClassification,
  scoreFromSentiment,
} from '@/lib/cx'

const CLASSIFICATIONS = ['Excelente', 'Bom', 'Atenção', 'Insatisfatório', 'Crítico', 'Não avaliável']

describe('constantes', () => {
  it.each([
    ['COMPETENCIES', [
      'Empatia e acolhimento', 'Comunicação e clareza', 'Eficiência do atendimento',
      'Conhecimento e condução técnica', 'Experiência do cliente e Customer Success',
      'Gestão comunicacional durante o multiatendimento',
    ]],
    ['SEVERITIES', ['Crítica', 'Importante', 'Desejável']],
    ['ORIGINS', ['Analista', 'Processo', 'Produto', 'Política empresarial', 'Indeterminada']],
    ['CONFIDENCES', ['Alto', 'Médio', 'Baixo']],
    ['TRENDS', ['Favorável', 'Incerta', 'Desfavorável']],
    ['OPPORTUNITY_STATUS', ['pendente', 'aprovada', 'ajustada', 'rejeitada']],
    ['CSAT_LEVELS', ['Ótimo', 'Bom', 'Neutro', 'Ruim', 'Péssimo']],
    ['CHANNELS', ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Outro']],
    ['EVALUATION_STATUS', ['rascunho', 'transcrito', 'analisado', 'curado']],
    ['DIAGNOSIS_STATUS', ['pendente', 'aprovado', 'rejeitado']],
    ['CSAT_SOURCES', ['planilha', 'pesquisa', 'manual', 'arquivo']],
    ['COMMUNICATION_TECHNIQUES', [
      'Assertividade', 'Rapport', 'Escuta ativa', 'Validação emocional',
      'Linguagem positiva', 'Clareza e objetividade',
    ]],
  ])('%s tem conteúdo e ordem exatos e é congelada', (name, expected) => {
    expect(cx[name]).toEqual(expected)
    expect(Object.isFrozen(cx[name])).toBe(true)
  })

  it.each([
    ['STATUS_LABELS', {
      rascunho: 'Rascunho', transcrito: 'Transcrição pronta',
      analisado: 'Em curadoria', curado: 'Curadoria concluída',
    }],
    ['DIAGNOSIS_LABELS', { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' }],
    ['ACTION_LABELS', {
      aprovada: 'Oportunidade aprovada', ajustada: 'Oportunidade ajustada',
      rejeitada: 'Oportunidade rejeitada', 'diagnóstico aprovado': 'Diagnóstico aprovado',
      'diagnóstico rejeitado': 'Diagnóstico rejeitado',
    }],
  ])('%s tem chaves, ordem e rótulos exatos e é congelado', (name, expected) => {
    expect(cx[name]).toEqual(expected)
    expect(Object.keys(cx[name])).toEqual(Object.keys(expected))
    expect(Object.isFrozen(cx[name])).toBe(true)
  })

  it('DEFAULT_CSAT_THRESHOLD é 4', () => {
    expect(cx.DEFAULT_CSAT_THRESHOLD).toBe(4)
  })
})

describe('estilos de badge', () => {
  it('BADGE_BASE é exato', () => {
    expect(cx.BADGE_BASE).toBe('rounded-full border px-2.5 py-1 text-xs')
  })

  it('CLASSIFICATION_STYLES cobre as 6 classificações com as classes exatas', () => {
    expect(Object.keys(cx.CLASSIFICATION_STYLES).sort()).toEqual([...CLASSIFICATIONS].sort())
    expect(cx.CLASSIFICATION_STYLES).toEqual({
      Excelente: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      Bom: 'bg-teal-50 text-teal-800 border-teal-200',
      Atenção: 'bg-amber-50 text-amber-800 border-amber-200',
      Insatisfatório: 'bg-orange-50 text-orange-800 border-orange-200',
      Crítico: 'bg-red-50 text-red-800 border-red-200',
      'Não avaliável': 'bg-slate-100 text-slate-600 border-slate-200',
    })
  })

  it.each([
    ['SEVERITY_STYLES', { Crítica: 'red', Importante: 'amber', Desejável: 'sky' }],
    ['TREND_STYLES', { Favorável: 'emerald', Incerta: 'amber', Desfavorável: 'red' }],
    ['STATUS_STYLES', { rascunho: 'slate', transcrito: 'sky', analisado: 'amber', curado: 'emerald' }],
  ])('%s segue o padrão bg-*-50 text-*-800 border-*-200', (name, colors) => {
    expect(Object.keys(cx[name])).toEqual(Object.keys(colors))
    for (const [key, color] of Object.entries(colors)) {
      expect(cx[name][key]).toBe(`bg-${color}-50 text-${color}-800 border-${color}-200`)
    }
  })

  it('todas as classes são strings literais, sem interpolação e sem espaços duplicados', () => {
    const groups = ['CLASSIFICATION_STYLES', 'SEVERITY_STYLES', 'TREND_STYLES', 'STATUS_STYLES']
    const values = [cx.BADGE_BASE, ...groups.flatMap((g) => Object.values(cx[g]))]
    for (const g of groups) expect(Object.isFrozen(cx[g])).toBe(true)
    for (const value of values) {
      expect(typeof value).toBe('string')
      expect(value).not.toContain('${')
      expect(value).not.toMatch(/\s{2,}/)
      expect(value).toBe(value.trim())
    }
  })
})

describe('scoreClassification', () => {
  it.each([
    [10, 'Excelente'], [9, 'Excelente'], [8.99, 'Bom'], [7, 'Bom'], [6.99, 'Atenção'],
    [6.5, 'Atenção'], [5, 'Atenção'], [4.99, 'Insatisfatório'], [3, 'Insatisfatório'],
    [2.99, 'Crítico'], [0, 'Crítico'], [-0.1, 'Não avaliável'], [10.5, 'Excelente'],
    ['7.5', 'Bom'], [null, 'Não avaliável'], [undefined, 'Não avaliável'], ['', 'Não avaliável'],
    [NaN, 'Não avaliável'], ['abc', 'Não avaliável'],
  ])('%j → %s', (score, expected) => {
    expect(scoreClassification(score)).toBe(expected)
  })
})

describe('csatBand', () => {
  it.each([
    [3, [['Insatisfação', 1], ['Insatisfação', 2], ['Satisfação positiva', 3], ['Satisfação positiva', 4], ['Satisfação positiva', 5]]],
    [4, [['Insatisfação', 1], ['Insatisfação', 2], ['Neutro', 3], ['Satisfação positiva', 4], ['Satisfação positiva', 5]]],
    [5, [['Insatisfação', 1], ['Insatisfação', 2], ['Neutro', 3], ['Insatisfação', 4], ['Satisfação positiva', 5]]],
  ])('threshold %i', (threshold, cases) => {
    for (const [expected, score] of cases) expect(csatBand(score, threshold)).toBe(expected)
  })

  it('usa threshold 4 por padrão', () => {
    expect(csatBand(4)).toBe('Satisfação positiva')
    expect(csatBand(3)).toBe('Neutro')
  })

  it.each([0, 6, null, undefined, '4', NaN, Infinity])('nota inválida %j → null', (score) => {
    expect(csatBand(score)).toBeNull()
  })

  it('aceita decimais dentro de 1–5', () => {
    expect(csatBand(4.5)).toBe('Satisfação positiva')
    expect(csatBand(3.5)).toBe('Insatisfação')
  })

  it.each([0, 6, 3.5, '3', null, NaN])('threshold inválido %j usa 4', (threshold) => {
    expect(csatBand(3, threshold)).toBe('Neutro')
    expect(csatBand(4, threshold)).toBe('Satisfação positiva')
  })
})

describe('parseNota', () => {
  it.each([
    ['5', 5], ['4,6', 5], ['nota 3 de 5', 3], ['-3', 3], ['10', null], ['0', null],
    ['', null], [null, null], [4.4, 4],
  ])('%j → %j', (value, expected) => {
    expect(parseNota(value)).toBe(expected)
  })
})

describe('deriveScoreFromLevel', () => {
  it.each([
    ['Ótimo', 5], ['Bom', 4], ['Neutro', 3], ['Ruim', 2], ['Péssimo', 1],
    ['  ótimo ', 5], ['BOM', 4], ['nEuTrO', 3], [' ruim', 2], ['PÉSSIMO', 1],
    ['', null], ['   ', null], ['Excelente', null], [null, null], [undefined, null], [5, null],
  ])('%j → %j', (level, expected) => {
    expect(deriveScoreFromLevel(level)).toBe(expected)
  })
})

describe('scoreFromSentiment', () => {
  it.each([
    ['Muito positivo', 5], ['positivo', 4], ['Positiva', 4], ['  MUITO NEGATIVO ', 1],
    ['muito negativa', 1], ['Negativo', 2], ['neutro', 3], ['Neutra', 3],
    ['indiferente', null], ['', null], [null, null],
  ])('%j → %j', (text, expected) => {
    expect(scoreFromSentiment(text)).toBe(expected)
  })
})

describe('normalizeTrend', () => {
  it.each([
    ['Desfavorável', 'Desfavorável'], ['tendência desfavoravel', 'Desfavorável'],
    ['Favorável', 'Favorável'], ['FAVORÁVEL', 'Favorável'], ['Incerta', 'Incerta'],
    ['incerto', 'Incerta'], ['qualquer coisa', 'Incerta'], ['', 'Incerta'],
    [null, 'Incerta'], [undefined, 'Incerta'],
  ])('%j → %s', (text, expected) => {
    expect(normalizeTrend(text)).toBe(expected)
  })
})

describe('formatDate', () => {
  it('formata data válida em pt-BR', () => {
    expect(formatDate('2026-03-15T12:00:00Z')).toBe('15 de mar. de 2026')
  })

  it.each(['', null, undefined])('vazio %j → —', (value) => {
    expect(formatDate(value)).toBe('—')
  })

  it('data inválida devolve o próprio valor', () => {
    expect(formatDate('data-ruim')).toBe('data-ruim')
  })
})

describe('formatDecimal', () => {
  it.each([
    [7.25, 2, '7,25'], [7.25, undefined, '7,3'], [8, undefined, '8,0'], [0, 0, '0'], [-1.5, 1, '-1,5'],
  ])('%j com %j casas → %s', (value, digits, expected) => {
    expect(formatDecimal(value, digits)).toBe(expected)
  })

  it.each([null, undefined, '7.5', 'abc', NaN, Infinity])('não numérico %j → —', (value) => {
    expect(formatDecimal(value)).toBe('—')
  })
})

describe('average', () => {
  it('calcula a média ignorando valores inválidos', () => {
    expect(average([8, null, 6, undefined, NaN, 7])).toBe(7)
    expect(average([7.5])).toBe(7.5)
  })

  it.each([[[]], [[null, undefined, NaN]], [null], [undefined]])('sem valores válidos %j → null', (values) => {
    expect(average(values)).toBeNull()
  })
})

describe('normalizeOpportunity', () => {
  it('aplica defaults quando campos estão ausentes ou inválidos', () => {
    expect(normalizeOpportunity({ severity: 'Alta', origin: 'Cliente', confidence: 'Total', status: 'aprovada' })).toEqual({
      severity: 'Desejável',
      origin: 'Indeterminada',
      confidence: 'Médio',
      status: 'pendente',
      evidence: '',
      description: '',
      impact: '',
      recommendation: '',
      improved_example: '',
      communication_techniques: [],
    })
  })

  it('preserva valores válidos', () => {
    const result = normalizeOpportunity({
      severity: 'Crítica', origin: 'Processo', confidence: 'Alto',
      evidence: 'Cliente: não entendi', description: 'Explicação confusa',
    })
    expect(result).toMatchObject({
      severity: 'Crítica', origin: 'Processo', confidence: 'Alto',
      evidence: 'Cliente: não entendi', description: 'Explicação confusa', status: 'pendente',
    })
  })

  it('filtra técnicas de comunicação inválidas e duplicadas, mantendo a ordem', () => {
    const result = normalizeOpportunity({
      communication_techniques: ['Rapport', 'Persuasão', 'Escuta ativa', 'Rapport', 'rapport', 3],
    })
    expect(result.communication_techniques).toEqual(['Rapport', 'Escuta ativa'])
  })

  it('não altera o objeto original', () => {
    const raw = { severity: 'Alta', communication_techniques: ['Rapport', 'Rapport'] }
    const snapshot = structuredClone(raw)
    const result = normalizeOpportunity(raw)
    expect(raw).toEqual(snapshot)
    expect(result).not.toBe(raw)
    expect(result.communication_techniques).not.toBe(raw.communication_techniques)
  })

  it.each([null, undefined])('aceita entrada %j', (raw) => {
    expect(normalizeOpportunity(raw)).toMatchObject({ severity: 'Desejável', status: 'pendente', communication_techniques: [] })
  })
})
