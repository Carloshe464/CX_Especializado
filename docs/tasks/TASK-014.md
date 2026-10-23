# TASK-014 — Autenticação no frontend, rotas protegidas e entrada na empresa

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-003 (mesclada) e **TASK-010 mesclada** (RPCs `create_organization`, `join_organization_by_domain` e tabelas de identidade). Pode correr em paralelo com a TASK-011 (que só toca `supabase/migrations` e `supabase/tests`) |
| Branch | `task/014-auth` (a partir de `main`) |
| PR | `TASK-014: Autenticação, rotas protegidas e entrada na empresa` → `main` |
| Itens | R-02, R-03, N-01 (frontend), N-02; SEC-02, SEC-03, SEC-17, SEC-22 (UI); D-008, D-017, D-023 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-014**: substituir a sessão provisória pela autenticação real do Supabase (e-mail/senha e Google), proteger as rotas internas, aplicar os redirecionamentos por papel da referência e criar a tela de entrada na empresa.

**A interface só reflete o acesso. Quem garante o acesso é o banco (RLS/RPC da TASK-010).**

### 0. Pré-condições e regras
- Confirme na `main` que existem `supabase/migrations/*_identidade_organizacoes.sql` e as RPCs `create_organization`, `join_organization_by_domain` e `set_member_role`. Se faltarem, pare e reporte.
- **Nada remoto:** sem `supabase login`/`link`/`push`, sem criar projeto no Google Cloud e sem credenciais reais do Google.
- **Não altere migrações nem testes de banco.** Se notar uma lacuna de RLS, descreva no relatório.
- **Não dispare o Actions (D-021).**
- Não commite `.env.local`, `supabase/.env` nem chaves locais. As chaves locais do `supabase start` são de desenvolvimento, mas também **não vão para o repositório**.

### 1. Leitura obrigatória
- `AGENTS.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md` §2–§3 e `docs/DECISIONS.md` D-008, D-017 e D-023.
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §3 (rotas, `ProtectedRoute` e redirecionamentos) e §7.1.
- `docs/reference/README-DEV_AUDITORIA_TECNICA.md` §A (wrapper e `AuthenticatedApp`).
- A migração da TASK-010 e a tabela de `errcode` CX001–CX016 do PR #11.
- Documentação oficial atual do `@supabase/supabase-js` v2: `onAuthStateChange`, `signInWithPassword`, `signUp` com `emailRedirectTo`, `signInWithOAuth` (Google, PKCE), `resetPasswordForEmail`, `updateUser` e evento `PASSWORD_RECOVERY`.

### 2. Escopo autorizado

**2.1 Cliente** (`src/lib/supabaseClient.js`)
- Passe a `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }`.
- Continua um único cliente, e `null` sem configuração.
- Atualize `supabaseClient.test.js`: o teste "sem recuperação automática" vira a verificação das novas opções; o teste "sem configuração → nenhuma rede" continua.

**2.2 `AuthProvider`** (substitui o padrão do `SessionProvider`; mantenha o contrato `useSession()`)

Estado exposto:
```js
{ status: 'loading' | 'signed_out' | 'signed_in',
  user: { id, email, fullName } | null,
  role: 'platform_admin' | 'supervisor' | 'analista' | null,
  organizationId: string | null,
  needsOnboarding: boolean,          // signed_in, sem vínculo e não admin
  refresh: () => Promise<void>,      // relê vínculo/papel (após onboarding)
  onSignOut: () => Promise<void> }
```
- Sessão por `supabase.auth.getSession()` e `onAuthStateChange`. Cancele a inscrição ao desmontar.
- O papel vem **somente** do banco, via RLS da TASK-010:
  - linha própria em `platform_admins` → `platform_admin`;
  - senão, `memberships.role` da linha própria;
  - senão, `null`.
- **Nunca** use `user_metadata`/`app_metadata` para papel (SEC-03).
- Sem cliente configurado: `status = 'signed_out'` e o aviso de configuração existente continua.
- `onSignOut`: `supabase.auth.signOut()`, `queryClient.clear()` e navegação para `/login`.
- O `SessionProvider value={...}` sintético continua disponível **somente para testes**.
- Remova o `TODO(TASK-014)`.

**2.3 Rotas** (`src/auth/ProtectedRoute.jsx`, `src/auth/RequireRole.jsx` e `App.jsx`)
- **`ProtectedRoute`** envolve o `Layout` e a nova rota `/onboarding`:
  - `loading` → `LoadingSpinner` em tela cheia;
  - `signed_out` → `<Navigate to="/login" replace state={{ from: location }} />`;
  - `needsOnboarding` → `/onboarding` (exceto se já estiver nela);
  - com vínculo, acessar `/onboarding` → `/`.
- **Redirecionamentos da referência (REF §3), com `<Navigate replace />`:**
  - `/` (Painel) para analista → `/meu-desenvolvimento`;
  - `/curadoria` e `/satisfacao` para quem não é supervisor nem admin → `/`.
  - Mais nenhum redirecionamento.
- Páginas de autenticação com usuário já logado → `/`, ou a rota de origem (`state.from`).
- `/pesquisa/:token` continua pública e fora de tudo.

**2.4 Telas** (pt-BR; `AuthLayout` centralizado com o logo `HeartHandshake` e "Protocolo CX"; componentes `Input`/`Label`/`Button` da TASK-003)

| Rota | Comportamento |
|---|---|
| `/login` | E-mail e senha + botão **"Continuar com Google"** (`signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`), com ícone do Google em SVG inline (o lucide 1.x não tem marcas). Links para cadastro e "Esqueci minha senha". Credencial inválida → "E-mail ou senha incorretos."; e-mail não confirmado → "Confirme seu e-mail antes de entrar." |
| `/register` | Nome, e-mail, senha (mínimo 8) e confirmação. `signUp` com `options.data.full_name` e `emailRedirectTo: origin`. Ao concluir: "Enviamos um link de confirmação para o seu e-mail." Também tem o botão Google |
| `/forgot-password` | `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`. **Mensagem neutra sempre**, sem revelar se o e-mail existe: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." |
| `/reset-password` | Aceita só depois do evento `PASSWORD_RECOVERY`, ou com sessão de recuperação ativa. Pede nova senha + confirmação → `updateUser({ password })` → mensagem de sucesso e ida para `/`. Sem sessão de recuperação → "Link inválido ou expirado." |
| `/onboarding` | Para usuário logado sem vínculo. Botão principal **"Entrar na empresa do meu e-mail"** → `rpc('join_organization_by_domain')`. Seção secundária **"Criar uma empresa"**: nome + domínio opcional → `rpc('create_organization', { p_name, p_domain })`. Sucesso → `refresh()` e ida para `/`. Erros mapeados por `code` (CX002, CX003, CX004, CX005, CX006, CX007, CX008, CX009) para as mensagens em pt-BR da migração; código desconhecido → "Não foi possível concluir. Tente novamente." Botão "Sair" |

- Botões desabilitados durante o envio e `aria-live` para mensagens.
- Nenhuma senha em log ou estado global.

**2.5 Supabase local para o teste manual** (`supabase/config.toml`, apenas a seção de auth)
- `site_url = "http://localhost:5173"`.
- `additional_redirect_urls` com `http://localhost:5173/reset-password`.
- `[auth.email] enable_confirmations = true`.
- `[auth.external.google]` com `enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"` e `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`. Crie também `supabase/.env.example` com placeholders.
- Se o `supabase start` falhar com essas variáveis vazias, deixe `enabled = false` e explique no relatório.

### 3. Testes obrigatórios (Vitest, cliente Supabase mockado; sem rede)
1. **`AuthProvider`:**
   - Transições `loading` → `signed_out` e `loading` → `signed_in`.
   - Papel derivado de `platform_admins` e de `memberships`.
   - `needsOnboarding` quando não há nenhum dos dois.
   - **`user_metadata.role = 'supervisor'` é ignorado.**
   - A inscrição é cancelada ao desmontar.
2. **`ProtectedRoute`:**
   - Mostra o spinner em `loading`.
   - Redireciona para `/login`, preservando `from`.
   - Redireciona para `/onboarding` quando falta vínculo.
   - `/onboarding` com vínculo → `/`.
3. **`RequireRole`:**
   - Analista em `/` vai para `/meu-desenvolvimento`.
   - Analista em `/curadoria` e `/satisfacao` vai para `/`.
   - Supervisor e admin acessam.
4. **Login:**
   - Chama `signInWithPassword` com os campos.
   - Mostra as mensagens de erro mapeadas.
   - O botão Google chama `signInWithOAuth` com `provider: 'google'` e `redirectTo` = origin.
   - Já logado → `/`.
5. **Register:** valida senha mínima e confirmação; chama `signUp` com `full_name` e `emailRedirectTo`.
6. **Forgot:** a mensagem é a mesma para sucesso e erro.
7. **Reset:**
   - Sem evento de recuperação → "Link inválido ou expirado.".
   - Com evento, chama `updateUser`.
8. **Onboarding:**
   - Cada botão chama a RPC correta.
   - Cada código CX mapeado mostra a mensagem certa.
   - Sucesso chama `refresh`.
9. **Sair:** chama `signOut`, limpa o cache e vai para `/login`.
10. **Regressão:** `routes.test.jsx` e `layout.test.jsx` atualizados.
    - Rotas internas exigem sessão.
    - `/pesquisa/:token` e as telas de auth renderizam sem sessão.
    - A App sem configuração do Supabase continua sem usuário fictício.

### 4. Teste manual ponta a ponta (Supabase local + Mailpit; registre no relatório)
1. `supabase start` e `supabase db reset`.
2. `.env.local` com a URL e a chave **publishable/anon local** (não commitar). `npm run dev`.
3. **Usuário 1** (`ana@empresa.test`):
   - cadastra-se e confirma o e-mail pelo Mailpit do `supabase start`;
   - cai em `/onboarding`;
   - cria a "Empresa Teste" com domínio `empresa.test`;
   - vê o menu de supervisor.
4. **Usuário 2** (`beto@empresa.test`):
   - cadastra-se e confirma;
   - no onboarding, clica "Entrar na empresa do meu e-mail";
   - vê o menu de analista;
   - ao acessar `/curadoria`, volta para `/`; ao acessar `/`, vai para `/meu-desenvolvimento`.
5. **Usuário 3** (`caio@gmail.test`): tentar criar empresa com o domínio `empresa.test` → mensagem do CX005.
6. "Esqueci minha senha" → link no Mailpit → redefinir → entrar com a nova senha.
7. "Sair" volta para `/login`; atualizar uma rota interna redireciona para o login.
8. Capturas: login, cadastro, onboarding, menu de supervisor e menu de analista, em 1280 px e 375 px. Só e-mails `.test`.
9. O botão Google **não** precisa concluir o fluxo localmente (sem credenciais). Registre apenas que ele inicia o redirecionamento para `/auth/v1/authorize?provider=google`.

### 5. Validação
```
npm ci
npm run lint
npm run test
npm run build
supabase test db          # garante que os testes da TASK-010 continuam verdes
git status --short
```
Além disso: `grep` no `dist/` pelos termos `service_role`, `sb_secret_` e `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. O resultado deve ser vazio.

### 6. Fora do escopo
- Telas reais (listas, detalhe, curadoria).
- Gestão de membros pela interface (promover e remover); por ora o admin usa `set_member_role` diretamente.
- Convites.
- Criação de organização pelo painel do admin.
- Prova de domínio por DNS.
- Qualquer mudança em migrações ou RLS.
- Credenciais reais do Google e qualquer configuração remota.
- `docs/`.

### 7. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Login, cadastro, recuperação e redefinição funcionando no Supabase local | relatório da §4 + capturas |
| 2 | Rotas internas protegidas; redirecionamentos da REF por papel | testes 2 e 3 + §4 |
| 3 | Papel lido só do banco; metadata ignorada | teste 1 |
| 4 | Onboarding: criar empresa e entrar pelo domínio, com mensagens CX em pt-BR | testes 8 + §4 |
| 5 | Recuperação de senha sem enumeração de e-mails | teste 6 |
| 6 | Nenhum segredo no repositório nem no bundle | diff + grep no `dist/` |
| 7 | `npm ci`, `lint`, `test` e `build` passando; `supabase test db` verde | saídas reais |
| 8 | Dependências: nenhuma nova, salvo justificativa | `git diff --stat` |

### 8. Entrega
PR `TASK-014: Autenticação, rotas protegidas e entrada na empresa` para `main`, com o relatório do `AGENTS.md`, as saídas reais, o roteiro da §4 executado e as capturas. Não faça merge.

## FIM DO PROMPT
