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
| TASK-011 | Banco local: entidades de negócio + integridade + seed | 2 | Operador | **TASK-010 mesclada** | `task/011-entidades` | 📝 liberada |
| TASK-014 | Auth no frontend: e-mail/senha + Google, ProtectedRoute, redirecionamentos por papel, onboarding | 2 | Operador | TASK-003 ✅ + **TASK-010 mesclada** · paralela à 011 | `task/014-auth` | 📝 liberada (paralela à 011) |
| TASK-012, 013, 015 | RLS de negócio + RPCs, Storage, revisão de segurança | 2 | Operador / orquestrador | TASK-011 | — | 💤 |
| TASK-020…025 | Motor de IA + configuração de provedor | 3 | Operador | Fase 2 + escolha do primeiro adaptador de provedor | — | 💤 |
| TASK-040…044 | Extensão de captura | E | Operador | Fase 4 + exemplo de URL/DOM do ClickDesk | — | 💤 |

## Ordem de execução da Fase 1
1. **Onda 1 (paralelo):** TASK-002 e TASK-004. Arquivos distintos; quem for mesclado por último traz a `main` e repete as validações.
2. **Onda 2:** TASK-003, depois da TASK-004 mesclada (conflito de `package.json`/lockfile e regras de lint).

## Ordem de execução da Fase 2
1. **Agora (paralelo):** TASK-003 (frontend) e TASK-010 (banco). Arquivos disjuntos: `src/`+`package.json` × `supabase/`.
2. **Depois da TASK-010 mesclada:** TASK-011.
3. **Depois da TASK-011:** TASK-012 (RLS/RPCs) e TASK-013 (Storage); TASK-014 (Auth no frontend) depois da TASK-003 e da TASK-010.
4. **TASK-015:** revisão de segurança pelo orquestrador + pedido de autorização para aplicar no remoto.

## Backlog identificado em revisões
- Gestão de membros: inclusão ou convite pelo admin/supervisor, para empresas sem domínio, e promoção/remoção pela interface (origem: revisão da TASK-010).
- Configuração remota de auth (tamanho mínimo de senha 8, `site_url`, Google) na TASK-015.

## Bloqueios e pendências do responsável
1. ~~Criar `main` e defini-la como padrão~~ — feito.
2. ~~README-DEV~~ — incorporado em `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
3. **Supabase MCP** não está conectado nesta sessão; verificação somente leitura do projeto pendente.
4. Decisões de produto fechadas em 2026-10-23 (ver `docs/DECISIONS.md` e `docs/specs/`). Pendências menores: confirmar "retorno positivo" = gostei **e** útil; primeiro adaptador de provedor de IA (pode ficar para a Fase 3).
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).

## Registro de revisões
| Tarefa | PR | Commit revisado | Resultado | Evidência |
|---|---|---|---|---|
| TASK-001 | #2 | `21f7f8f` | ✅ Aprovada; 5 pontos não bloqueantes → TASK-004/TASK-003/D-020 | CI run 39986235495 (lint 0 warnings, 73 testes, build); revisão do diff completo |
| TASK-001 | #2 | `fe7427a` | Commit do orquestrador: CI só manual (D-021), sem efeito no código da aplicação | diff de 1 arquivo (`ci.yml`) |
| TASK-004 | #5 | `498a86e` | ✅ Aprovada como parcial: `engines.node >=22.22.2`; ESLint 10 bloqueado pelo peer de `eslint-plugin-react` (D-022) | saídas locais no PR (lint 0, 73 testes, build, anti-`require`, audit antes/depois); diff 2+/2− |
| TASK-010 | #11 | `c35d5df` | ✅ Aprovada; caminho do admin (D-023); admin sem e-mail verificado e empresa sem supervisor até a 1ª promoção aceitos | 102/102 pgTAP + `db lint` + app intacto (saídas locais); revisão linha a linha da migração |
| TASK-003 | #8 | `87b12ff` | ✅ Aprovada; sessão separada em `auth/session.js` e `navigation.js` (react-refresh), desvio aceito | saídas locais (lint 0, 227 testes, build), capturas 1280/375, revisão do diff |
| TASK-002 | #4 | `18606ad` | ✅ Aprovada; branch `claude/magical-hamilton-06itj1` (desvio aceito); `STATUS_STYLES.rascunho` derivado | saídas locais no PR (lint 0, 205 testes, build); revisão do diff completo |
