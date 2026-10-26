import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { CHANNELS, COMPETENCIES, CSAT_SOURCES, TRENDS } from '../src/lib/cx.js'

const PASSWORD = 'TesteLocal030!'
const DEFAULT_URL = 'http://127.0.0.1:54321'
const GROUPS = [
  { name: 'Empresa X', domain: 'empresa-x.test', analysts: ['analista-a', 'analista-b'] },
  { name: 'Empresa Y', domain: 'empresa-y.test', analysts: ['analista'] },
]

// Executada antes de criar clientes ou enviar credenciais. Não há modo remoto.
export function assertLocalTarget(url, key) {
  let target
  try {
    target = new URL(url)
  } catch {
    throw new Error('SUPABASE_URL inválida. Use somente http://127.0.0.1:54321 ou localhost.')
  }
  if (!['http:', 'https:'].includes(target.protocol)
      || !['127.0.0.1', 'localhost'].includes(target.hostname)
      || target.username || target.password || target.pathname !== '/'
      || target.search || target.hash) {
    throw new Error('O seed recusa destinos não locais. Use somente 127.0.0.1 ou localhost, sem credenciais ou caminho na URL.')
  }
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('Defina SUPABASE_SECRET_KEY no ambiente com a chave do Supabase local.')
  }
  return target.origin
}

async function checked(request, context) {
  const { data, error } = await request
  // Não imprimir respostas de Auth, sessões ou chaves, mesmo em caso de falha.
  if (error) throw new Error(`${context}: ${error.code ?? error.status ?? 'falha na operação'}. Se a massa ficou incompleta, execute supabase db reset no ambiente local.`)
  return data
}

async function seed(url, key) {
  // Também bloqueia redirects: a chave não pode seguir uma resposta para outro host.
  const client = () => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }) },
  })
  const admin = client()
  const existing = await checked(
    admin.from('organization_domains').select('domain').in('domain', GROUPS.map((group) => group.domain)),
    'Verificar massa existente',
  )
  if (existing.length) {
    console.log('Massa local já existe. Nenhum registro foi criado ou duplicado. Para recriar, execute supabase db reset e rode o script novamente.')
    return
  }

  const sessions = []
  const users = []
  const organizations = []
  try {
    for (const group of GROUPS) {
      const members = []
      for (const login of ['supervisor', ...group.analysts]) {
        const email = `${login}@${group.domain}`
        const name = `${login === 'supervisor' ? 'Supervisor' : 'Analista'} fictício ${login} — ${group.name}`
        const { user } = await checked(admin.auth.admin.createUser({
          email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
        }), 'Criar usuário sintético')
        const session = client()
        sessions.push(session)
        await checked(session.auth.signInWithPassword({ email, password: PASSWORD }), 'Entrar com usuário sintético')
        const role = login === 'supervisor' ? 'supervisor' : 'analista'
        const member = { id: user.id, email, name, role, session }
        members.push(member)
        users.push(member)
      }
      const supervisor = members[0]
      const organizationId = await checked(supervisor.session.rpc('create_organization', {
        p_name: group.name, p_domain: group.domain,
      }), 'Criar organização pela RPC')
      organizations.push(organizationId)
      const analysts = members.slice(1)
      for (const analyst of analysts) {
        await checked(analyst.session.rpc('join_organization_by_domain'), 'Entrar na organização pela RPC')
      }

      let analysisIndex = 0
      for (let index = 0; index < 8; index += 1) {
        const analyst = analysts[index % analysts.length]
        const status = ['rascunho', 'transcrito', 'analisado', 'curado'][index % 4]
        const timestamp = new Date(Date.UTC(2026, 9, 1 + index, 12)).toISOString()
        const evaluation = await checked(admin.from('evaluations').insert({
          organization_id: organizationId,
          analyst_user_id: analyst.id,
          analyst_name: analyst.name,
          created_by: analyst.id,
          created_at: timestamp,
          protocol: index % 3 === 0 ? null : `LOCAL-${group.domain}-${index + 1}`,
          channel: CHANNELS[index % CHANNELS.length],
          source: 'texto',
          status: status === 'curado' ? 'analisado' : status,
          transcript: 'Atendente: Olá! Este é um atendimento fictício para teste local.\nCliente: Preciso de ajuda com uma solicitação simulada.\nAtendente: Vou explicar o próximo passo.',
          diagnosis_status: ['analisado', 'curado'].includes(status) ? 'pendente' : null,
        }).select('id, protocol, channel').single(), 'Criar avaliação fictícia')

        if (['analisado', 'curado'].includes(status)) {
          const opportunityCount = analysisIndex
          const run = await checked(admin.from('analysis_runs').insert({
            organization_id: organizationId, evaluation_id: evaluation.id, run_number: 1,
            status: 'sucesso', prompt_version: 'V1.2', provider: 'seed-local', model: 'seed-local',
            trend: TRENDS[analysisIndex % TRENDS.length],
            strengths: 'Acolhimento e explicação clara no cenário fictício.',
            summary_feedback: 'Análise sintética: confirmar entendimento e combinar o próximo passo.',
            uncertainties: 'Cenário inventado; não representa atendimento ou diagnóstico real.',
            started_at: timestamp, finished_at: timestamp, created_by: analyst.id,
          }).select('id').single(), 'Criar análise fictícia')
          const scores = [9, 7, 5, 3, 1, null]
          await checked(admin.from('evaluation_scores').insert(COMPETENCIES.map((competency, position) => ({
            organization_id: organizationId, evaluation_id: evaluation.id, analysis_run_id: run.id,
            competency, score: scores[(position + analysisIndex) % scores.length],
            evidence: 'Evidência fictícia: o atendente explica o próximo passo.',
          }))), 'Criar notas fictícias')
          let opportunities = []
          if (opportunityCount) {
            opportunities = await checked(admin.from('opportunities').insert(
              Array.from({ length: opportunityCount }, (_, position) => ({
                organization_id: organizationId, evaluation_id: evaluation.id, analysis_run_id: run.id,
                position: position + 1, severity: ['Desejável', 'Importante', 'Crítica'][position],
                description: 'Confirmar o entendimento do cliente no cenário fictício.',
                evidence: 'Cliente: Preciso de ajuda com uma solicitação simulada.',
                impact: 'Reduzir dúvidas na simulação.',
                recommendation: 'Perguntar se a orientação ficou clara.',
                improved_example: 'Ficou claro o próximo passo? Posso explicar novamente.',
                origin: 'Analista', confidence: 'Médio',
                communication_techniques: ['Assertividade', 'Rapport'],
              })),
            ).select('id, position').order('position'), 'Criar oportunidades fictícias')
          }
          await checked(admin.from('evaluations').update({ current_analysis_run_id: run.id })
            .eq('id', evaluation.id), 'Vincular execução atual')

          if (index % 2 === 0) {
            for (const opportunity of [null, ...opportunities.slice(0, 1)]) {
              await checked(analyst.session.rpc('submit_feedback', {
                p_run: run.id, p_target: opportunity ? 'oportunidade' : 'diagnostico',
                p_opportunity: opportunity?.id ?? null,
                p_liked: true, p_useful: true, p_comment: 'Validação fictícia do analista dono.',
              }), 'Validar pela RPC do analista')
            }
          }
          if (status === 'curado') {
            for (const [position, opportunity] of opportunities.entries()) {
              const decision = ['aprovada', 'ajustada', 'rejeitada'][position]
              await checked(supervisor.session.rpc('decide_opportunity', {
                p_opportunity: opportunity.id, p_decision: decision,
                p_note: 'Curadoria fictícia para teste local.',
                p_adjusted: decision === 'ajustada' ? 'Confirmar o entendimento com uma pergunta objetiva.' : null,
              }), 'Curar oportunidade pela RPC')
            }
            await checked(supervisor.session.rpc('decide_diagnosis', {
              p_evaluation: evaluation.id, p_decision: index === 3 ? 'aprovado' : 'rejeitado',
              p_review: 'Parecer fictício do supervisor para teste local.',
            }), 'Curar diagnóstico pela RPC')
          }
          analysisIndex += 1
        }

        if (index % 2 === 0) {
          const csat = {
            organization_id: organizationId, evaluation_id: evaluation.id,
            protocol: evaluation.protocol, analyst_name: analyst.name, analyst_user_id: analyst.id,
            score: index / 2 + 1, score_origin: 'real',
            source: CSAT_SOURCES[index / 2], channel: evaluation.channel,
            comment: 'Resposta fictícia para testar a satisfação local.',
            evaluated_at: timestamp, created_by: supervisor.id,
          }
          await checked(admin.from('csat_records').insert(index === 2 ? [csat, { ...csat, score: 5, source: 'manual' }] : [csat]),
            'Criar satisfação fictícia')
        }
      }
    }

    console.table(users.map(({ email, role }) => ({ 'E-mail de teste': email, Papel: role })))
    const counts = { 'Usuários sintéticos': users.length, Organizações: organizations.length }
    for (const table of ['evaluations', 'analysis_runs', 'evaluation_scores', 'opportunities', 'analysis_feedback', 'curation_logs', 'csat_records', 'app_settings', 'protocol_versions']) {
      const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).in('organization_id', organizations)
      if (error) throw new Error(`Não foi possível contar ${table}.`)
      counts[table] = count
    }
    console.table(counts)
    console.log(`Senha fixa de teste, somente local: ${PASSWORD}`)
  } finally {
    await Promise.allSettled(sessions.map((session) => session.auth.signOut()))
  }
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, reset: { type: 'boolean' } } })
  const key = process.env.SUPABASE_SECRET_KEY
  const url = assertLocalTarget(values.url ?? process.env.SUPABASE_URL ?? DEFAULT_URL, key)
  if (values.reset) {
    console.log('Para apagar e recriar o banco local, execute você mesmo: supabase db reset')
    return
  }
  await seed(url, key)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
