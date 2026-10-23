# TASK-004 — Manutenção da toolchain

| Campo | Valor |
|---|---|
| Fase | 1 — Fundação técnica |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-001 (em `main`) |
| Pode correr em paralelo com | TASK-002. **Precisa ser mesclada antes de iniciar a TASK-003** (as duas alteram `package.json` e o lockfile) |
| Branch | `task/004-toolchain` (a partir de `main`) |
| PR | `TASK-004: Manutenção da toolchain` → `main` |
| Origem | Pontos não bloqueantes 1 e 3 da revisão da TASK-001 (PR #2) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-004 — Manutenção da toolchain**. **Não altere código da aplicação em `src/`**, exceto o mínimo para satisfazer regras novas do linter, com cada ajuste explicado no relatório.

### 0. Pré-condição
Crie `task/004-toolchain` a partir da `main` atualizada. **Não dispare o GitHub Actions nem altere os gatilhos do `.github/workflows/ci.yml` (D-021).**

### 1. Objetivos
1. **ESLint em linha suportada.** O ESLint 9.39.5 foi reportado como fora de suporte no `npm ci`.
   - Consulte a política de suporte oficial (https://eslint.org/version-support) e o guia de migração da versão-alvo.
   - Atualize `eslint` e `@eslint/js` para a linha atualmente suportada.
   - Verifique a compatibilidade declarada (peerDependencies) de `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` e `globals` com a versão-alvo.
   - Se algum plugin **não** suportar a versão-alvo, **não** troque o plugin por outro e **não** use `--force`/`--legacy-peer-deps`. Mantenha a maior versão compatível, documente o bloqueio no relatório e entregue como "parcial".
   - Mantenha o flat config, as regras atuais (inclusive a anti-`require` e `react-refresh/only-export-components`) e `--max-warnings 0`.
2. **Versão mínima do Node coerente.** `package.json` → `"engines": { "node": ">=22.22.2" }`, que é o mínimo efetivo exigido pelo jsdom 30 e já citado no README. Manter `.nvmrc` em `22`.
3. **Auditoria.** Rode `npm audit` antes e depois e reporte as duas saídas. Não use `npm audit fix --force` nem `overrides`. Os 4 alertas moderados do Tailwind 3 são risco aceito (D-020).

### 2. Fora do escopo
Atualizar `actions/checkout`/`setup-node` (adiado pela D-021); migrar para o Tailwind v4; trocar Vite, Vitest, React ou React Router; adicionar dependências de runtime; mexer em `docs/`.

### 3. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | `eslint` e `@eslint/js` na linha suportada, ou bloqueio documentado | `npm ls eslint @eslint/js` + link da política de suporte |
| 2 | `npm ci` sem o aviso de ESLint fora de suporte | saída completa |
| 3 | `npm run lint` sem erros e sem warnings | saída |
| 4 | `npm run test` com todos os testes passando (no mínimo os 73 atuais) | saída |
| 5 | `npm run build` sem erros | saída |
| 6 | Regra anti-`require` ainda ativa | teste por stdin, como na TASK-001 |
| 7 | `engines.node` = `>=22.22.2` | diff |
| 8 | Lockfile regenerado com `npm install`, nunca editado à mão, e coerente | `git diff --stat` |
| 9 | `npm audit` antes e depois | saídas |

### 4. Entrega
PR `TASK-004: Manutenção da toolchain` para `main`, com o relatório do `AGENTS.md` e as saídas reais. Não faça merge.

## FIM DO PROMPT
