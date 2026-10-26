# Quadro de tarefas

Status: 📝 Pronta para encaminhar · 🚧 Em execução · 🔍 Em revisão · ✅ Aprovada · ⛔ Bloqueada · 💤 Planejada
Status só muda com evidência (PR, CI, relatório do operador).

| ID | Título | Fase | Responsável | Depende de | Branch / PR | Status |
|---|---|---|---|---|---|---|
| TASK-000 | Fase 0 — reconhecimento, governança e planejamento | 0 | Claude Code (orquestrador) | — | `claude/youthful-mendel-aq8uze` | ✅ (em `main`) |
| TASK-001 | Fundação React/Vite/Supabase | 1 | Operador (Codex ou Claude) | TASK-000 em `main` | `task/001-fundacao` · PR #2 | ✅ mesclada em 2026-10-23 |
| TASK-002 | Biblioteca de domínio `lib/cx.js` + testes | 1 | Operador | TASK-001 · paralela à 004 | `task/002-dominio-cx` | ✅ mesclada (PR #4) |
| TASK-003 | Layout `CxLayout` + componentes base | 1 | Operador | **TASK-004 mesclada** | `task/003-layout` | ✅ mesclada (PR #8) |
| TASK-004 | Manutenção da toolchain (ESLint suportado, `engines`; actions só ao reativar CI) | 1 | Operador | TASK-001 · paralela à 002 | `task/004-toolchain` | ✅ mesclada parcial (PR #5, D-022) |
| TASK-010 | Banco local: identidade, organizações, papéis, entrada por domínio | 2 | Operador | TASK-001 · **paralela à 003** | PR #11 | ✅ mesclada |
| TASK-011 | Banco local: entidades de negócio + integridade + seed | 2 | Operador | **TASK-010 mesclada** | `task/011-entidades-negocio` | ✅ PR #16 |
| TASK-014 | Auth no frontend: e-mail/senha + Google, ProtectedRoute, redirecionamentos por papel, onboarding | 2 | Operador | TASK-003 ✅ + **TASK-010 mesclada** · paralela à 011 | `claude/magical-hamilton-06itj1` | ✅ PR #15 |
| TASK-012 | Banco local: RLS de negócio, RPCs de validação/curadoria, `effective_feedback` | 2 | Operador | **TASK-011 mesclada** · paralela à 014 | `laikc/great-mayer-la33ql` | ✅ PR #18 |
| TASK-013 | Storage privado + `evaluation_files` + serviço de upload/URL assinada | 2 | Operador | **TASK-012 mesclada** | `task/013-storage` | 📝 liberada |
| TASK-015 | Revisão de segurança da Fase 2 + pedido de autorização para o remoto | 2 | Orquestrador | 011–014 mescladas | — | 💤 |
| TASK-020…025 | Motor de IA + configuração de provedor | 3 | Operador | Fase 2 + escolha do primeiro adaptador de provedor | — | 💤 |
| TASK-040…044 | Extensão de captura | E | Operador | Fase 4 + exemplo de URL/DOM do ClickDesk | — | 💤 |

## Ordem de execução da Fase 1
1. **Onda 1 (paralelo):** TASK-002 e TASK-004. Arquivos distintos; quem for mesclado por último traz a `main` e repete as validações.
2. **Onda 2:** TASK-003, depois da TASK-004 mesclada (conflito de `package.json`/lockfile e regras de lint).

## Ordem de execução da Fase 2
1. ✅ TASK-003 e TASK-010 (paralelas); ✅ TASK-011 e TASK-014 (paralelas).
2. ✅ TASK-012 (RLS/RPCs de negócio).
3. **Agora:** TASK-013 (Storage).
4. **TASK-015:** revisão de segurança pelo orquestrador + pedido de autorização para aplicar no remoto.

## Backlog identificado em revisões
- Gestão de membros: inclusão ou convite pelo admin/supervisor, para empresas sem domínio, e promoção/remoção pela interface (origem: revisão da TASK-010).
- Configuração remota de auth (tamanho mínimo de senha 8, `site_url`, Google) na TASK-015.
- `minimum_password_length = 8` também no `supabase/config.toml` local (servidor aceita 6; a interface exige 8) — TASK-015 (origem: revisão da TASK-014).
- Templates de e-mail com `token_hash` + `verifyOtp`: com PKCE, o link de confirmação/redefinição só funciona no mesmo navegador. Resolver antes de publicar — TASK-015.
- Botão "Sair" no cabeçalho móvel do `Layout` (hoje só existe na barra lateral do desktop) — correção pequena, junto da Fase 4.
- *Code splitting* das páginas internas (bundle de 512 kB) — Fase 4.
- Fase 3: a Edge Function só aponta `current_analysis_run_id` para execução com `sucesso` (`decide_opportunity` confere só a execução atual) (origem: revisão da TASK-012).
- TASK-021: a tela de configuração de IA lista colunas explicitamente; `select *` em `ai_provider_configs` dá `42501` (sem grant em `secret_ref`).
- Gestão de membros: o trigger `protect_evaluation` lê `memberships` com a RLS de quem chama; revisar se a política de `memberships` mudar.
- Avaliação com execução, ticket de pesquisa ou arquivo não pode ser apagada (FKs da TASK-011); para rascunho com arquivo, apagar antes o objeto no Storage — conferir na TASK-013.

## Bloqueios e pendências do responsável
1. ~~Criar `main` e defini-la como padrão~~ — feito.
2. ~~README-DEV~~ — incorporado em `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
3. **Supabase MCP** não está conectado nesta sessão; verificação somente leitura do projeto pendente.
4. Decisões de produto fechadas em 2026-10-23 (ver `docs/DECISIONS.md` e `docs/specs/`). Pendências menores: confirmar "retorno positivo" = gostei **e** útil; primeiro adaptador de provedor de IA (pode ficar para a Fase 3).
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).

## Registro de revisões
| Tarefa | PR | Commit revisado | Resultado | Evidência |
|---|---|---|---|---|
| TASK-012 | #18 | `6817194` | ✅ Aprovada; códigos CX023–CX036; políticas de `evaluations` em linha (INSERT … RETURNING) e regras extras aceitas; relatório diz que `decide_opportunity` exige `sucesso`, o código só exige execução atual (risco nulo, registrado para a Fase 3) | saídas locais (562/562 pgTAP, `db lint`, lint 0, 301 testes, build); revisão linha a linha da migração e da matriz |
| TASK-014 | #15 | `a62968f` | ✅ Aprovada (squash, sem as capturas PNG no histórico); desvios aceitos: branch, `AuthProvider` dentro do roteador, `PublicOnlyRoute`, indicador de recuperação em `sessionStorage` | saídas locais (lint 0, 301 testes, build, 102 pgTAP), `grep` do `dist/`, roteiro manual com Mailpit/Playwright e capturas 1280/375 |
| TASK-011 | #16 | `1627990` | ✅ Aprovada; guards de `TRUNCATE` extras aceitos; inventário de `00_estrutura` relaxado (SEC-16 mantido) | saídas locais (355/355 pgTAP, `db lint`, lint 0, 227 testes, build) e comparação literal das listas com `cx.js`; revisão linha a linha da migração |
| TASK-001 | #2 | `21f7f8f` | ✅ Aprovada; 5 pontos não bloqueantes → TASK-004/TASK-003/D-020 | CI run 39986235495 (lint 0 warnings, 73 testes, build); revisão do diff completo |
| TASK-001 | #2 | `fe7427a` | Commit do orquestrador: CI só manual (D-021), sem efeito no código da aplicação | diff de 1 arquivo (`ci.yml`) |
| TASK-004 | #5 | `498a86e` | ✅ Aprovada como parcial: `engines.node >=22.22.2`; ESLint 10 bloqueado pelo peer de `eslint-plugin-react` (D-022) | saídas locais no PR (lint 0, 73 testes, build, anti-`require`, audit antes/depois); diff 2+/2− |
| TASK-010 | #11 | `c35d5df` | ✅ Aprovada; caminho do admin (D-023); admin sem e-mail verificado e empresa sem supervisor até a 1ª promoção aceitos | 102/102 pgTAP + `db lint` + app intacto (saídas locais); revisão linha a linha da migração |
| TASK-003 | #8 | `87b12ff` | ✅ Aprovada; sessão separada em `auth/session.js` e `navigation.js` (react-refresh), desvio aceito | saídas locais (lint 0, 227 testes, build), capturas 1280/375, revisão do diff |
| TASK-002 | #4 | `18606ad` | ✅ Aprovada; branch `claude/magical-hamilton-06itj1` (desvio aceito); `STATUS_STYLES.rascunho` derivado | saídas locais no PR (lint 0, 205 testes, build); revisão do diff completo |
