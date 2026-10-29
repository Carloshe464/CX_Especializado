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
| TASK-013 | Storage privado + `evaluation_files` + serviço de upload/URL assinada | 2 | Operador | **TASK-012 mesclada** | `task/013-storage` | ✅ PR #20 |
| TASK-015 | Auth por `token_hash` + senha 8; inventário remoto; 4 migrações aplicadas no Supabase real (canal A) | 2 | Operador (Codex) + revisão do orquestrador | 010–014 ✅ | `task/015-supabase-remoto` | ✅ PR #23 |
| TASK-030 | Base da Fase 4: "Sair" no celular, páginas sob demanda, massa de dados local (`scripts/seed-local.mjs`) | 4 | Operador | TASK-015 ✅ · paralela à 031 | `task/030-base-fase4` | ✅ PR #26 |
| TASK-031 | Tela Avaliações (`/avaliacoes`) | 4 | Operador | TASK-015 ✅ · paralela à 030 | `task/031-avaliacoes` | ✅ PR #25 |
| TASK-032 | Tela Nova avaliação (`/nova-avaliacao`): analista travado/escolha pelo supervisor, abas, prints no Storage, protocolo duplicado | 4 | Operador | TASK-030 ✅ · TASK-031 ✅ | `task/032-nova-avaliacao` | ✅ PR #30 |
| TASK-033 | Detalhe da avaliação (`/avaliacao/:id`): execução atual, anexos, transcrição editável, validação do analista (`submit_feedback`), curadoria em só leitura | 4 | Operador | TASK-032 ✅ | `task/033-detalhe-avaliacao` | 📝 Ordem pronta |
| TASK-034 | Tela Curadoria (`/curadoria`): fila com prioridade "não útil", curadoria recente; formulários de decisão (`decide_opportunity`/`decide_diagnosis`) isolados | 4 | Operador | TASK-032 ✅ · **paralela à 033** (arquivos disjuntos) | `task/034-curadoria` | 📝 Ordem pronta |
| TASK-036 | Ligar os formulários de decisão e a validação do supervisor ao detalhe | 4 | Operador | TASK-033 + TASK-034 mescladas | — | ⏳ A escrever |
| TASK-020…025 | Motor de IA + configuração de provedor | 3 | Operador | Fase 2 + escolha do primeiro adaptador de provedor | — | 💤 |
| TASK-040…044 | Extensão de captura | E | Operador | Fase 4 + exemplo de URL/DOM do ClickDesk | — | 💤 |

## Ordem de execução da Fase 1
1. **Onda 1 (paralelo):** TASK-002 e TASK-004. Arquivos distintos; quem for mesclado por último traz a `main` e repete as validações.
2. **Onda 2:** TASK-003, depois da TASK-004 mesclada (conflito de `package.json`/lockfile e regras de lint).

## Ordem de execução da Fase 2
1. ✅ TASK-003 e TASK-010 (paralelas); ✅ TASK-011 e TASK-014 (paralelas).
2. ✅ TASK-012 (RLS/RPCs de negócio).
3. ✅ TASK-013 (Storage).
4. ✅ TASK-015: migrações aplicadas no Supabase real (`ymsyabgztkfhdllbxfyc`) em 26/10/2026.

## Ordem de execução da Fase 4
1. ✅ TASK-030 (base) · ✅ TASK-031 (Avaliações) · ✅ TASK-032 (Nova avaliação).
2. **Agora:** TASK-033 Detalhe com validação do analista ∥ TASK-034 Curadoria (em paralelo) → TASK-036 integração da curadoria no detalhe → TASK-035 Meu desenvolvimento.
3. Sem IA (Fase 3 no final): telas de análise são construídas e testadas com análises fictícias da massa local.

## Backlog identificado em revisões
- Gestão de membros: inclusão ou convite pelo admin/supervisor, para empresas sem domínio, e promoção/remoção pela interface (origem: revisão da TASK-010).
- Configuração remota de auth (tamanho mínimo de senha 8, `site_url`, Google) na TASK-015.
- ~~`minimum_password_length = 8` no `config.toml` local~~ — feito na TASK-015.
- Templates `token_hash` prontos no repositório (TASK-015), mas **bloqueados no remoto**: projeto Free com SMTP padrão não permite editar templates e só envia para a equipe (2/h). **SMTP próprio é pré-requisito da publicação** — decisão do responsável.
- Painel de Auth remoto (responsável): senha mínima 8; Site URL e redirects `http://localhost:5173` (provisórios até a Fase 6).
- ~~Botão "Sair" no cabeçalho móvel do `Layout`~~ — feito na TASK-030.
- ~~*Code splitting* das páginas internas (bundle de 512 kB)~~ — feito na TASK-030.
- Teste intermitente: `AuthConfirm.test.jsx` ("confirma email e substitui a URL por /") deu timeout uma vez na suíte completa e passou isolado e na reexecução; estabilizar sem aumentar timeout (origem: revisão da TASK-031).
- Fase 3: a Edge Function só aponta `current_analysis_run_id` para execução com `sucesso` (`decide_opportunity` confere só a execução atual) (origem: revisão da TASK-012).
- TASK-021: a tela de configuração de IA lista colunas explicitamente; `select *` em `ai_provider_configs` dá `42501` (sem grant em `secret_ref`).
- Gestão de membros: o trigger `protect_evaluation` lê `memberships` com a RLS de quem chama; revisar se a política de `memberships` mudar.
- Avaliação com execução, ticket de pesquisa ou arquivo não pode ser apagada (FKs da TASK-011); para rascunho com arquivo, a UI (Fase 4) apaga antes o objeto pela API de Storage (comportamento comprovado na TASK-013).
- Job de limpeza de órfãos: precisa de função privilegiada própria (a view `private.orphan_evaluation_files` não é legível nem pelo `service_role`) (origem: revisão da TASK-013).
- ~~Fase 4 (upload): arquivo de 0 byte e `contentType` pela extensão~~ — feito na TASK-032.
- `findEvaluationIdByProtocol` usa `%termo%`; trocar pelo termo exato escapado (o PostgREST também trata `*` como curinga), para o link da duplicata não sumir com protocolos curtos acima do `max-rows`; unir os dois imports de `lib/cx.js` em `evaluations.js` (origem: revisão da TASK-032).
- Capturas de tela dos operadores ficam só no computador local; definir como anexá-las ao PR (origem: revisões das TASK-031/032).
- SEC-21 (LGPD): rever a exclusão de arquivos pelo gestor após a análise junto da política de retenção.

## Bloqueios e pendências do responsável
1. ~~Criar `main` e defini-la como padrão~~ — feito.
2. ~~README-DEV~~ — incorporado em `docs/reference/README-DEV_AUDITORIA_TECNICA.md`.
3. ~~Supabase MCP~~ — conector do operador (Codex) com acesso à organização Especializado; projeto `ymsyabgztkfhdllbxfyc`.
4. Decisões de produto fechadas em 2026-10-23 (ver `docs/DECISIONS.md` e `docs/specs/`). Pendências menores: confirmar "retorno positivo" = gostei **e** útil; primeiro adaptador de provedor de IA (pode ficar para a Fase 3).
5. Acesso à aplicação original no Base44 (somente leitura) para capturas de tela de referência (P-39).

## Registro de revisões
| Tarefa | PR | Commit revisado | Resultado | Evidência |
|---|---|---|---|---|
| TASK-032 | #30 | `92c2262` | ✅ Aprovada: payload só com as 8 colunas concedidas; analista travado/escolha pelo supervisor (D-013); duplicidade sem perder o texto (D-012); anexos no caminho D-025; desvio temporário (criação só com prints) aceito; P-11/P-12 🟨 | saídas locais (lint 0, 433 testes, build), manual local com supervisor/A/B e 2 linhas em `evaluation_files` |
| TASK-031 | #25 | `0f3193a` | ✅ Aprovada (2ª rodada): limiar CSAT por organização (`getCsatThresholds()` → mapa; inválido → 4); `organizationId` exposto; exceção em `routes.test.jsx` aceita; P-08 🟨 até a importação (Fase 5) | saídas locais (lint 0, 391 testes, build com chunk `Evaluations` 16,76 kB), teste de regressão com 3 organizações, teste manual local com 2 perfis |
| TASK-031 | #25 | `6556090` | 🔧 Correção pedida: `getCsatThreshold().maybeSingle()` quebra para o admin da plataforma (lê `app_settings` de várias organizações); limiar deve ser por organização da avaliação; merge da `main` (lazy) | revisão do diff + política `app_settings_select` |
| TASK-030 | #26 | `747fa8a` | ✅ Aprovada; grupo de chunk `supabase` no Vite aceito (build 300 kB + 214 kB, sem aviso); pgTAP em stack isolado aceito | saídas locais (lint 0, 355 testes, build, 659 pgTAP), seed com guarda (18 casos), reexecução sem duplicar, cobertura por SELECT, teste em 375 px |
| TASK-015 | #23 | `736e6e0` | ✅ Aprovada; portões cumpridos (aprovação condicionada + inventário; autorização escrita, canal A); 4 migrações aplicadas com versões iguais às locais; 7 WARN `authenticated_security_definer_function_executable` aceitos (RPCs previstas, `anon` revogado, papel validado internamente) | saídas de `db push --dry-run`/`db push`; verificação somente leitura SEC-09/10/11/15/16/19; hashes das 27 funções e 33 políticas iguais ao local |
| TASK-013 | #20 | `d0e93b1` | ✅ Aprovada; CX037–CX038; teste usa `storage.allow_delete_query` só na transação sintética (aceito); §8b comprovado | saídas locais (659/659 pgTAP, `db lint`, `db advisors` security, lint 0, 324 testes, build) e teste real no navegador (URL assinada 200, sem token 400, TTL 3600) |
| TASK-012 | #18 | `6817194` | ✅ Aprovada; códigos CX023–CX036; políticas de `evaluations` em linha (INSERT … RETURNING) e regras extras aceitas; relatório diz que `decide_opportunity` exige `sucesso`, o código só exige execução atual (risco nulo, registrado para a Fase 3) | saídas locais (562/562 pgTAP, `db lint`, lint 0, 301 testes, build); revisão linha a linha da migração e da matriz |
| TASK-014 | #15 | `a62968f` | ✅ Aprovada (squash, sem as capturas PNG no histórico); desvios aceitos: branch, `AuthProvider` dentro do roteador, `PublicOnlyRoute`, indicador de recuperação em `sessionStorage` | saídas locais (lint 0, 301 testes, build, 102 pgTAP), `grep` do `dist/`, roteiro manual com Mailpit/Playwright e capturas 1280/375 |
| TASK-011 | #16 | `1627990` | ✅ Aprovada; guards de `TRUNCATE` extras aceitos; inventário de `00_estrutura` relaxado (SEC-16 mantido) | saídas locais (355/355 pgTAP, `db lint`, lint 0, 227 testes, build) e comparação literal das listas com `cx.js`; revisão linha a linha da migração |
| TASK-001 | #2 | `21f7f8f` | ✅ Aprovada; 5 pontos não bloqueantes → TASK-004/TASK-003/D-020 | CI run 39986235495 (lint 0 warnings, 73 testes, build); revisão do diff completo |
| TASK-001 | #2 | `fe7427a` | Commit do orquestrador: CI só manual (D-021), sem efeito no código da aplicação | diff de 1 arquivo (`ci.yml`) |
| TASK-004 | #5 | `498a86e` | ✅ Aprovada como parcial: `engines.node >=22.22.2`; ESLint 10 bloqueado pelo peer de `eslint-plugin-react` (D-022) | saídas locais no PR (lint 0, 73 testes, build, anti-`require`, audit antes/depois); diff 2+/2− |
| TASK-010 | #11 | `c35d5df` | ✅ Aprovada; caminho do admin (D-023); admin sem e-mail verificado e empresa sem supervisor até a 1ª promoção aceitos | 102/102 pgTAP + `db lint` + app intacto (saídas locais); revisão linha a linha da migração |
| TASK-003 | #8 | `87b12ff` | ✅ Aprovada; sessão separada em `auth/session.js` e `navigation.js` (react-refresh), desvio aceito | saídas locais (lint 0, 227 testes, build), capturas 1280/375, revisão do diff |
| TASK-002 | #4 | `18606ad` | ✅ Aprovada; branch `claude/magical-hamilton-06itj1` (desvio aceito); `STATUS_STYLES.rascunho` derivado | saídas locais no PR (lint 0, 205 testes, build); revisão do diff completo |
