# TASK-032 — Tela Nova avaliação (`/nova-avaliacao`)

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-030 ✅ e TASK-031 ✅ mescladas |
| Branch | `task/032-nova-avaliacao` (a partir de `main`) |
| PR | `TASK-032: Tela Nova avaliação` → `main` |
| Itens | P-09, P-10, P-11 (parcial), P-12 (parcial), P-13 (REF §7.3, README-DEV §D.2 e §E.3); D-012; D-013; SEC-05, SEC-09, SEC-18; backlog "upload: 0 byte e `contentType`" |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-032**: implementar a tela **Nova avaliação**. Ela cria a avaliação no Supabase, com anexos opcionais de prints no Storage privado, e depois leva ao detalhe.

**A permissão é do banco.** A política `evaluations_insert` e o Storage já decidem quem pode criar o quê. A tela só monta o pedido certo e traduz os erros. Não crie migrações nem mude a RLS.

### 0. Regras invioláveis

**Arquivos permitidos:**
- `src/pages/NewEvaluation.jsx`;
- `src/services/evaluations.js`: só **acréscimos**, sem mudar `listEvaluations`/`getCsatThresholds`;
- `src/services/organizationMembers.js` (novo);
- `src/services/evaluationFiles.js`: só os ajustes da §2.3;
- componentes novos em `src/components/cx/` (por exemplo `PrintFilesField.jsx`);
- testes novos em `src/__tests__/`;
- **acréscimos** ao `src/test/fakeSupabase.js`;
- `src/__tests__/routes.test.jsx`: só para trocar a asserção "Em construção." de `/nova-avaliacao` (exceção já autorizada).

**Restrições:**
- Não toque em migrações, testes de banco, `App.jsx`, `Layout.jsx` nem `scripts/`.
- Sem dependências novas e sem chamadas de IA. A extração de prints é da Fase 3.
- Nada remoto: o teste manual é só no Supabase local.
- Não dispare o Actions (D-021). Textos em pt-BR. Dados de teste fictícios (SEC-17).

### 1. Leitura obrigatória

- **`AGENTS.md`.**
- **REF** `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`: §7.3 (NewEvaluation) e §4.1 (status).
- **README-DEV** `docs/reference/README-DEV_AUDITORIA_TECNICA.md`: §D.0, §D.2 (fluxo de criação) e §E.3 (grade `sm:grid-cols-3`, analista travado, abas).
- **`docs/DECISIONS.md`:**
  - **D-012:** o protocolo é único por organização. Uma criação com protocolo existente leva à avaliação existente em vez de duplicar.
  - **D-013:** o supervisor **escolhe um analista da organização**. O nome livre fica só para importações.
  - **D-025:** o caminho no Storage é `{org}/{avaliação}/{uuid}.{ext}`.
- **Migrações:**
  - `20261026061629_rls_negocio.sql`: a política `evaluations_insert`, os `grant insert (...)` e o gatilho `protect_evaluation`;
  - `20261026063835_storage_avaliacoes.sql`: o bucket `evaluation-files` (20 MB e os MIME permitidos), as políticas de `storage.objects` e o gatilho que registra em `evaluation_files`;
  - `20261023201152_entidades_negocio.sql`: o índice `evaluations_org_protocol_unique` e o check de `channel`/`source`.
- **Código existente:**
  - `src/lib/cx.js`: `CHANNELS`;
  - `src/services/evaluationFiles.js`;
  - `src/auth/session.js`: `useSession()` traz `user`, `role` e `organizationId`;
  - os componentes `Tabs`, `Select`, `Textarea`, `Input`, `Label`, `Button`, `PageHeader` e `use-toast`.

### 2. Implementação

**2.1 Serviços**

`src/services/organizationMembers.js`:

`listOrgAnalysts(organizationId)`:
- Não existe FK de `memberships` para `profiles`, então são **duas consultas**:
  1. `memberships.select('user_id').eq('organization_id', org).eq('role', 'analista')`;
  2. `profiles.select('id, full_name, email').in('id', ids)`.
- Devolve `[{ id, name }]`, com `name = full_name?.trim() || email`, ordenado por nome no `pt-BR` (`localeCompare`).
- Se não houver nenhuma membership, devolve uma lista vazia sem fazer a 2ª consulta.

`src/services/evaluations.js` (acréscimos):

`buildEvaluationPayload({ form, session, analyst, hasPrints })` é uma função **pura** e exportada. Ela devolve exatamente estas colunas:
- `organization_id`: `session.organizationId`.
- `protocol`: aparado; vazio vira `null`.
- `channel`: um valor de `CHANNELS` ou `null`.
- `transcript`: o texto **sem cortar o tamanho**. Se o texto aparado estiver vazio, vira `null`.
- `source`: `'prints'` se houver prints, senão `'texto'` (REF §7.3).
- `status`: `'transcrito'` se a transcrição aparada não estiver vazia, senão `'rascunho'` (REF §7.3).
- `analyst_user_id` e `analyst_name`:
  - **analista:** o próprio `session.user.id`, com o nome `session.user.fullName || session.user.email`;
  - **supervisor e admin com organização:** o `analyst.id`/`analyst.name` escolhido (D-013).

**Nunca** envie `created_by`, `diagnosis_status`, `supervisor_review` nem `current_analysis_run_id`.

`createEvaluation(payload)`:
- `insert(payload).select('id, organization_id').single()` e devolve `{ id, organizationId }`.
- **Erro `23505`** (protocolo duplicado, D-012): lance um erro com `code = 'PROTOCOLO_DUPLICADO'` e, se houver, `existingId`.
  - O `existingId` vem de `findEvaluationIdByProtocol(protocol)`.
  - Se a RLS esconder a existente (por exemplo, a de outro analista), devolva `existingId = null`.
- Demais erros: propague.

`findEvaluationIdByProtocol(protocol)`:
- Faz `select('id, protocol').ilike('protocol', padrão)`, com `%`, `_` e `\` **escapados**, e confirma no cliente a igualdade por `trim().toLowerCase()` (a mesma normalização do índice).
- Devolve o `id` ou `null`.

Sem cliente configurado: erro claro em pt-BR, sem chamar a rede (mesmo padrão dos outros serviços).

**2.2 Página** (`src/pages/NewEvaluation.jsx`)

`PageHeader`: título "Nova avaliação" e descrição "Registre o atendimento para análise".

**Sem organização** (`session.organizationId` nulo, como o admin da plataforma sem vínculo):
- Mostre o aviso "Para registrar avaliações, entre com um usuário vinculado a uma organização." e **não** mostre o formulário.

**Dados do atendimento** (grade `sm:grid-cols-3`):
- **Protocolo:** `Input`.
- **Canal:** `Select` com `CHANNELS`, opcional, com o placeholder "Selecione o canal".
- **Analista responsável:**
  - **analista:** campo **desabilitado**, pré-preenchido com o próprio nome, como na REF;
  - **supervisor ou admin com organização:** `Select` obrigatório com os analistas de `listOrgAnalysts`, usando a `useQuery(['org_analysts', organizationId])`.
  - Se a lista vier vazia, mostre o texto auxiliar "Nenhum analista na organização ainda. Convide analistas para registrar avaliações." e desabilite o envio.

**Abas** (`Tabs`, com rótulos da REF):
1. **"Colar conversa":**
   - `Textarea` `min-h-72 font-mono`, com `aria-label="Transcrição do atendimento"`;
   - **sem `maxLength`** (P-10).
2. **"Prints do chat":** componente `PrintFilesField`.
   - `input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf"`.
   - Lista os arquivos escolhidos com nome, tamanho legível e um botão "Remover" com `aria-label="Remover {nome}"`.
   - **Valida no cliente, antes de enviar:**
     - extensão fora de png/jpg/jpeg/webp/pdf → "Formato não aceito: {nome}. Use PNG, JPG, WEBP ou PDF.";
     - 0 byte → "O arquivo {nome} está vazio.";
     - mais de 20 MB → "O arquivo {nome} passa de 20 MB.".
     - O arquivo inválido **não** entra na lista.
   - O botão "Extrair transcrição com IA" fica **desabilitado**, com o texto auxiliar "Disponível em breve" (Fase 3).
3. **"Importar planilha":**
   - mostra o texto "A importação de planilhas chega em breve." e um botão desabilitado "Importar planilha" (Fase 5).

**Botão "Criar avaliação":**
- **Habilitado** quando:
  - há transcrição não vazia **ou** pelo menos um print (veja a nota abaixo);
  - para supervisor e admin, há também um analista escolhido;
  - não há envio em andamento.
- **Nota sobre os prints:** é um desvio **temporário** da REF. Lá, o botão exige transcrição porque a IA extrai o texto dos prints. Sem a IA (Fase 3), avaliação só com prints nasce em `rascunho`, que é permitido pela máquina de estados. Registre esse desvio no relatório.
- **Ao enviar:**
  1. `createEvaluation(buildEvaluationPayload(...))`.
  2. Se houver prints, chame `uploadEvaluationFile({ organizationId, evaluationId, file })` **em sequência**, um por arquivo.
     - Se algum falhar, **não** apague a avaliação.
     - Mostre um toast "Avaliação criada, mas {n} arquivo(s) não foram enviados." e siga para o detalhe. A reenvio fica para o detalhe, na TASK-033.
  3. `queryClient.invalidateQueries({ queryKey: ['evaluations'] })` e `navigate('/avaliacao/' + id)`.
- **Durante o envio:**
  - o botão mostra "Criando…" e fica desabilitado;
  - os campos ficam desabilitados;
  - não pode haver duplo envio.

**Erros** (sempre com `role="alert"`, **mantendo** o que foi digitado):
- **`PROTOCOLO_DUPLICADO` com `existingId`:**
  - "Já existe uma avaliação com o protocolo {protocolo}." e um link "Abrir avaliação existente" para `/avaliacao/{existingId}`;
  - **não** navegue sozinho, para o texto colado não se perder.
- **`PROTOCOLO_DUPLICADO` sem `existingId`:** "Já existe uma avaliação com este protocolo na sua organização. Fale com o supervisor."
- **`42501` ou violação de RLS:** "Você não tem permissão para registrar esta avaliação."
- **Outros erros:** "Não foi possível criar a avaliação. Tente novamente."

**Responsivo:** em 375 px a grade vira uma coluna, as abas cabem sem rolagem horizontal e os nomes de arquivo longos quebram linha.

**2.3 Ajustes em `evaluationFiles.js`** (item do backlog)
- **`contentType`:** quando `file.type` vier vazio, deduza o tipo pela extensão, com um mapa para as 8 extensões que o bucket aceita.
- **Arquivo de 0 byte:** `uploadEvaluationFile` recusa com "O arquivo {nome} está vazio." **antes** de chamar a rede.
- Mantenha as assinaturas atuais e os testes existentes passando.

### 3. Testes (Vitest + Testing Library, cliente falso, sem rede)

**`buildEvaluationPayload`:**
- **Analista:** `analyst_user_id` é o próprio usuário e o nome vem do usuário.
- **Supervisor:** usa o analista escolhido.
- **`source`:** `'prints'` com prints e `'texto'` sem.
- **`status`:** transcrição só com espaços → `rascunho` e `transcript: null`.
- **Protocolo:** é aparado, e o vazio vira `null`.
- **Transcrição longa** (mais de 200 mil caracteres): é preservada inteira.
- **Colunas:** o objeto tem **somente** as 8 colunas permitidas (teste com `Object.keys`).

**`createEvaluation` e `findEvaluationIdByProtocol`:**
- Sucesso: chama `insert` e `select` com `single`.
- `23505`: gera `PROTOCOLO_DUPLICADO` com `existingId`.
- `23505` sem a avaliação visível: `existingId: null`.
- Escape de `%`, `_` e `\` no `ilike`.
- Comparação ignora maiúsculas e espaços.
- Outros erros são propagados.
- Sem cliente: erro e nenhuma chamada.

**`listOrgAnalysts`:**
- Faz as 2 consultas com os filtros certos.
- Usa o e-mail como reserva quando falta o nome.
- Ordena por nome.
- Lista vazia não faz a 2ª consulta.
- Erro é propagado.

**`evaluationFiles`:**
- `contentType` deduzido quando `file.type` está vazio.
- Arquivo de 0 byte é recusado sem rede.

**Página:**
- **Analista:** o campo analista está desabilitado e mostra o próprio nome. Ao criar com texto, o payload sai certo, com `transcrito`/`texto`, e a tela navega para `/avaliacao/:id`.
- **Supervisor:**
  - escolhe o analista e cria;
  - sem analista escolhido, o botão fica desabilitado;
  - com a lista vazia, aparece a mensagem e o botão fica desabilitado.
- **Sem organização:** aparece o aviso e não há formulário.
- **Botão desabilitado:** sem transcrição e sem prints.
- **Prints:**
  - adicionar 2 e remover 1;
  - os inválidos (extensão, 0 byte, mais de 20 MB) mostram mensagem e não entram na lista;
  - criar só com prints → `rascunho`/`prints`, com um upload por arquivo **na ordem**;
  - falha em 1 upload mostra o toast e mesmo assim navega.
- **Abas da Fase 3/5:** "Extrair transcrição com IA" e "Importar planilha" estão desabilitados.
- **Protocolo duplicado:**
  - com `existingId`: a mensagem e o link aparecem, o texto digitado continua e a tela não navega;
  - sem `existingId`: aparece a mensagem do supervisor.
- **`42501`:** mostra a mensagem de permissão.
- **Envio em andamento:** "Criando…" e um segundo clique não gera nova chamada.
- **Lista de avaliações:** é invalidada após o sucesso.
- **`routes.test.jsx`:** `/nova-avaliacao` continua com o `h1` "Nova avaliação".

### 4. Validação local (saída real)
```
npm ci && npm run lint && npm run test && npm run build
git status --short
```

**Teste manual** no Supabase local, depois de `supabase db reset` e `node scripts/seed-local.mjs`:
1. **`analista-a@empresa-x.test`:**
   - cria uma avaliação com texto, que nasce "Transcrição pronta";
   - cria outra só com 2 prints (PNG e PDF), que nasce "Rascunho". No Studio local, confira as 2 linhas em `evaluation_files` e os caminhos `{org}/{avaliação}/{uuid}.{ext}`.
2. **`supervisor@empresa-x.test`:**
   - cria uma avaliação para o analista A;
   - entre como **analista A**: ele a vê em Avaliações;
   - entre como **analista B**: ele **não** a vê.
3. **Protocolo repetido:**
   - o supervisor repete um protocolo existente e aparece o link "Abrir avaliação existente";
   - o analista B repete um protocolo do analista A e aparece a mensagem sem link.
4. **Capturas** em 1280 px e 375 px (as 3 abas e o estado de erro do protocolo).

Não use o projeto remoto.

### 5. Fora do escopo

- Extração de prints com IA (Fase 3).
- Importação de planilha (Fase 5).
- Detalhe da avaliação e reenvio de anexos (TASK-033).
- Convite e gestão de membros (backlog).
- Nome livre de analista (D-013: só em importações).
- Criação pelo admin sem organização.

### 6. Critérios de aceitação

| # | Critério | Evidência |
|---|---|---|
| 1 | Campos, canais e analista travado para o analista; supervisor escolhe analista da organização (D-013) | testes + manual |
| 2 | Transcrição sem limite; regras de `source`/`status` da REF | testes do payload |
| 3 | Prints enviados ao Storage privado no caminho da D-025, com validação no cliente | testes + `evaluation_files` no Studio local |
| 4 | Protocolo duplicado não duplica nem perde o texto digitado (D-012) | testes + manual |
| 5 | Payload só com as colunas concedidas; nenhuma coluna de servidor | teste com `Object.keys` |
| 6 | Isolamento: o analista B não vê a avaliação criada para o analista A | manual com 3 perfis |
| 7 | Responsivo em 375 px | capturas |
| 8 | Lint, testes e build verdes; diff só nos arquivos da §0 | saídas + `git diff --stat` |

### 7. Entrega
PR `TASK-032: Tela Nova avaliação` para `main`, com o relatório do `AGENTS.md`, as saídas reais e as capturas, anexadas ao PR quando possível. Registre no relatório os desvios: criação só com prints (temporária) e P-11/P-12 parciais. Não faça merge.

## FIM DO PROMPT
