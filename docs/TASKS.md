# Quadro de tarefas

Status: 📝 Pronta para encaminhar · 🚧 Em execução · 🔍 Em revisão · ✅ Aprovada · ⛔ Bloqueada · 💤 Planejada
Status só muda com evidência (PR, CI, relatório do operador).

| ID | Título | Fase | Responsável | Depende de | Branch / PR | Status |
|---|---|---|---|---|---|---|
| TASK-000 | Fase 0 — reconhecimento, governança e planejamento | 0 | Claude Code (orquestrador) | — | `claude/youthful-mendel-aq8uze` | ✅ (em `main`) |
| TASK-001 | Fundação React/Vite/Supabase | 1 | Operador (Codex ou Claude) | TASK-000 em `main` | `task/001-fundacao` | 📝 |
| TASK-002 | Biblioteca de domínio `lib/cx.js` + testes | 1 | Operador | TASK-001 | — | 💤 |
| TASK-003 | Layout `CxLayout` + componentes base | 1 | Operador | TASK-001 | — | 💤 |
| TASK-010…015 | Organizações, banco, RLS, Storage, Auth | 2 | Operador | Fase 1 + Supabase CLI para o operador | — | 💤 (decisões tomadas) |
| TASK-020…025 | Motor de IA + configuração de provedor | 3 | Operador | Fase 2 + escolha do primeiro adaptador de provedor | — | 💤 |
| TASK-040…044 | Extensão de captura | E | Operador | Fase 4 + exemplo de URL/DOM do ClickDesk | — | 💤 |

## Bloqueios e pendências do responsável
1. ~~Criar `main` e defini-la como padrão~~ — feito.
2. ~~README-DEV~~ — incorporado em `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
3. **Supabase MCP** não está conectado nesta sessão; verificação somente leitura do projeto pendente.
4. Decisões de produto fechadas em 2026-10-23 (ver `docs/DECISIONS.md` e `docs/specs/`). Pendências menores: confirmar "retorno positivo" = gostei **e** útil; comprovação de posse de domínio; exemplo de URL/DOM do ClickDesk; primeiro adaptador de provedor de IA (pode ficar para a Fase 3).
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).
