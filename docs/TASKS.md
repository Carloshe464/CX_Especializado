# Quadro de tarefas

Status: 📝 Pronta para encaminhar · 🚧 Em execução · 🔍 Em revisão · ✅ Aprovada · ⛔ Bloqueada · 💤 Planejada
Status só muda com evidência (PR, CI, relatório do operador).

| ID | Título | Fase | Responsável | Depende de | Branch / PR | Status |
|---|---|---|---|---|---|---|
| TASK-000 | Fase 0 — reconhecimento, governança e planejamento | 0 | Claude Code (orquestrador) | — | `claude/youthful-mendel-aq8uze` | ✅ (em `main`) |
| TASK-001 | Fundação React/Vite/Supabase | 1 | Operador (Codex ou Claude) | TASK-000 em `main` | `task/001-fundacao` | 📝 |
| TASK-002 | Biblioteca de domínio `lib/cx.js` + testes | 1 | Operador | TASK-001 | — | 💤 |
| TASK-003 | Layout `CxLayout` + componentes base | 1 | Operador | TASK-001 | — | 💤 |
| TASK-010…015 | Organizações, banco, RLS, Storage, Auth | 2 | Operador | Fase 1 + D-017 (entrada na organização) + perguntas da spec de validação | — | ⛔ aguarda respostas |
| TASK-020…025 | Motor de IA + configuração de provedor | 3 | Operador | Fase 2 + primeiro provedor + chave por organização? | — | ⛔ aguarda respostas |
| TASK-040…044 | Extensão de captura | E | Operador | Fase 4 + spec da extensão §6 | — | 💤 |

## Bloqueios e pendências do responsável
1. ~~Criar `main` e defini-la como padrão~~ — feito.
2. ~~README-DEV~~ — incorporado em `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
3. **Supabase MCP** não está conectado nesta sessão; verificação somente leitura do projeto pendente.
4. Decididas: D-002, D-008, D-009 (conceito), D-011, D-012, D-013, D-014, D-016, D-017 (papéis), D-018 (escopo). Perguntas abertas: `docs/specs/VALIDACAO_E_CURADORIA.md` §4, `docs/specs/PROVEDOR_IA.md` §5, `docs/specs/EXTENSAO_CAPTURA.md` §6, D-017 (entrada na organização).
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).
