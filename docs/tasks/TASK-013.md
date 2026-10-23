# TASK-013 — Storage privado de arquivos das avaliações

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | **TASK-012 mesclada** (usa `private.can_read_evaluation`, `can_edit_evaluation` e `is_org_manager`) |
| Branch | `task/013-storage` (a partir de `main`) |
| PR | `TASK-013: Storage privado de arquivos (banco local)` → `main` |
| Itens | SEC-09, SEC-10, SEC-18; D-025; correção #9; REF §10 (URL assinada com TTL de 3600 s) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-013**: criar, **somente no Supabase local**, o bucket privado dos arquivos das avaliações, com políticas que espelham o acesso à avaliação, registro automático em `evaluation_files` e relatório de órfãos. Além disso, um serviço pequeno no frontend para enviar arquivos e gerar URL assinada.

### 0. Regras invioláveis
- Tudo é local; não altere migrações existentes; crie a nova com `supabase migration new storage_avaliacoes`.
- No frontend, crie **apenas** os arquivos da §5. Não altere `package.json` nem o lockfile.
- Não dispare o Actions (D-021); use dados sintéticos.

### 1. Leitura obrigatória
- `AGENTS.md`, `docs/SECURITY.md` (SEC-09) e `docs/ARCHITECTURE.md` §7.
- `docs/DECISIONS.md` D-025.
- Migrações e testes das TASK-010/011/012.
- Documentação oficial atual do Supabase Storage:
  - controle de acesso com RLS em `storage.objects`;
  - helpers `storage.foldername()` e `storage.filename()`;
  - criação de bucket por SQL (`storage.buckets`, com `file_size_limit` e `allowed_mime_types`);
  - aviso de que objetos **não** devem ser apagados por SQL direto.

### 2. Bucket (na migração)
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evaluation-files', 'evaluation-files', false, 20971520,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
```
- **Caminho obrigatório (D-025):** `{organization_id}/{evaluation_id}/{uuid}.{ext}`, com `ext` em `png | jpg | jpeg | webp | pdf | txt | csv | xlsx`.

### 3. Políticas em `storage.objects` (apenas `bucket_id = 'evaluation-files'`; nenhuma para `anon`)
Em todas: o primeiro segmento do caminho tem de ser **igual** à `organization_id` da avaliação do segundo segmento. Converta com segurança: caminho malformado → `false`, sem erro de cast. Faça isso com uma função `private.storage_eval_id(name text) returns uuid` que devolve `null` para caminho inválido.

| Operação | Regra |
|---|---|
| SELECT | `private.can_read_evaluation(eval_id)` |
| INSERT | `private.can_edit_evaluation(eval_id)`, avaliação com `status in ('rascunho','transcrito')`, caminho válido e `owner = auth.uid()` |
| UPDATE | **nenhuma**: sem sobrescrita; um arquivo novo gera um objeto novo |
| DELETE | gestor da organização, ou o próprio `owner` enquanto a avaliação estiver em `rascunho`/`transcrito` |

### 4. Registro e órfãos
- **Trigger `after insert`** em `storage.objects`, só para o bucket `evaluation-files` (função em `private`, `security definer`, `search_path = ''`). Cria a linha em `evaluation_files`:
  - `organization_id` e `evaluation_id` vêm do caminho;
  - `storage_path = name`;
  - `kind` vem da extensão: `png/jpg/jpeg/webp` → `print`, `pdf` → `pdf`, `csv/xlsx` → `planilha`, `txt` → `txt`;
  - `mime_type` e `size_bytes` vêm de `metadata`;
  - `created_by = owner`.
- **Trigger `after delete`** em `storage.objects` remove a linha correspondente.
- **Políticas de `evaluation_files`:** SELECT com `private.can_read_evaluation(evaluation_id)`; nenhuma escrita pela API.
- **View `private.orphan_evaluation_files`:** não exposta, só leitura pelo `postgres`. Lista os objetos do bucket sem avaliação existente e as linhas de `evaluation_files` sem objeto. A **limpeza** é feita depois, por job com a API de Storage (backlog). Nada de `delete` direto em `storage.objects`.

### 5. Serviço no frontend
`src/services/evaluationFiles.js`, sem UI e sem dependências novas:
- `buildEvaluationFilePath({ organizationId, evaluationId, fileName })`: gera `{org}/{eval}/{crypto.randomUUID()}.{ext}` com a extensão normalizada em minúsculas; extensão fora da lista → erro em pt-BR.
- `uploadEvaluationFile({ organizationId, evaluationId, file })`: `supabase.storage.from('evaluation-files').upload(path, file, { upsert: false, contentType: file.type })`.
- `getEvaluationFileUrl(path)`: `createSignedUrl(path, 3600)`, ou seja, TTL de 3600 s (REF §10).
- Sem cliente configurado → erro claro, sem chamada de rede.

Testes em `src/__tests__/evaluationFiles.test.js`, com o cliente mockado:
- caminho e extensões;
- extensão inválida;
- `upsert: false`;
- TTL 3600;
- comportamento sem cliente.

### 6. Testes de banco (pgTAP, novo arquivo; os anteriores continuam passando)
Personas e massa como na TASK-012. Insira objetos com `insert into storage.objects (bucket_id, name, owner, metadata)` **trocando a identidade da sessão**, para que as políticas sejam exercitadas.
1. O bucket existe, é **privado** e tem limite de tamanho e lista de MIME.
2. **INSERT:**
   - A envia na própria avaliação;
   - A **não** envia na avaliação de B;
   - o supervisor Y não envia em X;
   - o caminho com a organização errada (org Y + avaliação de X) é recusado;
   - um caminho malformado é recusado sem erro de cast;
   - a avaliação em `analisado` é recusada;
   - `anon` é recusado.
3. **SELECT:**
   - A vê os próprios objetos e não os de B;
   - o supervisor X vê os de X e não os de Y;
   - o admin vê tudo;
   - `anon` não vê nada.
4. **UPDATE** de objeto falha para todos os papéis da API.
5. **DELETE:**
   - o `owner` apaga em `rascunho`, mas não depois de `analisado`;
   - o gestor apaga;
   - B não apaga o objeto de A.
6. **Triggers:** o upload cria `evaluation_files` com o `kind` correto por extensão, e a exclusão do objeto remove a linha.
7. **`evaluation_files`:** A lê só os próprios; escrita direta pela API falha.
8. A view de órfãos lista um objeto de avaliação removida.
9. SEC-15/SEC-16 para as funções e tabelas novas.

### 7. Validação local (saída real)
```
supabase start
supabase db reset
supabase test db
supabase db lint --level warning
supabase stop
npm ci && npm run lint && npm run test && npm run build
git status --short
```
**Teste manual:** com `npm run dev` e um usuário local (após a TASK-014, ou criado pelo Studio local), envie um PNG, gere a URL assinada e abra-a. Depois confirme que a mesma URL **sem** o token devolve 400/404. Registre no relatório.

### 8. Fora do escopo
- Telas de upload.
- Extração de texto de prints/PDF (Fase 3).
- Job de limpeza de órfãos.
- Política de retenção LGPD (SEC-21).
- Qualquer ação remota.
- `docs/`.

### 9. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Bucket privado com limites | teste 1 |
| 2 | Políticas espelham a avaliação e isolam organizações | testes 2–5 |
| 3 | `evaluation_files` sincronizado por trigger | teste 6 |
| 4 | Serviço do frontend com URL assinada de 3600 s e sem `upsert` | testes da §5 |
| 5 | `supabase test db`, `db lint` e `npm ci/lint/test/build` verdes | saídas |
| 6 | Diff só em `supabase/`, `src/services/evaluationFiles.js` e seu teste | `git diff --stat` |

### 10. Entrega
PR `TASK-013: Storage privado de arquivos (banco local)` para `main`, com o relatório do `AGENTS.md` e as saídas reais. Não faça merge.

## FIM DO PROMPT
