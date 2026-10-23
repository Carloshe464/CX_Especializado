# TASK-001 — Fundação React/Vite/Supabase

| Campo | Valor |
|---|---|
| Fase | 1 — Fundação técnica |
| Responsável | Operador (Codex ou sessão Claude Code operadora) |
| Revisor | Claude Code (orquestrador) |
| Depende de | Documentos da Fase 0 em `main` |
| Branch | `task/001-fundacao` (a partir de `main`) |
| PR | `TASK-001: Fundação React/Vite/Supabase` → `main` |
| Itens de paridade | V-01, V-02, V-03, V-09, V-10, R-01, R-07, P-48, P-49 |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-001 — Fundação React/Vite/Supabase**: criar a base local do frontend. **Não implemente telas reais, autenticação, banco de dados nem IA.**

### 1. Leitura obrigatória antes de começar
- `AGENTS.md`, `docs/SECURITY.md`, `docs/DECISIONS.md` (D-003, D-004, D-005, D-006).
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §2, §3 e §9 (stack, rotas e design system da aplicação original).
- `docs/ARCHITECTURE.md` §2.

### 2. Objetivo
Projeto React 18 + Vite em JavaScript ESM, com Tailwind CSS v3 e base do shadcn/ui, React Router v7 com **todas** as rotas da aplicação original apontando para páginas provisórias, cliente Supabase preparado sem credenciais, tokens visuais exatos, ESLint, testes com Vitest e pipeline de CI.

### 3. Escopo autorizado

**3.1 Projeto e dependências** (npm; confira na documentação oficial a versão estável atual e a compatibilidade com React 18 e Node 22 antes de instalar; registre as versões no relatório)
- Runtime: `react@18`, `react-dom@18`, `react-router-dom@7`, `@supabase/supabase-js@2`, `@tanstack/react-query@5`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, `@radix-ui/react-slot`.
- Dev: `vite`, `@vitejs/plugin-react`, `tailwindcss@3` (última 3.4.x), `postcss`, `autoprefixer`, `eslint@9` (flat config), `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- **Não** instale Recharts, Playwright, Supabase CLI nem SDKs de IA nesta tarefa.
- `package.json`: `"type": "module"`, `"private": true`, `"engines": { "node": ">=22" }`, scripts: `dev`, `build`, `preview`, `lint`, `test` (`vitest run`), `test:watch`.
- `.nvmrc` com `22`. `package-lock.json` versionado.

**3.2 Estrutura de diretórios**
```
index.html
vite.config.js            # plugin react, alias @ → src, config do Vitest (jsdom, setupFiles)
jsconfig.json             # paths "@/*": ["./src/*"]
tailwind.config.js
postcss.config.js
eslint.config.js
components.json           # shadcn/ui, tsx: false, cssVariables: true, aliases com @/
.env.example
.gitignore
.nvmrc
.github/workflows/ci.yml
src/
  main.jsx
  App.jsx
  index.css
  lib/env.js
  lib/supabaseClient.js
  lib/utils.js            # cn() do shadcn
  components/ui/button.jsx
  components/cx/AppShell.jsx
  pages/                  # páginas provisórias (ver 3.5)
  test/setup.js
  __tests__/              # ou testes colocalizados *.test.jsx
supabase/migrations/.gitkeep
```

**3.3 `index.html`** (REF §9.3): `lang="pt-BR"`, `<title>Protocolo de Inteligência CX</title>`, meta viewport, Google Fonts **Fraunces** (pesos 400–700, com eixo `opsz`) e **Inter** (400–700) com `preconnect`, `<div id="root">`, `<script type="module" src="/src/main.jsx">`. Favicon simples em `public/` (sem marca de terceiros).

**3.4 Design tokens**
- `src/index.css`: diretivas `@tailwind base/components/utilities` e o bloco `:root` com **exatamente** estes valores (REF §9.1):
  ```
  --background: 40 30% 98%;   --foreground: 20 15% 12%;   --card: 0 0% 100%;
  --primary: 174 42% 21%;     --primary-foreground: 40 30% 98%;
  --secondary: 40 25% 94%;    --secondary-foreground: 174 42% 21%;
  --muted: 40 20% 95%;        --muted-foreground: 25 8% 42%;
  --accent: 38 45% 92%;       --accent-foreground: 30 25% 20%;
  --destructive: 8 70% 48%;   --border: 40 18% 88%;      --ring: 174 42% 21%;
  --radius: 0.75rem;
  --font-heading: 'Fraunces', Georgia, 'Times New Roman', serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Fraunces', Georgia, serif;
  ```
- Tokens exigidos pelo Tailwind/shadcn mas **ausentes na REF** devem ser definidos com estes valores derivados e marcados com o comentário `/* derivado — confirmar com README-DEV */`: `--card-foreground: 20 15% 12%`, `--popover: 0 0% 100%`, `--popover-foreground: 20 15% 12%`, `--input: 40 18% 88%`, `--destructive-foreground: 40 30% 98%`, `--chart-1: 174 42% 21%`, `--chart-2: 174 30% 40%`, `--chart-3: 38 70% 50%`, `--chart-4: 8 70% 48%`, `--chart-5: 200 60% 45%`, `--sidebar-background: 40 30% 98%`, `--sidebar-foreground: 20 15% 12%`, `--sidebar-primary: 174 42% 21%`, `--sidebar-primary-foreground: 40 30% 98%`, `--sidebar-accent: 38 45% 92%`, `--sidebar-accent-foreground: 30 25% 20%`, `--sidebar-border: 40 18% 88%`, `--sidebar-ring: 174 42% 21%`.
- Não crie tema escuro nem toggle (a REF usa apenas o tema claro).
- `@layer base`: `body` com `bg-background text-foreground font-body antialiased`; `h1–h4` com `font-heading tracking-tight`; `* { @apply border-border; }`.
- `tailwind.config.js` (REF §9.2): `content` em `index.html` e `src/**/*.{js,jsx}`; `colors` mapeando todos os tokens via `hsl(var(--x))` (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart.1–5, sidebar.*); `borderRadius` `lg: var(--radius)`, `md: calc(var(--radius) - 2px)`, `sm: calc(var(--radius) - 4px)`; `fontFamily` `heading`, `body`, `display` via variáveis e `mono` padrão; `opacity` de 0 a 100 em passos de 1 (`'0'…'100'` → `0…1`); keyframes/animation `accordion-down`/`accordion-up`; plugin `tailwindcss-animate`.

**3.5 Roteamento** (REF §3) — `src/App.jsx` com `QueryClientProvider` → `BrowserRouter` → `Routes`:
| Rota | Página provisória | Layout |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Login, Register, ForgotPassword, ResetPassword | sem layout |
| `/pesquisa/:token` | Survey (exibe "Pesquisa de satisfação") | sem layout |
| `/` | Dashboard ("Painel") | `AppShell` |
| `/avaliacoes` | Evaluations ("Avaliações") | `AppShell` |
| `/nova-avaliacao` | NewEvaluation ("Nova avaliação") | `AppShell` |
| `/avaliacao/:id` | EvaluationDetail ("Avaliação") | `AppShell` |
| `/curadoria` | Curation ("Curadoria") | `AppShell` |
| `/meu-desenvolvimento` | MyDevelopment ("Meu desenvolvimento") | `AppShell` |
| `/satisfacao` | Satisfaction ("Satisfação") | `AppShell` |
| `/protocolo` | ProtocolPage ("Protocolo") | `AppShell` |
| `*` | PageNotFound ("Página não encontrada" + link para `/`) | sem layout |

- Cada página provisória renderiza um `<h1>` com o título acima e o texto "Em construção." — nada além disso.
- `AppShell` é provisório: `<main className="min-h-screen bg-background"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Outlet /></div></main>`. O layout real (sidebar/topbar) é a TASK-003.
- **Não** implemente `ProtectedRoute`, redirecionamentos por papel nem contexto de autenticação (TASK-014). Adicione um comentário `// TODO(TASK-014): envolver com ProtectedRoute` no ponto onde o guard entrará.

**3.6 Cliente Supabase sem credenciais**
- `.env.example`:
  ```
  # Copie para .env.local. Somente valores PÚBLICOS. Nunca use a service_role/secret key no frontend.
  VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
  ```
  (Verifique na documentação atual do Supabase a nomenclatura vigente de chaves "publishable"/"anon" e mencione no relatório.)
- `src/lib/env.js` exporta `readSupabaseEnv(source = import.meta.env)` → `{ url, key, isConfigured, error }`:
  - `isConfigured=false` com `error` em pt-BR se faltar URL ou chave, ou se a URL não for `https://` (permitir `http://localhost`/`127.0.0.1` para Supabase local).
  - **Rejeitar** chaves secretas: prefixo `sb_secret_` ou JWT cujo payload decodificado tenha `"role":"service_role"` → `isConfigured=false` e erro "Chave secreta não pode ser usada no navegador".
  - Aceitar também `VITE_SUPABASE_ANON_KEY` como fallback legado.
- `src/lib/supabaseClient.js`: cria **um único** cliente com `createClient(url, key)` somente quando `isConfigured`; caso contrário exporta `supabase = null` e `supabaseConfigError`. Nenhuma chamada de rede na inicialização.
- Se não configurado, a aplicação **continua funcionando** e exibe, apenas em `import.meta.env.DEV`, um aviso discreto (faixa `bg-accent text-accent-foreground text-sm`) com a mensagem de configuração.

**3.7 shadcn/ui**
- Configure `components.json` para Tailwind v3 e JavaScript (`"tsx": false`, `"rsc": false`, `cssVariables: true`, aliases `@/components`, `@/lib/utils`, `@/components/ui`). A CLI atual do shadcn pode ter como padrão o Tailwind v4: consulte a seção de Tailwind v3 da documentação oficial e use a versão/CLI compatível, ou configure manualmente seguindo a documentação.
- Adicione somente o componente `button` (usado no link da 404) para comprovar a integração.

**3.8 Qualidade**
- `eslint.config.js` (flat): `@eslint/js` recommended, react, react-hooks, react-refresh; `globals.browser`; ignora `dist`. Regra que proíbe `require` (`no-restricted-syntax` para `CallExpression[callee.name='require']`) nos arquivos de `src/`.
- `npm run lint` deve terminar **sem erros e sem warnings**.

**3.9 Testes (Vitest + Testing Library, ambiente jsdom)**
1. `env.test.js`: variáveis ausentes; URL inválida; URL `http://localhost:54321` aceita; chave `sb_secret_...` rejeitada; JWT sintético com `role: service_role` rejeitado; JWT com `role: anon` aceito; chave `sb_publishable_...` aceita; fallback `VITE_SUPABASE_ANON_KEY`. Use apenas valores fictícios.
2. `routes.test.jsx`: para cada rota da tabela 3.5 (usando `MemoryRouter` com `initialEntries`), o `<h1>` esperado é renderizado; rota inexistente mostra "Página não encontrada". Para isso, separe a árvore de rotas (ex.: `AppRoutes`) do `BrowserRouter`.
3. `tokens.test.js`: lê `src/index.css` e confirma cada valor de `:root` listado em 3.4 (bloco da REF) exatamente.
4. `html.test.js`: `index.html` contém `lang="pt-BR"`, o título exato e as famílias Fraunces e Inter.

**3.10 CI** — `.github/workflows/ci.yml`: gatilhos `push` e `pull_request`; Node lido do `.nvmrc` com cache npm; passos `npm ci`, `npm run lint`, `npm run test`, `npm run build`. Sem segredos.

**3.11 `.gitignore`**: `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*` exceto `!.env.example`, `*.local`, logs, `.DS_Store`, `.vscode/*` (exceto `extensions.json`), `.idea/`, `supabase/.temp/`, `supabase/.branches/`.

**3.12 Documentação** — atualizar `README.md` seção "Execução local": pré-requisitos (Node 22, npm), `npm ci`, copiar `.env.example` para `.env.local`, scripts disponíveis, aviso de que autenticação/banco ainda não existem. Não altere outros documentos de governança (o orquestrador atualiza `TASKS.md` e `PARITY_MATRIX.md`).

### 4. Fora do escopo (proibido nesta tarefa)
Telas reais; sidebar/topbar; autenticação e guards; tabelas, migrações SQL ou qualquer acesso ao Supabase remoto; Edge Functions; IA; Recharts; deploy/publicação; serviços pagos; mudanças em `docs/` além do `README.md`.

### 5. Restrições
- JavaScript ESM, arquivos `.jsx` para componentes; nada de TypeScript.
- Classes Tailwind literais. Textos em pt-BR.
- Nenhum segredo real em nenhum arquivo; `.env.local` nunca commitado.
- Commits pequenos e descritivos na branch `task/001-fundacao`.

### 6. Critérios de aceitação (todos obrigatórios)
| # | Critério | Evidência exigida no relatório |
|---|---|---|
| 1 | Projeto React 18/Vite funcional | versões de `react`, `vite` em `npm ls` |
| 2 | Estrutura de diretórios conforme 3.2 | árvore (`git ls-files`) |
| 3 | Tailwind v3 configurado com tokens exatos | `tokens.test.js` passando + classe `bg-primary` presente no CSS gerado do build |
| 4 | Roteamento com todas as rotas da REF | `routes.test.jsx` passando |
| 5 | Supabase preparado sem credenciais; chaves secretas rejeitadas | `env.test.js` passando; `git grep -nE "sb_secret_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}\.eyJ" -- . ':!*.test.*'` sem resultados |
| 6 | `.env.example` e `.gitignore` adequados | conteúdo no relatório; `git check-ignore .env.local` retorna o caminho |
| 7 | Scripts `dev`, `build`, `preview`, `lint`, `test` | saída de cada um |
| 8 | Execução local comprovada | `npm run dev` + `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → `200`; idem `http://localhost:5173/curadoria` |
| 9 | Build sem erros | saída completa de `npm run build` |
| 10 | Lint sem erros e sem warnings | saída de `npm run lint` |
| 11 | CI verde no PR | link do run do GitHub Actions |
| 12 | `README.md` atualizado | diff |

### 7. Entrega
Abra o PR `TASK-001: Fundação React/Vite/Supabase` para `main` com o relatório no formato de `AGENTS.md`, incluindo as saídas reais dos comandos. Não declare nenhum critério atendido sem a evidência correspondente.

## FIM DO PROMPT

---

## Notas do orquestrador para a revisão
- Conferir que nenhuma página provisória antecipa comportamento (sem dados fictícios simulando a app).
- Conferir que a regra anti-`require` está ativa e que `npm ci` funciona a partir do lockfile limpo.
- Conferir os tokens derivados marcados para confirmação (dependem do README-DEV).
- Conferir que o CI roda em `pull_request` e está verde no último commit do PR.
