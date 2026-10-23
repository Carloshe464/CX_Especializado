# Quadro de tarefas

Status: 📝 Pronta para encaminhar · 🚧 Em execução · 🔍 Em revisão · ✅ Aprovada · ⛔ Bloqueada · 💤 Planejada
Status só muda com evidência (PR, CI, relatório do operador).

| ID | Título | Fase | Responsável | Depende de | Branch / PR | Status |
|---|---|---|---|---|---|---|
| TASK-000 | Fase 0 — reconhecimento, governança e planejamento | 0 | Claude Code (orquestrador) | — | `claude/youthful-mendel-aq8uze` | ✅ (aguarda merge em `main`) |
| TASK-001 | Fundação React/Vite/Supabase | 1 | Operador (Codex ou Claude) | TASK-000 em `main` | `task/001-fundacao` | 📝 |
| TASK-002 | Biblioteca de domínio `lib/cx.js` + testes | 1 | Operador | TASK-001 | — | 💤 |
| TASK-003 | Layout `CxLayout` + componentes base | 1 | Operador | TASK-001 | — | 💤 |
| TASK-010…015 | Banco, RLS, Storage, Auth | 2 | Operador | Fase 1 + decisões D-002/D-008/D-011/D-012/D-013 | — | ⛔ aguarda decisões |
| TASK-020…024 | Motor de IA | 3 | Operador | Fase 2 + D-009 | — | ⛔ aguarda D-009 |

## Bloqueios e pendências do responsável
1. **Criar `main`**: o repositório estava vazio; o primeiro commit está em `claude/youthful-mendel-aq8uze`. É preciso fazer o merge (ou criar `main` a partir desta branch) e defini-la como branch padrão antes da TASK-001.
2. **README-DEV — Auditoria Técnica Profunda** não foi anexado; inserir em `docs/reference/`.
3. **Supabase MCP** não está conectado nesta sessão; verificação somente leitura do projeto pendente.
4. Decisões propostas em `docs/DECISIONS.md`: D-002, D-008, D-009, D-011, D-012, D-013.
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).
