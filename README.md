# Protocolo CX 1.1

Plataforma de análise e gestão da qualidade de atendimentos (Customer Experience e Customer Success), reconstruída de forma independente a partir da aplicação original desenvolvida no Base44.

> **Estado atual:** Fase 0 (reconhecimento e planejamento) concluída. Ainda não existe código de aplicação. A primeira ordem de implementação é a [TASK-001](docs/tasks/TASK-001.md).

## Objetivo

Reconstruir a aplicação existente com meta de **99% de paridade funcional e visual verificável por testes**, corrigindo os problemas de segurança e integridade identificados na auditoria. Não se trata de criar uma plataforma "semelhante".

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite, JavaScript ESM, Tailwind CSS, shadcn/ui, React Router, Recharts, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, Storage privado, Edge Functions, RLS) |
| IA | Camada de serviço independente do provedor, executada no servidor |
| Engenharia | Git/GitHub, ESLint, testes automatizados |

## Organização do trabalho

| Papel | Agente | Instruções |
|---|---|---|
| Orquestrador (arquitetura, ordens de trabalho, revisão, aprovação de PR) | Claude Code | [CLAUDE.md](CLAUDE.md) |
| Operadores (implementação) | OpenAI Codex e/ou sessões Claude Code operadoras | [AGENTS.md](AGENTS.md) |

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/reference/](docs/reference/) | Documentação original extraída do Base44 e briefing de orquestração |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura proposta |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Fases e critérios de saída |
| [docs/TASKS.md](docs/TASKS.md) | Quadro de tarefas, responsáveis e status |
| [docs/tasks/](docs/tasks/) | Ordens de trabalho completas (prompts para os operadores) |
| [docs/PARITY_MATRIX.md](docs/PARITY_MATRIX.md) | Matriz de paridade funcional, visual e de segurança |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de ameaças e regras de segurança |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registro de decisões técnicas |

## Execução local

Será documentada pela TASK-001 (scripts `dev`, `build`, `lint`, `test`).
