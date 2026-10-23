# TASK-012 — Banco local: RLS de negócio, validação, curadoria e veredito efetivo

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) — revisão de segurança linha a linha |
| Depende de | **TASK-011 mesclada**. Pode correr em paralelo com a TASK-014 (frontend) |
| Branch | `task/012-rls-negocio` (a partir de `main`) |
| PR | `TASK-012: RLS de negócio, validação e curadoria (banco local)` → `main` |
| Itens | SEC-05, SEC-06, SEC-07, SEC-08, SEC-10, SEC-12 (RPC), SEC-16, SEC-18, SEC-19; D-011, D-013, D-016, D-024; correções #1 e #2 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-012**: escrever, **somente no Supabase local**, as políticas RLS das tabelas de negócio criadas na TASK-011, as RPCs de validação do analista e de curadoria do supervisor, o trigger que protege colunas sensíveis de `evaluations` e a view `effective_feedback`. Tudo provado por uma matriz de testes pgTAP.

### 0. Regras invioláveis
- Tudo é **local**. Proibidos `login`, `link`, `push` e `deploy`.
- **Não altere as migrações existentes.** Crie uma nova com `supabase migration new rls_negocio`. Se algo da TASK-010/011 precisar mudar, faça na nova migração, com `alter`, e justifique no relatório.
- Não altere `package.json`, lockfile, `src/`, `docs/` nem `.github/`.
- Não dispare o Actions (D-021). Use só dados sintéticos.
- **Nenhuma política para `anon`.** Toda escrita sensível passa por RPC `security definer` com `search_path = ''`, que deriva identidade e papel de `auth.uid()` (SEC-03).

### 1. Leitura obrigatória
- `AGENTS.md` e `docs/SECURITY.md` (inteiro, inclusive a seção "Testes exigidos").
- `docs/specs/VALIDACAO_E_CURADORIA.md`.
- `docs/DECISIONS.md`: D-011, D-013, D-016 e **D-024**. Validação do analista é o padrão; a decisão do supervisor sobrepõe quando existir.
- `docs/ARCHITECTURE.md` §4–§5 e as migrações das TASK-010/011 com seus testes.

### 2. Funções auxiliares (`private`, `stable`, `security definer`, `search_path = ''`, `execute` só para `authenticated`)

| Função | Retorna `true` quando |
|---|---|
| `private.can_read_evaluation(p_eval uuid)` | admin da plataforma; **ou** supervisor da organização da avaliação; **ou** membro da organização com `analyst_user_id = auth.uid()` ou `created_by = auth.uid()` |
| `private.can_edit_evaluation(p_eval uuid)` | admin; ou supervisor da organização; ou membro da organização com `created_by = auth.uid()` ou `analyst_user_id = auth.uid()` |
| `private.is_org_manager(p_org uuid)` | admin da plataforma ou supervisor de `p_org` |

### 3. Políticas por tabela

Para todas as tabelas:
- `revoke all` de `anon` e `authenticated`, e depois **grants mínimos por coluna**;
- o `organization_id` gravado é sempre o da linha-mãe, ou `private.current_org_id()`.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `evaluations` | `can_read_evaluation(id)` | membro da organização com `organization_id = current_org_id()` e `created_by = auth.uid()`. **Analista:** `analyst_user_id = auth.uid()` (cria avaliação do próprio chat). **Supervisor:** `analyst_user_id` de membro da **mesma** organização (D-013), ou `null` com `analyst_name`. `status in ('rascunho','transcrito')`; `diagnosis_status`, `supervisor_review` e `current_analysis_run_id` nulos | colunas `protocol`, `channel`, `source`, `transcript`, `analyst_name`, `analyst_user_id`, `status`; `using/with check can_edit_evaluation(id)`. Regras finas no trigger da §4 | `can_edit_evaluation(id)` **e** `status in ('rascunho','transcrito')` (com execução de IA não se apaga, D-016) |
| `analysis_runs`, `evaluation_scores`, `opportunities` | `can_read_evaluation(evaluation_id)` | — (Edge Function com service role, Fase 3) | — (curadoria só pela RPC) | — |
| `analysis_feedback` | `can_read_evaluation(evaluation_id)` | — (só pela RPC) | — | — |
| `csat_records` | gestor da organização; analista quando `analyst_user_id = auth.uid()` | gestor: qualquer linha da própria organização. Analista: só com `analyst_user_id = auth.uid()` e `source = 'manual'` | gestor | gestor |
| `survey_tickets` | gestor | gestor, **sem** grant na coluna `token` (gerado no servidor, SEC-11) | — | gestor |
| `survey_responses` | gestor | — (Edge Function, Fase 5) | — | — |
| `app_settings` | membros da organização e admin | — | gestor, coluna `value` (o check da TASK-011 valida o limiar) | — |
| `protocol_versions` | membros e admin | — | — (ativação só pela RPC) | — |
| `curation_logs` | gestor da organização | — (só pelas RPCs) | — | — |
| `ai_failures` | gestor | — | — | — |
| `ai_provider_configs` | gestor, **sem** grant em `secret_ref` (SEC-19) | — (Edge Function, TASK-025) | — | — |

`evaluation_files` fica para a TASK-013. Até lá, deixe-a sem políticas.

### 4. Trigger `private.protect_evaluation()` (`before update on evaluations`)
Quando `current_user` for `anon` ou `authenticated` (chamada direta pela API):
- `organization_id`, `created_by`, `diagnosis_status`, `supervisor_review` e `current_analysis_run_id` são **imutáveis**. Só as RPCs e as Edge Functions os alteram.
- `status` só pode transitar entre `rascunho` e `transcrito`. `analisado` e `curado` só via servidor.
- `analyst_user_id` só pode ser alterado por gestor da organização, e para um membro da mesma organização.
- `transcript` não pode mudar quando `status in ('analisado','curado')`. Reanálise com nova transcrição é fluxo da Fase 3.

### 5. RPCs (`public`, `plpgsql`, `security definer`, `search_path = ''`)

Todas com:
- `revoke` de `public` e `anon`, e `grant` a `authenticated`;
- `errcode` novos **CX020–CX039**, documentados em comentário no topo da migração.

| RPC | Regras |
|---|---|
| `submit_feedback(p_run uuid, p_target text, p_opportunity uuid, p_liked boolean, p_useful boolean, p_comment text) returns uuid` | A execução precisa ser a **atual** da avaliação (`current_analysis_run_id`) e ter `status = 'sucesso'`. **Analista** só se `evaluations.analyst_user_id = auth.uid()`, gravando `author_role = 'analista'`. **Gestor** grava `author_role = 'supervisor'`. Outro analista → CX02x. Faz *upsert* pela chave única da TASK-011. `author_id` e `author_role` **nunca** vêm de parâmetro. `p_opportunity` precisa pertencer à execução |
| `decide_opportunity(p_opportunity uuid, p_decision text, p_note text, p_adjusted text) returns void` | Só gestor da organização. `p_decision in ('aprovada','ajustada','rejeitada')`. A oportunidade precisa ser da execução atual. `p_adjusted` só é aceito com `ajustada` e é opcional (D-024: padrão = texto da IA). Grava `status`, `supervisor_note` e `adjusted_recommendation`, e **na mesma transação** insere `curation_logs(target = 'oportunidade', action = p_decision, note = p_note)`. Pode ser redecidida, sempre com novo log |
| `decide_diagnosis(p_evaluation uuid, p_decision text, p_review text) returns void` | Só gestor. `p_decision in ('aprovado','rejeitado')`. Exige execução atual com `sucesso`. Grava `diagnosis_status`, `supervisor_review` e `status = 'curado'`, e insere o log (`target = 'diagnóstico'`, `action = 'diagnóstico aprovado'` ou `'diagnóstico rejeitado'`) |
| `set_active_protocol_version(p_version uuid) returns void` | Só gestor da organização da versão. Desativa a ativa e ativa a nova, na mesma transação |

### 6. View `public.effective_feedback` (`with (security_invoker = true)`)
Uma linha por alvo (o diagnóstico de cada execução e cada oportunidade), com estas colunas:
- `organization_id`, `evaluation_id`, `analysis_run_id`, `target_type`, `opportunity_id`, `analyst_user_id`;
- `analyst_liked`, `analyst_useful`, `analyst_comment`;
- `supervisor_decision` (texto ou `null`);
- `effective` ∈ (`positivo`, `negativo`, `sem_validacao`);
- `source` ∈ (`supervisor`, `analista`, `null`).

**Regra D-024**:
1. **Decisão do supervisor existe:**
   - na oportunidade, `status <> 'pendente'`;
   - no diagnóstico, só na execução atual e com `diagnosis_status` não nulo.
   - `aprovada`/`ajustada`/`aprovado` → `positivo`; `rejeitada`/`rejeitado` → `negativo`. `source = 'supervisor'`.
2. **Senão, há feedback do analista:** `liked and useful` → `positivo`; `liked = false or useful = false` → `negativo`; os dois nulos → `sem_validacao`. `source = 'analista'`.
3. **Senão:** `sem_validacao`.

Como `security_invoker` está ativo, a view respeita a RLS de quem consulta. `grant select` só a `authenticated`.

### 7. Testes obrigatórios (pgTAP, novo arquivo; os testes anteriores continuam passando)
Personas, criadas por um helper no próprio arquivo:
- admin da plataforma;
- supervisor X;
- analista A de X;
- analista B de X;
- supervisor Y;
- usuário sem vínculo;
- `anon`.

**Massa sintética mínima:**
- uma avaliação de A (criada por A) e uma de B (criada pelo supervisor X para B);
- uma execução `sucesso` em cada, inserida como `postgres`, com 6 scores e 2 oportunidades;
- um CSAT de A e um de B;
- a mesma estrutura na organização Y.

1. **Matriz SELECT/INSERT/UPDATE/DELETE** para **cada** tabela da §3 × cada persona, com o resultado esperado explícito. Inclui obrigatoriamente:
   - Y não lê nada de X, e vice-versa;
   - A não lê a avaliação, os scores, as oportunidades, o feedback nem o CSAT de B;
   - sem vínculo e `anon` não leem nada.
2. **`evaluations`:**
   - A cria a avaliação com `analyst_user_id = A`;
   - A **não** cria para B;
   - o supervisor X cria para B, mas não para um usuário de Y;
   - INSERT com `status = 'analisado'` ou `diagnosis_status` preenchido falha;
   - INSERT com `organization_id` de Y falha.
3. **Trigger §4:**
   - A não altera `diagnosis_status`, `supervisor_review`, `organization_id` nem `current_analysis_run_id`;
   - A não muda `status` para `analisado`/`curado`;
   - A não troca `analyst_user_id`;
   - A não altera a transcrição de avaliação `analisado`;
   - o supervisor X troca `analyst_user_id` para B, mas não para um usuário de Y.
4. **DELETE:** só em `rascunho`/`transcrito`; uma avaliação com execução não é apagada por ninguém pela API.
5. **`submit_feedback`:**
   - A valida o diagnóstico e uma oportunidade da própria avaliação, e o upsert altera em vez de duplicar;
   - B **não** valida a avaliação de A;
   - o supervisor grava como `supervisor`;
   - em execução que não é a atual → erro;
   - oportunidade de outra execução → erro;
   - `author_role` não é forjável.
6. **`decide_opportunity`/`decide_diagnosis`:**
   - o analista recebe erro (SEC-06/SEC-07);
   - o supervisor Y recebe erro numa avaliação de X;
   - o supervisor X decide e um log é criado na mesma transação;
   - `p_adjusted` com `aprovada` → erro;
   - o diagnóstico aprovado leva `status` a `curado`;
   - UPDATE direto em `opportunities.status` pela API falha.
7. **`effective_feedback`:**
   - A positivo sem supervisor → `positivo/analista`;
   - A positivo e supervisor `rejeitada` → `negativo/supervisor`;
   - A com `liked = true, useful = false` → `negativo`;
   - nada → `sem_validacao`;
   - A vê só as linhas próprias pela view, e o supervisor X vê as da organização.
8. **`csat_records`:**
   - o analista insere só `manual` próprio e não atualiza nem apaga;
   - o supervisor faz tudo dentro da organização.
9. **`survey_tickets`:**
   - o analista não lê nem cria;
   - o supervisor cria **sem** informar o token, e um token informado é rejeitado por falta de privilégio.
10. **`ai_provider_configs`:** o supervisor lê `provider` e `model`; `select secret_ref` falha por privilégio.
11. **`set_active_protocol_version`:** o analista recebe erro; com o supervisor, fica exatamente uma versão ativa.
12. **SEC-16, SEC-10 e SEC-15** revalidados para todos os objetos novos (tabelas, view e funções).

### 8. Validação local (saída real)
```
supabase start
supabase db reset
supabase test db
supabase db lint --level warning
supabase stop
npm ci && npm run lint && npm run test && npm run build
git status --short
```

### 9. Fora do escopo
- Storage e `evaluation_files` (TASK-013).
- Edge Functions e prompts (Fase 3).
- Indicadores agregados e taxa de utilidade (Fase 4/5).
- Interface.
- Exclusão por LGPD (backlog SEC-21).
- Qualquer ação remota.

### 10. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Matriz completa por tabela × persona × operação | testes 1–4, 8–10 |
| 2 | Validação do analista e curadoria do supervisor só pelas RPCs, com log atômico | testes 5–6 |
| 3 | Veredito efetivo conforme D-024 | teste 7 |
| 4 | Isolamento entre organizações em todas as tabelas | teste 1 |
| 5 | `secret_ref` e `token` protegidos por privilégio de coluna | testes 9–10 |
| 6 | `supabase test db` e `db lint` verdes; app intacto; diff só em `supabase/` | saídas |

### 11. Entrega
PR `TASK-012: RLS de negócio, validação e curadoria (banco local)` para `main`. O relatório deve trazer:
- a **tabela da matriz** (tabela × persona × operação → resultado);
- a lista de `errcode`;
- as saídas reais.

Não faça merge.

## FIM DO PROMPT
