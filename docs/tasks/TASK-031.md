# TASK-031 — Tela Avaliações (`/avaliacoes`)

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-015 mesclada ✅. **Paralela à TASK-030** (esta só toca os arquivos da §2) |
| Branch | `task/031-avaliacoes` (a partir de `main`) |
| PR | `TASK-031: Tela Avaliações` → `main` |
| Itens | P-08 (REF §7.2, README-DEV §E.3); S-02/S-05 na interface; D-010 (tendência na execução atual); D-012 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-031**: implementar a tela **Avaliações** com paridade com a referência, lendo os dados reais do Supabase (respeitando a RLS) com TanStack Query.

**Quem vê o quê é decidido pelo banco.** O analista vê só as dele porque a RLS filtra. A tela **não** filtra por papel nem por usuário.

### 0. Regras invioláveis
- **Arquivos permitidos:**
  - `src/pages/Evaluations.jsx`;
  - `src/services/evaluations.js` (novo);
  - `src/components/cx/EvaluationListItem.jsx` (novo);
  - testes novos em `src/__tests__/`;
  - **acréscimos** ao `src/test/fakeSupabase.js`, sem mudar o comportamento existente.
- **Não toque** em `App.jsx`, `Layout.jsx`, migrações nem scripts, que pertencem à TASK-030, em paralelo.
- Sem dependências novas e sem chamadas fora do cliente Supabase existente.
- Não dispare o Actions (D-021). Textos em pt-BR. Dados de teste fictícios.

### 1. Leitura obrigatória
- `AGENTS.md`.
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §4.1 (status e rótulos), §7.2 (Avaliações) e §8 (vocabulário visual).
- `docs/reference/README-DEV_AUDITORIA_TECNICA.md`: §B.4 (badge com a **primeira** nota 1–5 por avaliação, ordenada da mais recente), §E.2–E.3 (Evaluations) e §0.4 (limites de lista).
- `docs/DECISIONS.md` D-010 (os campos da IA ficam em `analysis_runs`; a tendência vem da **execução atual**) e D-012.
- `src/lib/cx.js` (`STATUS_LABELS`, `STATUS_STYLES`, `TREND_STYLES`, `BADGE_BASE`, `csatBand`, `formatDate`) e os componentes `PageHeader`, `EmptyState` e `LoadingSpinner`.
- As migrações das TASK-011/012: colunas de `evaluations`, `analysis_runs`, `csat_records` e `app_settings`, e as políticas de leitura.

### 2. Implementação

**2.1 Serviço** (`src/services/evaluations.js`)
- `listEvaluations()`: uma consulta a `evaluations` que traga:
  - `id, protocol, analyst_name, channel, status, created_at`;
  - a **tendência da execução atual**, pelo relacionamento `current_analysis_run_id`. Há duas FKs entre `evaluations` e `analysis_runs`, então use o *hint* explícito da FK `evaluations_current_run_fkey` no embed. Confirme a sintaxe na documentação do PostgREST/supabase-js e cite-a no relatório;
  - os `csat_records` da avaliação (`score, created_at`);
  - ordem `created_at desc` e **limite 200** (paridade, REF §7.2).
- **Retorno normalizado** por item: `{ id, protocol, analystName, channel, status, createdAt, trend, realScore }`.
  - `realScore` é a nota 1–5 do registro **mais recente** que tenha nota (README-DEV §B.4), ou `null`.
  - O analista só recebe os próprios CSAT, porque a RLS filtra. Não há tratamento especial para isso.
- `getCsatThreshold()`: lê `app_settings` com `key = 'csat_positive_threshold'` e devolve um inteiro de 1 a 5. Se o valor estiver ausente ou for inválido, devolve `DEFAULT_CSAT_THRESHOLD`.
- Erro do Supabase → lance o erro (a tela trata). Sem cliente configurado → erro claro em pt-BR, sem chamar a rede (mesmo padrão de `evaluationFiles.js`).

**2.2 Item da lista** (`src/components/cx/EvaluationListItem.jsx`)
- O item é um card-link para `/avaliacao/:id` (`rounded-2xl border border-border bg-card`, hover sutil, foco visível).
- **Título:** o protocolo, ou "Sem protocolo" em cinza quando vazio.
- **Linha meta:** `analista · canal · data`. Use `formatDate`, omita as partes vazias e mostre "Analista não informado" quando faltar o nome.
- **Badges** com `BADGE_BASE`:
  - status com `STATUS_LABELS`/`STATUS_STYLES`;
  - tendência com `TREND_STYLES`, só quando existir;
  - "Nota real: X · faixa" com `csatBand(X, limiar)`, só quando `realScore` existir.
- Em 375 px: as badges quebram linha e não há rolagem horizontal.

**2.3 Página** (`src/pages/Evaluations.jsx`)
- `PageHeader` com o título "Avaliações" e a descrição curta "Atendimentos registrados e o andamento da análise".
- **Ações do cabeçalho:**
  - **"Nova avaliação"**: botão primário que leva a `/nova-avaliacao`;
  - **"Importar planilha"**: botão secundário **desabilitado**, com o texto auxiliar "Disponível em breve". A importação é da Fase 5. Registre no relatório que o P-08 fica 🟨 até lá.
- **Busca:**
  - campo com `aria-label="Buscar avaliações"` e placeholder "Buscar por protocolo, analista ou canal";
  - filtro **no cliente**, sem diferenciar maiúsculas nem **acentos** (`normalize('NFD')`), sobre protocolo, analista e canal.
- **Estados:**
  - **carregando:** `LoadingSpinner`;
  - **erro:** mensagem "Não foi possível carregar as avaliações." e botão "Tentar novamente", que chama `refetch`;
  - **lista vazia:** `EmptyState` com o ícone `ClipboardList`, o título "Nenhuma avaliação ainda", a descrição "Registre o primeiro atendimento para começar." e a ação "Nova avaliação";
  - **busca sem resultado:** "Nenhuma avaliação encontrada para “termo”." e um botão "Limpar busca".
- Use `useQuery` com as chaves `['evaluations']` e `['app_settings', 'csat_positive_threshold']`. Sem `refetchOnWindowFocus`; o padrão do `query-client` já desliga.
- **Rodapé:** com exatamente 200 itens, mostre o aviso "Mostrando as 200 avaliações mais recentes." (é o limite da REF; a paginação real fica para depois).

### 3. Testes (Vitest + Testing Library, cliente falso, sem rede)
- **Serviço:**
  - monta a consulta com o embed da execução atual pela FK explícita, a ordem e o limite;
  - normaliza a tendência ausente para `null`;
  - `realScore` pega o registro **mais recente com nota** e ignora os sem nota;
  - limiar inválido ou ausente → 4;
  - erro propagado;
  - sem cliente → erro e nenhuma chamada.
- **Página:**
  - estado de carregamento;
  - lista com os 4 status e os rótulos corretos;
  - badge de tendência só quando existir;
  - "Nota real: 5 · Satisfação positiva" com limiar 4;
  - "Nota real: 3 · Neutro";
  - com limiar 5, a nota 4 vira "Insatisfação";
  - busca por protocolo, por analista com acento digitado sem acento, e por canal;
  - busca sem resultado com o botão "Limpar busca" funcionando;
  - lista vazia;
  - erro com o botão "Tentar novamente" refazendo a consulta;
  - item sem protocolo mostra "Sem protocolo";
  - os links apontam para `/avaliacao/:id`;
  - "Importar planilha" está desabilitado;
  - aviso dos 200 itens.
- O cliente falso hoje só tem `select/eq/maybeSingle`. **Acrescente** o que precisar (`order`, `limit`, resposta como lista) sem quebrar os testes existentes.

### 4. Validação local (saída real)
```
npm ci && npm run lint && npm run test && npm run build
git status --short
```
**Teste manual** no Supabase local:
- se a TASK-030 já estiver mesclada, use `node scripts/seed-local.mjs`; senão, crie 3 ou 4 avaliações fictícias pelo Studio local;
- entre como supervisor e como analista e confira que o analista vê **só** as próprias avaliações;
- capturas em 1280 px e 375 px.

Não use o projeto remoto para o teste manual.

### 5. Fora do escopo
- Importação de planilha (Fase 5).
- Detalhe da avaliação (TASK-033).
- Paginação além de 200.
- Filtros por status ou período: não estão na REF; sugira no relatório se fizer sentido.

### 6. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Lista com status, tendência da execução atual e "Nota real · faixa" com o limiar da organização | testes da §3 |
| 2 | Busca sem diferenciar maiúsculas nem acentos (protocolo, analista, canal) | testes |
| 3 | Estados de carregamento, erro, vazio e busca sem resultado | testes |
| 4 | Visibilidade definida pela RLS (sem filtro por papel na tela) | revisão do código + teste manual com 2 perfis |
| 5 | Responsivo em 375 px, sem rolagem horizontal | capturas |
| 6 | Lint, testes e build verdes; diff só nos arquivos da §0 | saídas + `git diff --stat` |

### 7. Entrega
PR `TASK-031: Tela Avaliações` para `main`, com o relatório do `AGENTS.md`, as saídas reais e as capturas. Não faça merge.

## FIM DO PROMPT
