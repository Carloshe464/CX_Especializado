# TASK-036 — Curadoria no detalhe da avaliação e teste de ponta a ponta das TASK-033/034

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-033 ✅ (PR #34) e TASK-034 ✅ (PR #35) |
| Branch | `task/036-curadoria-no-detalhe` (a partir de `main`) |
| PR | `TASK-036: Curadoria no detalhe e teste de ponta a ponta` → `main` |
| Itens | P-17, P-18 e P-21 (REF §7.4, README-DEV §D.7–D.8); D-011/D-024 (validação do supervisor, V3); spec `VALIDACAO_E_CURADORIA.md` V3, V4 e V8; **teste manual pendente das TASK-033 e TASK-034**; backlog "cores fixas" |
| **Ambiente** | **Obrigatório:** Supabase local funcionando (Docker com espaço livre, ~10 GB), Node 24 e `git push` para o GitHub. Recomendado: o computador do responsável. Sem isso, **não abra o PR**: relate o bloqueio |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-036**, em duas partes:

1. **Código (pequeno):** ligar à tela de detalhe (`/avaliacao/:id`) os formulários de decisão do supervisor que a TASK-034 entregou prontos, e acrescentar a **validação do próprio supervisor** (gostei/útil/comentário).
2. **Teste de ponta a ponta no Supabase local:** fazer o teste manual que **ficou pendente nas TASK-033 e TASK-034**, mais o desta tarefa, com evidência real do banco.

A **parte 2 é tão obrigatória quanto a 1.** Este PR só é aprovado com o teste manual feito no Supabase local e com as evidências.

**A permissão é do banco.** As RPCs `decide_opportunity`, `decide_diagnosis` e `submit_feedback` conferem o papel e a organização. A tela só decide **quais controles mostrar**. Não crie migrações nem mude a RLS ou as RPCs.

### 0. Regras invioláveis

**Antes de tudo, confira o ambiente:**
1. `node -v` deve ser 24.x.
2. `docker info` deve responder, e é preciso ter ~10 GB livres.
3. `git ls-remote origin main` deve responder.

Se algum falhar, **pare** e relate. Não entregue o PR sem o teste manual.

**Arquivos permitidos:**
- `src/pages/EvaluationDetail.jsx`;
- os componentes da TASK-033, só para receber os formulários e para as cores: `src/components/cx/CurationCard.jsx`, `OpportunityCard.jsx` e `AnalystValidation.jsx`;
- `src/components/cx/PrintGallery.jsx`: só a troca da checagem de gestor pelo helper da §2.1;
- `src/pages/Curation.jsx`: só a troca da cor fixa da badge pela constante da §2.4;
- `src/lib/permissions.js` (novo);
- `src/lib/cx.js`: só **acréscimos** de constantes de estilo (§2.4);
- testes novos ou ajustados em `src/__tests__/`;
- acréscimos ao `src/test/fakeSupabase.js`.

**Restrições:**
- **Não altere** `OpportunityDecisionForm.jsx`, `DiagnosisDecisionForm.jsx` nem `src/services/curation.js`. Eles já foram aprovados. Se precisar de algo neles, relate antes.
- Não toque em migrações, testes de banco, `App.jsx`, `Layout.jsx` nem `scripts/`.
- Sem dependências novas e sem IA. Nada remoto: só o Supabase local.
- Não dispare o Actions (D-021). Textos em pt-BR. Dados de teste fictícios (SEC-17).

### 1. Leitura obrigatória

- **`AGENTS.md`.**
- **As ordens de trabalho anteriores:** `docs/tasks/TASK-033.md` e `docs/tasks/TASK-034.md`, inteiras, sobretudo as **§4 (teste manual)** e as §2, para saber o que cada componente faz.
- **REF** `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`: §7.4 (curadoria no detalhe) e §8 (`CurationCard`, `OpportunityCard`).
- **README-DEV** `docs/reference/README-DEV_AUDITORIA_TECNICA.md`: §D.7–D.8.
- **`docs/DECISIONS.md`:** D-011 e D-024.
- **`docs/specs/VALIDACAO_E_CURADORIA.md`:** V3, V4 e V8, a nota de refinamento da §2 (as linhas do supervisor em `analysis_feedback` servem à taxa de utilidade) e a §4.
- **Migração `20261026061629_rls_negocio.sql`:**
  - `submit_feedback`: o papel vem de `is_org_manager`, então o gestor grava como `supervisor`;
  - `decide_opportunity` e `decide_diagnosis`.
- **Código atual:**
  - `src/pages/EvaluationDetail.jsx` e os componentes `CurationCard`, `OpportunityCard`, `AnalystValidation`, `OpportunityDecisionForm`, `DiagnosisDecisionForm` e `PrintGallery`;
  - `src/services/evaluationDetail.js` e `src/services/curation.js`.

### 2. Implementação

**2.1 Helper de permissão de interface** (`src/lib/permissions.js`)

`isOrgManager(session, organizationId)` devolve `true` quando:
- `session.role === 'platform_admin'`; ou
- `session.role === 'supervisor'` e `session.organizationId === organizationId`.

É só para **mostrar controles**. A permissão real é do banco. Use o helper em:
- `EvaluationDetail.jsx`, no lugar do `manager` atual da transcrição;
- `PrintGallery.jsx`, no lugar do `manager` atual;
- os pontos novos desta tarefa.

O comportamento existente não pode mudar: os testes atuais continuam passando.

**2.2 Decisões do supervisor no detalhe** (só com execução atual em `sucesso`)

**Diagnóstico:**
- `CurationCard` passa a aceitar `children`.
- No detalhe, quando `isOrgManager(session, evaluation.organization_id)`, renderize dentro dele:
  ```jsx
  <DiagnosisDecisionForm
    evaluation={{ id, status, diagnosisStatus: diagnosis_status }}
    onDecided={...}
  />
  ```
- O componente já se esconde fora de `analisado`/pendente.

**Oportunidades:**
- Para gestor, cada `OpportunityCard` recebe:
  ```jsx
  <OpportunityDecisionForm opportunity={opportunity} evaluationId={evaluation.id} />
  ```
  antes da validação. O componente já se esconde fora de `pendente`.
- **Analista e criador não gestor:** nenhum formulário de decisão, nem renderizado escondido.
- **Depois de uma decisão:** a invalidação de `['evaluation', id]` (que o componente já faz) recarrega a tela. A badge da decisão, a nota e a recomendação ajustada aparecem pelo `OpportunityCard` já existente.
- **Depois de decidir o diagnóstico:** o status vira "Curadoria concluída" e o formulário some.

**2.3 Validação do supervisor** (`AnalystValidation`, V3)

Hoje o gestor só vê a validação do analista, em leitura. Passe a mostrar, **para o gestor**, duas partes:
1. **"Validação do analista"** (leitura), como hoje: "Gostei · Útil" e o comentário, ou "O analista ainda não validou.".
2. **"Sua avaliação da orientação"**, um formulário igual ao do analista:
   - "Você gostou desta orientação?" e "Ela foi útil?", com o comentário opcional (até 2000 caracteres);
   - o pré-preenchimento vem da linha `author_role = 'supervisor'` do mesmo alvo;
   - os botões "Enviar avaliação" e "Atualizar avaliação";
   - usa a mesma `saveAnalystFeedback`/`submit_feedback`. O banco grava como `supervisor`.
   - Texto auxiliar: "Usada só na taxa de utilidade da IA. A decisão de curadoria é feita nos botões acima."

**Para o analista dono, nada muda.** Ele não vê a avaliação do supervisor (gostei/útil), só a decisão de curadoria, como hoje (spec §4.4).

Mantenha **um único componente**, para não duplicar a lógica do formulário. Por exemplo, um `ValidationForm` interno parametrizado pelo `author_role`. Se quiser, renomeie a exportação para `OrientationValidation`, mas mantenha o arquivo `AnalystValidation.jsx`, para não mexer em imports à toa.

**2.4 Cores fixas → constantes** (backlog das TASK-033/034)

Em `src/lib/cx.js`, **acrescente**, seguindo o mesmo vocabulário das `*_STYLES` existentes:
- `DIAGNOSIS_STYLES`: `pendente`, `aprovado`, `rejeitado`;
- `OPPORTUNITY_DECISION_STYLES`: `aprovada`, `ajustada`, `rejeitada`;
- `OPPORTUNITY_DECISION_LABELS`: `aprovada` → "Aprovada", `ajustada` → "Ajustada", `rejeitada` → "Rejeitada".

Use essas constantes em `CurationCard`, `OpportunityCard` e na badge da curadoria recente de `Curation.jsx`, removendo os objetos locais. O visual não muda.

### 3. Testes (Vitest + Testing Library, cliente falso, sem rede)

**`isOrgManager`:**
- admin → `true`;
- supervisor da mesma organização → `true`;
- supervisor de outra organização → `false`;
- analista → `false`;
- sessão vazia → `false`.

**Detalhe como supervisor da organização** (execução `sucesso`, diagnóstico pendente, 2 oportunidades: 1 `pendente` e 1 `aprovada`):
- "Aprovar diagnóstico" e "Rejeitar" aparecem no card de curadoria;
- os botões Aprovar/Ajustar/Rejeitar aparecem **só** na oportunidade pendente;
- **aprovar uma oportunidade** chama `rpc('decide_opportunity', …)` com os parâmetros certos e invalida `['evaluation', id]`;
- **aprovar o diagnóstico** chama `rpc('decide_diagnosis', …)`;
- **com o diagnóstico já `aprovado`/`curado`:** não há formulário de diagnóstico, e o parecer aparece.

**Validação do supervisor:**
- o gestor vê a validação do analista em leitura e o formulário "Sua avaliação da orientação";
- envia pela RPC `submit_feedback`, com `p_opportunity: null` no diagnóstico;
- vem pré-preenchido com a linha `supervisor`;
- **não** é pré-preenchido com a linha do analista.

**Isolamento de controles:**
- **Analista dono:** nenhum botão de decisão, formulário próprio de validação mantido e nenhuma avaliação do supervisor visível.
- **Supervisor de outra organização** (sessão com `organizationId` diferente, caso teórico, porque a RLS nem devolveria a avaliação): nenhum controle de gestor.
- **Admin da plataforma:** vê os controles.

**Regressão:** todos os testes existentes de `EvaluationDetail`, `PrintGallery`, `Curation`, `routes` e `guards` continuam passando.

**Constantes:** `CurationCard` e `OpportunityCard` usam as classes de `DIAGNOSIS_STYLES`/`OPPORTUNITY_DECISION_STYLES`. Um teste simples da classe aplicada basta.

### 4. Validação

**4.1 Automatizada (saída real, completa):**
```
node -v && npm ci && npm run lint && npm run test && npm run build && git status --short
```

**4.2 Teste manual no Supabase local (OBRIGATÓRIO)**

Preparação:
```
supabase start
supabase db reset
supabase status          # copie a chave secret local só para a variável de ambiente
node scripts/seed-local.mjs
npm run dev
```

**Para cada passo**, registre no relatório:
- o resultado observado;
- quando o passo pede, a **consulta SQL no Studio local** com o resultado real (texto copiado);
- a captura, quando indicada.

**A — Pendências da TASK-033 (detalhe)**
1. **`analista-a@empresa-x.test`, avaliação `analisado`:**
   - vê as competências, o diagnóstico e as oportunidades;
   - valida o diagnóstico e uma oportunidade e recarrega: o formulário vem pré-preenchido;
   - muda a validação.
   - SQL: `select target_type, opportunity_id, author_role, liked, useful from analysis_feedback where evaluation_id = '<id>';` → uma linha por alvo, com `analista`.
2. **`analista-a`, avaliação `rascunho`:**
   - edita a transcrição e salva: vira "Transcrição pronta";
   - adiciona e remove um anexo próprio.
   - SQL: `select storage_path, created_by from evaluation_files where evaluation_id = '<id>';` antes e depois.
3. **`analista-a`, avaliação criada pelo supervisor com anexo do supervisor:** o "Remover" **não** aparece no anexo do supervisor.
4. **`analista-b@empresa-x.test`** abre a URL da avaliação de A e vê "Avaliação não encontrada ou você não tem acesso a ela.".
5. **`supervisor@empresa-y.test`** abre a URL de uma avaliação de X e recebe a mesma mensagem.

**B — Pendências da TASK-034 (Curadoria)**

6. **`supervisor@empresa-x.test`** abre `/curadoria`:
   - a fila mostra só X `analisado`/pendente, com a tendência e as pendentes;
   - a avaliação em que A marcou "não útil" no passo 1 (marque uma como "não útil") aparece no **topo**, com o destaque.
7. **`analista-a`** abre `/curadoria` e é redirecionado.
8. **`supervisor@empresa-y.test`** não vê nada de X na fila nem na curadoria recente.

**C — Esta tarefa (curadoria no detalhe)**

9. **`supervisor@empresa-x.test`, no detalhe da avaliação do passo 6:**
   - **aprova** uma oportunidade;
   - **ajusta** outra, com nota e recomendação ajustada;
   - **ajusta** uma terceira **sem** recomendação, se houver;
   - **rejeita** outra, com justificativa.
   - SQL:
     ```sql
     select id, status, supervisor_note, adjusted_recommendation from opportunities where evaluation_id = '<id>';
     select target, action, note, opportunity_id from curation_logs where evaluation_id = '<id>' order by created_at;
     ```
     → **uma linha de log por decisão**.
10. **O mesmo supervisor:**
    - envia "Sua avaliação da orientação" no diagnóstico (Não útil);
    - SQL: `select author_role, liked, useful from analysis_feedback where evaluation_id = '<id>' and target_type = 'diagnostico';` → **duas** linhas (`analista` e `supervisor`). A do analista **não** pode ter mudado.
11. **O mesmo supervisor:**
    - **aprova o diagnóstico** com parecer: o status vira "Curadoria concluída" e os formulários somem;
    - SQL: `select status, diagnosis_status, supervisor_review from evaluations where id = '<id>';` e a nova linha em `curation_logs` (`diagnóstico aprovado`);
    - em `/curadoria`, a avaliação saiu da fila e entrou na "Curadoria recente" com "Aprovado".
12. **`analista-a`** abre a mesma avaliação e vê:
    - as decisões (badges, a nota do supervisor, a recomendação ajustada e a original);
    - o parecer e "Aprovado";
    - **nenhum** botão de decisão;
    - **não** vê a avaliação gostei/útil do supervisor.
13. **Rejeição do diagnóstico:** em outra avaliação, o supervisor tenta "Rejeitar" sem parecer e vê a mensagem; depois rejeita com parecer. SQL do log `diagnóstico rejeitado`.

**D — Capturas** em 1280 px e 375 px, **anexadas ao PR**:
- o detalhe como supervisor, com os formulários;
- o detalhe depois das decisões, como analista;
- a fila da Curadoria com o destaque "não útil";
- a "Curadoria recente";
- o "não encontrada" para o analista B.

Se não conseguir anexar pelo navegador, use `gh pr comment` com imagem ou o arrastar e soltar do GitHub. Se nada funcionar, diga o motivo exato.

### 5. Fora do escopo
- Reverter decisão pela interface (a REF não permite).
- Taxa de utilidade nos indicadores (Painel, Fase 5).
- Reanálise e histórico de execuções (Fase 3).
- CSAT manual e link de pesquisa.
- "Meu desenvolvimento" (TASK-035).

### 6. Critérios de aceitação

| # | Critério | Evidência |
|---|---|---|
| 1 | Gestor decide o diagnóstico e as oportunidades no detalhe; analista não vê os controles | testes + passos 9, 11 e 12 |
| 2 | Cada decisão grava status e log (V8); avaliação decidida sai da fila | SQL dos passos 9, 11 e 13 |
| 3 | Avaliação do supervisor gravada como `supervisor`, sem alterar a do analista; analista não a vê | testes + SQL do passo 10 + passo 12 |
| 4 | Pendências manuais das TASK-033 e TASK-034 comprovadas no banco local | passos 1 a 8 com SQL |
| 5 | Isolamento: analista B e a organização Y não veem a avaliação nem a fila de X | passos 4, 5 e 8 |
| 6 | Helper `isOrgManager` usado nos 3 lugares, sem mudar o comportamento | testes |
| 7 | Cores centralizadas em `cx.js`, sem mudança visual | testes + capturas |
| 8 | Lint, testes e build verdes, com Node 24 | saídas reais completas |
| 9 | Capturas anexadas ao PR | PR |

### 7. Entrega
PR `TASK-036: Curadoria no detalhe e teste de ponta a ponta` para `main`, com:
- o relatório do `AGENTS.md`;
- as saídas reais;
- os resultados SQL de cada passo;
- as capturas anexadas.

Não faça merge. Se o teste manual não puder ser feito, **não abra o PR como pronto**: abra em rascunho com o motivo exato.

## FIM DO PROMPT
