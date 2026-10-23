# TASK-002 — Biblioteca de domínio `src/lib/cx.js`

| Campo | Valor |
|---|---|
| Fase | 1 — Fundação técnica |
| Responsável | Operador (Codex ou sessão Claude Code operadora) |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-001 (em `main`) |
| Pode correr em paralelo com | TASK-004 (arquivos distintos). Quem for mesclado por último deve trazer a `main` e repetir as validações |
| Branch | `task/002-dominio-cx` (a partir de `main`) |
| PR | `TASK-002: Biblioteca de domínio cx.js` → `main` |
| Itens de paridade | D-01…D-07, V-08 (estilos), P-51, P-52, N-12 (lista de técnicas) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-002 — Biblioteca de domínio**: constantes e funções puras de regra de negócio, com testes. **Não crie telas, componentes, chamadas ao Supabase nem chamadas de IA.**

### 0. Pré-condição
Crie `task/002-dominio-cx` a partir da `main` atualizada. Ela já contém a fundação da TASK-001 (Vite, Vitest, ESLint). **GitHub Actions não deve ser disparado (D-021)**: a evidência é a validação local.

### 1. Leitura obrigatória
- `AGENTS.md`, `docs/DECISIONS.md` (D-011, D-019).
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §4.1, §5, §6 (`parseNota`, `scoreFromSentiment`) e §7.4 (`normalizeTrend`).
- `docs/reference/README-DEV_AUDITORIA_TECNICA.md` §C.3 (classificação calculada pelo sistema e defaults de oportunidade), §C.6, §E.2 e Bloco F (arredondamentos).
- `docs/specs/PROTOCOLO_PROMPT_V1.2.md` §3 (lista de técnicas).

### 2. Escopo autorizado
Crie `src/lib/cx.js` (ESM, sem dependências novas, sem efeitos colaterais) e `src/__tests__/cx.test.js`.

**2.1 Constantes**, exportadas com os valores **exatos**, na ordem abaixo, e congeladas com `Object.freeze`:
```js
COMPETENCIES = ["Empatia e acolhimento", "Comunicação e clareza", "Eficiência do atendimento",
  "Conhecimento e condução técnica", "Experiência do cliente e Customer Success",
  "Gestão comunicacional durante o multiatendimento"]
SEVERITIES = ["Crítica", "Importante", "Desejável"]
ORIGINS = ["Analista", "Processo", "Produto", "Política empresarial", "Indeterminada"]
CONFIDENCES = ["Alto", "Médio", "Baixo"]
TRENDS = ["Favorável", "Incerta", "Desfavorável"]
OPPORTUNITY_STATUS = ["pendente", "aprovada", "ajustada", "rejeitada"]
CSAT_LEVELS = ["Ótimo", "Bom", "Neutro", "Ruim", "Péssimo"]
CHANNELS = ["Chat", "WhatsApp", "E-mail", "Telefone", "Outro"]
EVALUATION_STATUS = ["rascunho", "transcrito", "analisado", "curado"]
DIAGNOSIS_STATUS = ["pendente", "aprovado", "rejeitado"]
CSAT_SOURCES = ["planilha", "pesquisa", "manual", "arquivo"]
COMMUNICATION_TECHNIQUES = ["Assertividade", "Rapport", "Escuta ativa", "Validação emocional",
  "Linguagem positiva", "Clareza e objetividade"]          // D-019
STATUS_LABELS = { rascunho: "Rascunho", transcrito: "Transcrição pronta",
  analisado: "Em curadoria", curado: "Curadoria concluída" }
DIAGNOSIS_LABELS = { pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado" }
ACTION_LABELS = { aprovada: "Oportunidade aprovada", ajustada: "Oportunidade ajustada",
  rejeitada: "Oportunidade rejeitada", "diagnóstico aprovado": "Diagnóstico aprovado",
  "diagnóstico rejeitado": "Diagnóstico rejeitado" }       // derivado — confirmar na comparação visual
DEFAULT_CSAT_THRESHOLD = 4
```

**2.2 Estilos de badge** (classes Tailwind **literais**, nunca montadas dinamicamente):
- `BADGE_BASE = "rounded-full border px-2.5 py-1 text-xs"`
- `CLASSIFICATION_STYLES`:
  - Excelente → `"bg-emerald-50 text-emerald-800 border-emerald-200"`
  - Bom → `"bg-teal-50 text-teal-800 border-teal-200"`
  - Atenção → `"bg-amber-50 text-amber-800 border-amber-200"`
  - Insatisfatório → `"bg-orange-50 text-orange-800 border-orange-200"`
  - Crítico → `"bg-red-50 text-red-800 border-red-200"`
  - Não avaliável → `"bg-slate-100 text-slate-600 border-slate-200"`
- `SEVERITY_STYLES`: Crítica red · Importante amber · Desejável sky, no mesmo padrão `bg-*-50 text-*-800 border-*-200`.
- `TREND_STYLES`: Favorável emerald · Incerta amber · Desfavorável red.
- `STATUS_STYLES`: rascunho slate · transcrito sky · analisado amber · curado emerald.

**2.3 Funções** (puras e determinísticas; documente cada uma com JSDoc curto em português):

| Função | Regra |
|---|---|
| `scoreClassification(score)` | `null`, `undefined`, `''` ou não numérico → `"Não avaliável"`. Para número `n`: `n >= 9` Excelente · `>= 7` Bom · `>= 5` Atenção · `>= 3` Insatisfatório · `>= 0` Crítico · `< 0` "Não avaliável". Aceita decimais (8,99 → Bom). Valores acima de 10 seguem a cadeia (→ Excelente, como no original); a faixa 0–10 é validada pelo motor de IA, não aqui. Strings numéricas (`"7.5"`) são convertidas com `Number`. |
| `csatBand(score, threshold = 4)` | Se `score` não for número finito entre 1 e 5 → `null`. `score >= threshold` → `"Satisfação positiva"`; senão `score === 3` → `"Neutro"`; senão → `"Insatisfação"`. Threshold inválido (fora de 1–5 ou não inteiro) → usa 4. |
| `parseNota(value)` | Converte para string, troca `,` por `.`, extrai o primeiro `/\d+(\.\d+)?/`, aplica `Math.round`; retorna o inteiro se estiver entre 1 e 5, senão `null`. Paridade com peculiaridades: `"-3"` → 3; `"4,6"` → 5; `"10"` → null. |
| `deriveScoreFromLevel(level)` | `{Ótimo:5, Bom:4, Neutro:3, Ruim:2, Péssimo:1}`; comparação após `trim` e sem diferenciar maiúsculas (derivado — original não documenta); vazio ou desconhecido → `null`. |
| `scoreFromSentiment(text)` | Minúsculas + `trim`; testa nesta ordem: contém "muito positivo" → 5; "positiv" → 4; "muito negativ" → 1; "negativ" → 2; "neutr" → 3; senão `null`. |
| `normalizeTrend(text)` | Minúsculas; contém "desfavor" → Desfavorável; senão "favor" → Favorável; senão "incert" → Incerta; senão (inclusive vazio) → Incerta. |
| `formatDate(value)` | Vazio/nulo → `"—"`; data inválida → `String(value)`; senão `new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })`. |
| `formatDecimal(value, digits = 1)` | Número → `toFixed(digits)` com vírgula decimal (`7.25, 2` → `"7,25"`); não numérico → `"—"`. |
| `average(values)` | Média dos valores numéricos finitos, ignorando `null`/`undefined`/`NaN`; lista sem válidos → `null`. |
| `normalizeOpportunity(raw)` | Retorna um novo objeto com `severity`, `origin` e `confidence` válidos (fora das listas → defaults `"Desejável"`, `"Indeterminada"`, `"Médio"`), strings ausentes → `""`, `status: "pendente"`, `communication_techniques` filtrado para os valores de `COMMUNICATION_TECHNIQUES`, sem duplicatas (ausente → `[]`). Não altera `raw`. |

### 3. Testes obrigatórios (`src/__tests__/cx.test.js`)
1. Cada constante: conteúdo e ordem exatos, e congelada (`Object.isFrozen`).
2. `scoreClassification` com fronteiras: 10, 9, 8.99, 7, 6.99, 6.5, 5, 4.99, 3, 2.99, 0, -0.1, 10.5, `"7.5"`, `null`, `undefined`, `""`, `NaN`, `"abc"`.
3. `csatBand` com 1–5 × threshold 3, 4 e 5; valores 0, 6, 4.5, `null`; threshold inválido.
4. `parseNota`: `"5"`, `"4,6"`, `"nota 3 de 5"`, `"-3"`, `"10"`, `"0"`, `""`, `null`, `4.4`.
5. `deriveScoreFromLevel`, com variações de caixa e espaços; `scoreFromSentiment`, incluindo a precedência de "muito positivo" sobre "positiv"; `normalizeTrend`, incluindo a precedência de "desfavor" sobre "favor".
6. `formatDate` com `"2026-03-15T12:00:00Z"`, vazio e `"data-ruim"`. Use horário de meio-dia UTC para não depender do fuso.
7. `formatDecimal`, `average` e `normalizeOpportunity` (defaults, filtro de técnicas, não mutação).
8. Todas as classes de estilo são strings literais, sem `${` e sem espaços duplicados; todas as chaves de `CLASSIFICATION_STYLES` cobrem as 6 classificações.

### 4. Fora do escopo
Componentes, páginas, badges renderizados, Supabase, IA, importação de planilha (`normalizeSpreadsheetRow` é Fase 5), regras de validação do analista/supervisor (Fase 4), dependências novas e mudanças em `docs/`.

### 5. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | `src/lib/cx.js` com todas as constantes, estilos e funções da seção 2 | diff |
| 2 | Testes da seção 3 passando | saída de `npm run test` |
| 3 | `npm run lint` sem erros e sem warnings | saída |
| 4 | `npm run build` sem erros | saída |
| 5 | Nenhuma dependência nova; `package.json` e lockfile intactos | `git diff --stat origin/main` |
| 6 | Relatório no formato do `AGENTS.md` | PR |

### 6. Entrega
PR `TASK-002: Biblioteca de domínio cx.js` para `main`, com o relatório e as saídas reais de `npm ci`, `npm run lint`, `npm run test` e `npm run build`. Não faça merge.

## FIM DO PROMPT
