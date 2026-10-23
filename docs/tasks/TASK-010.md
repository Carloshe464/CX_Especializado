# TASK-010 — Banco local: identidade, organizações e papéis

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-001 em `main`. **Pode correr em paralelo com a TASK-003**: só cria arquivos em `supabase/`; não altera `package.json`, lockfile, `src/` nem `docs/` |
| Branch | `task/010-identidade` (a partir de `main`) |
| PR | `TASK-010: Identidade, organizações e papéis (banco local)` → `main` |
| Requisitos de ambiente | Docker em execução e Supabase CLI instalada (registrar as versões) |
| Itens | SEC-03, SEC-04, SEC-10, SEC-15, SEC-16, SEC-18 (identidade), SEC-22; D-002, D-008, D-017, D-023 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-010**: criar, **somente no Supabase local**, a camada de identidade (perfis, organizações, domínios, vínculos, admin da plataforma), as funções de papel, as RPCs de entrada na organização e os testes pgTAP que provam as regras.

### 0. Regras invioláveis desta tarefa
- **Nada remoto.** Proibido `supabase login`, `supabase link`, `supabase db push`, `supabase functions deploy` ou qualquer acesso ao projeto remoto. Tudo roda com `supabase start` local.
- **Não altere** `package.json`, `package-lock.json`, `src/`, `docs/` nem `.github/`. Isso mantém a tarefa paralela à TASK-003 sem conflitos.
- **Não dispare o GitHub Actions (D-021).**
- Dados de teste **sintéticos**: e-mails `@exemplo.test`, `@outraempresa.test`; nunca dados reais.
- Nenhum segredo commitado. O `supabase init` gera `supabase/.gitignore`; mantenha-o. Não commite `.env` nem `supabase/.temp/`.

### 1. Leitura obrigatória
`AGENTS.md`; `docs/SECURITY.md` (inteiro); `docs/ARCHITECTURE.md` §3; `docs/DECISIONS.md` D-002, D-008, D-017 e D-023; documentação oficial atual do Supabase sobre **RLS**, **funções `SECURITY DEFINER` em schema não exposto**, **testes de banco com pgTAP (`supabase test db`)** e o comando `supabase db lint`.

### 2. Escopo autorizado

**2.1 Estrutura**
- `supabase init` → `supabase/config.toml` com `project_id = "protocolo-cx"`. Não configure provedores de login nesta tarefa (Google entra na TASK-014).
- Crie a migração com `supabase migration new identidade_organizacoes`. Uma migração; SQL comentado em português.

**2.2 Schema `private`** (não exposto pela API)
- `create schema private;` com `revoke all on schema private from public, anon, authenticated;`. Conceda `usage` e `execute` a `authenticated` **apenas** nas funções usadas por políticas.
- Tabela `private.public_email_domains(domain text primary key)` com seed de domínios públicos, no mínimo:
  - gmail.com, googlemail.com;
  - outlook.com, hotmail.com, live.com, msn.com;
  - yahoo.com, yahoo.com.br, icloud.com, me.com, aol.com;
  - proton.me, protonmail.com;
  - uol.com.br, bol.com.br, terra.com.br, ig.com.br;
  - gmx.com, zoho.com, yandex.com, mail.com.

**2.3 Tabelas em `public`** (todas com `created_at`/`updated_at timestamptz not null default now()` e trigger `private.set_updated_at()`)

| Tabela | Colunas e restrições |
|---|---|
| `profiles` | `id uuid pk references auth.users on delete cascade`; `full_name text`; `email text not null` |
| `organizations` | `id uuid pk default gen_random_uuid()`; `name text not null check (length(btrim(name)) between 2 and 120)`; `created_by uuid references auth.users on delete set null` |
| `organization_domains` | `id`; `organization_id uuid not null references organizations on delete cascade`; `domain text not null unique`; check `domain = lower(btrim(domain))` e formato de domínio; trigger que **rejeita** domínios presentes em `private.public_email_domains` |
| `memberships` | `id`; `user_id uuid not null unique references auth.users on delete cascade` (**uma organização por usuário**); `organization_id uuid not null references organizations on delete cascade`; `role text not null check (role in ('supervisor','analista'))` |
| `platform_admins` | `user_id uuid pk references auth.users on delete cascade` |

**2.4 Triggers**
- `private.handle_new_user()`: `after insert on auth.users` cria `profiles` (`email`, `full_name` de `raw_user_meta_data->>'full_name'` ou `'name'`). Um trigger `after update of email` sincroniza `profiles.email`.
- `private.protect_membership()`: `before update on memberships`. Bloqueia qualquer alteração de `user_id` ou `organization_id` (SEC-04). Ninguém altera o próprio `role`. Mudanças de papel só pela RPC `set_member_role`.

**2.5 Funções de papel** (`private`, `language sql`, `stable`, `security definer`, `set search_path = ''`, nomes totalmente qualificados no corpo)
- `private.current_org_id() returns uuid`: organização do `auth.uid()` em `memberships`, ou `null`.
- `private.is_member(org uuid) returns boolean`
- `private.is_supervisor(org uuid) returns boolean`
- `private.is_platform_admin() returns boolean`

**2.6 RPCs de entrada** (`public`, `plpgsql`, `security definer`, `set search_path = ''`)

Para todas:
- Use `auth.uid()`; **nunca** aceite `user_id`, `role` ou `organization_id` do chamador para decidir permissão (SEC-03).
- Mensagens de erro em pt-BR, com `errcode` próprio e documentado no relatório.
- `revoke execute ... from public, anon`; `grant execute ... to authenticated`.

| RPC | Regra |
|---|---|
| `create_organization(p_name text, p_domain text default null) returns uuid` | Exige e-mail verificado (`auth.users.email_confirmed_at is not null`) e que o chamador **não** tenha vínculo. Cria a organização e o vínculo `supervisor`. Se `p_domain` vier, normaliza (`lower(btrim)`) e só aceita se: (a) for **exatamente** o domínio do e-mail verificado do chamador; (b) não for domínio público; (c) não pertencer a outra organização (D-023). |
| `join_organization_by_domain() returns uuid` | Exige e-mail verificado e ausência de vínculo. Procura o domínio do e-mail em `organization_domains` e cria o vínculo **sempre** como `analista` (SEC-22). Sem correspondência → erro "Nenhuma empresa cadastrada para o domínio do seu e-mail". |
| `set_member_role(p_user_id uuid, p_role text) returns void` | Permitida a supervisor da **mesma** organização do alvo, ou a admin da plataforma. Proibido alterar o próprio papel. Proibido deixar a organização sem supervisor. |

**2.7 RLS e privilégios** (habilite RLS em **todas** as tabelas de `public`; `revoke all on <tabela> from anon` em todas)

| Tabela | SELECT | INSERT / UPDATE / DELETE pela API |
|---|---|---|
| `profiles` | o próprio; supervisor vê perfis de membros da própria organização; admin vê todos | UPDATE só da própria linha e só da coluna `full_name` (`grant update (full_name)`); sem INSERT/DELETE |
| `organizations` | membros da organização; admin | UPDATE de `name` por supervisor da organização ou admin; sem INSERT/DELETE (só pela RPC) |
| `organization_domains` | membros da organização; admin | nenhum (só pela RPC) |
| `memberships` | a própria linha; supervisor vê as da sua organização; admin vê todas | nenhum direto (só pelas RPCs) |
| `platform_admins` | apenas a própria linha | **nenhum**; `revoke insert, update, delete` de `authenticated` e `anon`. A inclusão do responsável acontece só no painel, na TASK-015 |

Nenhuma política para `anon` (SEC-10).

### 3. Testes obrigatórios (pgTAP, `supabase/tests/database/*.test.sql`)
- **Simulação de usuários:** insira usuários sintéticos em `auth.users` dentro de uma transação de teste e troque de identidade com `set local role authenticated` + `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`.
  - Personas: admin da plataforma, supervisor X, analista A de X, analista B de X, supervisor Y, usuário sem vínculo, usuário com e-mail **não** verificado e `anon`.
  - Sem extensões de terceiros (ex.: test helpers do dbdev); se precisar de helper, escreva-o no próprio arquivo de teste.

1. **SEC-16:** todas as tabelas de `public` têm `relrowsecurity = true` (consulta em `pg_class`).
2. **SEC-15:** todas as funções `security definer` de `public` e `private` têm `search_path` fixado (consulta em `pg_proc.proconfig`).
3. **SEC-10:** `anon` não tem privilégio de SELECT/INSERT/UPDATE/DELETE em nenhuma tabela de `public` (`has_table_privilege`).
4. **Trigger de perfil:** inserir em `auth.users` cria `profiles`; mudar o e-mail sincroniza.
5. **`create_organization`:**
   - Caminho feliz: cria a organização e vira supervisor.
   - Recusas:
     - e-mail não verificado;
     - usuário já vinculado;
     - domínio diferente do e-mail;
     - domínio público (`gmail.com`);
     - domínio já usado por outra organização;
     - nome vazio.
6. **`join_organization_by_domain`:**
   - Entra como `analista`.
   - Recusas:
     - sem domínio cadastrado;
     - e-mail não verificado;
     - usuário já vinculado.
7. **`set_member_role`:**
   - O supervisor de X promove A.
   - Recusas:
     - o supervisor Y tentando alterar A;
     - o analista tentando alterar alguém;
     - o usuário alterando o próprio papel;
     - remoção do último supervisor.
   - O admin consegue.
8. **SEC-04:**
   - `update memberships` direto (role, user_id, organization_id) falha para todos os papéis da API.
   - `insert into platform_admins` falha para `authenticated`.
9. **SEC-18 (identidade):**
   - O supervisor Y não vê organização, domínios, vínculos nem perfis de X.
   - O analista A vê só a própria linha de `memberships` e o próprio perfil.
   - O admin vê tudo.
10. **SEC-03:** as funções de papel retornam o esperado para cada persona e ignoram qualquer `role` vindo em `raw_user_meta_data`.

### 4. Validação local (registre a saída real de cada comando)
```
supabase --version
docker --version
supabase start
supabase db reset          # aplica a migração do zero
supabase test db           # todos os testes pgTAP
supabase db lint --level warning
supabase stop
npm ci && npm run lint && npm run test && npm run build   # app intacto
git status --short         # só supabase/ alterado
```

### 5. Fora do escopo
- Tabelas de negócio, que ficam para a TASK-011.
- Políticas de negócio e RPCs de curadoria/validação (TASK-012).
- Storage (TASK-013).
- Login no frontend e configuração do Google (TASK-014).
- Seeds com usuários.
- Qualquer coisa remota.
- Alterações em `docs/`.

### 6. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | `supabase db reset` aplica a migração sem erro | saída |
| 2 | Todos os testes da §3 passam | saída de `supabase test db` |
| 3 | `supabase db lint` sem erros | saída |
| 4 | RLS em todas as tabelas, sem privilégio para `anon` | testes 1 e 3 |
| 5 | Funções `security definer` com `search_path` fixo e em schema não exposto (exceto as RPCs) | teste 2 + diff |
| 6 | Entrada por domínio conforme SEC-22/D-023 | testes 5 e 6 |
| 7 | App intacto: `npm ci/lint/test/build` passando | saídas |
| 8 | Só arquivos em `supabase/` no diff; nada remoto executado | `git diff --stat origin/main` + declaração no relatório |
| 9 | Versões do Supabase CLI, Docker e Postgres local registradas | relatório |

### 7. Entrega
PR `TASK-010: Identidade, organizações e papéis (banco local)` para `main`, com o relatório do `AGENTS.md`, as saídas reais e a tabela de `errcode` das RPCs. Não faça merge.

## FIM DO PROMPT
