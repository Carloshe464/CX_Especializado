# Arquitetura — Protocolo CX 1.1

> Status: **proposta (Fase 0)**. Itens marcados *[pendente]* dependem de decisão do responsável. **README-DEV** = `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
> Referência de comportamento original: `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` (citado como **REF §n**).

## 1. Visão geral

```
Navegador (React SPA)                        Supabase
┌──────────────────────────┐   anon/publishable key + JWT do usuário
│ Páginas / componentes    │ ─────────────────────────────┐
│ src/lib/cx.js (domínio)  │                              ▼
│ src/services/* (API)     │            ┌──────────────────────────────────┐
└──────────────────────────┘            │ PostgREST  → tabelas com RLS     │
          │                              │ RPC (SECURITY DEFINER, validadas)│
          │  invoke()                    │ Storage (buckets privados)       │
          └────────────────────────────► │ Edge Functions (Deno)            │
                                         │   ├─ analyze-evaluation  ──► LLM │
                                         │   ├─ extract-transcript  ──► LLM │
                                         │   ├─ extract-csat        ──► LLM │
                                         │   ├─ import-spreadsheet          │
                                         │   └─ survey (público, token)     │
                                         │ Auth (e-mail/senha)              │
                                         └──────────────────────────────────┘
```

Princípios:
1. **O banco é a fronteira de segurança.** Toda regra de acesso existe como RLS/constraint/trigger; a UI apenas reflete.
2. **Operações privilegiadas** (IA, curadoria, pesquisa pública, importação) passam por Edge Functions ou RPCs que validam identidade e papel no servidor.
3. **Nenhum segredo no navegador.** Frontend só conhece `VITE_SUPABASE_URL` e a chave pública.
4. **Paridade primeiro**: rotas, textos, fluxos e tokens visuais seguem a REF; desvios só via `DECISIONS.md`.

## 2. Frontend

Estrutura alvo (criada progressivamente; TASK-001 cria a base):

```
src/
  main.jsx, App.jsx           # providers + rotas (REF §3)
  index.css                   # tokens HSL (REF §9.1)
  pages/                      # uma página por rota
  components/ui/              # shadcn/ui
  components/cx/              # componentes de domínio (REF §8)
  components/cx/charts/
  lib/
    supabaseClient.js         # cliente único
    env.js                    # leitura/validação de variáveis VITE_*
    cx.js                     # constantes e helpers de domínio (REF §5) — puro, testável
    utils.js                  # cn() do shadcn
  services/                   # acesso a dados por entidade (sem lógica de UI)
  auth/                       # AuthProvider, ProtectedRoute, RequireRole
  test/                       # setup de testes
```

Bibliotecas: React 18, Vite, React Router v7 (modo declarativo, igual REF §3), Tailwind CSS v3 + `tailwindcss-animate` (paridade com `tailwind.config.js` da REF §9.2 — D-004), shadcn/ui, Recharts, lucide-react, `@supabase/supabase-js` v2, TanStack Query (a REF usa `QueryClientProvider`), Vitest + Testing Library.

Rotas e guardas (REF §3): `/pesquisa/:token` e páginas de auth fora do layout; demais dentro de `ProtectedRoute` + `CxLayout`. `Dashboard`, `Curation`, `Satisfaction` exigem papel supervisor (redirecionamentos da REF preservados).

## 3. Identidade e papéis

- Supabase Auth (e-mail/senha) substitui o auth do Base44. Telas `/login`, `/register`, `/forgot-password`, `/reset-password`.
- Tabela `profiles` (1:1 com `auth.users`): `id`, `full_name`, `email`, `role` (`admin` = supervisor, `user` = analista), timestamps.
- `role` **não pode ser alterado pelo próprio usuário** (RLS de update sem coluna `role` + trigger de proteção). Atribuição de papel só por supervisor via RPC auditada ou pelo painel Supabase.
- Função SQL `public.is_supervisor()` (`SECURITY DEFINER`, `STABLE`, `search_path` fixo) usada pelas políticas.
- *[pendente]* Cadastro aberto (`/register`) vs. somente convite — REF diz "convidar via plataforma" (§11.8). Proposta: registro cria sempre `role='user'`; avaliar desabilitar signup público (D-008).

## 4. Modelo de dados (rascunho — fixado na Fase 2)

Convenções: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by uuid references auth.users` (equivalentes a `created_date`/`updated_date`/`created_by_id` da REF). Enums via `CHECK` ou tipos `enum` com os valores exatos da REF §5 (strings em pt-BR preservadas para paridade).

| Tabela | Origem REF | Notas de desenho |
|---|---|---|
| `profiles` | gestão de usuários | papel controlado pelo servidor |
| `evaluations` | §4.1 | `analyst_user_id` FK `profiles`; `status` (rascunho/transcrito/analisado/curado); `diagnosis_status` (pendente/aprovado/rejeitado); campos de diagnóstico da IA **movidos para `analysis_runs`** (D-010) ou protegidos por view; `protocol` com índice único normalizado *[pendente D-012]* |
| `analysis_runs` | nova (correção #3) | uma linha por execução da IA: `prompt_version`, `model`, `status` (sucesso/falha), `raw_output` (jsonb), `trend`, `strengths`, `summary_feedback`, `uncertainties`, `error_code`. Reanálise cria nova execução; decisões de curadoria anteriores não são apagadas |
| `evaluation_scores` | §4.2 | FK `evaluation_id`, `analysis_run_id`; `score numeric(4,2) null check 0..10`; `classification` derivada por função SQL (mesma regra de `scoreClassification`) |
| `opportunities` | §4.3 | FK `analysis_run_id`; status de curadoria alterável **somente** por supervisor |
| `csat_records` | §4.4 | `score smallint check 1..5`; **`score_origin`** (`real` / `derivada_nivel` / `derivada_sentimento`) — correção #6; `source` (planilha/pesquisa/manual/arquivo) |
| `survey_tickets` | §4.5 | `token` gerado no servidor (≥128 bits), `expires_at`, `used_at`, `max_responses=1`; **sem leitura anônima direta** |
| `survey_responses` | §4.5 | inserida apenas pela Edge Function `survey`; `unique(ticket_id)` — correção #5 |
| `app_settings` | §4.6 | `key` único; `csat_positive_threshold` = 4, validado 1–5 |
| `protocol_versions` | §4.6 | V1.1 como seed |
| `curation_logs` | §4.6 | append-only: sem UPDATE/DELETE para ninguém via API; inserção por trigger/RPC de curadoria |
| `ai_failures` | nova (correção #8) | registro técnico sem PII: `evaluation_id`, `stage`, `error_code`, `prompt_version`, `model`, `created_at` |
| `evaluation_files` | nova (correção #9) | metadados dos arquivos do Storage (`path`, `kind`, `evaluation_id`), permitindo limpeza de órfãos |

**Organização única vs. multiempresa:** ver D-002. Proposta: organização única nesta fase, sem coluna `organization_id`, com caminho de migração documentado.

### Visibilidade do diagnóstico (correção #1)
Analista lê `evaluations` próprias, mas **scores, oportunidades e diagnóstico** só quando `diagnosis_status = 'aprovado'`, e oportunidades só com status `aprovada`/`ajustada`. Implementado por RLS nas tabelas filhas (join com `evaluations`) e por separar os campos de diagnóstico da linha principal (`analysis_runs`), de modo que nenhuma consulta direta exponha conteúdo pendente.

## 5. Curadoria

RPCs `decide_opportunity(opportunity_id, decision, note, adjusted_recommendation)` e `decide_diagnosis(evaluation_id, decision, review)`:
- validam `is_supervisor()`;
- validam transições de estado permitidas;
- gravam `curation_logs` na mesma transação.

Políticas de UPDATE diretas nas colunas de curadoria são negadas a todos os papéis não supervisores (correção #2).

## 6. Motor de IA (Fase 3)

Pipeline na Edge Function `analyze-evaluation`, em módulos independentes do provedor:

1. **Entrada:** carrega a transcrição (servidor), valida que o chamador pode analisar a avaliação. **Não carrega CSAT** (regra 4.5/§8).
2. **Prompt versionado:** `PROTOCOL_PROMPT V1.1` verbatim (REF §6.2) armazenado em arquivo versionado + `protocol_versions`; `prompt_version` registrado na execução.
3. **Adaptador de provedor:** interface `generateStructured({ prompt, schema, files? })`; modelo e chave via segredos (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`). *[pendente D-009: provedor]*
4. **Validação:** JSON Schema estrito (exatamente 6 competências, nomes exatos, `score` 0–10 ou `null`, enums de severidade/origem/confiança/tendência, oportunidades 0..n).
5. **Normalização:** `normalizeTrend`, classificação, recorte de campos.
6. **Persistência:** transação cria `analysis_runs` + scores + oportunidades (`pendente`) e muda `evaluations.status → analisado`, `diagnosis_status → pendente`.
7. **Falhas:** saída inválida/incompleta → `analysis_runs.status='falha'` + `ai_failures`; a avaliação mantém o estado anterior; UI mostra mensagem acionável (correção #8).

Funções análogas: `extract-transcript` (prints, visão multimodal, prompt REF §6.1), `extract-csat` (PDF/print), `import-spreadsheet` (REF §6.3; normalização de linhas portada de `normalizeSpreadsheetRow` com testes).

## 7. Storage

Bucket privado `evaluation-files`, caminho `{analyst_user_id}/{evaluation_id}/{uuid}.{ext}`. Políticas de Storage espelham a RLS da avaliação. Exibição por URL assinada (TTL 3600 s, REF §10). Uploads registrados em `evaluation_files`; rotina de limpeza de órfãos (correção #9).

## 8. Pesquisa pública

`/pesquisa/:token` chama a Edge Function `survey` (sem JWT): `GET` valida token e devolve somente o `protocol` exibível; `POST` grava resposta 1–5 + comentário, marca o ticket como usado, aplica limite de taxa e tamanho. Nenhuma tabela interna recebe política para o papel `anon` (correção #5 e requisitos de segurança).

## 9. Indicadores

Fórmulas exatas: README-DEV Bloco F (CSAT positivo, média, taxa de resposta, distribuição, evolução 6 meses, gravidade, comparativo por analista como média das médias, relação competência×satisfação, contadores de curadoria). Agregações do Dashboard, Meu desenvolvimento e Satisfação feitas por **views/RPCs SQL** (sem limites fixos de 500/1000 da REF — correção #4), com testes comparando com cálculo de referência em JS sobre o mesmo conjunto sintético.

## 10. Ambientes e CI

- Local: Vite dev server; Supabase local (CLI) para testes de RLS a partir da Fase 2 *[CLI ausente no ambiente atual]*.
- CI: GitHub Actions — `npm ci`, `lint`, `test`, `build` (TASK-001); testes de banco com Supabase local/pgTAP a partir da Fase 2.
- Publicação: fora do escopo até a Fase 6 e mediante autorização.
