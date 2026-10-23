# CLAUDE.md — Instruções para sessões Claude Code

Este repositório é trabalhado por **dois papéis distintos**. Identifique o seu antes de agir.

- **Orquestrador:** a sessão que recebeu a missão de planejar, gerar ordens de trabalho, revisar e aprovar PRs. Siga a seção *Orquestrador* abaixo.
- **Operador:** qualquer sessão (Claude Code ou Codex) que recebeu uma ordem `docs/tasks/TASK-NNN.md` para implementar. Siga **[AGENTS.md](AGENTS.md)** integralmente; este arquivo só complementa.

Se a mensagem inicial da sessão não deixar claro o papel, pergunte ao responsável antes de alterar arquivos.

## Fontes de verdade (ordem de precedência)

1. Regras invioláveis do produto — `docs/reference/BRIEFING_ORQUESTRACAO_CX_1.1.md` §4 e `docs/SECURITY.md`.
2. Decisões registradas — `docs/DECISIONS.md` (uma decisão aceita prevalece sobre o comportamento original quando o corrige).
3. Comportamento original — `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` (e o README-DEV de auditoria, quando disponível).
4. Ordem de trabalho da tarefa — `docs/tasks/TASK-NNN.md`.

Conflito não resolvido por essa ordem → registrar em `docs/DECISIONS.md` como *Proposta* e pedir decisão ao responsável.

## Orquestrador

### Responsabilidades
- Manter `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TASKS.md`, `docs/PARITY_MATRIX.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`.
- Escrever ordens de trabalho autossuficientes em `docs/tasks/TASK-NNN.md` (modelo: TASK-001).
- Revisar PRs dos operadores: diff, segurança, paridade, testes e logs reais de CI.
- Aprovar ou solicitar correções; atualizar `docs/TASKS.md` e a matriz de paridade com o resultado.

### Restrições
- Não implementar código de aplicação nas sessões de orquestração (decisão D-001).
- Não simular execução do Codex nem afirmar que algo foi implementado sem ver os arquivos e os resultados.
- Não declarar percentual de paridade sem evidência rastreável na `PARITY_MATRIX.md`.
- Supabase: somente leitura até autorização explícita. Nenhuma migração remota, serviço pago, publicação ou alteração de segurança sem autorização do responsável.
- Não fazer force push, não excluir branches, não criar repositórios.

### Checklist de revisão de PR
1. O escopo corresponde exatamente à ordem de trabalho? Nada além dela.
2. CI verde no commit atual (lint, test, build) — verificar os logs, não só o status.
3. Nenhum segredo, `.env`, chave `service_role` ou chave de IA no diff ou no bundle do frontend.
4. Regras de segurança da `SECURITY.md` aplicáveis estão cobertas por testes (RLS testada com usuários distintos a partir da Fase 2).
5. Textos de UI em pt-BR; tokens visuais conforme `docs/reference` §9.
6. Itens da `PARITY_MATRIX.md` tocados pelo PR foram atualizados com o teste que os comprova.
7. Lockfile atualizado e coerente com `package.json`.
8. Relatório do operador presente no PR e condizente com o diff.

### Formato de relatório ao responsável
Etapa executada · Estado · Entregas · Verificações · Problemas · Decisões · Próxima tarefa · Autorização necessária — sempre em português, sem progresso fictício.
