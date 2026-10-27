# TASK-033 — Detalhe da avaliação (`/avaliacao/:id`) com validação do analista

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-032 ✅ mesclada |
| Branch | `task/033-detalhe-avaliacao` (a partir de `main`) |
| PR | `TASK-033: Detalhe da avaliação e validação do analista` → `main` |
| Itens | P-14 a P-19 (REF §7.4, README-DEV §E.3; P-14/P-17/P-19 ficam 🟨 sem Reanalisar/Analisar e CSAT manual); validação do analista (D-011, D-024, `docs/specs/VALIDACAO_E_CURADORIA.md` V1–V3 e V7); anexos (SEC-09, D-025); D-019 (técnicas de comunicação); backlog da TASK-032 (busca de duplicata pelo termo exato) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-033**: implementar a tela **Detalhe da avaliação** e a **validação do analista** sobre o resultado da IA.

A tela mostra:
- os dados do atendimento;
- os anexos;
- a transcrição, editável enquanto não houver análise;
- o resultado da **execução atual** da IA: 6 competências, diagnóstico e oportunidades;
- o estado da curadoria;
- a satisfação real.

O analista dono valida o diagnóstico e cada oportunidade (gostei/útil/comentário) pela RPC `submit_feedback`.

**A permissão é do banco.** A RLS decide quem lê a avaliação, e a RPC decide quem valida. A tela não filtra por papel para esconder dados: ela só escolhe quais **controles** mostrar. Não crie migrações nem mude a RLS.

### 0. Regras invioláveis

**Arquivos permitidos:**
- `src/pages/EvaluationDetail.jsx`;
- `src/services/evaluationDetail.js` (novo), com a leitura da tela e a validação;
- `src/services/evaluations.js`: só os ajustes da §2.6 e `updateEvaluationTranscript`;
- `src/services/evaluationFiles.js`: só **acréscimos** (`listEvaluationFiles`, `removeEvaluationFile`);
- componentes novos em `src/components/cx/`: `StatCard` existente; `CompetencyCard`, `DiagnosisCard`, `CurationCard`, `OpportunityCard`, `AnalystValidation`, `PrintGallery`, `CsatRecordList`;
- testes novos em `src/__tests__/`;
- **acréscimos** ao `src/test/fakeSupabase.js` (`rpc`, `storage.remove`, `createSignedUrl` etc.);
- `src/__tests__/routes.test.jsx`: só a asserção de `/avaliacao/:id`, se precisar (exceção autorizada).

**Restrições:**
- Não toque em migrações, testes de banco, `App.jsx`, `Layout.jsx`, `scripts/` nem nas telas Avaliações e Nova avaliação.
- **Sem IA:** "Analisar com a IA" e "Reanalisar" ficam fora ou desabilitados (Fase 3).
- **Sem curadoria do supervisor:** os botões Aprovar/Ajustar/Rejeitar e o parecer são da TASK-034. Aqui o estado da curadoria é **só leitura**.
- Sem dependências novas. Nada remoto: o teste manual é só no Supabase local.
- Não dispare o Actions (D-021). Textos em pt-BR. Dados de teste fictícios (SEC-17).

### 1. Leitura obrigatória

- **`AGENTS.md`.**
- **REF** `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`: §7.4 (EvaluationDetail), §8 (`CompetencyCard`, `DiagnosisCard`, `CurationCard`, `OpportunityCard`, `PrintGallery`, `CsatPanel`) e §9 (tokens).
- **README-DEV** `docs/reference/README-DEV_AUDITORIA_TECNICA.md`: §D.0, §D.3, §D.4, §D.9, §E.3 (EvaluationDetail) e §B.12.
- **`docs/DECISIONS.md`:**
  - **D-010:** o resultado fica em `analysis_runs`, e a tela mostra a **execução atual**.
  - **D-011/D-024:** o analista vê a análise assim que ela termina e valida. A curadoria do supervisor prevalece quando existe.
  - **D-016:** reanálise e histórico (só para saber que **não** entram aqui).
  - **D-019:** técnicas de comunicação nas oportunidades.
- **`docs/specs/VALIDACAO_E_CURADORIA.md`:** V1 a V9 e §4.
- **Migrações:**
  - `20261023201152_entidades_negocio.sql`: `evaluations`, `analysis_runs`, `evaluation_scores` (com `classification` gerada), `opportunities`, `analysis_feedback` (único por execução/alvo/papel) e `csat_records`;
  - `20261026061629_rls_negocio.sql`: `can_read_evaluation`, as políticas `*_select`, `evaluations_update`, o gatilho `protect_evaluation` (CX032–CX036) e `submit_feedback` (CX001 e CX023–CX027);
  - `20261026063835_storage_avaliacoes.sql`: as políticas de `storage.objects` (o envio só vale em `rascunho`/`transcrito`; o dono pode remover enquanto não houver análise, e o gestor sempre) e `evaluation_files`.
- **`docs/SECURITY.md`:** a tabela "Códigos de erro do banco".
- **Código existente:**
  - `src/lib/cx.js`: `COMPETENCIES`, `STATUS_*`, `TREND_STYLES`, `CLASSIFICATION_STYLES`, `SEVERITY_STYLES`, `DIAGNOSIS_LABELS`, `csatBand`, `formatDate`;
  - `src/services/*`;
  - `src/components/cx/PrintFilesField.jsx` (reaproveite a validação de arquivo);
  - `scripts/seed-local.mjs`: a massa já traz avaliações `analisado`/`curado` com execução, notas, oportunidades e validações.

### 2. Implementação

**2.1 Leitura** (`src/services/evaluationDetail.js`)

`getEvaluationDetail(id)` devolve um objeto normalizado:
```
{ evaluation, run, scores, opportunities, feedback, csatRecords, files }
```

**Id inválido.** Se `id` não for um UUID, devolva `null` **sem chamar a rede**.

**1ª consulta, `evaluations`:**
- colunas explícitas: `id, organization_id, protocol, analyst_user_id, analyst_name, channel, source, status, transcript, diagnosis_status, supervisor_review, current_analysis_run_id, created_by, created_at`;
- mais o embed `current_run:analysis_runs!evaluations_current_run_fkey(id, run_number, status, prompt_version, trend, strengths, summary_feedback, uncertainties, finished_at)`;
- use `.eq('id', id).maybeSingle()`.
- Se não vier linha, devolva `null`. Não diferencie "não existe" de "sem acesso".

**Demais consultas, em paralelo** (`Promise.all`), com colunas explícitas e **sem `select *`**:
- `evaluation_scores` da execução atual (`analysis_run_id = run.id`). Ordene no cliente pela ordem de `COMPETENCIES`.
- `opportunities` da execução atual, por `position`. Colunas:
  - `id, position, severity, origin, confidence, description, evidence, impact, recommendation, improved_example, communication_techniques`;
  - `status, supervisor_note, adjusted_recommendation`.
- `analysis_feedback` da execução atual. Colunas:
  - `id, target_type, opportunity_id, author_role, liked, useful, comment, updated_at`.
- `csat_records` da avaliação, com `created_at desc` e **limite 50** (REF §7.4). Colunas:
  - `id, score, score_origin, level, source, comment, reason, themes, created_at`.
- `listEvaluationFiles(evaluationId)`.

Sem execução atual (`current_analysis_run_id` nulo): não consulte scores, oportunidades nem validações; devolva listas vazias.

`saveAnalystFeedback({ runId, target, opportunityId, liked, useful, comment })`:
- chama `rpc('submit_feedback', { p_run, p_target, p_opportunity, p_liked, p_useful, p_comment })`;
- para o diagnóstico, `p_opportunity: null`.

**Mapeamento de erros** (exporte `feedbackErrorMessage(error)`):
- **CX023:** "Você não tem permissão para validar esta avaliação."
- **CX025:** "Esta análise foi substituída. Recarregue a página."
- **CX026:** "A análise ainda não terminou."
- **CX024 e CX027:** "Validação inválida. Recarregue a página."
- **Outros:** "Não foi possível salvar a validação. Tente novamente."

**Sem cliente configurado:** erro claro em pt-BR, sem rede (mesmo padrão dos outros serviços).

**2.2 Arquivos** (`src/services/evaluationFiles.js`, acréscimos)
- `listEvaluationFiles(evaluationId)` lê `evaluation_files` (`id, storage_path, kind, mime_type, size_bytes, created_at`) com a ordem `created_at`.
- `removeEvaluationFile(path)` chama `storage.remove([path])` e lança o erro, se houver. O gatilho apaga a linha de `evaluation_files`.

**2.3 Transcrição** (`src/services/evaluations.js`)

`updateEvaluationTranscript({ id, transcript })`:
- envia **somente** `{ transcript, status }`, com `status = 'transcrito'` se o texto aparado não estiver vazio, senão `'rascunho'` e `transcript: null` (README-DEV §D.0/§D.3);
- usa `.update(...).eq('id', id).select('id').single()`.

Erros:
- **CX033 e CX036:** "A transcrição não pode mais ser alterada nesta etapa."
- **42501 ou nenhuma linha:** "Você não tem permissão para alterar esta avaliação."
- **Outros:** "Não foi possível salvar a transcrição. Tente novamente."

**2.4 Página** (`src/pages/EvaluationDetail.jsx`)

Use `useParams`, `useQuery(['evaluation', id], …)` e a `useQuery` de limiares já existente (`['app_settings', 'csat_positive_threshold']`, `getCsatThresholds`). Use o limiar da organização da avaliação, com padrão 4.

**Estados da página:**
- **carregando:** `LoadingSpinner`;
- **erro:** "Não foi possível carregar a avaliação." e o botão "Tentar novamente";
- **`null`:** "Avaliação não encontrada ou você não tem acesso a ela." e o link "Voltar para Avaliações". A mesma mensagem vale para id inválido.

**Cabeçalho:**
- **kicker** pequeno em maiúsculas: `PROTOCOLO {run.prompt_version}` quando houver execução, senão `PROTOCOLO CX`;
- **título** serifado: o protocolo, ou "Atendimento" quando vazio;
- **linha:** "Analista X · Canal · data", com `formatDate` e as partes vazias omitidas;
- **badge** de status;
- **link** "← Avaliações" para `/avaliacoes`.

**Métricas** (3 `StatCard`):
- **Média das competências:** média das notas não nulas, com vírgula decimal e 1 casa, como "7,5 / 10". Sem notas, mostre "—".
- **Oportunidades:** a contagem.
- **Transcrição revisada:** "Sim" quando há transcrição não vazia, senão "Não".
  - A REF não documenta como esse valor é calculado. Use essa regra e registre-a no relatório; o orquestrador confirma.

**Sem análise** (`rascunho`/`transcrito`, ou sem execução atual):
- **`PrintGallery`:**
  - os arquivos de `listEvaluationFiles` com URL assinada (`getEvaluationFileUrl`, TTL atual);
  - **imagens:** miniatura (`<img>` com `alt` = "Anexo {n}") que abre em nova aba (`target="_blank" rel="noopener noreferrer"`);
  - **PDF:** link "Abrir PDF {n}";
  - fica oculta sem arquivos;
  - quando a avaliação estiver em `rascunho`/`transcrito`, mostre também:
    - "Adicionar arquivos", reaproveitando a validação de `PrintFilesField` (PNG/JPG/WEBP/PDF, até 20 MB, sem 0 byte), com envio um por um e a invalidação da query;
    - "Remover" por arquivo, com confirmação "Remover este arquivo?" e `aria-label="Remover anexo {n}"`. Se o Storage recusar, mostre "Não foi possível remover o arquivo." (a política decide).
- **Transcrição:**
  - **editável** (status `rascunho`/`transcrito` e usuário dono, analista da avaliação ou gestor):
    - `Textarea` `min-h-72 font-mono`, **sem limite**, com `aria-label="Transcrição do atendimento"`;
    - botão "Salvar transcrição", desabilitado sem alteração e durante o envio, que mostra "Salvando…";
    - toast "Transcrição salva.";
    - invalida `['evaluation', id]` e `['evaluations']`.
  - **somente leitura:** `<pre>` com quebra de linha (`whitespace-pre-wrap break-words`).
  - **"Analisar com a IA":** botão **desabilitado**, com o texto auxiliar "Disponível em breve" (Fase 3).
- **"Avaliação real do cliente":** `CsatRecordList`.

**Com análise** (execução atual com `status = 'sucesso'`), grade `xl:grid-cols-3`:
- **Esquerda (2/3) — "Competências":**
  - grade `sm:grid-cols-2` de `CompetencyCard`, na ordem de `COMPETENCIES`;
  - cada card tem o nome, a badge de `classification` com `CLASSIFICATION_STYLES`, a nota "N de 10" (vírgula decimal) ou "Não avaliável" e a evidência em citação.
- **Direita:**
  - **`DiagnosisCard`:** o título "Diagnóstico da IA", o subtítulo "TENDÊNCIA DE SATISFAÇÃO" com a badge `TREND_STYLES`, o `summary_feedback`, a caixa "PONTOS FORTES" (`strengths`) e as "Incertezas" (`uncertainties`). As partes vazias são omitidas.
    - Logo abaixo vem `AnalystValidation` com o alvo `diagnostico`.
  - **`CurationCard` (só leitura):**
    - o status com `DIAGNOSIS_LABELS` ("Pendente", "Aprovado", "Rejeitado");
    - o parecer `supervisor_review`, quando existir, com o rótulo "Parecer do supervisor";
    - se estiver pendente, o texto "Aguardando revisão do supervisor.". A validação do analista vale por padrão (D-024).
  - **"Satisfação real":** `CsatRecordList`.
- **Abaixo — "Oportunidades de melhoria":**
  - uma lista de `OpportunityCard`, por `position`;
  - vazia: "A IA não identificou oportunidades relevantes neste atendimento." (README-DEV §E.3).
  - **Cada card mostra:**
    - as badges de gravidade (`SEVERITY_STYLES`), origem e confiança;
    - a descrição;
    - a evidência em citação;
    - o impacto;
    - a recomendação;
    - o exemplo melhorado;
    - as **técnicas de comunicação** (D-019) como chips, só quando existirem.
  - **Decisão do supervisor** (só leitura): com status diferente de `pendente`, mostre a badge ("Aprovada", "Ajustada", "Rejeitada"), a `supervisor_note` com o rótulo "Nota do supervisor" e, em `ajustada` com `adjusted_recommendation`, a "Recomendação ajustada pelo supervisor".
    - Nesse caso, mostre também a original, com o rótulo "Recomendação original da IA".
  - Cada card termina com `AnalystValidation` para o alvo `oportunidade`.
- **Execução atual com outro status:**
  - `em_andamento`: "A análise está em andamento.";
  - `falha`: "A última análise não foi concluída.".
  - Não mostre competências, diagnóstico nem oportunidades.

**`AnalystValidation`** (V2, V3 e V7):
- **Quem preenche:** só quando `session.user.id === evaluation.analyst_user_id` e o papel é `analista`.
- **O formulário:**
  - dois grupos de opção exclusiva, com `role="radiogroup"` e rótulos acessíveis:
    - "Você gostou desta orientação?" → "Gostei" / "Não gostei";
    - "Ela foi útil?" → "Útil" / "Não útil";
  - "Comentário (opcional)", com **máximo de 2000 caracteres** (o mesmo check do banco) e contador.
- **O botão:** "Enviar validação", ou "Atualizar validação" quando já existir uma linha `author_role = 'analista'` para o alvo. Ele só é habilitado com as **duas** escolhas feitas e mostra "Enviando…" durante o envio.
- **Pré-preenchimento:** a partir da validação existente do analista para o alvo.
- **Depois de salvar:** toast "Validação salva." e invalidação de `['evaluation', id]`. Em caso de erro, use `feedbackErrorMessage` com `role="alert"`, mantendo o que foi preenchido.
- **Supervisor e admin:** veem a validação do analista em **só leitura**: "Validação do analista: Gostei · Útil", mais o comentário, ou "O analista ainda não validou.".
  - O formulário do supervisor fica para a TASK-034.
- **Criador que não é o analista da avaliação** (por exemplo, o supervisor que criou para A): também só leitura.

**Responsivo:** em 375 px tudo vira uma coluna, as badges quebram linha, os textos longos (evidência, transcrição, nomes de arquivo) quebram e não há rolagem horizontal.

**2.5 `CsatRecordList`**
- Lista os registros:
  - nota grande "N / 5" com a faixa `csatBand(nota, limiar)`, ou "Sem nota" quando `score` for nulo;
  - a fonte (planilha, pesquisa, manual, arquivo) e, quando `score_origin` não for `real`, a marca "nota derivada";
  - o comentário, o motivo e os temas, quando existirem;
  - a data.
- Vazia: "Nenhuma avaliação real do cliente registrada.".
- Sem formulário de registro manual e sem link de pesquisa: ficam para uma próxima tarefa, porque o link exige Edge Function (SEC-11).

**2.6 Ajustes do backlog da TASK-032** (`src/services/evaluations.js`)
- `findEvaluationIdByProtocol` passa a usar o padrão **exato** escapado, sem `%` nas pontas. Escape `\`, `%`, `_` e também `*`, que o PostgREST trata como curinga. Mantenha a confirmação no cliente por `trim().toLowerCase()`.
- Una os dois `import` de `../lib/cx.js`.
- Atualize o teste existente do escape.

### 3. Testes (Vitest + Testing Library, cliente falso, sem rede)

**`getEvaluationDetail`:**
- id inválido → `null` sem chamada;
- colunas explícitas e o embed pela FK `evaluations_current_run_fkey`;
- consultas filhas filtradas pela **execução atual** e feitas em paralelo;
- sem execução, não há consulta filha de análise;
- `maybeSingle` nulo → `null`;
- erro é propagado;
- sem cliente → erro e nenhuma chamada.

**`saveAnalystFeedback` e `feedbackErrorMessage`:**
- parâmetros exatos da RPC para o diagnóstico (`p_opportunity: null`) e para uma oportunidade;
- os 5 mapeamentos de erro.

**`updateEvaluationTranscript`:**
- envia **somente** `transcript` e `status` (teste com `Object.keys`);
- texto só com espaços → `rascunho`/`null`;
- mapeamentos CX033/CX036, 42501 e nenhuma linha.

**Arquivos:**
- `listEvaluationFiles` filtra e ordena;
- `removeEvaluationFile` chama `remove([path])` e propaga o erro.

**`findEvaluationIdByProtocol`:** padrão exato escapado, incluindo `*`.

**Página:**
- **Estados:** carregando; erro com "Tentar novamente"; não encontrada, inclusive com id inválido.
- **Cabeçalho:** o kicker com `prompt_version`; o título "Atendimento" sem protocolo; a linha meta; a badge; o link de volta.
- **Métricas:** a média "7,5 / 10" ignora `null`; "—" sem notas; a contagem de oportunidades; "Transcrição revisada".
- **Sem análise:**
  - textarea editável para o dono e "Salvar transcrição" envia e invalida;
  - texto vazio salva como rascunho;
  - `<pre>` quando não for editável;
  - "Analisar com a IA" desabilitado;
  - galeria com imagem e PDF;
  - adicionar e remover anexo, e a mensagem de falha ao remover.
- **Com análise:**
  - 6 competências na ordem certa, com "Não avaliável" para `null`;
  - o diagnóstico com tendência, pontos fortes e incertezas;
  - a curadoria pendente e a aprovada, com parecer;
  - as oportunidades com técnicas de comunicação;
  - a decisão `ajustada` mostra a recomendação ajustada e a original;
  - a lista vazia de oportunidades.
- **`em_andamento` e `falha`:** mostram a mensagem e nenhum card de análise.
- **`AnalystValidation`:**
  - **o analista dono:**
    - envia o diagnóstico (RPC com `p_opportunity: null`);
    - envia uma oportunidade (RPC com o `id` dela);
    - o formulário vem pré-preenchido e o botão diz "Atualizar validação";
    - o botão fica desabilitado sem as duas escolhas;
    - o limite de 2000 caracteres;
    - os erros CX023 e CX025 mostram as mensagens.
  - **Supervisor:** vê a validação do analista em só leitura e **nenhum** formulário; com a validação ausente, vê "O analista ainda não validou.".
  - **Criador não analista:** sem formulário.
- **`CsatRecordList`:** a faixa com o limiar da organização (nota 4 com limiar 5 → "Insatisfação"); "Sem nota"; "nota derivada"; a lista vazia.

### 4. Validação local (saída real)
```
npm ci && npm run lint && npm run test && npm run build
git status --short
```

**Teste manual** no Supabase local, depois de `supabase db reset` e `node scripts/seed-local.mjs`:
1. **`analista-a@empresa-x.test`:**
   - abre uma avaliação `analisado`: vê as competências, o diagnóstico e as oportunidades;
   - valida o diagnóstico e uma oportunidade, recarrega e confere o pré-preenchimento;
   - muda a validação (V7);
   - no Studio local, confira **uma** linha por alvo em `analysis_feedback`, com `author_role = 'analista'`.
2. **`analista-a`, avaliação `rascunho`:**
   - edita a transcrição e salva: ela vira "Transcrição pronta";
   - adiciona e remove um anexo: confira `evaluation_files` no Studio.
3. **`supervisor@empresa-x.test`:**
   - abre a mesma avaliação: vê a validação de A em só leitura, sem formulário;
   - abre uma `curado`: vê "Aprovado"/"Rejeitado" e o parecer.
4. **`analista-b@empresa-x.test`:** abre a URL da avaliação de A e vê "Avaliação não encontrada ou você não tem acesso a ela." (RLS).
5. **`supervisor@empresa-y.test`:** abre a URL de uma avaliação de X e recebe a mesma mensagem (SEC-18).
6. **Capturas** em 1280 px e 375 px: o estado sem análise, o estado com análise, a validação e o "não encontrada". **Anexe as imagens ao PR**, arrastando-as para a descrição ou para um comentário no GitHub. Se não for possível, diga o motivo no relatório.

Não use o projeto remoto.

### 5. Fora do escopo
- Analisar e reanalisar com a IA, além do histórico de execuções (Fase 3, D-016).
- Curadoria do supervisor: aprovar/ajustar/rejeitar, parecer e validação do supervisor (TASK-034).
- Registro manual de CSAT e link de pesquisa (próxima tarefa/Edge Function).
- Excluir avaliação.
- "Meu desenvolvimento" (TASK-035).

### 6. Critérios de aceitação

| # | Critério | Evidência |
|---|---|---|
| 1 | Cabeçalho, métricas e grade da REF §7.4 com os dados da execução atual (D-010) | testes + capturas |
| 2 | Estado sem análise: anexos (listar, abrir, adicionar, remover) e transcrição editável com a regra de status | testes + manual com `evaluation_files` |
| 3 | O analista dono valida o diagnóstico e cada oportunidade pela RPC, com edição posterior (V2, V7) | testes + `analysis_feedback` no Studio |
| 4 | O supervisor vê a validação do analista e o estado da curadoria, sem controles de decisão | testes + manual |
| 5 | Acesso só pela RLS: B e a organização Y recebem "não encontrada" | manual com 4 perfis |
| 6 | Pedidos com colunas explícitas, sem coluna de servidor no `update` | testes com `Object.keys`/`select` |
| 7 | Busca de duplicata com padrão exato escapado | teste |
| 8 | Responsivo em 375 px | capturas anexadas |
| 9 | Lint, testes e build verdes; diff só nos arquivos da §0 | saídas + `git diff --stat` |

### 7. Entrega
PR `TASK-033: Detalhe da avaliação e validação do analista` para `main`, com o relatório do `AGENTS.md`, as saídas reais e as capturas anexadas. Registre no relatório:
- a regra adotada para "Transcrição revisada";
- os itens da REF §7.4 que ficaram para depois: IA, curadoria e CSAT manual.

Não faça merge.

## FIM DO PROMPT
