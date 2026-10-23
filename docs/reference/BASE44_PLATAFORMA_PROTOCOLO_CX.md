# Protocolo CX — Plataforma de Gestão de Qualidade em Atendimento SaaS

> Documentação técnica integral para replicação 1:1 do projeto por outra IA. Todo o conteúdo abaixo descreve exatamente o estado atual da aplicação: arquitetura, modelo de dados com Row-Level Security, prompts da IA (textuais, verbatim), regras de negócio, design system com tokens e a estrutura arquivo a arquivo.

---

## 1. Visão geral

**Protocolo CX** é uma plataforma de gestão de qualidade de atendimentos de suporte SaaS. O fluxo central:

1. Um **analista** (ou supervisor) registra um atendimento: colando a transcrição do chat, enviando prints/PDF para extração por IA, ou importando planilhas (CSV/XLSX de qualquer formato).
2. A **IA analisa** a transcrição pelo Protocolo de Inteligência CX V1.1: seis competências (notas 0–10), oportunidades de melhoria (quantidade variável, inclusive zero), tendência qualitativa de satisfação, pontos fortes, feedback consolidado e incertezas.
3. A análise fica **"Em curadoria"**: um **supervisor** (usuário com role `admin`) aprova, ajusta ou rejeita cada oportunidade e o diagnóstico consolidado.
4. **Somente o conteúdo aprovado** aparece no portal de autodesenvolvimento do analista ("Meu desenvolvimento").
5. A **nota real de satisfação do cliente** (1–5) é registrada **separadamente e depois** da análise — nunca antes — para uso futuro em aprendizado supervisionado. A IA não conhece a nota real: estima apenas a tendência qualitativa (Favorável / Incerta / Desfavorável), sem percentuais probabilísticos e sem afirmar causalidade.
6. Supervisores acompanham painéis de indicadores: CSAT, evolução das competências, gravidade/frequência das oportunidades, comparativo por analista e relação comportamento↔satisfação (correlação observada, nunca causalidade afirmada).

### Princípios invioláveis do produto

- **Desenvolvimento profissional, não fiscalização punitiva.** Tom de feedback sempre construtivo.
- **Curadoria humana obrigatória**: nada da IA chega ao analista sem aprovação do supervisor.
- **Segregação estrita de dados**: analista vê apenas as próprias avaliações; supervisor (admin) vê tudo.
- **Sem nota global ponderada** nesta fase — apenas as seis competências individuais (os pesos serão definidos depois, com atendimentos reais).
- A IA **não presume falhas no multiatendimento** (analistas atendem 4+ clientes simultâneos) sem evidências; não penaliza pausas isoladas, erros de digitação ou ausência de formalidades.
- A IA **nunca inventa mensagens ou procedimentos**; trechos ilegíveis viram `[ilegível]` e incertezas são sempre registradas.
- Resultados da IA **nunca são apresentados como verdades incontestáveis**.

---

## 2. Stack e ambiente

| Camada | Tecnologia |
|---|---|
| Plataforma | Base44 (backend-as-a-service: auth, entidades, storage, integrações, hosting) |
| Frontend | React 18 + Vite (ESM puro — **nunca `require()`**) |
| Estilo | Tailwind CSS + tokens HSL em `src/index.css` + shadcn/ui em `src/components/ui/` |
| Ícones | lucide-react (apenas ícones existentes) |
| Roteamento | react-router-dom v7 |
| Charts | recharts |
| LLM / extração | Integrações Core do SDK: `InvokeLLM`, `ExtractDataFromUploadedFile`, `UploadPrivateFile`, `CreateFileSignedUrl` |
| Auth | Plataforma (`@/lib/AuthContext`, `ProtectedRoute`, páginas boilerplate em `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`) |
| SDK | `import { base44 } from '@/api/base44Client'` — cliente pré-inicializado |

Idioma: **português (pt-BR)** em toda a UI. Formatação de datas via `toLocaleDateString('pt-BR')`.

---

## 3. Arquitetura de rotas (`src/App.jsx`)

Wrapper padrão da plataforma (preservar intacto): `<AuthProvider>` → `<QueryClientProvider>` → `<Router>` → `<ScrollToTop/>` + `<AuthenticatedApp/>` + `<Toaster/>`.

Rotas:

```jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/pesquisa/:token" element={<Survey />} /> {/* pública — fora do layout e do ProtectedRoute */}
  <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
    <Route element={<CxLayout />}> {/* layout: sidebar desktop + topbar mobile + <Outlet/> */}
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

- `Dashboard`, `Curation` e `Satisfaction` fazem **redirect interno** (`<Navigate replace/>`) se o usuário não for `admin` (Dashboard → `/meu-desenvolvimento`; Curation e Satisfaction → `/`).
- A rota `/` redireciona analistas para `/meu-desenvolvimento`.

---

## 4. Modelo de dados (entidades Base44, `base44/entities/*.jsonc`)

Todos os registros têm os campos embutidos `id`, `created_date`, `updated_date`, `created_by_id` — **nunca declarar** esses campos no schema. `role` do usuário: `admin` (supervisor) ou `user` (analista).

Variável RLS `{{user.id}}` e condição `{"user_condition": {"role": "admin"}}` conforme abaixo. Regra de padrão dominante:

- **Isolamento por dono**: leitura/escrita permitida quando `data.analyst_user_id == user.id` **OU** o usuário é `admin`.
- Ações administrativas/estruturais (config, versões, logs, tickets): leitura pública interna onde necessário, escrita somente `admin`.

### 4.1 Evaluation — o atendimento

```jsonc
{
  "name": "Evaluation",
  "type": "object",
  "properties": {
    "protocol": { "type": "string", "description": "Número do chamado/atendimento" },
    "analyst_name": { "type": "string", "description": "Nome do analista que atendeu" },
    "analyst_user_id": { "type": "string", "description": "Usuário do analista (isolamento por pessoa)" },
    "channel": { "type": "string", "description": "Canal do atendimento" },
    "source": { "type": "string", "description": "Origem: prints, texto ou importacao" },
    "status": { "type": "string", "description": "rascunho, transcrito, analisado ou curado" },
    "transcript": { "type": "string", "description": "Transcrição integral do atendimento, sem limite de tamanho" },
    "print_files": { "type": "array", "items": { "type": "string" }, "description": "Arquivos privados dos prints" },
    "trend": { "type": "string", "description": "Tendência estimada pela IA: Favorável, Incerta ou Desfavorável" },
    "strengths": { "type": "string", "description": "Pontos fortes reconhecidos pela IA" },
    "summary_feedback": { "type": "string", "description": "Feedback construtivo consolidado da IA" },
    "uncertainties": { "type": "string", "description": "Incertezas e informações ausentes registradas pela IA" },
    "diagnosis_status": { "type": "string", "description": "pende do supervisor: pendente, aprovado ou rejeitado" },
    "supervisor_review": { "type": "string", "description": "Parecer do supervisor" },
    "survey_token": { "type": "string", "description": "Token do link de pesquisa de satisfação" }
  },
  "required": [],
  "rls": {
    "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "data.analyst_user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
    "create": { "$or": [ { "data.analyst_user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
    "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
    "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
  }
}
```

Máquina de estados de `status`: `rascunho` → `transcrito` → `analisado` → `curado`. Labels exibidas: Rascunho / Transcrição pronta / **Em curadoria** / Curadoria concluída.

### 4.2 EvaluationScore — nota por competência

```jsonc
{
  "name": "EvaluationScore",
  "type": "object",
  "properties": {
    "evaluation_id": { "type": "string" },
    "analyst_name": { "type": "string" },
    "analyst_user_id": { "type": "string", "description": "Usuário do analista dono da avaliação" },
    "competency": { "type": "string", "description": "Uma das seis competências do protocolo" },
    "score": { "type": "number", "description": "Nota 0 a 10, ou nula quando não avaliável" },
    "classification": { "type": "string", "description": "Excelente, Bom, Atenção, Insatisfatório, Crítico ou Não avaliável" },
    "evidence": { "type": "string", "description": "Evidência textual verificável" }
  },
  "required": ["evaluation_id", "competency"],
  "rls": { /* read/create/update/delete idênticos ao padrão dono-ou-admin com data.analyst_user_id */ }
}
```

### 4.3 Opportunity — oportunidade de melhoria

```jsonc
{
  "name": "Opportunity",
  "type": "object",
  "properties": {
    "evaluation_id": { "type": "string" },
    "analyst_user_id": { "type": "string" },
    "severity": { "type": "string", "description": "Crítica, Importante ou Desejável" },
    "evidence": { "type": "string", "description": "Evidência textual verificável citada da conversa" },
    "description": { "type": "string", "description": "Descrição objetiva do comportamento observado" },
    "impact": { "type": "string", "description": "Impacto potencial na experiência do cliente" },
    "origin": { "type": "string", "description": "Analista, Processo, Produto, Política empresarial ou Indeterminada" },
    "recommendation": { "type": "string", "description": "Recomendação prática" },
    "improved_example": { "type": "string", "description": "Exemplo de resposta melhorada, quando aplicável" },
    "confidence": { "type": "string", "description": "Alto, Médio ou Baixo" },
    "status": { "type": "string", "description": "pendente, aprovada, ajustada ou rejeitada" },
    "supervisor_note": { "type": "string", "description": "Justificativa ou ajuste do supervisor" },
    "adjusted_recommendation": { "type": "string", "description": "Recomendação ajustada pelo supervisor" }
  },
  "required": ["evaluation_id"],
  "rls": { /* padrão dono-ou-admin com data.analyst_user_id em read/create/update/delete */ }
}
```

### 4.4 CsatRecord — nota real de satisfação (1–5)

```jsonc
{
  "name": "CsatRecord",
  "type": "object",
  "properties": {
    "evaluation_id": { "type": "string" },
    "protocol": { "type": "string" },
    "analyst_name": { "type": "string" },
    "analyst_user_id": { "type": "string" },
    "score": { "type": "number" },
    "level": { "type": "string" },
    "sentiment": { "type": "string" },
    "channel": { "type": "string" },
    "subject": { "type": "string" },
    "comment": { "type": "string" },
    "reason": { "type": "string" },
    "themes": { "type": "string" },
    "evidence": { "type": "string" },
    "recommended_action": { "type": "string" },
    "evaluator": { "type": "string" },
    "team": { "type": "string" },
    "brand": { "type": "string" },
    "evaluated_at": { "type": "string" },
    "opened_at": { "type": "string" },
    "source": { "type": "string" }
  },
  "required": [],
  "rls": {
    "read":   { "$or": [ { "data.analyst_user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
    "create": { "$or": [ { "data.analyst_user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
    "update": { "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
}
```

`source` ∈ {`planilha`, `pesquisa`, `manual`, `arquivo`}.

### 4.5 SurveyTicket / SurveyResponse — link de pesquisa público

```jsonc
// SurveyTicket (read: {}; create/update/delete: admin)
{ "name": "SurveyTicket", "properties": {
    "token": { "type": "string", "description": "Código único do link de pesquisa" },
    "evaluation_id": { "type": "string" },
    "protocol": { "type": "string", "description": "Chamado exibido na pesquisa" }
  }, "required": ["token", "evaluation_id"] }

// SurveyResponse (read/update/delete: admin; create: {} — cliente anônimo responde)
{ "name": "SurveyResponse", "properties": {
    "token": { "type": "string", "description": "Token do link respondido" },
    "score": { "type": "number", "description": "Nota 1 a 5 dada pelo cliente" },
    "comment": { "type": "string", "description": "Comentário do cliente" }
  }, "required": ["token", "score"] }
```

Token gerado no cliente com `crypto.randomUUID()` sem hífens. URL: `${origin}/pesquisa/${token}`.

### 4.6 AppSetting / ProtocolVersion / CurationLog

```jsonc
// AppSetting — configurações chave/valor (read: {}; escrita admin)
{ "key": "csat_positive_threshold", "value": "4", "description": "Nota mínima considerada satisfação positiva (regra oficial ainda não confirmada)" }

// ProtocolVersion — versionamento do protocolo (read: {}; escrita admin)
{ "version": "V1.1", "description": "...", "changes": "Histórico de alterações desta versão", "effective_date": "..." } // required: ["version"]

// CurationLog — auditoria da curadoria (todas as ops: admin)
{ "evaluation_id": "...", "opportunity_id": "...", "target": "oportunidade ou diagnóstico",
  "action": "aprovada, ajustada, rejeitada, diagnóstico aprovado ou diagnóstico rejeitado", "note": "..." } // required: ["action"]
```

`AppSetting` com chave `csat_positive_threshold` define a nota mínima de CSAT positivo (padrão 4, faixa válida 1–5).

---

## 5. Biblioteca de domínio (`src/lib/cx.js`)

Constantes e helpers **exatas**:

```js
export const COMPETENCIES = [
  "Empatia e acolhimento",
  "Comunicação e clareza",
  "Eficiência do atendimento",
  "Conhecimento e condução técnica",
  "Experiência do cliente e Customer Success",
  "Gestão comunicacional durante o multiatendimento",
];
export const SEVERITIES = ["Crítica", "Importante", "Desejável"];
export const ORIGINS = ["Analista", "Processo", "Produto", "Política empresarial", "Indeterminada"];
export const CONFIDENCES = ["Alto", "Médio", "Baixo"];
export const TRENDS = ["Favorável", "Incerta", "Desfavorável"];
export const OPPORTUNITY_STATUS = ["pendente", "aprovada", "ajustada", "rejeitada"];
export const CSAT_LEVELS = ["Ótimo", "Bom", "Neutro", "Ruim", "Péssimo"];

// Classificação qualitativa (0–10):
// >=9 Excelente · >=7 Bom · >=5 Atenção · >=3 Insatisfatório · >=0 Crítico · null/NaN "Não avaliável"
export function scoreClassification(score) { /* conforme tabela */ }

// Faixa de satisfação real (1–5): score >= positiveThreshold → "Satisfação positiva";
// === 3 → "Neutro"; < threshold (≠3) → "Insatisfação"; fora de 1–5 → null
export function csatBand(score, positiveThreshold = 4) { /* ... */ }

// deriveScoreFromLevel: {Ótimo:5, Bom:4, Neutro:3, Ruim:2, Péssimo:1} → null se vazio
```

Estilos Tailwind (badges `rounded-full border px-2.5 py-1 text-xs`):

- `CLASSIFICATION_STYLES`: Excelente emerald-50/800/200 · Bom teal · Atenção amber · Insatisfatório orange · Crítico red · Não avaliável slate-100/600/200.
- `SEVERITY_STYLES`: Crítica red · Importante amber · Desejável sky.
- `TREND_STYLES`: Favorável emerald · Incerta amber · Desfavorável red.
- `STATUS_STYLES`: rascunho slate · transcrito sky · analisado amber · curado emerald.
- `STATUS_LABELS`: rascunho "Rascunho" · transcrito "Transcrição pronta" · analisado **"Em curadoria"** · curado "Curadoria concluída".
- `formatDate(value)`: `pt-BR` `{day:'2-digit', month:'short', year:'numeric'}`, `—` quando vazio, string crua quando inválida.

---

## 6. Camada de IA (`src/lib/cxAi.js`)

Funções (todas via `base44.integrations.Core`):

| Função | Faz |
|---|---|
| `uploadPrivateFile(file)` | `UploadPrivateFile` → `file_uri` |
| `signFileUri(uri, 3600)` | `CreateFileSignedUrl` → URL assinada |
| `getPositiveThreshold()` | lê `AppSetting.key='csat_positive_threshold'`; devolve int 1–5 ou **4** |
| `extractTranscriptFromPrints(fileUris)` | LLM vision sobre URLs assinadas → `{transcript, protocol, analyst_name, channel, uncertainties}` |
| `analyzeTranscript(transcript)` | **Análise principal** (Protocolo V1.1) → `{scores[], opportunities[], trend, strengths, uncertainties, summary_feedback}` |
| `extractCsatFromDocument(fileUri)` | LLM sobre PDF/print de pesquisa → `{chamado, nota, nivel, sentimento, comentario, motivo, canal, assunto, avaliado_em, uncertainties}` |
| `extractSpreadsheetRows(fileUrl)` | `ExtractDataFromUploadedFile` com schema universal de ~18 campos |
| `parseNota(value)` | extrai número (vírgula→ponto), arredonda, devolve 1–5 ou null |
| `scoreFromSentiment(s)` | "muito positivo"→5, "positiv*"→4, "muito negativ"→1, "negativ"→2, "neutr"→3 |
| `normalizeSpreadsheetRow(row)` | normaliza uma linha: decide Evaluation, CsatRecord ou skip |

Detalhe do `unwrap`: `res && typeof res === 'object' && 'response' in res && !('transcript' in res) ? res.response : res` — o SDK às vezes embrulha o JSON em `.response`.

### 6.1 Prompt de extração de transcrição (prints) — verbatim

> Extraia a transcrição fiel e completa do chat de atendimento de suporte presente nos arquivos anexos, na ordem cronológica das mensagens. Use o formato "Atendente: ..." e "Cliente: ..." para cada mensagem. NÃO invente mensagens nem procedimentos: marque trechos ilegíveis ou não visíveis como [ilegível]. Se algum dado estiver visível, informe também o número do chamado/protocolo, o nome do analista/atendente e o canal. Em "uncertainties", registre incertezas e informações ausentes.

Schema de resposta: `{transcript, protocol, analyst_name, channel, uncertainties}` (required: `['transcript']`).

### 6.2 PROTOCOL_PROMPT V1.1 — análise da transcrição (verbatim)

```
Você é um avaliador de atendimentos de suporte SaaS e segue o PROTOCOLO DE INTELIGÊNCIA CX — V1.1, cujo objetivo é promover desenvolvimento profissional, não fiscalização punitiva.

CONTEXTO OPERACIONAL:
- O analista atende simultaneamente quatro ou mais clientes.
- NÃO penalize pausas isoladas, pequenos erros de digitação ou ausência de formalidades desnecessárias.
- Considere contexto, continuidade, comunicação, expectativas e consequências observáveis.
- NÃO presuma falhas no gerenciamento da carga de trabalho sem evidências suficientes.

AVALIAÇÃO POR COMPETÊNCIA — avalie as seis competências abaixo com nota de 0 a 10. Quando não houver evidências suficientes, use score null (classificação "Não avaliável"):
1. Empatia e acolhimento
2. Comunicação e clareza
3. Eficiência do atendimento
4. Conhecimento e condução técnica
5. Experiência do cliente e Customer Success
6. Gestão comunicacional durante o multiatendimento

Classificações: 9-10 Excelente; 7-8 Bom; 5-6 Atenção; 3-4 Insatisfatório; 0-2 Crítico.
NÃO calcule nota global ponderada (os pesos serão definidos depois, com atendimentos reais).
Cada competência deve citar evidência textual verificável da conversa.

OPORTUNIDADES DE MELHORIA — identifique uma quantidade variável, INCLUSIVE ZERO quando não houver problemas relevantes. NÃO transforme qualquer possibilidade remota de insatisfação em falha crítica. Cada oportunidade deve conter:
- severity: "Crítica", "Importante" ou "Desejável"
- evidence: evidência textual verificável citada da conversa
- description: descrição objetiva do comportamento observado
- impact: impacto potencial na experiência do cliente
- origin: origem provável — "Analista", "Processo", "Produto", "Política empresarial" ou "Indeterminada"
- recommendation: recomendação prática
- improved_example: exemplo de resposta melhorada, quando aplicável (senão string vazia)
- confidence: grau de confiança — "Alto", "Médio" ou "Baixo"

TENDÊNCIA DE SATISFAÇÃO — após analisar a conversa, estime SOMENTE a tendência qualitativa do cliente: "Favorável", "Incerta" ou "Desfavorável". Você não conhece a nota real do cliente. NÃO produza percentuais probabilísticos nem afirme causalidade.

FEEDBACK — em summary_feedback seja objetivo e construtivo: preserve pontos fortes e reconheça boas decisões do analista. Para situações simples, sugestões curtas e aplicáveis; para importantes ou críticas, explique evidência, impacto e ação recomendada. Em strengths, liste os pontos fortes observados. Em uncertainties, registre incertezas e informações ausentes. NÃO invente mensagens ou procedimentos técnicos. Não apresente as conclusões como verdades incontestáveis.
```

Chamada: `InvokeLLM({ prompt: PROTOCOL_PROMPT + '\n\nTRANSCRIÇÃO DO ATENDIMENTO:\n"""\n' + transcript + '\n"""', response_json_schema })` com schema `{scores: [{competency, score: number|null, evidence}], opportunities: [{severity, evidence, description, impact, origin, recommendation, improved_example, confidence}], trend, strengths, uncertainties, summary_feedback}` (required: `['scores','opportunities','trend']`).

### 6.3 Importação universal de planilha

`extractSpreadsheetRows` usa `ExtractDataFromUploadedFile` com um schema de colunas **sem obrigatórias** — a IA reconhece o que existir em cada linha: `chamado, responsavel, canal, avaliado_em, aberto_em, nota, nivel (Ótimo/Bom/Neutro/Ruim/Péssimo), sentimento, assunto, comentario, motivo, temas, evidencia, acao_recomendada, transcricao, equipe, marca, quem_avaliou`.

`normalizeSpreadsheetRow(row)` decide por linha:

1. `score = parseNota(nota) ?? deriveScoreFromLevel(nivel) ?? scoreFromSentiment(sentimento)`.
2. `hasCsat` = score || comentario || nivel || sentimento; `hasEvalData` = chamado || transcricao || responsavel || canal.
3. **Detecção de linha de resumo/ruído** (skip): sem transcrição E (≥2 valores entre as palavras nível {ótimo,bom,neutro,ruim,péssimo} || responsável === "responsável" || tem "%" sem csat || sem dados avaliáveis e sem csat).
4. Saída: `{skip, reason}` OU `{skip:false, evaluation: {protocol, analyst_name, channel, transcript, source:'importacao', status: transcricao ? 'transcrito' : 'rascunho'}, csat: {score, level, sentiment, subject, comment, reason, themes, evidence, recommended_action, evaluator, team, brand, channel, evaluated_at, opened_at, source:'planilha'} | null}`.

---

## 7. Páginas (`src/pages/`) — comportamento exato

### 7.1 Dashboard (`/`, admin-only, redirect analista → `/meu-desenvolvimento`)
Carrega em paralelo (limites: evaluations 500, scores/opportunities/csat 1000) + threshold. Renderiza:
- Cabeçalho + badge âmbar-link para `/curadoria` com contagem de `status==='analisado' && (diagnosis_status||'pendente')==='pendente'`.
- 4 StatCards: CSAT positivo % (notas ≥ threshold), média de satisfação real, total de avaliações (com nº com nota), taxa de resposta.
- `CsatDistribution` (notas 1–5) + `SeverityChart` (frequência/gravidade) com contadores de curadoria (pendente/aprovada/ajustada/rejeitada com %).
- `CompetencyEvolution`: média por mês/competência (últimos 6 meses com dados, chave `AAAA-MM`).
- `AnalystComparison` por `analyst_name` (avaliações, overall = média das médias de competência, CSAT médio).
- Tabela "Relação entre comportamentos e satisfação": média de cada competência agrupada por faixa (Satisfação ≥ threshold / Neutro = 3 / Insatisfação) — sempre com o aviso de que correlação não afirma causalidade.

### 7.2 Evaluations (`/avaliacoes`, todos)
Lista paginada (limit 200) de avaliações com busca client-side por protocolo/analista/canal; badges de status, tendência e "Nota real: X · faixa" (primeira CsatRecord 1–5 por avaliação); botões "Importar planilha" (abre `SpreadsheetImport`) e "Nova avaliação"; empty state com ícone `ClipboardList`.

### 7.3 NewEvaluation (`/nova-avaliacao`, todos)
Campos: protocolo, canal (`['Chat','WhatsApp','E-mail','Telefone','Outro']`), analista responsável (desabilitado p/ não-admin, pré-preenchido com o nome do usuário logado; analista cria para si). 3 abas:
- **Colar conversa**: textarea `min-h-72 font-mono`, **sem limite de tamanho**.
- **Prints do chat**: upload múltiplo `image/*,application/pdf` → `UploadPrivateFile` por arquivo (armazenados de forma privada), lista com "Remover", botão "Extrair transcrição com IA" (`extractTranscriptFromPrints`) que preenche transcrição/protocolo/analista/canal quando vazio ou admin.
- **Importar planilha**: botão que abre `SpreadsheetImport` (onDone → navega para `/avaliacoes`).
Criação: `source` = prints se houver prints, senão `'texto'`; `status` = `transcrito` se transcrição não vazia, senão `rascunho`; `analyst_user_id` = `null` para admin, `user.id` para analista; navega para `/avaliacao/{id}`.

### 7.4 EvaluationDetail (`/avaliacao/:id`) — a tela central
Carrega `Evaluation.get(id)` + em paralelo `EvaluationScore` (limit 100, sort created_date), `Opportunity` (idem), `CsatRecord` (limit 50, sort -created_date) + threshold.

Permissões derivadas: `isOwner = created_by_id === user.id`; `canEdit = isAdmin || isOwner`; `editable = canEdit && status ∈ {rascunho, transcrito}`; `canSeeAnalysis = isAdmin || isOwner || diagnosis_status === 'aprovado'`; `analyzed = status ∈ {analisado, curado}`.

Layout (estado analisado):
1. **Cabeçalho**: kicker `PROTOCOLO V1.1`; título serifado grande = protocolo (fallback "Atendimento"); linha "Analista X · Canal · data pt-BR"; badge de status; botão "Reanalisar" (visível só se `analyzed && canEdit && transcript`) que roda `analyze()` de novo; link "Avaliações ←".
2. **Métricas** (grid 3 cards): média das competências válidas (vírgula decimal, "X / 10"), contagem de oportunidades, transcrição revisada Sim/Não.
3. **Grade xl:grid-cols-3**: coluna esquerda (2/3) = "Competências" com grid `sm:grid-cols-2` de `CompetencyCard` (ou placeholder de bloqueio se `!canSeeAnalysis`: "A análise deste atendimento está em curadoria pelo supervisor..."); coluna direita = `DiagnosisCard` (se canSeeAnalysis) + `CurationCard` + seção "Satisfação real" com `CsatPanel`.
4. **Oportunidades de melhoria** (se canSeeAnalysis): lista de `OpportunityCard` com decisão do supervisor.

Estado não-analisado: `PrintGallery` (se houver prints), textarea de transcrição editável (se `editable`) com "Salvar transcrição" (`status` volta a transcrito/rascunho conforme conteúdo) e "Analisar com a IA", ou `<pre>` somente-leitura; seção "Avaliação real do cliente" com `CsatPanel`.

Fluxo `analyze()`:
1. `analyzeTranscript(transcript)`.
2. `deleteMany` de scores e oportunidades da avaliação (reanálise substitui).
3. `bulkCreate` de `EvaluationScore` (classification via `scoreClassification`, herdando `analyst_name`/`analyst_user_id` da avaliação) e de `Opportunity` (`status:'pendente'`).
4. `Evaluation.update({status:'analisado', trend (normalizado), strengths, summary_feedback, uncertainties, diagnosis_status:'pendente'})`.
5. `load()`.

Curadoria: `decideOpportunity(opp, status, fields)` atualiza a oportunidade e grava `CurationLog` (target `oportunidade`); `decideDiagnosis(status)` atualiza `{diagnosis_status, supervisor_review, status:'curado'}` e grava `CurationLog` (target `diagnóstico`, action `diagnóstico aprovado|rejeitado`).

`normalizeTrend`: contém "desfavor"→Desfavorável, "favor"→Favorável, "incert"→Incerta, default Incerta.

### 7.5 Curation (`/curadoria`, admin-only)
Fila de avaliações `status='analisado'` com `diagnosis_status` pendente (com contagem de oportunidades pendentes por avaliação e badge de tendência) + "Curadoria recente" (últimos 10 `curado` com badge do resultado do diagnóstico).

### 7.6 MyDevelopment (`/meu-desenvolvimento`, analista — oculto para admin no menu)
Portal de autodesenvolvimento. Carrega tudo filtrado por `analyst_user_id = user.id` (evaluations 200, scores 1000, oportunidades 1000 apenas `status ∈ {aprovada, ajustada}`, csat 500). Mostra somente avaliações com `diagnosis_status === 'aprovado'`:
- 3 StatCards (avaliações aprovadas + "N em curadoria", satisfação real média, média geral das competências — só sobre conteúdo aprovado).
- Comparativo por competência: barras de progresso `bg-primary` (largura = média/10 × 100%).
- Cartões por avaliação aprovada: tendência, pontos fortes (caixa emerald), summary_feedback, parecer do supervisor (caixa secondary), `ScoreList`, `OpportunityCard` (readonly) e badges "Nota do cliente: X · faixa".

### 7.7 Satisfaction (`/satisfacao`, admin-only)
Centro de gestão da nota real:
- 3 StatCards (CSAT positivo, média, notas registradas).
- "Importar satisfação": botão planilha (`SpreadsheetImport`) + "Importar PDF ou print" com prévia extraída (`extractCsatFromDocument`) e confirmar/descartar; ao registrar, vincula `evaluation_id` buscando por protocolo (`source:'arquivo'`).
- Lançamento manual por chamado + seletor de nota 1–5 (`source:'manual'`).
- Regra de classificação: input da nota mínima de satisfação positiva salvo em `AppSetting` (create-or-update) + `CsatDistribution`.
- "Pesquisas respondidas por clientes": `SurveyResponse` com botões Registrar (cria `CsatRecord` com `source:'pesquisa'` via `SurveyTicket` → apaga a resposta) / Descartar.
- Tabela de todos os registros (chamado, analista, nota, classificação, comentário truncado, fonte, data).

### 7.8 ProtocolPage (`/protocolo`)
Documento vivo do protocolo: cards de competências, classificações (9–10 Excelente … 0–2 Crítico, sem evidências = Não avaliável), contexto operacional, oportunidades, satisfação e curadoria, segurança e qualidade; histórico de versões (`ProtocolVersion`, admin registra novas) e log de "Aprendizado contínuo" (`CurationLog`, admin, com ACTION_LABELS: aprovada/ajustada/rejeitada/diagnóstico aprovado/diagnóstico rejeitado).

### 7.9 Survey (`/pesquisa/:token`, pública, fora do layout)
Página standalone centrada: valida o token em `SurveyTicket`; escala 1–5 (botões 14×14 `rounded-2xl`, seleção `scale-105 bg-primary`), comentário opcional; `SurveyResponse.create({token, score, comment})`; estados: loading, token inválido, obrigado (caixa emerald). Requer app publicado e público para clientes externos.

---

## 8. Componentes (`src/components/cx/`)

| Arquivo | Responsabilidade |
|---|---|
| `Layout.jsx` | Shell: sidebar desktop fixa `w-64` (logo `HeartHandshake` em quadrado `rounded-xl bg-primary`, nav, email + role SUPERVISOR/ANALISTA + "Sair") e topbar mobile sticky com nav horizontal de pills; `main` com `lg:pl-64` e container `max-w-6xl`. Itens: Painel(admin), Avaliações, Nova avaliação, Curadoria(admin), Satisfação(admin), Protocolo(admin), Meu desenvolvimento(analistas). NavLink ativo: desktop `bg-accent text-accent-foreground`; mobile pill `bg-primary text-primary-foreground`. |
| `StatCard.jsx` | Card de estatística: label uppercase pequeno, valor `font-heading text-3xl font-semibold`, hint opcional. Container `rounded-2xl border border-border bg-card p-5`. |
| `CompetencyCard.jsx` | Card de competência: nome, badge de classification (`CLASSIFICATION_STYLES`), nota "N de 10" grande serifada (ou "Não avaliável" slate), evidência em caixa de citação. |
| `DiagnosisCard.jsx` | Painel "Diagnóstico da IA": subtítulo "TENDÊNCIA DE SATISFAÇÃO" + badge `TREND_STYLES`, `summary_feedback`, caixa emerald "PONTOS FORTES" (`strengths`) e `uncertainties`. |
| `CurationCard.jsx` | Status da curadoria (labels: Pendente/Aprovado/Rejeitado) com estilos; parecer `supervisor_review`; admin com diagnóstico pendente: textarea de parecer + botões "Aprovar diagnóstico"/"Rejeitar". |
| `OpportunityCard.jsx` | Card de oportunidade: gravidade+origem+confiança, descrição, evidência citada, impacto, recomendação, exemplo melhorado; admin com status pendente: botões Aprovar / Ajustar (nota + recomendação ajustada) / Rejeitar (justificativa), chamando `onDecision(opp, status, fields)`. |
| `ScoreList.jsx` | Lista compacta de competência+nota+classificação (uso no portal do analista). |
| `AnalystComparison.jsx` | Tabela por analista (avaliações, overall, CSAT) — dashboard. |
| `PrintGallery.jsx` | Grade de imagens de `print_files` via URLs assinadas (`signFileUri`), clique abre em nova aba; oculto se vazio. |
| `CsatPanel.jsx` | Registros de satisfação da avaliação (nota grande, faixa, fonte, comentário/motivo/temas) + área admin: registro manual (seletor 1–5, comentário, motivo) e geração de link de pesquisa (token → `SurveyTicket.create` + `Evaluation.update({survey_token})` → URL `${origin}/pesquisa/${token}` com copiar). |
| `SpreadsheetImport.jsx` | Dialog de importação universal com máquina de estados `idle → extracting → preview → committing → done`: upload privado → assina URL → `extractSpreadsheetRows` → `normalizeSpreadsheetRow` por linha → tabela de prévia com coluna "O que será feito" (`Ignorada` / `Avaliação + satisfação` / `Vincular ao chamado ou criar` / `Nova avaliação` / `Registro de satisfação`) → commit linha a linha (reusa `Evaluation` por protocolo se existir; não-admin cria com `analyst_user_id = user.id` e nome próprio; `CsatRecord` vinculado) → resumo criadas/vinculadas/falhas. Aceita `.csv,.xlsx,.xls,.json,.html`. |
| `charts/CsatDistribution.jsx` | Barras recharts das notas 1–5, colunas ≥ threshold destacadas (positivas). |
| `charts/CompetencyEvolution.jsx` | Linhas recharts: uma série por competência ao longo dos meses. |
| `charts/SeverityChart.jsx` | Barras de frequência por gravidade. |

Padrões visuais comuns: cards `rounded-2xl border border-border bg-card`, seções com título `font-heading`, placeholders dashed (`border-dashed`) para vazios, spinners `Loader2 animate-spin` durante operações.

---

## 9. Design system

### 9.1 Tokens (`src/index.css`) — tema claro (único em uso; `.dark` existe mas sem toggle)

```css
:root {
  --background: 40 30% 98%;
  --foreground: 20 15% 12%;
  --card: 0 0% 100%;
  --primary: 174 42% 21%;          /* verde-petróleo escuro */
  --primary-foreground: 40 30% 98%;
  --secondary: 40 25% 94%;
  --secondary-foreground: 174 42% 21%;
  --muted: 40 20% 95%;
  --muted-foreground: 25 8% 42%;
  --accent: 38 45% 92%;
  --accent-foreground: 30 25% 20%;
  --destructive: 8 70% 48%;
  --border: 40 18% 88%;
  --ring: 174 42% 21%;
  --radius: 0.75rem;
  --font-heading: 'Fraunces', Georgia, 'Times New Roman', serif;  /* títulos serifados */
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;      /* corpo */
  --font-display: 'Fraunces', Georgia, serif;
}
```

Estética **editorial**: fundo quase-branco quente, títulos serifados (`font-heading`) em peso 600 com `tracking-tight`, muito espaço em branco, cartões com borda fina e cantos `rounded-2xl`, texto cinza-quente para metadados em caixa alta com `tracking-widest`/`tracking-[0.2em]`. Cores semânticas dos badges em tailwind direto (emerald/teal/amber/orange/red/sky/slate 50-200-800).

### 9.2 `tailwind.config.js`
Extensões relevantes: `opacity` de 0 a 100 em passos de 1%; `borderRadius` derivado de `--radius`; `colors` mapeados de tokens HSL (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar); `fontFamily` heading/body/display/mono; keyframes accordion; plugin `tailwindcss-animate`. Classes dinâmicas são proibidas (purge) — todas literais no fonte.

### 9.3 `index.html`
`lang="pt-BR"`, título "Protocolo de Inteligência CX", Google Fonts Fraunces + Inter, favicon/manifest, `<div id="root">`, `<script type="module" src="/src/main.jsx">`.

---

## 10. Integrações Core usadas (todas já disponíveis, sem configuração)

- `InvokeLLM` — prompts acima com `response_json_schema` (raiz sempre `object`); modelos com `file_urls` (vision) para prints/PDF.
- `UploadPrivateFile` — todo upload de usuário final (prints, planilhas, PDFs) fica em storage privado; exibição sempre via `CreateFileSignedUrl` (TTL 3600s).
- `ExtractDataFromUploadedFile` — importação de planilha (CSV/XLSX/JSON/HTML).
- (Disponíveis mas não usadas: `SendEmail`, `GenerateSpeech`, etc.)

---

## 11. Roteiro de replicação (ordem recomendada)

1. **Entidades** (`base44/entities/`): criar na ordem `Evaluation`, `EvaluationScore`, `Opportunity`, `CsatRecord`, `SurveyTicket`, `SurveyResponse`, `AppSetting`, `ProtocolVersion`, `CurationLog` — schemas da seção 4, **completos e sem placeholders**, com as políticas RLS exatas.
2. **Design tokens**: replicar `src/index.css` e `tailwind.config.js` (seção 9) e o `index.html`.
3. **Bibliotecas de domínio**: `src/lib/cx.js` (seção 5) e `src/lib/cxAi.js` (seção 6 — prompts verbatim).
4. **Componentes**: primeiro os folha (`StatCard`, `CompetencyCard`, `DiagnosisCard`, `CurationCard`, `OpportunityCard`, `ScoreList`, `AnalystComparison`, `PrintGallery`, charts), depois `CsatPanel` e `SpreadsheetImport`, por fim `Layout.jsx`.
5. **Páginas**: `EvaluationDetail` (depende da maioria dos componentes), depois `Evaluations`, `NewEvaluation`, `Curation`, `MyDevelopment`, `Satisfaction`, `ProtocolPage`, `Dashboard`, `Survey`.
6. **Router**: editar `src/App.jsx` conforme seção 3, preservando o wrapper de auth/QueryClient/Toaster e as páginas boilerplate de autenticação (nunca recriar).
7. **Seed inicial**: registrar em `AppSetting` a chave `csat_positive_threshold` = "4"; registrar em `ProtocolVersion` a V1.1 com a descrição do protocolo.
8. **Usuários**: convidar via plataforma — supervisor com role `admin`, analistas com role `user`.

## 12. Checklist de paridade funcional

- [ ] Analista vê somente as próprias avaliações/oportunidades/scores/csat; supervisor vê tudo (RLS + filtros).
- [ ] Transcrição colada sem limite de tamanho; prints e planilhas em storage privado.
- [ ] Importação aceita qualquer CSV/XLSX sem colunas obrigatórias; linhas de resumo ignoradas; nota derivada de nível/sentimento quando ausente.
- [ ] Análise gera exatamente 6 scores + oportunidades variáveis (0 permitido) + tendência + strengths/feedback/uncertainties; reanálise substitui registros anteriores.
- [ ] Status "analisado" exibido como "Em curadoria"; conteúdo da IA bloqueado para o analista até `diagnosis_status === 'aprovado'`.
- [ ] Curadoria grava `CurationLog` em cada decisão (oportunidade e diagnóstico).
- [ ] Nota real 1–5 só entra por planilha/PDF/print/pesquisa/manual, sempre após o diagnóstico; threshold configurável em Satisfação.
- [ ] Link de pesquisa público `/pesquisa/:token` valida token, grava `SurveyResponse`, supervisor registra ou descarta.
- [ ] Dashboard e portais calculam tudo server-side onde possível e exibem correlações sem afirmar causalidade.
- [ ] UI responsiva (sidebar ≥ lg, topbar com pills abaixo), pt-BR, sem erros de console, build ESM sem `require`.