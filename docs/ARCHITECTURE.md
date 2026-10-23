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

## 3. Identidade, organizações e papéis (D-002, D-008, D-017)

- Supabase Auth com **Google OAuth** e e-mail/senha, em cadastro aberto (self-service). Telas `/login`, `/register`, `/forgot-password`, `/reset-password`.
- `profiles` (1:1 com `auth.users`): `id`, `full_name`, `email`, timestamps. **Sem papel.**
- `organizations`: `id`, `name`, timestamps.
- `memberships`: `user_id`, `organization_id`, `role` (`supervisor` | `analista`), com **uma organização por usuário** (único em `user_id`), exceto o admin da plataforma.
- `platform_admins`: `user_id`; papel global, só gravável pelo banco/painel.
- Funções `SECURITY DEFINER` (`STABLE`, `search_path` fixo): `current_org_id()`, `is_supervisor(org)`, `is_platform_admin()`, usadas por todas as políticas.
- Papel e organização **nunca** vêm do cliente (SEC-03/SEC-04/SEC-18).
- *[em aberto D-017]* fluxo de entrada: criar organização no cadastro (e virar supervisor), convite por link, ou domínio de e-mail.

## 4. Modelo de dados (rascunho — fixado na Fase 2)

Convenções: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by uuid references auth.users` (equivalentes a `created_date`/`updated_date`/`created_by_id` da REF). Enums via `CHECK` ou tipos `enum` com os valores exatos da REF §5 (strings em pt-BR preservadas para paridade).

| Tabela | Origem REF | Notas de desenho |
|---|---|---|
| `organizations`, `memberships`, `platform_admins`, `profiles` | gestão de usuários | §3 |
| `analysis_feedback` | nova (D-011) | validação do analista e veredito do supervisor por diagnóstico/oportunidade; view `effective_feedback` |
| `ai_provider_configs` | nova (D-009) | provedor, URL, modelo, referência ao segredo no Vault, por organização ❓ |
| `evaluations` | §4.1 | `organization_id`; `analyst_user_id` FK `profiles` (analista escolhido pelo supervisor, D-013); `status` (rascunho/transcrito/analisado/curado); `diagnosis_status` (pendente/aprovado/rejeitado); campos de diagnóstico da IA **movidos para `analysis_runs`** (D-010) ou protegidos por view; `protocol` único por `(organization_id, lower(btrim(protocol)))` (D-012) |
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

**Multiempresa (D-002):** toda tabela de negócio tem `organization_id NOT NULL`; `app_settings` e `protocol_versions` também são por organização, com seed na criação da organização.

### Visibilidade e validação (D-011 — substitui a correção #1)
O analista lê a análise das **próprias** avaliações assim que pronta e grava validação apenas como ele mesmo; o supervisor lê tudo da organização e grava veredito que prevalece. Especificação: `docs/specs/VALIDACAO_E_CURADORIA.md`.

Redação anterior (histórico):
Analista lê `evaluations` próprias, mas **scores, oportunidades e diagnóstico** só quando `diagnosis_status = 'aprovado'`, e oportunidades só com status `aprovada`/`ajustada`. Implementado por RLS nas tabelas filhas (join com `evaluations`) e por separar os campos de diagnóstico da linha principal (`analysis_runs`), de modo que nenhuma consulta direta exponha conteúdo pendente.

## 5. Curadoria (veredito do supervisor)

RPCs `decide_opportunity(opportunity_id, decision, note, adjusted_recommendation)` e `decide_diagnosis(evaluation_id, decision, review)`:
- validam `is_supervisor(org)` da organização da avaliação;
- validam transições de estado permitidas;
- gravam `curation_logs` na mesma transação.

Políticas de UPDATE diretas nas colunas de curadoria são negadas a todos os papéis não supervisores (correção #2).

## 6. Motor de IA (Fase 3)

Pipeline na Edge Function `analyze-evaluation`, em módulos independentes do provedor:

1. **Entrada:** carrega a transcrição (servidor), valida que o chamador pode analisar a avaliação. **Não carrega CSAT** (regra 4.5/§8).
2. **Prompt versionado:** `PROTOCOL_PROMPT V1.1` verbatim (REF §6.2) armazenado em arquivo versionado + `protocol_versions`; `prompt_version` registrado na execução.
3. **Adaptador de provedor:** interface `generateStructured({ prompt, schema, files? })`; provedor, URL, modelo e chave lidos de `ai_provider_configs` + Vault, configurados pela interface (D-009, `docs/specs/PROVEDOR_IA.md`).
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

## 11. Extensão de captura (D-018)
Produto separado em `extension/` (Chromium MV3): captura por adaptador de plataforma, `.txt` por ticket na pasta escolhida pelo analista e envio por Edge Function de ingestão autenticada que cria/atualiza a avaliação pelo ticket e, em "Analisar ao vivo", dispara a análise. Especificação: `docs/specs/EXTENSAO_CAPTURA.md`.
