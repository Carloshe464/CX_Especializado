# TASK-003 — Layout `CxLayout` e componentes base

| Campo | Valor |
|---|---|
| Fase | 1 — Fundação técnica |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-001 em `main` e **TASK-004 mesclada** (ambas alteram `package.json`/lockfile e as regras de lint) |
| Branch | `task/003-layout` (a partir de `main`) |
| PR | `TASK-003: Layout e componentes base` → `main` |
| Itens de paridade | V-04, V-05, V-06 (parcial: filtragem por papel), V-07, P-38 (parcial), P-40 (StatCard) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-003 — Layout e componentes base**: o "casco" visual da aplicação (barra lateral no desktop, topo com pílulas no celular), componentes visuais reutilizáveis e os componentes shadcn/ui usados pelo domínio. **Não implemente autenticação, redirecionamentos por papel, dados, Supabase nem IA.**

### 0. Pré-condição
Crie `task/003-layout` a partir da `main` atualizada. Confirme que a TASK-004 já está na `main`, conferindo no `package.json` que `engines.node` é `>=22.22.2`; se não estiver, pare e reporte. **Não dispare o GitHub Actions (D-021).**

### 1. Leitura obrigatória
- `AGENTS.md`, `docs/DECISIONS.md` (D-011, D-017).
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §3, §8 (linha `Layout.jsx` e `StatCard.jsx`) e §9.
- `docs/reference/README-DEV_AUDITORIA_TECNICA.md` §A.1 (componentes shadcn usados), §E.2 (vocabulário visual) e §E.3 (Layout).

### 2. Escopo autorizado

**2.1 Sessão provisória (sem autenticação)** — `src/auth/SessionContext.jsx`
- `SessionProvider` e `useSession()` expondo `{ user, role }`, onde `user = { email } | null` e `role ∈ {"supervisor", "analista", "platform_admin"} | null`.
- O valor padrão da aplicação é **sempre** `{ user: null, role: null }`. **Proibido** usar usuário fictício, papel fixo ou seletor de papel na aplicação. Valores sintéticos só nos testes, por meio do `SessionProvider`.
- Comentário: `// TODO(TASK-014): substituir pelo estado real do Supabase Auth.`

**2.2 `src/components/cx/Layout.jsx`** (substitui o `AppShell.jsx`, que deve ser removido; atualize `App.jsx` e os testes)

Desktop (`lg` ou maior): barra lateral fixa à esquerda, `w-64`, `border-r border-border bg-card`.
- **Topo:** logo em quadrado `rounded-xl bg-primary` com o ícone `HeartHandshake` em `text-primary-foreground`, e o nome "Protocolo CX" em `font-heading font-semibold` (*nome derivado — confirmar na comparação visual*).
- **Navegação:** `NavLink`; ativo `bg-accent text-accent-foreground`; inativo `text-muted-foreground hover:bg-accent/60`; itens `rounded-lg px-3 py-2 text-sm` com ícone.
- **Rodapé:** e-mail truncado (`truncate`), rótulo do papel em caixa alta pequena (`text-[11px] uppercase tracking-widest text-muted-foreground`) e botão "Sair" (ícone `LogOut`).
  - Rótulos do papel: supervisor → "SUPERVISOR"; analista → "ANALISTA"; platform_admin → "ADMIN GERAL" (derivado, D-017).
  - Sem usuário: o rodapé mostra "Sessão não iniciada" e **não** mostra "Sair".
  - "Sair" chama `onSignOut` recebido do contexto; nesta tarefa ele não faz nada além de existir (TASK-014).

Celular (abaixo de `lg`): topo `sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur`, com o logo pequeno e uma linha de pílulas com rolagem horizontal (`overflow-x-auto`). Pílula ativa `bg-primary text-primary-foreground`; inativa `bg-secondary text-secondary-foreground`. Sem rolagem horizontal da página.

Conteúdo: `<main className="lg:pl-64">` com o contêiner `mx-auto max-w-6xl px-4 py-8 sm:px-6` e `<Outlet />`.

**Itens de navegação** (ordem e visibilidade conforme REF §8; ícones *derivados — confirmar na comparação visual*):

| Rótulo | Rota | Visível para | Ícone sugerido |
|---|---|---|---|
| Painel | `/` | supervisor, platform_admin | `LayoutDashboard` |
| Avaliações | `/avaliacoes` | todos | `ClipboardList` |
| Nova avaliação | `/nova-avaliacao` | todos | `CirclePlus` (ou nome equivalente no lucide 1.x) |
| Curadoria | `/curadoria` | supervisor, platform_admin | `ShieldCheck` |
| Satisfação | `/satisfacao` | supervisor, platform_admin | `Smile` |
| Protocolo | `/protocolo` | supervisor, platform_admin | `BookOpen` |
| Meu desenvolvimento | `/meu-desenvolvimento` | analista (oculto para supervisor/admin) | `Sprout` |

Com `role = null`, mostrar apenas "Avaliações" e "Nova avaliação". Os itens devem vir de uma lista declarativa (`NAV_ITEMS`) com `roles`, filtrada por uma função pura exportada (`visibleNavItems(role)`), testável. **Isso é só apresentação; o controle de acesso real será feito no banco e nas rotas (TASK-012/TASK-014).**

**2.3 Componentes visuais** em `src/components/cx/` (README-DEV §E.2):
- `StatCard({ label, value, hint })`: `rounded-2xl border border-border bg-card p-5`; label `text-xs uppercase tracking-widest text-muted-foreground`; valor `font-heading text-3xl font-semibold`; hint opcional `text-sm text-muted-foreground`.
- `PageHeader({ kicker, title, description, actions })`: kicker `text-[11px] uppercase tracking-[0.2em] text-muted-foreground`; título `<h1>` `font-heading text-3xl sm:text-4xl font-semibold tracking-tight`.
- `EmptyState({ icon, title, description, action })`: `rounded-2xl border border-dashed border-border p-10 text-center`.
- `LoadingSpinner({ label = "Carregando…" })`: `h-8 w-8 rounded-full border-4 border-secondary border-t-primary animate-spin`, com `role="status"` e texto acessível.

**2.4 shadcn/ui** (estilo new-york, Tailwind v3, JavaScript, tudo em `src/components/ui/`), apenas os usados pelo domínio (README-DEV §A.1): `input`, `textarea`, `label`, `tabs`, `select`, `dialog`, `toast` + `toaster` + `use-toast`. Instale somente os pacotes `@radix-ui/*` correspondentes. Configure à mão, seguindo a documentação de Tailwind v3 do shadcn (a CLI atual gera v4).

**2.5 Wrapper da aplicação** (REF §3): `App.jsx` passa a ser `QueryClientProvider` → `SessionProvider` → `BrowserRouter` → `ScrollToTop` + rotas + `<Toaster />`. `ScrollToTop` (`src/components/ScrollToTop.jsx`) rola para o topo a cada mudança de `pathname`. As rotas internas usam `Layout` no lugar de `AppShell`. **As páginas provisórias não mudam.**

**2.6 Ícones do lucide-react 1.x.** O original usava a linha 0.475. Confirme, pela documentação/changelog oficial do lucide 1.x, o nome atual de: `HeartHandshake`, `ClipboardList`, `Loader2` (pode ter virado `LoaderCircle`), `LogOut` e dos ícones da tabela. Liste no relatório o nome usado para cada um.

### 3. Testes obrigatórios
1. `visibleNavItems`: listas exatas, na ordem, para `supervisor`, `platform_admin`, `analista` e `null`.
2. Layout renderizado com `SessionProvider` sintético (e-mail fictício `analista@exemplo.test`):
   - mostra os itens corretos e o rótulo do papel;
   - marca o item da rota ativa;
   - sem sessão, mostra "Sessão não iniciada" e não mostra "Sair".
3. `routes.test.jsx` atualizado: as rotas internas renderizam dentro do Layout (`role="main"` presente), as externas fora dele.
4. `StatCard`, `PageHeader`, `EmptyState` e `LoadingSpinner` renderizam as props e os papéis acessíveis.
5. Um teste garante que a aplicação, **sem** provider de teste, usa sessão nula (sem usuário fictício).

### 4. Fora do escopo
`ProtectedRoute`, redirecionamentos de `/`, `/curadoria` e `/satisfacao`, login/logout reais, páginas reais, Recharts, `docs/` e outros componentes shadcn além dos listados.

### 5. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Layout desktop e celular conforme 2.2 | diff + capturas de tela locais em 1280 px e 375 px anexadas ao PR (com papel sintético só no ambiente local de captura, sem commit) |
| 2 | Sem rolagem horizontal em 375 px | captura + descrição da verificação |
| 3 | Navegação filtrada por papel (2.2) e testada | testes |
| 4 | Componentes 2.3 e shadcn 2.4 presentes e usados só onde previsto | diff |
| 5 | Nenhum usuário/papel fictício no código da aplicação | revisão + teste 3.5 |
| 6 | `npm run lint` sem erros e sem warnings; `npm run test` e `npm run build` passando | saídas reais |
| 7 | Nomes de ícones confirmados para o lucide 1.x | tabela no relatório |
| 8 | Lockfile coerente, apenas com os pacotes `@radix-ui/*` novos | `git diff --stat` + `npm ls` |

### 6. Entrega
PR `TASK-003: Layout e componentes base` para `main`, com o relatório do `AGENTS.md`, as saídas reais e as capturas. Não faça merge.

## FIM DO PROMPT
