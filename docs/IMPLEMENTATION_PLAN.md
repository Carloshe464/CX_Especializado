# Plano de implementação

Cada fase só começa quando os critérios de saída da fase anterior estiverem **verificados** (evidência em PR/CI). Tarefas detalhadas em `docs/TASKS.md`; ordens completas em `docs/tasks/`.

## Fase 0 — Reconhecimento e planejamento ✅ (orquestrador)
Entregas: governança (`CLAUDE.md`, `AGENTS.md`), arquitetura, decisões, segurança, matriz de paridade, TASK-001.
Saída: documentos versionados; TASK-001 pronta para encaminhamento.
Pendências que **não bloqueiam a Fase 1**: README-DEV de auditoria ausente; Supabase MCP indisponível nesta sessão; decisões D-002, D-008, D-009, D-011, D-012, D-013.

## Fase 1 — Fundação técnica
| Tarefa | Escopo | Depende de |
|---|---|---|
| TASK-001 | Vite + React 18 + Tailwind v3 + shadcn base + Router v7 + cliente Supabase + tokens + ESLint + Vitest + CI | Fase 0 |
| TASK-002 | `src/lib/cx.js` completo com testes (itens D-01…D-07) | TASK-001 |
| TASK-003 | `CxLayout` (sidebar/topbar), `StatCard` e componentes shadcn necessários, com papel simulado em testes | TASK-001 |

Saída: build e CI verdes; V-01…V-03, V-09, V-10, R-01, R-07, D-01…D-07, P-48, P-49 verificados.

## Fase 2 — Banco e autenticação
**Pré-requisitos:** decisões D-002, D-008, D-011, D-012, D-013; Supabase CLI disponível para o operador (testes locais).
| Tarefa | Escopo |
|---|---|
| TASK-010 | Migrações: `profiles`, funções de papel, enums/constraints |
| TASK-011 | Migrações: entidades de negócio + `analysis_runs`, `ai_failures`, `evaluation_files`; seeds |
| TASK-012 | RLS + RPCs de curadoria + triggers de proteção + matriz de testes de RLS |
| TASK-013 | Storage privado e políticas |
| TASK-014 | Auth no frontend: AuthProvider, ProtectedRoute, RequireRole, telas de auth |
| TASK-015 | **Revisão de segurança** pelo orquestrador + pedido de autorização para aplicar no remoto |

Saída: matriz RLS 100% verde localmente (S-01…S-08, S-10); autorização registrada antes de qualquer `db push`.

## Fase 3 — Motor CX 1.1
**Pré-requisito:** D-009 (provedor/modelo/orçamento).
TASK-020 adaptador de provedor + schemas de validação · TASK-021 prompts versionados (hash verbatim) · TASK-022 Edge Function `analyze-evaluation` com persistência transacional e tratamento de falhas · TASK-023 `extract-transcript` (visão) · TASK-024 suíte de transcrições sintéticas.
Saída: A-01…A-09 verificados com mocks e com ao menos uma execução real autorizada.

## Fase 4 — Fluxo principal
Avaliações, Nova avaliação (colar/prints), Detalhe, Curadoria, Meu desenvolvimento. Saída: P-08…P-23, P-37, P-41 (sem CSAT).

## Fase 5 — Complementares
Importação de planilhas, extração de PDFs/prints de CSAT, Satisfação, Pesquisa pública, Dashboard com agregações SQL, Protocolo. Saída: P-01…P-07, P-24…P-36, A-10, A-11.

## Fase 6 — Validação e publicação
Testes de segurança, integração e e2e (Playwright), comparação visual com a referência, conferência de indicadores, auditoria de custos, plano de publicação. Publicação somente com autorização.
