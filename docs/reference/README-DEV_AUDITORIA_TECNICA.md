# README-DEV — AUDITORIA TÉCNICA PROFUNDA — PROTOCOLO CX 1.1

> **Natureza deste documento:** auditoria somente-leitura do estado atual da aplicação, para replicação independente da infraestrutura Base44 com paridade funcional e visual de ~99%. **Nenhum arquivo, entidade, permissão ou dado foi alterado.** A aplicação é a fonte de verdade. Todo código citado foi lido dos arquivos reais; o que não pôde ser inspecionado está marcado como tal.

---

## 0. SUMÁRIO EXECUTIVO DA ENTREGA

### 0.1 Inventário real (síntese)
- 1 app React 18 + Vite (ESM) com 16 rotas (9 do domínio + 4 de auth + pesquisa pública + 404), 14 componentes de domínio (`src/components/cx/**`), ~40 componentes shadcn/ui de scaffold, 2 bibliotecas de domínio (`src/lib/cx.js`, `src/lib/cxAi.js`), 9 entidades + User.
- **Zero backend functions, workflows, agents ou rotas de servidor** (`base44/functions/`, `base44/workflows/`, `base44/agents/` não existem). **Toda a lógica — incluindo as chamadas de IA e o armazenamento de arquivos — roda no frontend** via `@base44/sdk` (integrações Core).
- Sem estado global além de `AuthContext`; sem react-query em uso no domínio (o provider existe, instanciado com `refetchOnWindowFocus: false, retry: 1`, mas as páginas usam `useState`/`useEffect` + SDK direto).

### 0.2 Mapa de dependências do Base44 (o que precisa ser substituído na replicação)
| Dependência | Onde | Substituto necessário fora do Base44 |
|---|---|---|
| `@base44/sdk` — `createClient` | `src/api/base44Client.js` | Cliente próprio para entidades/auth/storage |
| `base44.app.getPublicSettings()` | `src/lib/AuthContext.jsx` | Endpoint de config pública do app |
| `base44.auth.me()/logout()/redirectToLogin()` + OAuth Google | `AuthContext`, páginas de auth | Backend de sessão próprio |
| `base44.entities.<Name>.{get,filter,list,create,bulkCreate,update,deleteMany}` + RLS | todas as páginas | API de dados com row-level security equivalente |
| `base44.integrations.Core.InvokeLLM` | `src/lib/cxAi.js` (3 prompts) | Gateway LLM com suporte a `file_urls` (vision) e `response_json_schema` |
| `base44.integrations.Core.ExtractDataFromUploadedFile` | `cxAi.extractSpreadsheetRows` | Extração estruturada de CSV/XLSX/JSON/HTML |
| `base44.integrations.Core.UploadPrivateFile` / `CreateFileSignedUrl` | `cxAi.uploadPrivateFile` / `signFileUri` | Storage privado + URLs assinadas (TTL 3600 s) |
| `@base44/vite-plugin` (build + HMR/preview) | `vite.config.js` | Removível: apenas `@vitejs/plugin-react` permanece |
| Env `VITE_BASE44_*` | `src/lib/app-params.js` | Ver §A.7 |

### 0.3 Pendências/contratos ainda necessários para replicação
1. Chaves do LLM (provedor e modelo exatos por trás de `InvokeLLM` com `model` omitido = "automatic" — **não configurável/inspecionável a partir do código**; ver §C.16).
2. Serviço equivalente de extração estruturada (`ExtractDataFromUploadedFile`) — o comportamento de tolerância a colunas arbitrárias depende do implemento da plataforma.
3. Storage privado com assinatura de URLs.
4. Backend de auth (email/senha + Google + OTP de registro + reset de senha) — páginas boilerplate em `src/pages/{Login,Register,ForgotPassword,ResetPassword}.jsx` e `OAuthConsent.jsx` **não foram transcritas nesta auditoria** (código boilerplate da plataforma); manter as do template é suficiente para paridade.
5. `/manifest.json` referenciado por `index.html` (servido pela plataforma; não existe no repositório).

### 0.4 Lacunas entre documentação funcional e código (ver Bloco H)
- A curadoria obrigatória é garantida **apenas por UI e por uma regra de leitura parcial**: via API, o criador da avaliação tem `update` irrestrito (`created_by_id == user.id`) e pode aprovar o próprio diagnóstico; a página de detalhe mostra a análise ao **dono** mesmo antes da aprovação (`canSeeAnalysis = isAdmin || isOwner || aprovado`).
- "Reanalisar" em avaliação já **curada** reabre o ciclo: apaga scores/oportunidades (inclusive curadas) e volta `status`/`diagnosis_status` para `analisado`/`pendente`.
- Listas usam `limit` fixo (200–1000) sem cursor: acima disso, indicadores divergem silenciosamente.
- ~20 dependências npm instaladas não são usadas pelo código do domínio (§A.3).

### 0.5 Ordem recomendada de extração restante
1. Transcrever as páginas boilerplate de auth (Login/Register/Forgot/Reset/OAuthConsent) e `src/components/{AuthLayout,GoogleIcon,UserNotRegisteredError,ScrollToTop}.jsx`.
2. Exportar os dados reais (entidades) caso a paridade exija conteúdo, não só comportamento.
3. Congelar comportamento de `InvokeLLM` com `model: 'automatic'` escolhendo um modelo específico na replicação e ajustando os prompts até saída equivalente.
4. Decidir o serviço de extração de planilhas (LLM alternativo ou parser determinístico + mapeamento de colunas).

---

# BLOCO A — INVENTÁRIO EXATO DO PROJETO

## A.1 Árvore completa (real, sem `node_modules`/`dist`)

```
./
├── .gitignore · .npmrc · AGENTS.md · CLAUDE.md · README.md · README-DEV.md (este)
├── package.json · package-lock.json · vite.config.js · tailwind.config.js
├── postcss.config.js · jsconfig.json · components.json · eslint.config.js · index.html
├── base44/
│   ├── config.jsonc
│   └── entities/{AppSetting,CsatRecord,CurationLog,Evaluation,EvaluationScore,
│                 Opportunity,ProtocolVersion,SurveyResponse,SurveyTicket,User}.jsonc
└── src/
    ├── main.jsx · App.jsx · index.css
    ├── api/base44Client.js
    ├── lib/{app-params.js, authReturnTo.js, AuthContext.jsx, cx.js, cxAi.js,
    │        query-client.js, utils.js, PageNotFound.jsx}
    ├── utils/index.ts                      # createPageUrl(pageName) → '/Nome-com-hifens'
    ├── hooks/{use-mobile.jsx, use-size.jsx}
    ├── components/
    │   ├── {AuthLayout, GoogleIcon, ProtectedRoute, ScrollToTop, UserNotRegisteredError}.jsx
    │   ├── cx/{Layout, StatCard, ScoreList, AnalystComparison, CompetencyCard, DiagnosisCard,
    │   │        CurationCard, OpportunityCard, PrintGallery, CsatPanel, SpreadsheetImport}.jsx
    │   ├── cx/charts/{CsatDistribution, CompetencyEvolution, SeverityChart}.jsx
    │   └── ui/… (~40 arquivos shadcn: accordion, alert-dialog, alert, aspect-ratio, avatar,
    │            badge, breadcrumb, button, calendar, card, carousel, chart, checkbox,
    │            collapsible, command, context-menu, dialog, drawer, dropdown-menu, form,
    │            hover-card, image, image-helpers.js, input-otp, input, label, menubar,
    │            navigation-menu, pagination, popover, progress, radio-group, resizable,
    │            responsive-image, scroll-area, select, separator, sheet, sidebar, skeleton,
    │            slider, sonner, switch, table, tabs, textarea, toast, toaster,
    │            toggle-group, toggle, tooltip, use-responsive-image.jsx, use-toast)
    └── pages/{Curation, Dashboard, EvaluationDetail, Evaluations, ForgotPassword, Login,
              MyDevelopment, NewEvaluation, OAuthConsent, ProtocolPage, Register,
              ResetPassword, Satisfaction, Survey}.jsx
```

**Arquivos efetivamente utilizados pelo domínio CX:** tudo em `src/pages/` listado exceto auth boilerplate; `src/components/cx/**`; `src/lib/{cx,cxAi,AuthContext,app-params,query-client,authReturnTo,utils}.js(x)`; `src/components/{ProtectedRoute,UserNotRegisteredError,ScrollToTop}.jsx`; `src/components/ui/{button,input,textarea,label,tabs,select,dialog,toaster}` (+ dependências transitivas shadcn); `src/index.css`; `tailwind.config.js`; `index.html`; `base44/entities/*`; `base44/config.jsonc`.

**Obsoletos/não referenciados pelo código do domínio** (scaffold shadcn completo — não importar tudo reduz o bundle): `accordion, alert-dialog, alert, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, image*, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, toggle*, tooltip, use-responsive-image` (importados apenas entre si ou por nada).

## A.2 Configuração de build (`vite.config.js` — verbatim)

```js
import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true, navigationNotifier: true, analyticsTracker: true, visualEditAgent: true
    }),
    react(),
  ]
});
```

`base44/config.jsonc` (deploy da plataforma):
```jsonc
{ "name": "base44-app",
  "site": { "installCommand": "npm install", "buildCommand": "npm run build",
            "serveCommand": "npm run dev", "outputDirectory": "./dist" } }
```

Aliases (`jsconfig.json` + uso): `@/*` → `./src/*`. `moduleResolution: bundler`, `jsx: react-jsx`, `type: module` (ESM puro). PostCSS padrão (`tailwindcss` + `autoprefixer`). `components.json` (shadcn): style `new-york`, `rsc: false`, `tsx: false`, css `src/index.css`, baseColor `neutral`, cssVariables `true`, aliases padrão, iconLibrary `lucide`.

## A.3 Dependências (package.json, `name: "base44-app"`, `version: 0.0.0`)

**Efetivamente usadas pelo domínio:** `@base44/sdk ^0.8.57`, `@base44/vite-plugin ^1.0.47`, `react ^18.2.0`, `react-dom ^18.2.0`, `react-router-dom ^7.18.4`, `lucide-react ^0.475.0`, `recharts ^2.15.4`, `class-variance-authority ^0.7.1`, `clsx ^2.1.1`, `tailwind-merge ^3.0.2`, `@radix-ui/react-{slot,dialog,label,select,tabs,toast}` e pares usados pelos componentes shadcn importados, `tailwindcss-animate`, `@tanstack/react-query ^5.84.1` (provider apenas).

**Instaladas mas NÃO usadas no código do domínio** (removíveis na replicação): `@hello-pangea/dnd`, `@hookform/resolvers`, `@stripe/*`, `canvas-confetti`, `cmdk`, `date-fns`, `embla-carousel-react`, `framer-motion`, `html2canvas`, `input-otp`, `jspdf`, `lodash`, `moment`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-hot-toast`, `react-leaflet`, `react-markdown`, `react-quill-new`, `react-resizable-panels`, `sonner`, `three`, `vaul`, `zod`.

**DevDependencies relevantes:** `tailwindcss ^3.4.17`, `autoprefixer`, `postcss`, `vite ^8.3.3` (atualizada por correção de segurança OSV; anteriormente 8.2.0), `@vitejs/plugin-react ^6.0.5`, `typescript ^5.8.2`, `eslint ^9` com plugins react/react-hooks/react-refresh/unused-imports, `nitro` (beta, plugin da plataforma).

Scripts: `dev` (vite) · `build` (vite build) · `preview` · `lint`/`lint:fix` · `typecheck` (tsc -p jsconfig).

## A.4 Rotas (`src/App.jsx`) — verbatim essencial

```jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/pesquisa/:token" element={<Survey />} />               // pública, sem layout
  <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
    <Route element={<CxLayout />}>                                      // sidebar/topbar + <Outlet/>
      <Route path="/" element={<Dashboard />} />
      <Route path="/avaliacoes" element={<Evaluations />} />
      <Route path="/nova-avaliacao" element={<NewEvaluation />} />
      <Route path="/avaliacao/:id" element={<EvaluationDetail />} />
      <Route path="/curadoria" element={<Curation />} />
      <Route path="/meu-desenvolvimento" element={<MyDevelopment />} />
      <Route path="/satisfacao" element={<Satisfaction />} />
      <Route path="/protocolo" element={<ProtocolPage />} />
    </Route>
  </Route>
  <Route path="*" element={<PageNotFound />} />
</Routes>
```

Wrapper: `AuthProvider → QueryClientProvider(queryClientInstance) → Router → ScrollToTop + AuthenticatedApp + Toaster`. `AuthenticatedApp`: spinner full-screen enquanto `isLoadingPublicSettings || isLoadingAuth`; `authError.type === 'user_not_registered'` → `<UserNotRegisteredError/>`; `auth_required` → `navigateToLogin()` (usa `base44.auth.redirectToLogin(window.location.href)`).

## A.5 Providers, hooks, contexts, estado
- **`AuthContext`** (`src/lib/AuthContext.jsx`): estado `{ user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, authChecked, appPublicSettings }`. Boot: `base44.app.getPublicSettings()` → se `appParams.token` existe, `base44.auth.me()`. `logout(shouldRedirect=true)` → `base44.auth.logout(window.location.href)`. Consumido por todas as páginas via `useAuth()`; papel do usuário: `user.role === 'admin'` (supervisor) vs `user` (analista).
- **`ProtectedRoute`** (`src/components/ProtectedRoute.jsx`): fallback spinner; re-checa auth se `!authChecked && !isLoadingAuth`; `user_not_registered` → tela de erro; não autenticado → `unauthenticatedElement`; senão `<Outlet/>`.
- **Sem store global de domínio.** Cada página carrega dados com `base44.entities.X.filter(...)` em `useEffect` + `useState` e recalcula tudo client-side. `QueryClient` existe apenas como provider.

## A.6 Funções de backend / automações / assíncronos
**Não existem.** Nenhum arquivo em `base44/functions/`, `base44/workflows/`, `base44/agents/`; nenhuma rota de servidor; nenhum cron; nenhuma assinatura realtime (`subscribe` não é usada). Todo o trabalho assíncrono é feito pela própria UI aguardando Promises (spinners `Loader2`/spinner border).

## A.7 Variáveis de ambiente (somente nomes e finalidades)
| Nome | Finalidade |
|---|---|
| `VITE_BASE44_APP_ID` | Identifica o app no backend Base44 |
| `VITE_BASE44_FUNCTIONS_VERSION` | Versão das funções serverless a invocar |
| `VITE_BASE44_APP_BASE_URL` | URL base do app (construção de links) |
| `BASE44_LEGACY_SDK_IMPORTS` | Habilita imports legados no plugin Vite (não usado: `false`) |
| (runtime) `localStorage.base44_access_token` / `token` | Token de acesso do usuário (limpos se `?clear_access_token=true`) |
| (runtime) `?functions_version=` na URL | Sobrepõe a versão de funções |

## A.8 Funcionalidades que dependem de serviços internos não exportáveis
1. `InvokeLLM` com `model` omitido (seleção "automatic" do modelo — interna da plataforma).
2. `ExtractDataFromUploadedFile` (extração tolerante a qualquer layout de planilha).
3. `UploadPrivateFile`/`CreateFileSignedUrl` (storage privado com assinatura).
4. Auth (OTP, OAuth Google, reset) — boilerplate da plataforma.
5. Publicação/URL pública para a rota `/pesquisa/:token` funcionar para clientes externos (o app precisa estar publicado e público).

---

# BLOCO B — MODELO DE DADOS E SEGURANÇA

Convenções Base44: todo registro tem `id`, `created_date`, `updated_date`, `created_by_id` (auditória, automáticos — **não declarados nos schemas**). RLS usa `{{user.id}}` e `user_condition: {role:'admin'}`; sem regra = aberto (inclusive anônimo). Schemas completos estão em `base44/entities/*.jsonc`; como são idênticos aos transcritos no `src/README.md` §4 (que foi gerado destes arquivos), aqui se documenta comportamento + RLS por entidade sem repetir os 9 JSON integralmente (a fonte de verdade é o arquivo `.jsonc`).

## B.1 Evaluation
- **Campos**: `protocol`, `analyst_name`, `analyst_user_id`, `channel`, `source`∈{prints, texto, importacao}, `status`∈{rascunho, transcrito, analisado, curado}, `transcript` (sem limite), `print_files[]` (URIs privadas), `trend`, `strengths`, `summary_feedback`, `uncertainties`, `diagnosis_status`∈{pendente, aprovado, rejeitado}, `supervisor_review`, `survey_token`. **required: []** (nenhum campo obrigatório — a criação aceita payload parcial).
- **RLS**: read = `created_by_id == user.id` OU `analyst_user_id == user.id` OU admin. create = `analyst_user_id == user.id` OU admin. update/delete = `created_by_id == user.id` OU admin.
- **Integridade/duplicidade**: nenhuma chave única em `protocol` — a deduplicação é **aplicacional**: `SpreadsheetImport.commit` busca `Evaluation.filter({protocol}, limit 1)` antes de criar. Duas criações concorrentes com o mesmo protocolo geram duplicatas.
- **Falhas**: erros de SDK propagam (sem catch no domínio, exceto `SpreadsheetImport` por linha: marca `failed` e continua).

## B.2 EvaluationScore — required `['evaluation_id','competency']`; `score` number 0–10 ou null (não avaliável); `classification` derivada por `scoreClassification()` no momento da análise e persistida. RLS: leitura/escrita = `analyst_user_id == user.id` OU admin. Recriado integralmente a cada análise (`deleteMany({evaluation_id})` + `bulkCreate`).

## B.3 Opportunity — required `['evaluation_id']`; `status`∈{pendente, aprovada, ajustada, rejeitada}; `severity`∈SEVERITIES; `origin`∈ORIGINS; `confidence`∈CONFIDENCES; `supervisor_note`, `adjusted_recommendation` preenchidos na curadoria. RLS: dono (`analyst_user_id`) OU admin em read/create/**update/delete**. ⚠️ o analista dono pode, via API, alterar `status` das próprias oportunidades (ver H.2).

## B.4 CsatRecord — `required: []`; `score` number 1–5 (ou null quando só existe comentário/nível); `source`∈{planilha, pesquisa, manual, arquivo}. RLS: read/create = dono OU admin; **update/delete = somente admin**. Vários registros por avaliação são permitidos (histórico); indicadores usam o **primeiro** registro 1–5 por avaliação (ordenado `-created_date`) para badge de lista, mas **todos** para médias.

## B.5 SurveyTicket — required `['token','evaluation_id']`; read **aberto (anônimo)**; escrita admin. Token gerado no cliente: `crypto.randomUUID().replace(/-/g,'')`.
## B.6 SurveyResponse — required `['token','score']`; read/update/delete admin; **create aberto (anônimo)** — é o único ponto de escrita pública do sistema.
## B.7 AppSetting — required `['key']`; read aberto; escrita admin. Chave única na prática: `csat_positive_threshold` (a página Satisfação faz create-or-update consultando `filter({key})`).
## B.8 ProtocolVersion — required `['version']`; read aberto; escrita admin.
## B.9 CurationLog — required `['action']`; **todas as operações admin** (auditoria). `target`∈{oportunidade, diagnóstico}; `action`∈{aprovada, ajustada, rejeitada, diagnóstico aprovado, diagnóstico rejeitado}.
## B.10 User (built-in) — `role` enum `[admin, user]`, required. Somente admins listam/editam outros usuários; usuários entram por convite (`base44.users.inviteUser`), não por insert direto.

## B.11 Matriz de permissões (efetiva, combinando RLS + UI)
| Operação | Não autenticado | Analista responsável | Analista não responsável | Supervisor/admin | Cliente (link público) |
|---|---|---|---|---|---|
| Ver avaliação | ✗ (redirect login) | ✓ (próprias, via `analyst_user_id` ou `created_by_id`) | ✗ (RLS filtra) | ✓ todas | ✗ |
| Criar avaliação | ✗ | ✓ (auto-vinculada) | — | ✓ (sem dono) | ✗ |
| Editar transcrição/status | ✗ | ✓ se criou (`created_by_id`) | ✗ | ✓ todas | ✗ |
| **Aprovar diagnóstico / mudar `diagnosis_status`** | ✗ | ⚠️ **via API: sim, se criou** (UI não expõe) | ✗ | ✓ | ✗ |
| Mudar `status` de oportunidade | ✗ | ⚠️ via API (RLS update permite dono) | ✗ | ✓ (UI) | ✗ |
| Ver scores/oportunidades pré-aprovação | ✗ | ⚠️ **sim via RLS read** + `canSeeAnalysis = isAdmin || isOwner || aprovado` (dono vê na página de detalhe) | ✗ | ✓ | ✗ |
| Registrar CSAT | ✗ | ✓ (próprios) | ✗ | ✓ (UI completa) | somente via SurveyResponse |
| Responder pesquisa | Survey: read aberto de `SurveyTicket` (validação de token) e **create** de `SurveyResponse` | — | — | — | ✓ |
| Settings/versões/logs | read aberto (auth interna) | read | read | escrita | — |

**B.12 — Verificação específica solicitada ("consulta direta permite ver análise antes da aprovação?"):** **Sim, dois caminhos existem.** (1) RLS de `EvaluationScore`/`Opportunity` permite ao analista dono **ler** tudo imediatamente após a análise, antes da curadoria — o gating por `diagnosis_status === 'aprovado'` é aplicado apenas na **UI** (`canSeeAnalysis`) e no portal `MyDevelopment`. (2) Na página de detalhe, `canSeeAnalysis` inclui `isOwner`, ou seja, o analista que criou a avaliação **vê o diagnóstico pendente** na própria tela. O acesso de *outros* analistas é bloqueado por RLS. Ver H.1/H.2 para o risco equivalente de escrita.

---

# BLOCO C — MOTOR DE INTELIGÊNCIA ARTIFICIAL (`src/lib/cxAi.js`, integral em comportamento)

## C.1 Utilitários
```js
const unwrap = (res) =>
  res && typeof res === 'object' && 'response' in res && !('transcript' in res) ? res.response : res;
// uploadPrivateFile(file)      → UploadPrivateFile → file_uri
// signFileUri(fileUri, 3600)   → CreateFileSignedUrl → signed_url
// getPositiveThreshold()       → AppSetting 'csat_positive_threshold' → int 1–5 ou 4 (try/catch → 4)
```

## C.2 `extractTranscriptFromPrints(fileUris)` — 1 chamada `InvokeLLM` com `file_urls` (URLs assinadas, TTL 3600 s) e `response_json_schema {transcript*, protocol, analyst_name, channel, uncertainties}`. **Prompt verbatim:** "Extraia a transcrição fiel e completa do chat de atendimento de suporte presente nos arquivos anexos, na ordem cronológica das mensagens. Use o formato \"Atendente: ...\" e \"Cliente: ...\" para cada mensagem. NÃO invente mensagens nem procedimentos: marque trechos ilegíveis ou não visíveis como [ilegível]. Se algum dado estiver visível, informe também o número do chamado/protocolo, o nome do analista/atendente e o canal. Em \"uncertainties\", registre incertezas e informações ausentes."
Mensagens ilegíveis → literal `[ilegível]`. Sem tentativas de reordenação pós-LLM: a ordenação é responsabilidade do prompt.

## C.3 `analyzeTranscript(transcript)` — 1 chamada `InvokeLLM({prompt: PROTOCOL_PROMPT + '\n\nTRANSCRIÇÃO DO ATENDIMENTO:\n"""\n' + transcript + '\n"""', response_json_schema})`. **PROTOCOL_PROMPT V1.1 (verbatim, completo — inclui as seis competências 0–10, classificações 9-10/7-8/5-6/3-4/0-2, score null quando sem evidências, proibição de nota global ponderada, evidência textual obrigatória, oportunidades em quantidade variável inclusive zero, severidade/origem/confiança, tendência somente qualitativa, feedback construtivo com strengths e uncertainties)**. O texto integral está preservado em `src/README.md` §6.2 (idêntico ao arquivo). Schema de saída: `scores[{competency*, score: number|null, evidence}], opportunities[{severity*, evidence*, description*, impact, origin, recommendation, improved_example, confidence}], trend*, strengths, uncertainties, summary_feedback` (required: `['scores','opportunities','trend']`).
- **Pós-processamento persistido** (`EvaluationDetail.analyze`): classification calculada por `scoreClassification(score)` (não confiada ao LLM); `trend` normalizada por `normalizeTrend()` (contains "desfavor"→Desfavorável, "favor"→Favorável, "incert"→Incerta, default **Incerta**); defaults de oportunidade: `severity`→'Desejável', `origin`→'Indeterminada', `confidence`→'Médio', `status:'pendente'`.
- **Multiatendimento**: tratado no prompt (contexto operacional, não penalizar pausas/typos, não presumir falhas de carga sem evidência) — não há lógica de código adicional.
- **Não avaliável**: score `null` persistido; classification "Não avaliável" (slate); `CompetencyCard`/`ScoreList` exibem "—" e barra 0%.

## C.4 `extractCsatFromDocument(fileUri)` — 1 chamada vision com schema `{chamado*, nota, nivel, sentimento, comentario, motivo, canal, assunto, avaliado_em, uncertainties}`. Prompt: extrai, não inventa, registra incertezas. Pré-visualizada em `Satisfaction` antes de persistir (`source:'arquivo'`).

## C.5 `extractSpreadsheetRows(fileUrl)` — `ExtractDataFromUploadedFile` com schema de **18 campos opcionais** (`chamado, responsavel, canal, avaliado_em, aberto_em, nota, nivel, sentimento, assunto, comentario, motivo, temas, evidencia, acao_recomendada, transcricao, equipe, marca, quem_avaliou`). `status === 'error'` → `throw Error(details)`. Saída sempre forçada a array.

## C.6 `normalizeSpreadsheetRow(row)` (regras exatas)
1. `score = parseNota(nota) ?? deriveScoreFromLevel(nivel) ?? scoreFromSentiment(sentimento)`.
   - `parseNota`: regex `/\d+(\.\d+)?/` após trocar vírgula por ponto; `Math.round`; válido 1–5, senão null.
   - `deriveScoreFromLevel`: {Ótimo:5, Bom:4, Neutro:3, Ruim:2, Péssimo:1}.
   - `scoreFromSentiment`: "muito positivo"→5, "positiv*"→4, "muito negativ"→1, "negativ"→2, "neutr"→3, senão null.
2. `hasCsat = score || comentario || nivel || sentimento`; `hasEvalData = chamado || transcricao || responsavel || canal`.
3. **Skip (linha de resumo/ruído)** quando sem transcrição E (≥2 valores ∈ {ótimo,bom,neutro,ruim,péssimo} || responsavel === "responsável" (case-insensitive) || contém "%" sem csat || sem evalData e sem csat). Motivo: "Linha de resumo ou sem dados reconhecíveis".
4. Saída: `evaluation = {protocol, analyst_name, channel, transcript, source:'importacao', status: transcricao ? 'transcrito' : 'rascunho'}`; `csat` (se hasCsat) com 14 campos + `source:'planilha'`.

## C.7 Reanálise e substituição
`EvaluationDetail.analyze()` — sem verificação de `status`: `deleteMany({evaluation_id})` de `EvaluationScore` **e** `Opportunity` (apaga inclusive oportunidades já curadas e seus ajustes) → `bulkCreate` novos → `Evaluation.update({status:'analisado', trend, strengths, summary_feedback, uncertainties, diagnosis_status:'pendente'})` → `load()`. Reanálise de avaliação **curada** reverte o ciclo para "Em curadoria" (ver H.4). O botão "Reanalisar" aparece quando `analyzed && canEdit && transcript` — inclui status `curado`.

## C.8 Separação IA × CSAT real
**Confirmado: a IA nunca recebe a nota real.** Os três prompts de diagnóstico (`PROTOCOL_PROMPT`, extração de prints, extração de CSAT) são chamadas independentes; nenhum prompt recebe `CsatRecord`, `SurveyResponse` ou campo `score` de satisfação; o prompt explicita "Você não conhece a nota real do cliente". O CSAT entra no fluxo apenas em telas do supervisor e no portal aprovado. Um `CsatRecord` pode até existir antes da análise (importação), mas não é passado ao LLM.

## C.9 Falhas e respostas inválidas
- `SpreadsheetImport.handleFile`: catch → mensagem de erro + volta a `idle`. Commit: `try/catch` **por linha** → linha marcada `failed`, segue para a próxima; resumo final com contagens.
- Demais funções: sem catch (erro propaga; a UI fica com spinner parado via `finally` que limpa `busy`). Sem retry em nenhuma chamada de IA.
- `unwrap` trata o envelope `{response}` do SDK; schema com raiz `object` garante dict.
- Resposta sem campo: defaults (`|| ''`, `|| null`) em todo o mapeamento.

## C.10 Provedor/modelo/limites
- Provedor: `base44.integrations.Core.InvokeLLM` — **modelo não especificado no código** (`model` omitido → "automatic", escolha interna da plataforma; não inspecionável). Nenhuma chamada usa `add_context_from_internet`. Vision via `file_urls` nas extrações de print/PDF.
- Sequência por fluxo: prints = upload N + sign N + 1 InvokeLLM; análise = 1 InvokeLLM; CSAT doc = upload + sign + 1 InvokeLLM; planilha = upload + sign + 1 ExtractDataFromUploadedFile + N×create no commit.
- Limites: transcrição "sem limite" (string única); extração de planilha limitada pelo serviço da plataforma; TTL de URL assinada 3600 s.

---

# BLOCO D — REGRAS DE NEGÓCIO E FLUXOS

## D.0 Máquinas de estado
**Atendimento** (`Evaluation.status`): `rascunho --(salvar com texto)--> transcrito --(Analisar com a IA)--> analisado --(decideDiagnosis)--> curado`; `curado --(Reanalisar)--> analisado` (reabre). `transcrito --(limpar texto e salvar)--> rascunho`.
**Curadoria** (`diagnosis_status`): `pendente --(Aprovar)--> aprovado` / `--(Rejeitar)--> rejeitado`; reanálise → volta a `pendente`. **Oportunidade** (`status`): `pendente → aprovada | ajustada | rejeitada` (decisão única; sem reversão na UI).

## D.1–D.15 Fluxos (entrada → operações → estado visível → repetição)
1. **Auth**: plataforma (email/senha, Google, registro com OTP, reset). Contexto em A.5. Repetição: sessão persiste por token em localStorage.
2. **Criar avaliação** (`/nova-avaliacao`): valida nada além de transcrição não vazia para o botão; `Evaluation.create({protocol, analyst_name, channel, transcript, print_files, source: prints?'prints':'texto', status, analyst_user_id: isAdmin? null : user.id})` → navega `/avaliacao/{id}`. Repetido: cria nova avaliação (sem dedup por protocolo aqui).
3. **Colar/editar transcrição** (detalhe, `editable = canEdit && status∈{rascunho,transcrito}`): `update({transcript, status})` → `load()`. Repetido: sobrescreve.
4. **Upload/extração de prints** (stored privately): `UploadPrivateFile` por arquivo → lista com Remover → "Extrair transcrição com IA" preenche transcript/protocol/canal (analista/canal só se vazio/permitido).
5. **Análise IA**: C.3/C.7. Visível: status "Em curadoria", 6 cards, diagnóstico.
6. **Reanálise**: idem 5 (button "Reanalisar"); zera curadoria anterior.
7. **Curadoria de oportunidades** (`OpportunityCard`, admin + pendente): Aprovar `{status:'aprovada'}` · Ajustar `{status:'ajustada', supervisor_note, adjusted_recommendation}` · Rejeitar `{status:'rejeitada', supervisor_note}` → `Opportunity.update` + `CurationLog.create({evaluation_id, opportunity_id, target:'oportunidade', action:status, note})` → `load()`.
8. **Diagnóstico**: `CurationCard` — parecer (textarea) → `Evaluation.update({diagnosis_status, supervisor_review, status:'curado'})` + `CurationLog.create({target:'diagnóstico', action:'diagnóstico aprovado'|'diagnóstico rejeitado', note:review})`. **Aprovar/rejeitar não depende das oportunidades** — cada uma é decidida isoladamente.
9. **Liberação ao analista**: `MyDevelopment` lista somente `diagnosis_status === 'aprovado'` e oportunidades `status ∈ {aprovada, ajustada}`; `EvaluationDetail` mostra análise quando `isAdmin || isOwner || aprovado` (ver B.12).
10. **Importar CSV/XLSX** (`SpreadsheetImport`, stages `idle→extracting→preview→committing→done`): A.6/C.5/C.6 + commit C.7 do README (reuso por protocolo; não-admin auto-vincula; resumo created/linked/failed). Repetido: reimportar o mesmo protocolo **vincula** à avaliação existente (não duplica avaliação; duplica CsatRecord).
11. **CSAT manual**: `CsatPanel` (na avaliação) e `Satisfaction` (por protocolo) → `CsatRecord.create({source:'manual', ...})`.
12. **CSAT por PDF/print**: C.4 + prévia + persist com `evaluation_id` por lookup de protocolo.
13. **Pesquisa pública**: `CsatPanel` (admin) gera token → `SurveyTicket.create` + `Evaluation.update({survey_token})` → URL `${origin}/pesquisa/${token}` copiável.
14. **Resposta da pesquisa** (`/pesquisa/:token`, anônima): valida token em `SurveyTicket` → `SurveyResponse.create({token, score 1–5, comment})`. Supervisor em `Satisfaction`: "Registrar" → `CsatRecord.create({source:'pesquisa', evaluation_id do ticket})` **+ `SurveyResponse.delete`**; "Descartar" → só delete. ⚠️ a resposta não é marcada como usada além da exclusão; token permanece válido (múltiplas respostas possíveis pelo mesmo link — ver H.7).
15. **Indicadores**: Bloco F.

---

# BLOCO E — INTERFACE E EXPERIÊNCIA

## E.1 Design tokens (verbatim de `src/index.css` — tema claro; `.dark` existe mas não há toggle)
`--background: 40 30% 98%` · `--foreground: 20 15% 12%` · `--card: 0 0% 100%` · `--primary: 174 42% 21%` (petróleo) · `--primary-foreground: 40 30% 98%` · `--secondary: 40 25% 94%` · `--secondary-foreground: 174 42% 21%` · `--muted: 40 20% 95%` · `--muted-foreground: 25 8% 42%` · `--accent: 38 45% 92%` · `--accent-foreground: 30 25% 20%` · `--destructive: 8 70% 48%` · `--border/input: 40 18% 88%` · `--ring: 174 42% 21%` · `--radius: 0.75rem` · `--font-heading/display: 'Fraunces', Georgia, serif` · `--font-body: 'Inter', ui-sans-serif` · chart-1..5 · sidebar-*.
`tailwind.config.js`: cores mapeadas `hsl(var(--…))`; `fontFamily {heading, body, display, mono}`; `borderRadius` {lg, md, sm} derivados de `--radius`; `opacity` 0–100 passo 1; keyframes accordion; plugin `tailwindcss-animate`. **Classes sempre literais** (purge). Breakpoints padrão Tailwind (`sm 640 · lg 1024 · xl 1280`); o app usa `sm`, `lg` (sidebar), `xl` (grade 3 colunas no detalhe).
`index.html`: `lang="pt-BR"`, título "Protocolo de Inteligência CX", Google Fonts Fraunces (400/500/600) + Inter (400/500/600), favicon base44, `/manifest.json`, viewport padrão.

## E.2 Vocabulário visual comum
Cards `rounded-2xl border border-border bg-card`; títulos de página `font-heading text-3xl sm:text-4xl font-semibold tracking-tight`; seções `font-heading text-xl|lg font-semibold`; kickers `text-[11px] uppercase tracking-[0.2em]|tracking-widest text-muted-foreground`; badges `rounded-full border px-2.5 py-1 text-xs` com as paletas emerald/teal/amber/orange/red/sky/slate-50/200/800 (`CLASSIFICATION/SEVERITY/TREND/STATUS_STYLES` em `cx.js`); vazios `rounded-2xl border border-dashed`; loading: spinner `w-8 h-8 border-4 border-secondary border-t-primary animate-spin` central ou `Loader2` inline; botões `rounded-lg|rounded-xl`, primário `bg-primary`.

## E.3 Telas (estrutura, condicionais, estados, responsividade)
- **Layout** (`cx/Layout.jsx`): sidebar desktop fixa `w-64` (logo: quadrado `rounded-xl bg-primary` com `HeartHandshake`; nav com `NavLink` ativo `bg-accent text-accent-foreground`; rodapé: email truncado + "SUPERVISOR|ANALISTA" + "Sair") e topbar mobile sticky (`bg-card/95 backdrop-blur`, nav horizontal de pills com scroll, ativo `bg-primary text-primary-foreground`). Nav items: Painel(admin), Avaliações, Nova avaliação, Curadoria(admin), Satisfação(admin), Protocolo(admin), Meu desenvolvimento(analistas, `hideForAdmin`). Conteúdo `max-w-6xl`, `lg:pl-64`.
- **Dashboard**: 4 StatCards (`sm:grid-cols-2 lg:grid-cols-4`); badge âmbar de pendências (link curadoria); 2 seções `lg:grid-cols-2` (CsatDistribution + SeverityChart com contadores/percentuais); CompetencyEvolution full-width; AnalystComparison (tabela `min-w-[760px]` com scroll-x); tabela relação×satisfação `min-w-[560px]`. Redirect analista → `/meu-desenvolvimento`.
- **Evaluations**: busca client-side (protocolo/analista/canal); lista de cards-link (status, tendência, "Nota real: X · faixa"); botões Importar planilha + Nova avaliação; empty state (`ClipboardList`).
- **NewEvaluation**: grid `sm:grid-cols-3` (protocolo/canal/analista — analista travado no próprio nome); Tabs texto/prints/planilha; "Criar avaliação" só com transcrição.
- **EvaluationDetail** (a tela central): header (kicker "Protocolo V1.1", título = protocolo, "Analista X · canal · data", badge status, "Reanalisar" condicional, link "Avaliações ←"); 3 métricas; grade `xl:grid-cols-3` — esquerda Competências (`sm:grid-cols-2`, placeholder de bloqueio quando `!canSeeAnalysis`: "A análise deste atendimento está em curadoria pelo supervisor. O conteúdo aparece aqui após a aprovação."), direita DiagnosisCard (se canSeeAnalysis) + CurationCard + "Satisfação real" (CsatPanel); abaixo "Oportunidades de melhoria" (se canSeeAnalysis; empty: "A IA não identificou oportunidades relevantes neste atendimento."). Não-analisado: PrintGallery + textarea editável (salvar/Analisar) ou `<pre>`; "Avaliação real do cliente".
- **Curation**: fila `analisado && diagnosis pendente` com contagem de pendentes por avaliação + tendência; "Curadoria recente" (10 curados, badge do resultado).
- **MyDevelopment**: 3 StatCards; barras por competência; cartões por avaliação aprovada (pontos fortes emerald, feedback, parecer do supervisor em secondary, ScoreList, oportunidades readonly, badges de nota).
- **Satisfaction**: StatCards; importação (planilha + PDF/print com prévia); lançamento manual (botões 1–5); regra de classificação (input threshold 1–5 + distribuição); respostas de pesquisa (Registrar/Descartar); tabela de registros.
- **ProtocolPage**: 6 cards de regras + histórico de versões + form de nova versão (admin) + "Aprendizado contínuo" (CurationLog admin, com ACTION_LABELS).
- **Survey**: standalone centrada `max-w-md`; estados loading/inválido ("Link de pesquisa inválido ou expirado.")/enviado (caixa emerald "Obrigado pela sua avaliação!"); escala 1–5 com botões `h-14 w-14 rounded-2xl` (ativo `scale-105 bg-primary`).
- **Dialog de importação** (`SpreadsheetImport`): `max-w-3xl`, dropzone dashed, tabela de prévia `min-w-[640px]` (Chamado/Responsável/Nota/Transcrição/"O que será feito"), contagem de ignoradas, footer com resumo.
- **Componentes folha**: `StatCard` (label uppercase xs + valor `font-heading text-3xl` + hint); `CompetencyCard` (nome, badge classification, "N de 10", evidência citada; null → "Não avaliável" slate); `DiagnosisCard` (TENDÊNCIA DE SATISFAÇÃO + badge trend, summary_feedback, caixa emerald PONTOS FORTES, uncertainties); `CurationCard` (status Pendente/Aprovado/Rejeitado + parecer; admin+pendente: Aprovar/Rejeitar diagnóstico); `OpportunityCard` (badges gravidade/origem/confiança, descrição, evidência “”, impacto, recomendação, exemplo melhorado; admin+pendente: Aprovar/Ajustar/Rejeitar com campos); `ScoreList` (barra `score*10%` + "Evidência:"); `PrintGallery` (grid de imagens assinadas); `CsatPanel` (registros + admin: manual 1–5 + link de pesquisa com copiar).
- **Charts**: `CsatDistribution` (Bar, células ≥ threshold em `--chart-1`, demais `--chart-3`, `h-64`); `CompetencyEvolution` (Line, `domain [0,10]`, `connectNulls`, 6 cores `--chart-1..5` + `#7c5cbf`, `h-72`); `SeverityChart` (Pie donut inner 55/outer 85, cores fixas `#c2410c/#b45309/#0369a1` + legenda com % arredondada).
- **Ordenação/busca/paginação**: listas `-created_date` com `limit` fixo (200–1000) **sem cursor e sem paginação**; única busca é a da lista de avaliações (client-side).
- **Formulários**: validação mínima (botões disabled até campo obrigatório preenchido; threshold 1–5; nota 1–5 por seleção, nunca texto livre). Sem mensagens de erro inline no domínio (erros propagam).
- **Não documentado funcionalmente mas implementado**: (a) dono vê diagnóstico pendente no detalhe (B.12); (b) reanálise disponível pós-curadoria; (c) `formatDate` degrada para string cruda em data inválida; (d) `deriveScoreFromLevel`/`scoreFromSentiment` geram CSAT sintético marcado apenas pela ausência de campo "nota" (o registro não distingue nota derivada de nota real — ver H.8).

---

# BLOCO F — INDICADORES E CÁLCULOS (fórmulas efetivas, `Dashboard.jsx`/`Satisfaction.jsx`)

Todas as agregações são client-side sobre páginas de `limit` fixo (denominadores truncam acima do limit — H.5).

1. **CSAT positivo** = `round(positivas / total_scored × 100)%`, onde `scored = registros com 1 ≤ score ≤ 5` e `positivas = score ≥ threshold` (threshold = `AppSetting.csat_positive_threshold`, default 4).
2. **Média de satisfação** = `Σ score / n` (2 decimais, `toFixed(2)`).
3. **Taxa de resposta** = `|{evaluations com ≥1 csat}| / |evaluations| × 100` (avaliações lidas com limit 500; csat 1000; `Math.round`).
4. **Distribuição 1–5**: contagem por `Math.round(score)`; barras ≥ threshold destacadas.
5. **Evolução das competências**: média mensal por competência agrupando por `created_date` (chave `AAAA-MM`), **últimos 6 meses com dados**, `null` quando mês sem nota; `connectNulls` no gráfico.
6. **Frequência e gravidade**: `SeverityChart` = contagem por severidade (apenas categorias com count > 0); legenda com `% = round(count/total_presentes×100)`.
7. **Comparativo por analista** (por `analyst_name`, fallback "Não informado", ordenado por nº de avaliações desc): `overall` = **média das médias** (média por competência com notas, depois média entre as competências existentes — não média de todas as notas); `csatAvg` = média dos csat do analista com contagem.
8. **Relação competência↔satisfação**: para cada avaliação com csat, banda = `csatBand(score, threshold)` (≥threshold "Satisfação", =3 "Neutro", senão "Insatisfação"); média das notas de cada competência por banda; `'—'` quando sem dados; aviso fixo "correlação observada não afirma causalidade".
9. **Contadores de curadoria**: contagem de oportunidades por status (default `pendente` quando ausente) com `% sobre o total de oportunidades; **pendências de diagnóstico** = avaliações `status='analisado' && (diagnosis_status||'pendente')='pendente'`.
10. **Portal do analista**: avaliações aprovadas = `diagnosis_status==='aprovado'`; médias só sobre scores dessas avaliações; barra = `min(100, avg/10×100)`.

Arredondamentos: percentuais `Math.round`; médias `toFixed(1)` (competências, `ScoreList`, AnalystComparison) ou `toFixed(2)` (CSAT); nota média do detalhe com vírgula decimal pt-BR. Duplicidades: cada `EvaluationScore`/`Opportunity` conta uma vez por registro (reanálise os substitui); múltiplos `CsatRecord` da mesma avaliação **contam todos** nas médias, mas apenas o primeiro (mais recente) no badge da lista.

---

# BLOCO G — MATRIZ DE TESTES (dados sintéticos; nada foi alterado)

Legenda: ✅ verificado nesta sessão/turnos anteriores (preview com dados reais) · 🔬 comportamento derivado do código (não executado) · ❓ não verificável aqui.

| # | Caso | Entrada | Procedimento | Resultado esperado | Observado |
|---|---|---|---|---|---|
| 1 | Supervisor vê tudo | conta admin | abrir `/`, `/curadoria`, `/satisfacao` | todas renderizam com dados globais | ✅ rotas renderizam (verificação anterior) |
| 2 | Analista isolado | conta `user` | abrir `/avaliacoes` | só avaliações com `analyst_user_id=eu` ou criadas por mim | 🔬 RLS + filtros conferem; ❓ sessão de 2ª identidade não automatizável aqui |
| 3 | Diagnóstico pendente x analista dono | avaliação `analisado`, dono = analista | abrir detalhe como dono | **dono vê** competências/diagnóstico (gating só p/ terceiros) | 🔬 código `canSeeAnalysis`; ✅ placeholder de bloqueio existe para não-dono |
| 4 | Diagnóstico aprovado libera portal | `diagnosis_status='aprovado'` | abrir `/meu-desenvolvimento` | avaliação e oportunidades aprovadas/ajustadas aparecem | 🔬 filtros conferem |
| 5 | Zero oportunidades | análise sem problemas | detalhe | "A IA não identificou oportunidades relevantes neste atendimento." + card de severidade ausente | 🔬 |
| 6 | Competência não avaliável | score null | detalhe | badge "Não avaliável", nota "—", barra 0%, fora das médias | 🔬 (`scoreClassification`, `validScores`) |
| 7 | Transcrição extrema | texto muito longo colado | salvar + analisar | sem limite de campo; análise depende do limite do LLM (não do app) | 🔬 |
| 8 | Print ilegível | imagem sem texto | extração | `[ilegível]` no transcript e `uncertainties` preenchidas | 🔬 prompt |
| 9 | Importação parcialmente inválida | CSV com linhas de resumo | importar | resumo skip; válidas criadas; falhas contadas `failed` | ✅ fluxo verificado em sessão anterior com planilha real (20 avaliações no banco) |
| 10 | Reanálise de avaliação curada | avaliação `curado` | clicar "Reanalisar" | scores/oportunidades antigos **apagados** (inclusive curados), status volta a `analisado`/`pendente` | 🔬 — risco documentado H.4 |
| 11 | Pesquisa inválida | token inexistente | abrir `/pesquisa/xxx` | "Link de pesquisa inválido ou expirado." | 🔬 |
| 12 | Pesquisa respondida 2× | mesmo link | responder de novo | **aceita nova resposta** (token não invalida; múltiplas `SurveyResponse` possíveis) | 🔬 H.7 |
| 13 | CSAT posterior | avaliação analisada | registrar manual | cria registro sem reanálise; indicadores atualizam | ✅ registro manual implementado e renderizado |
| 14 | Falha de IA | erro do InvokeLLM | analisar | spinner para (`finally`), sem toast/erro inline (erro propaga no console) | 🔬 H.9 |
| 15 | Acesso indevido por API | analista não dono tenta `get` | chamada direta SDK | RLS: menos registros / 403 "Permission denied" na escrita | 🔬 (regra da plataforma) |
| 16 | Layout responsivo | viewport mobile | detalhe + layout | colunas empilham, sem overflow horizontal | ✅ verificado (scrollWidth ≤ client+2, 0 erros console) |

---

# BLOCO H — LACUNAS E RISCOS (priorizados)

1. **[Violação potencial da curadoria — escrita]** `Evaluation.update` RLS permite ao **criador** (`created_by_id == user.id`) alterar qualquer campo — inclusive `diagnosis_status: 'aprovado'` e `status: 'curado'` — via API direta. Analistas criam as próprias avaliações, logo podem auto-aprovar diagnósticos sem passar pelo supervisor. A UI não expõe isso, mas o contrato de dados permite. **Na replicação**, se a intenção for curadoria obrigatória forte, restringir update de campos de curadoria a admin (ou mover update de curadoria para backend confiável).
2. **[Vazamento parcial — leitura]** O dono da avaliação lê scores/oportunidades e vê o diagnóstico pendente na página de detalhe (B.12). Se o requisito real for "analista só vê após aprovação", o comportamento atual diverge dele — decisão de produto a registrar antes de replicar.
3. **[Alteração de avaliações por terceiros]** Nenhum; não-donos são bloqueados por RLS em leitura e escrita (verificado nas regras, §B).
4. **[Perda de dados na reanálise]** "Reanalisar" em avaliação `curado` apaga oportunidades com `supervisor_note`/`adjusted_recommendation` e logs implícitos (CurationLog sobrevive, órfão de conteúdo). Sem confirmação/aviso na UI.
5. **[Divergência de indicadores]** Sem paginação por cursor: acima de 500 avaliações / 1000 scores/opps/csat a página lê só a primeira página e os indicadores ficam subestimados sem sinalização. `MyDevelopment` idem (limites 200/1000/500).
6. **[Dependência oculta do modelo]** `InvokeLLM` sem `model` → seleção automática da plataforma; a qualidade/formato dos diagnósticos pode variar com o modelo. Fixar modelo na replicação.
7. **[Pesquisa pública]** Token não invalida após resposta (múltiplas respostas); `SurveyResponse` não guarda `evaluation_id` (só token); `analyst_name` do `CsatRecord` de pesquisa fica vazio. `SurveyTicket.read` é aberto (necessário para a rota pública, mas expõe `evaluation_id` a quem tiver o token).
8. **[CSAT derivado indistinguível]** Nota derivada de nível/sentimento é persistida igual à nota real (`score`), sem flag de origem — contamina o "aprendizado supervisionado" futuro.
9. **[UX de erro mínima]** Falhas de IA/upload fora da importação não têm mensagem ao usuário (spinner simplesmente para); erros aparecem no console.
10. **[Duplicidade por corrida]** Dois imports/criações simultâneas com o mesmo protocolo geram avaliações duplicadas (deduplicação aplicacional, sem chave única).
11. **[Arquivos órfãos]** Prints/planilhas em storage privado nunca são removidos (nem ao remover o print da lista antes de salvar).
12. **[Scaffold pesado]** ~40 componentes shadcn e ~20 dependências npm não utilizados (A.1/A.3) — sem risco funcional, mas expandem o bundle.

---

## APÊNDICE — FONTES
Todo conteúdo foi extraído por leitura direta de: árvore real do repositório (find), `package.json`, `vite.config.js`, `jsconfig.json`, `components.json`, `base44/config.jsonc`, `index.html`, `src/App.jsx`, `src/main.jsx`, `src/api/base44Client.js`, `src/lib/{app-params,AuthContext,query-client,cx,cxAi}.js(x)`, `src/utils/index.ts`, `src/components/ProtectedRoute.jsx`, todas as 9 páginas de domínio + `Survey.jsx`, todos os 14 componentes `cx/**`, e os 10 schemas `base44/entities/*.jsonc`. Páginas boilerplate de auth (`Login/Register/ForgotPassword/ResetPassword/OAuthConsent`, `AuthLayout`, `GoogleIcon`, `UserNotRegisteredError`, `ScrollToTop`, `PageNotFound`) e os ~40 componentes `ui/` **não foram transcritos** (scaffold padrão da plataforma — mantê-los do template atinge paridade). Nenhum dado pessoal, conversa real, token ou segredo é incluído; os prompts citados são propriedade textual do próprio app.

**Nenhum arquivo, entidade, permissão, configuração ou dado da aplicação foi modificado durante esta auditoria.**