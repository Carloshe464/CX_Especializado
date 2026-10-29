# TASK-034 — Tela Curadoria (`/curadoria`) e formulários de decisão do supervisor

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-032 ✅. **Paralela à TASK-033**, com arquivos disjuntos: esta **não** toca `EvaluationDetail.jsx`, `evaluationDetail.js`, `evaluations.js`, `evaluationFiles.js` nem os componentes criados pela 033 |
| Branch | `task/034-curadoria` (a partir de `main`) |
| PR | `TASK-034: Tela Curadoria e formulários de decisão` → `main` |
| Itens | P-20 (REF §7.5, README-DEV §E.3 e §D.7–D.8); P-21 na interface; D-024; `docs/specs/VALIDACAO_E_CURADORIA.md` §3 (prioridade para "não útil"), V3, V4 e V8 |
| Depois | **TASK-036**: ligar os formulários desta tarefa à tela de detalhe (TASK-033), quando as duas estiverem mescladas |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-034**, em duas partes:
1. a tela **Curadoria** (`/curadoria`), com a fila do supervisor e a curadoria recente;
2. os **formulários de decisão do supervisor**, como componentes independentes e testados: decisão sobre uma oportunidade (aprovar, ajustar ou rejeitar) e sobre o diagnóstico (aprovar ou rejeitar, com parecer). Eles chamam as RPCs `decide_opportunity` e `decide_diagnosis`.

**A tela de detalhe está sendo feita em paralelo (TASK-033).** Por isso os formulários **não** entram no detalhe nesta tarefa. Eles são entregues prontos e testados isoladamente, e a TASK-036 faz a ligação depois.

**A permissão é do banco.** A rota `/curadoria` já é só de gestor (`RequireRole`). A RLS limita a fila à organização, e as RPCs conferem o papel e gravam o log na mesma transação. A tela não filtra por organização nem por papel. Não crie migrações nem mude a RLS ou as RPCs.

### 0. Regras invioláveis

**Arquivos permitidos:**
- `src/pages/Curation.jsx`;
- `src/services/curation.js` (novo);
- componentes **novos** em `src/components/cx/`:
  - `CurationQueueItem.jsx`;
  - `OpportunityDecisionForm.jsx`;
  - `DiagnosisDecisionForm.jsx`;
- testes novos em `src/__tests__/`;
- **acréscimos** ao `src/test/fakeSupabase.js`. A TASK-033 também acrescenta coisas nele: em caso de conflito no merge, mantenha as duas versões;
- `src/__tests__/routes.test.jsx`: só a asserção de `/curadoria` (exceção autorizada).

**Restrições:**
- **Não toque** em `EvaluationDetail.jsx`, `src/services/evaluationDetail.js`, `src/services/evaluations.js`, `src/services/evaluationFiles.js`, `App.jsx`, `Layout.jsx`, migrações, testes de banco nem `scripts/`.
- Não toque nos componentes que a TASK-033 cria: `CompetencyCard`, `DiagnosisCard`, `CurationCard`, `OpportunityCard`, `AnalystValidation`, `PrintGallery` e `CsatRecordList`.
- Sem dependências novas e sem IA. Nada remoto: o teste manual é só no Supabase local.
- Não dispare o Actions (D-021). Textos em pt-BR. Dados de teste fictícios (SEC-17).

### 1. Leitura obrigatória

- **`AGENTS.md`.**
- **REF** `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`: §7.5 (Curation), §7.4 (fluxo de curadoria) e §8 (`CurationCard`, `OpportunityCard`).
- **README-DEV** `docs/reference/README-DEV_AUDITORIA_TECNICA.md`: §D.0 (máquinas de estado), §D.7–D.8 (curadoria de oportunidade e de diagnóstico) e §E.3 (Curation).
- **`docs/DECISIONS.md`:**
  - **D-024:** o veredito do supervisor é a decisão de curadoria. A recomendação ajustada é **opcional**, e o padrão é o texto da IA.
  - **D-010:** só a execução atual é decidida.
- **`docs/specs/VALIDACAO_E_CURADORIA.md`:** §1 (V3, V4 e V8) e §3, onde a fila prioriza o que o analista marcou como "não útil".
- **Migrações:**
  - `20261026061629_rls_negocio.sql`: `decide_opportunity` e `decide_diagnosis` (CX001, CX025, CX026 e CX028–CX030) e as políticas `*_select`;
  - `20261023201152_entidades_negocio.sql`: as colunas de `evaluations`, `opportunities` e `analysis_feedback`.
- **`docs/SECURITY.md`:** a tabela "Códigos de erro do banco".
- **Código existente:**
  - `src/lib/cx.js`: `STATUS_*`, `TREND_STYLES`, `DIAGNOSIS_LABELS`, `ACTION_LABELS`, `BADGE_BASE`, `formatDate`;
  - `src/components/cx/EvaluationListItem.jsx`, como modelo de card-link;
  - `scripts/seed-local.mjs`: a massa traz avaliações `analisado` pendentes e `curado` decididas.

### 2. Implementação

**2.1 Serviço** (`src/services/curation.js`)

`listCurationQueue()` lista as avaliações em curadoria:
- **Filtros:**
  - `status = 'analisado'`;
  - diagnóstico pendente ou nulo, com `.or('diagnosis_status.is.null,diagnosis_status.eq.pendente')` (README-DEV §D.9).
- **Colunas explícitas:**
  - `id, protocol, analyst_name, channel, created_at, current_analysis_run_id`;
  - `current_run:analysis_runs!evaluations_current_run_fkey(trend)`;
  - `opportunities(id, status, analysis_run_id)`;
  - `analysis_feedback(author_role, useful, analysis_run_id)`.
- **Ordem e limite:** `created_at asc` (a mais antiga primeiro) e **limite 200**.
- **Normalize cada item** para `{ id, protocol, analystName, channel, createdAt, trend, pendingOpportunities, analystFlaggedNotUseful }`:
  - `pendingOpportunities`: as oportunidades **da execução atual** com `status = 'pendente'`;
  - `analystFlaggedNotUseful`: `true` se houver validação **do analista** na execução atual com `useful = false`.
- **Ordem final:** primeiro as que têm `analystFlaggedNotUseful`, depois as demais. Dentro de cada grupo, mantenha a ordem da consulta (spec §3).

`listRecentCuration()`:
- avaliações com `status = 'curado'`, ordenadas por `updated_at desc`, **limite 10** (REF §7.5);
- colunas `id, protocol, analyst_name, diagnosis_status, updated_at`;
- devolve `{ id, protocol, analystName, diagnosisStatus, decidedAt }`.

`decideOpportunity({ opportunityId, decision, note, adjusted })`:
- chama `rpc('decide_opportunity', { p_opportunity, p_decision, p_note, p_adjusted })`;
- **`p_adjusted` só segue com `decision = 'ajustada'`.** Nos outros casos envie `null`; o banco recusa com CX029.

`decideDiagnosis({ evaluationId, decision, review })`:
- chama `rpc('decide_diagnosis', { p_evaluation, p_decision, p_review })`.

**`curationErrorMessage(error)`:**
- **CX030:** "Somente o supervisor da organização pode decidir a curadoria."
- **CX025:** "Esta análise foi substituída. Recarregue a página."
- **CX026:** "A avaliação não tem análise concluída."
- **CX028 e CX029:** "Decisão inválida. Recarregue a página."
- **Outros:** "Não foi possível salvar a decisão. Tente novamente."

**Sem cliente configurado:** erro claro em pt-BR, sem rede (mesmo padrão dos outros serviços).

**2.2 Página** (`src/pages/Curation.jsx`)

`PageHeader`: título "Curadoria" e descrição "Revise as análises da IA antes de liberá-las como referência".

**Seção "Em curadoria"** (`useQuery(['curation', 'queue'], listCurationQueue)`):
- **Lista** de `CurationQueueItem`, cada um um card-link para `/avaliacao/:id` (`rounded-2xl border border-border bg-card`, foco visível), com:
  - o protocolo, ou "Sem protocolo";
  - a linha "analista · canal · data";
  - a badge de tendência (`TREND_STYLES`), quando existir;
  - a badge "{n} oportunidade(s) pendente(s)", ou "Sem oportunidades pendentes";
  - a badge de destaque "Analista marcou como não útil", quando `analystFlaggedNotUseful`, com cor de alerta dos tokens.
- **Contador no título da seção:** "Em curadoria (N)".
- **Vazia:** `EmptyState` com o ícone `ShieldCheck`, o título "Nenhuma análise aguardando curadoria" e a descrição "Quando a IA analisar um atendimento, ele aparece aqui.".
- **Com 200 itens:** o aviso "Mostrando as 200 análises mais antigas.".

**Seção "Curadoria recente"** (`useQuery(['curation', 'recent'], listRecentCuration)`):
- lista compacta de links para `/avaliacao/:id`, com o protocolo, o analista, a data e a badge do resultado (`DIAGNOSIS_LABELS`: "Aprovado" com estilo positivo, "Rejeitado" com estilo de alerta);
- vazia: "Nenhuma curadoria concluída ainda.".

**Estados** (cada seção trata os seus, sem derrubar a outra):
- **carregando:** `LoadingSpinner`;
- **erro:** "Não foi possível carregar a curadoria." e o botão "Tentar novamente".

**Responsivo:** em 375 px os cards ficam em uma coluna, as badges quebram linha e não há rolagem horizontal.

**2.3 `OpportunityDecisionForm`**

Props: `{ opportunity, evaluationId, onDecided }`. É um componente independente, ainda não usado no detalhe.
- **Só renderiza** quando `opportunity.status === 'pendente'`. A REF não permite reverter na interface (README-DEV §D.0); a RPC permite, mas a interface segue a REF.
- **Três ações:**
  - **"Aprovar"** decide `aprovada` na hora, sem nota.
  - **"Ajustar"** abre um painel com:
    - "Nota do supervisor", **obrigatória**, até 2000 caracteres;
    - "Recomendação ajustada (opcional)", até 2000 caracteres, com o texto auxiliar "Deixe em branco para manter a recomendação da IA." (D-024);
    - os botões "Salvar ajuste" e "Cancelar".
  - **"Rejeitar"** abre um painel com "Justificativa", **obrigatória**, até 2000 caracteres, e os botões "Confirmar rejeição" e "Cancelar".
- **Durante o envio:** tudo fica desabilitado, o botão ativo mostra "Salvando…" e não há duplo envio.
- **Depois de salvar:**
  - toast "Decisão registrada.";
  - invalide `['evaluation', evaluationId]`, `['evaluations']` e `['curation']`;
  - chame `onDecided?.()`.
- **Erro:** `curationErrorMessage` com `role="alert"`, mantendo o que foi digitado.

**2.4 `DiagnosisDecisionForm`**

Props: `{ evaluation, onDecided }`, onde `evaluation` tem `id`, `status` e `diagnosisStatus`.
- **Só renderiza** quando `status === 'analisado'` e o diagnóstico está pendente ou nulo.
- **Campos e botões:**
  - "Parecer do supervisor" (`Textarea`, até 2000 caracteres);
  - "Aprovar diagnóstico", com parecer opcional;
  - "Rejeitar", com parecer **obrigatório** e a mensagem "Informe o parecer para rejeitar." quando vazio.
- **Envio, sucesso e erro:** iguais aos da §2.3. As invalidações são as mesmas, usando `evaluation.id`.
- **Aviso** acima dos botões: "Ao decidir o diagnóstico, a curadoria desta avaliação é concluída." A RPC muda o status para `curado`.

### 3. Testes (Vitest + Testing Library, cliente falso, sem rede)

**`listCurationQueue`:**
- os filtros (`eq` do status, `or` do diagnóstico), as colunas com o embed pela FK explícita, a ordem e o limite;
- `pendingOpportunities` conta **só** as pendentes da execução atual, ignorando as de execuções antigas;
- `analystFlaggedNotUseful` só para a validação **do analista** na execução atual. Não conta a do supervisor nem a de execução antiga;
- os itens marcados vêm primeiro, mantendo a ordem relativa;
- a tendência ausente vira `null`.

**`listRecentCuration`:** o filtro `curado`, a ordem `updated_at desc`, o limite 10 e a normalização.

**`decideOpportunity` e `decideDiagnosis`:**
- os parâmetros exatos das RPCs;
- `p_adjusted` vira `null` fora de `ajustada`;
- os 5 mapeamentos de `curationErrorMessage`.

**Sem cliente:** erro e nenhuma chamada.

**Página:**
- carregando;
- a fila com o contador, as badges de tendência, as pendentes e "não útil";
- os links para `/avaliacao/:id`;
- a fila vazia;
- o aviso dos 200 itens;
- a curadoria recente com "Aprovado"/"Rejeitado", e vazia;
- erro em uma seção sem derrubar a outra, com "Tentar novamente" refazendo só a seção com erro.

**`OpportunityDecisionForm`:**
- não renderiza fora de `pendente`;
- "Aprovar" chama a RPC com `aprovada`, nota `null` e ajuste `null`;
- "Ajustar":
  - exige a nota;
  - envia sem recomendação → `p_adjusted: null`;
  - envia com recomendação → texto aparado;
- "Rejeitar" exige a justificativa;
- "Cancelar" fecha o painel sem chamar a RPC;
- o limite de 2000 caracteres;
- "Salvando…" e nenhum duplo envio;
- o toast e as invalidações;
- o erro CX030 mostra a mensagem e mantém o texto.

**`DiagnosisDecisionForm`:**
- não renderiza fora de `analisado`/pendente;
- aprovar sem parecer;
- rejeitar sem parecer mostra a mensagem e não chama a RPC;
- rejeitar com parecer;
- erros CX026 e CX025;
- as invalidações.

**`routes.test.jsx`:** `/curadoria` continua com o `h1` "Curadoria" para o supervisor e redireciona o analista, como já testado.

### 4. Validação local (saída real)
```
npm ci && npm run lint && npm run test && npm run build
git status --short
```

**Teste manual** no Supabase local, depois de `supabase db reset` e `node scripts/seed-local.mjs`:
1. **`supervisor@empresa-x.test`** abre `/curadoria`:
   - a fila mostra só avaliações de X em `analisado`/pendente, com a tendência e as pendentes;
   - a curadoria recente mostra as `curado` de X.
2. **Prioridade "não útil":**
   - como `analista-a@empresa-x.test`, marque uma oportunidade como "não útil" pelo detalhe, se a TASK-033 já estiver mesclada;
   - senão, chame `submit_feedback` com a sessão de A pelo console do navegador ou pelo Studio local, explicando no relatório como fez;
   - volte como supervisor: a avaliação sobe para o topo com o destaque.
3. **Formulários:** monte-os numa página **temporária, só local, sem commit**, ou exercite-os pelos testes de componente. No relatório, diga qual caminho usou.
   - Se usar a página temporária: aprove, ajuste e rejeite uma oportunidade e decida um diagnóstico.
   - No Studio local, confira:
     - `opportunities.status`, `supervisor_note` e `adjusted_recommendation`;
     - `evaluations.status = 'curado'` com `diagnosis_status` e `supervisor_review`;
     - **uma linha nova** em `curation_logs` por decisão (V8).
   - A avaliação decidida sai da fila e entra na curadoria recente.
4. **`analista-a`** abre `/curadoria` e é redirecionado (`RequireRole`).
5. **`supervisor@empresa-y.test`** não vê nada de X na fila nem na curadoria recente (SEC-18).
6. **Capturas** em 1280 px e 375 px da fila (com o destaque "não útil"), da curadoria recente e da fila vazia. **Anexe as imagens ao PR**, arrastando-as para a descrição ou para um comentário no GitHub. Se não for possível, diga o motivo no relatório.

Não use o projeto remoto.

### 5. Fora do escopo
- Ligar os formulários ao detalhe e a validação própria do supervisor (gostei/útil): **TASK-036**.
- Contadores de curadoria do Painel (Dashboard, Fase 5).
- Reverter decisão pela interface.
- Histórico de execuções e reanálise (Fase 3).

### 6. Critérios de aceitação

| # | Critério | Evidência |
|---|---|---|
| 1 | Fila `analisado` com diagnóstico pendente, tendência e contagem de oportunidades pendentes da execução atual (REF §7.5) | testes + manual |
| 2 | Itens com "não útil" do analista no topo (spec §3) | testes + manual |
| 3 | Curadoria recente: 10 `curado` mais recentes com o resultado | testes + manual |
| 4 | Formulários chamam as RPCs com os parâmetros certos; ajuste opcional (D-024); justificativa obrigatória ao rejeitar | testes |
| 5 | Cada decisão gera um log (V8) e a avaliação decidida sai da fila | manual com `curation_logs` |
| 6 | Isolamento: o analista é redirecionado; a organização Y não vê X | manual |
| 7 | Nenhum arquivo da TASK-033 tocado | `git diff --stat` |
| 8 | Responsivo em 375 px | capturas anexadas |
| 9 | Lint, testes e build verdes | saídas reais |

### 7. Entrega
PR `TASK-034: Tela Curadoria e formulários de decisão` para `main`, com o relatório do `AGENTS.md`, as saídas reais e as capturas anexadas. Se a TASK-033 for mesclada antes, faça merge da `main` na sua branch antes de entregar e rode tudo de novo. Não faça merge.

## FIM DO PROMPT
