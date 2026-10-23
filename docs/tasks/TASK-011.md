# TASK-011 — Banco local: entidades de negócio

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | **TASK-010 mesclada** (usa `organizations`, `profiles` e as funções de `private`). Pode correr em paralelo com a TASK-003 e a TASK-014 (só cria arquivos em `supabase/`) |
| Branch | `task/011-entidades` (a partir de `main`) |
| PR | `TASK-011: Entidades de negócio (banco local)` → `main` |
| Itens | SEC-08, SEC-10, SEC-14, SEC-16, SEC-18 (integridade), SEC-19 (estrutura); D-010, D-011, D-012, D-016, D-019, D-024; correções #3, #5, #6, #8 e #9 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-011**: criar, **somente no Supabase local**, as tabelas de negócio com restrições de integridade, a função de classificação, os triggers estruturais e o seed por organização, com testes pgTAP.

**Políticas de acesso de negócio NÃO entram aqui** (TASK-012). Nesta tarefa todas as tabelas novas ficam com RLS habilitada e **sem políticas**, ou seja, negação total pela API até a TASK-012.

### 0. Regras invioláveis
As mesmas da TASK-010:
- nada remoto (sem `login`/`link`/`push`/`deploy`);
- não altere `package.json`, lockfile, `src/`, `docs/` nem `.github/`;
- não dispare o Actions (D-021);
- dados sintéticos;
- nenhum segredo.

Confirme na `main` que a migração da TASK-010 existe; se não existir, pare e reporte.

### 1. Leitura obrigatória
`AGENTS.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md` §4–§8; `docs/specs/VALIDACAO_E_CURADORIA.md`; `docs/specs/PROVEDOR_IA.md` §3; `docs/DECISIONS.md` D-010, D-011, D-012, D-016, D-019 e D-024; `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §4; `docs/reference/README-DEV_AUDITORIA_TECNICA.md` Bloco B; `src/lib/cx.js`, que é a fonte das listas de valores.

### 2. Escopo autorizado
Crie a migração com `supabase migration new entidades_negocio`.

**Convenções para todas as tabelas:**
- `id uuid pk default gen_random_uuid()`;
- `organization_id uuid not null references organizations on delete restrict`;
- `created_at`, e `updated_at` com trigger `private.set_updated_at()` onde a linha é mutável;
- enums como `check (col in (...))` com os valores **exatos** de `src/lib/cx.js`;
- RLS habilitada, sem políticas, e `revoke all ... from anon`.

**2.1 Integridade entre organizações (SEC-18).**
- `evaluations` tem `unique (id, organization_id)`. Toda tabela filha referencia `(evaluation_id, organization_id) references evaluations (id, organization_id)`, o que impede um filho de outra organização.
- Do mesmo modo, `analysis_runs` tem `unique (id, evaluation_id)`. Tabelas ligadas a uma execução referenciam `(analysis_run_id, evaluation_id)`.

**2.2 Função `public.score_classification(p numeric) returns text`.**
- `language sql`, `immutable`, `set search_path = ''`.
- Regra idêntica a `scoreClassification` de `cx.js`: `null` ou `< 0` → `'Não avaliável'`; `>= 9` Excelente; `>= 7` Bom; `>= 5` Atenção; `>= 3` Insatisfatório; senão Crítico.

**2.3 Tabelas**

| Tabela | Colunas e restrições essenciais |
|---|---|
| `evaluations` | `protocol text`; `analyst_user_id uuid references profiles on delete set null`; `analyst_name text`; `channel text`; `source text not null check in ('prints','texto','importacao','extensao')` (`extensao` é novo, D-018); `status text not null default 'rascunho'` check EVALUATION_STATUS; `transcript text`; `diagnosis_status text` check DIAGNOSIS_STATUS (nulo antes da 1ª análise); `supervisor_review text`; `current_analysis_run_id uuid` (FK adicionada depois de `analysis_runs`, `on delete set null`); `created_by uuid default auth.uid() references auth.users on delete set null`. **Índice único** `(organization_id, lower(btrim(protocol))) where protocol is not null and btrim(protocol) <> ''` (D-012). Os campos de diagnóstico da IA **não** ficam aqui (D-010) |
| `analysis_runs` | `evaluation_id`; `run_number int not null`, com `unique (evaluation_id, run_number)`; `status text not null check in ('em_andamento','sucesso','falha')`; `prompt_version text not null`; `provider text`; `model text`; `trend text` check TRENDS; `strengths`, `summary_feedback`, `uncertainties text`; `raw_output jsonb`; `error_code text`; `started_at timestamptz not null default now()`; `finished_at timestamptz`; `created_by`. **Imutável depois de concluída:** um trigger bloqueia UPDATE quando `status <> 'em_andamento'` e bloqueia DELETE sempre (D-016: nada é apagado) |
| `evaluation_scores` | `evaluation_id`, `analysis_run_id`; `competency text not null` check COMPETENCIES; `score numeric(4,2) check (score between 0 and 10)` (nulo = não avaliável); `classification text generated always as (public.score_classification(score)) stored`; `evidence text`; `unique (analysis_run_id, competency)` |
| `opportunities` | `evaluation_id`, `analysis_run_id`; `position int not null`; `severity text not null default 'Desejável'` check SEVERITIES; `evidence`, `description`, `impact`, `recommendation`, `improved_example text`; `origin text not null default 'Indeterminada'` check ORIGINS; `confidence text not null default 'Médio'` check CONFIDENCES; `communication_techniques text[] not null default '{}'` com check `<@` array de COMMUNICATION_TECHNIQUES (D-019); `status text not null default 'pendente'` check OPPORTUNITY_STATUS; `supervisor_note text`; `adjusted_recommendation text` |
| `analysis_feedback` | `evaluation_id`, `analysis_run_id`; `target_type text not null check in ('diagnostico','oportunidade')`; `opportunity_id uuid references opportunities on delete cascade`, com check `(target_type = 'oportunidade') = (opportunity_id is not null)`; `author_id uuid not null references profiles`; `author_role text not null check in ('analista','supervisor')`; `liked boolean`; `useful boolean`; `comment text check (length(comment) <= 2000)`; `unique nulls not distinct (analysis_run_id, target_type, opportunity_id, author_role)` |
| `csat_records` | `evaluation_id uuid` (nullable; FK composta com `on delete set null` apenas na coluna `evaluation_id`; se a sintaxe do Postgres local não permitir, use FK simples + trigger que valida a organização e explique no relatório); `protocol`, `analyst_name text`; `analyst_user_id uuid references profiles on delete set null`; `score smallint check (score between 1 and 5)`; `score_origin text check in ('real','derivada_nivel','derivada_sentimento')`, com check `(score is null) = (score_origin is null)` (correção #6); `level`, `sentiment`, `channel`, `subject`, `comment`, `reason`, `themes`, `evidence`, `recommended_action`, `evaluator`, `team`, `brand text`; `evaluated_at`, `opened_at timestamptz`; `source text not null` check CSAT_SOURCES; `created_by` |
| `survey_tickets` | `evaluation_id`; `token text not null unique default encode(extensions.gen_random_bytes(32), 'hex')`, com check `length(token) = 64` (256 bits gerados no servidor, SEC-11); `protocol text`; `expires_at timestamptz not null default now() + interval '30 days'`; `used_at timestamptz`; `created_by` |
| `survey_responses` | `ticket_id uuid not null unique references survey_tickets on delete cascade` (resposta única, correção #5); `score smallint not null check (score between 1 and 5)`; `comment text check (length(comment) <= 2000)`. Um trigger garante que `organization_id` = organização do ticket |
| `app_settings` | `key text not null`; `value text not null`; `description text`; `unique (organization_id, key)`; check `key <> 'csat_positive_threshold' or value in ('1','2','3','4','5')` |
| `protocol_versions` | `version text not null`; `description`, `changes text`; `effective_date date`; `is_active boolean not null default false`; `unique (organization_id, version)`; índice único parcial: **uma versão ativa por organização** |
| `curation_logs` | `evaluation_id`; `opportunity_id uuid`; `analysis_run_id uuid`; `target text not null check in ('oportunidade','diagnóstico')`; `action text not null check in ('aprovada','ajustada','rejeitada','diagnóstico aprovado','diagnóstico rejeitado')`; `note text`; `actor_id uuid default auth.uid() references auth.users on delete set null`. **Append-only:** um trigger levanta exceção em UPDATE e DELETE para qualquer papel (SEC-08) |
| `ai_failures` | `evaluation_id uuid` (nullable, como em `csat_records`); `analysis_run_id uuid`; `stage text not null check in ('transcricao','analise','extracao_csat','importacao','teste_conexao')`; `error_code text not null check (error_code ~ '^[a-z0-9_]{1,64}$')`; `prompt_version`, `provider`, `model text`. **Sem coluna de texto livre** (SEC-14) |
| `evaluation_files` | `evaluation_id`; `storage_path text not null unique`; `kind text not null check in ('print','pdf','planilha','txt')`; `mime_type text`; `size_bytes bigint check (size_bytes > 0)`; `created_by` (correção #9) |
| `ai_provider_configs` | `provider text not null check in ('openai_compativel')`; `base_url text not null check (base_url ~ '^https://')`; `model text not null`; `supports_vision boolean not null default false`; `secret_ref uuid` (id no Vault; a chave **nunca** é coluna, SEC-19); `key_last4 text check (key_last4 ~ '^.{4}$')`; `is_active boolean not null default false`; `updated_by uuid`; índice único parcial: **uma configuração ativa por organização** |

**2.4 Seed por organização.** Trigger `after insert on organizations` (função em `private`, `security definer`, `search_path = ''`) cria:
- `app_settings`: `csat_positive_threshold = '4'`;
- `protocol_versions`: `V1.1` (inativa, "Linha de base de paridade") e `V1.2` (**ativa**, "Comunicação assertiva e rapport nas oportunidades — D-019").

O texto dos prompts não entra aqui (TASK-021).

### 3. Testes obrigatórios (pgTAP, novo arquivo em `supabase/tests/database/`)
Os testes da TASK-010 devem continuar passando.
1. `score_classification` com: 10, 9, 8.99, 7, 6.99, 6.5, 5, 4.99, 3, 2.99, 0, `null` (mesmas fronteiras de `cx.test.js`). A coluna gerada em `evaluation_scores` reflete a função.
2. Checks de enum rejeitam valores fora das listas, e os defaults de `opportunities` são `Desejável` / `Indeterminada` / `Médio` / `pendente`.
3. `communication_techniques`: aceita subconjunto válido e rejeita técnica desconhecida.
4. Protocolo único (D-012):
   - `' ABC-1 '` e `'abc-1'` colidem na mesma organização;
   - não colidem em organizações diferentes;
   - `null` e vazio não colidem.
5. **Integridade entre organizações:**
   - inserir score, oportunidade, feedback, arquivo, ticket ou log apontando para avaliação de **outra** organização falha;
   - score com `analysis_run_id` de outra avaliação falha.
6. `analysis_runs`:
   - UPDATE permitido em `em_andamento`, bloqueado depois de `sucesso`/`falha`;
   - DELETE sempre bloqueado;
   - `run_number` duplicado falha.
7. `analysis_feedback`:
   - check alvo × `opportunity_id`;
   - unicidade por papel;
   - comentário acima de 2000 caracteres falha.
8. `csat_records`: `score` fora de 1–5 falha; `score` sem `score_origin` (e vice-versa) falha.
9. `survey_tickets` e `survey_responses`:
   - o token padrão tem 64 caracteres hex e é único;
   - uma segunda resposta para o mesmo ticket falha.
10. `curation_logs`: UPDATE e DELETE falham, inclusive como `postgres`/dono da tabela.
11. `ai_failures`: `error_code` com espaço ou texto livre falha.
12. `ai_provider_configs`: `http://` falha; uma segunda configuração ativa na mesma organização falha.
13. Seed: criar organização gera `csat_positive_threshold = '4'` e as versões V1.1/V1.2, com só a V1.2 ativa. `value = '6'` falha.
14. **SEC-16/SEC-10:**
    - todas as tabelas de `public` com RLS;
    - `anon` sem privilégios;
    - um usuário `authenticated` (supervisor de X) lê **zero** linhas das tabelas novas, porque ainda não há políticas.

### 4. Validação local (saída real de cada comando)
```
supabase start
supabase db reset
supabase test db
supabase db lint --level warning
supabase stop
npm ci && npm run lint && npm run test && npm run build
git status --short
```

### 5. Fora do escopo
- Políticas RLS de negócio, RPCs de validação/veredito e view `effective_feedback` (TASK-012).
- Storage (TASK-013).
- Prompts e Edge Functions (Fase 3).
- Importação.
- Alterações em `docs/`, `src/` e `package.json`.
- Qualquer ação remota.

### 6. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | `supabase db reset` aplica as duas migrações do zero | saída |
| 2 | Testes da TASK-010 e da §3 passando | `supabase test db` |
| 3 | `supabase db lint` sem erros | saída |
| 4 | Valores dos checks idênticos a `src/lib/cx.js` | diff + teste 2 |
| 5 | Integridade entre organizações por FK composta | teste 5 |
| 6 | Sem coluna para chave de IA nem texto livre em `ai_failures` | diff + teste 11 |
| 7 | App intacto e diff só em `supabase/` | `npm` + `git diff --stat origin/main` |

### 7. Entrega
PR `TASK-011: Entidades de negócio (banco local)` para `main`, com o relatório do `AGENTS.md` e as saídas reais. Não faça merge.

## FIM DO PROMPT
