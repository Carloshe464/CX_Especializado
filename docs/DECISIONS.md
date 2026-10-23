# Registro de decisões técnicas

Status: **Aceita** (vigente) · **Proposta** (aguarda o responsável) · **Substituída**.
Toda correção de comportamento da aplicação original deve aparecer aqui, citando a referência (REF §n = `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`).

| ID | Título | Status |
|---|---|---|
| D-001 | Orquestração sem mecanismo automático de execução do Codex | Aceita |
| D-002 | Organização única vs. multiempresa | **Proposta** |
| D-003 | React Router v7 em modo declarativo | Aceita |
| D-004 | Tailwind CSS v3 (não v4) | Aceita |
| D-005 | npm como gerenciador de pacotes | Aceita |
| D-006 | Vitest + Testing Library | Aceita |
| D-007 | Correções dos 9 problemas conhecidos | Aceita (detalhes por fase) |
| D-008 | Política de cadastro de usuários | **Proposta** |
| D-009 | Provedor e modelo de IA | **Proposta** |
| D-010 | Diagnóstico em `analysis_runs` versionadas | Aceita (fixar na Fase 2) |
| D-011 | Analista dono não vê análise pendente | **Proposta** (diverge da REF) |
| D-012 | Unicidade do número de protocolo | **Proposta** |
| D-013 | Avaliação criada por supervisor sem analista vinculado | **Proposta** |

---

### D-001 — Orquestração sem mecanismo automático de execução do Codex
**Contexto:** a sessão de orquestração não dispõe de CLI/integração do Codex (`codex` ausente no ambiente) e o responsável determinou que esta sessão apenas orquestre, valide, aprove PRs e gere prompts.
**Decisão:** ordens de trabalho são arquivos `docs/tasks/TASK-NNN.md` contendo um prompt completo para colar no Codex ou numa sessão Claude Code operadora. A entrega volta como PR no GitHub, revisado pelo orquestrador.
**Consequência:** nenhuma execução é simulada; status em `TASKS.md` só muda com evidência no PR.

### D-002 — Organização única vs. multiempresa *(Proposta)*
**Opções:**
- **A. Organização única (recomendada):** sem `organization_id`. RLS simples (dono ou supervisor), menos superfície de erro, testes mais baratos. Migrar depois exige: adicionar `organization_id` em todas as tabelas, backfill com a organização padrão, reescrever políticas, escopar `is_supervisor()` por organização e unicidade de protocolo por organização. Esforço estimado moderado, mecânico, se as políticas forem centralizadas em funções.
- **B. Multiempresa desde já:** `organizations` + `memberships(role)`; toda política filtra por organização. Isolamento entre clientes SaaS pronto, porém dobra a matriz de testes de RLS e antecipa decisões de produto (cobrança, convite, papéis por organização) não autorizadas.

**Recomendação:** A, mantendo as políticas concentradas em funções (`is_supervisor()`, `can_read_evaluation(id)`) para facilitar a migração. **Aguarda decisão do responsável antes da TASK de schema (Fase 2).**

### D-003 — React Router v7 em modo declarativo
A REF §2 usa `react-router-dom v7` com `<Routes>/<Route>`. Mantido para paridade. v7 suporta React 18.

### D-004 — Tailwind CSS v3
A REF §9.2 depende de `tailwind.config.js`, tokens HSL `hsl(var(--x))` e `tailwindcss-animate`, padrão do shadcn/ui para Tailwind v3. A v4 muda o modelo de configuração e exigiria reescrever tokens. Usar a última 3.4.x; reavaliar migração após paridade visual comprovada.

### D-005 — npm
Disponível no ambiente (npm 10.9 / Node 22), padrão em CI, gera `package-lock.json`. Node fixado em 22 LTS via `.nvmrc` e `engines`.

### D-006 — Vitest + Testing Library
Integra nativamente com Vite; testes unitários de `lib/cx.js`, componentes e rotas. Testes de banco (RLS) serão SQL/pgTAP ou scripts com Supabase local na Fase 2.

### D-007 — Correções dos problemas conhecidos
| # | Problema (briefing §7) | Correção | Fase |
|---|---|---|---|
| 1 | Analista acessa análises pendentes | RLS nas tabelas de diagnóstico condicionada a `diagnosis_status='aprovado'`; diagnóstico fora da linha principal (D-010) | 2 |
| 2 | Alteração indevida de estados de curadoria | Colunas de curadoria só via RPC de supervisor; trigger rejeita alterações por outros papéis | 2 |
| 3 | Reanálise apaga decisões de supervisão | Reanálise cria nova `analysis_run`; histórico e `curation_logs` preservados; reanálise de avaliação já curada exige supervisor | 3 |
| 4 | Limites fixos geram indicadores incompletos | Agregações em SQL (views/RPC), sem `limit` | 5 |
| 5 | Respostas duplicadas em pesquisa | Token gerado no servidor, uso único, expiração, `unique(ticket_id)`, rate limit | 5 |
| 6 | Nota inferida confundida com real | Coluna `score_origin`; UI e indicadores distinguem real × derivada | 2/5 |
| 7 | Protocolos duplicados em criações simultâneas | Índice único (D-012) + upsert na importação | 2 |
| 8 | Falhas de IA sem tratamento | Estados de erro, `ai_failures`, mensagens acionáveis, avaliação não muda de estado | 3 |
| 9 | Arquivos órfãos | `evaluation_files` + limpeza ao remover/descartar + rotina periódica | 2/5 |

Problemas adicionais identificados na leitura da REF (tratados nas mesmas fases):
- **SurveyTicket com leitura pública (`read: {}`)** permite listar todos os tokens → sem acesso `anon`; validação via Edge Function.
- **Token de pesquisa gerado no cliente** → gerado no servidor.
- **Update de `Evaluation` por `created_by_id`** permite ao analista gravar `diagnosis_status='aprovado'` → coberto por #2.
- **`EvaluationScore`/`Opportunity` com update pelo dono** permite ao analista aprovar as próprias oportunidades → coberto por #2.

### D-008 — Política de cadastro *(Proposta)*
REF §11.8 indica convite pela plataforma, mas existe `/register`. Proposta: manter a rota `/register` (paridade), todo cadastro nasce com `role='user'`, papel `admin` atribuído somente por supervisor existente; avaliar com o responsável se o signup público deve ser desativado em produção.

### D-009 — Provedor e modelo de IA *(Proposta)*
O motor é independente de provedor (adaptador). Escolha do provedor/modelo inicial, orçamento e chave ficam com o responsável antes da Fase 3. Requisitos: saída JSON estruturada, visão multimodal (prints/PDF), execução a partir de Edge Function.

### D-010 — Diagnóstico em `analysis_runs`
Separa o resultado de cada execução da IA da linha da avaliação: permite versionar prompt/modelo, preservar curadorias anteriores (#3) e proteger conteúdo pendente por RLS (#1). A UI continua exibindo os mesmos campos da REF §7.4.

### D-011 — Analista dono não vê análise pendente *(Proposta — diverge da REF)*
A REF §7.4 define `canSeeAnalysis = isAdmin || isOwner || diagnosis_status==='aprovado'`, com `isOwner = created_by_id === user.id`. Assim, um analista que criou a própria avaliação vê o diagnóstico antes da curadoria, contrariando REF §1 ("nada da IA chega ao analista sem aprovação") e o briefing §4.6. Proposta: `canSeeAnalysis = isSupervisor || diagnosis_status==='aprovado'` (o analista vê o placeholder "em curadoria"). Precisa de confirmação.

### D-012 — Unicidade do protocolo *(Proposta)*
A REF reutiliza a avaliação por protocolo na importação, mas não impõe unicidade. Proposta: índice único sobre `lower(trim(protocol))` quando não nulo; criação concorrente retorna a avaliação existente. Confirmar se o mesmo chamado pode ter mais de uma avaliação legítima (ex.: atendimentos distintos com o mesmo protocolo).

### D-013 — Avaliação criada por supervisor sem analista *(Proposta)*
REF §7.3: supervisor cria com `analyst_user_id = null` e nome livre, logo o analista nunca vê a avaliação no portal. Proposta: o supervisor seleciona o analista (perfil existente) ao criar; nome livre permanece apenas para importações sem correspondência, com vinculação posterior.
