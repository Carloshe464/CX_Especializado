# Matriz de paridade

Meta: **99% de paridade verificável**. Um item só conta como atingido com status **✅ Verificado** e um teste/evidência rastreável na coluna "Verificação". Itens marcados **Corrigido** reproduzem o objetivo funcional da REF com o comportamento ajustado por uma decisão (D-xxx).

Itens **Alterado** seguem a nova regra decidida pelo responsável (não a REF) e contam como paridade quando a regra nova estiver verificada.

Status: ⬜ Não iniciado · 🟨 Em andamento · 🟦 Implementado (sem evidência) · ✅ Verificado · ⛔ Bloqueado
REF = `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`

**Paridade atual comprovada: 31 / 102 itens (30,4%)**, com TASK-001 (PR #2), TASK-002 (PR #4), TASK-003 (PR #8), TASK-010 (PR #11), TASK-011 (PR #16), TASK-014 (PR #15) e TASK-012 (PR #18) mescladas.

## Fundação e visual
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| V-01 | `index.html` `lang="pt-BR"`, título "Protocolo de Inteligência CX", Fraunces + Inter | §9.3 | Visual | Paridade | `html.test.js` (PR #2) | ✅ |
| V-02 | Tokens HSL `:root` exatos | §9.1 | Visual | Paridade | `tokens.test.js` (PR #2) | ✅ |
| V-03 | `tailwind.config.js`: cores por token, radius, fontes, opacity 1%, animate | §9.2 | Visual | Paridade | revisão PR #2 + build CI | ✅ |
| V-04 | Layout: sidebar `w-64` ≥ lg, logo `HeartHandshake`, e-mail + papel + Sair | §8 Layout | Visual | Paridade | `layout.test.jsx` + captura 1280 px (PR #8) | ✅ |
| V-05 | Topbar mobile sticky com pills; ativo `bg-primary` | §8 Layout | Visual | Paridade | captura 375 px + medidas de scrollWidth (PR #8) | ✅ |
| V-06 | Itens de menu por papel (Painel, Avaliações, Nova avaliação, Curadoria, Satisfação, Protocolo, Meu desenvolvimento) | §8 Layout | Funcional | Paridade | `layout.test.jsx` (listas por papel, PR #8); controle de acesso real na TASK-012/014 | ✅ |
| V-07 | Cards `rounded-2xl border bg-card`, títulos `font-heading`, placeholders dashed, `Loader2` | §8 | Visual | Paridade | StatCard/EmptyState/LoadingSpinner (PR #8); falta comparar com capturas da referência | 🟨 |
| V-08 | Estilos de badges (classificação, gravidade, tendência, status) | §5 | Visual | Paridade | classes literais testadas em `cx.test.js` (PR #4); falta render/snapshot | 🟨 |
| V-09 | UI integralmente em pt-BR; datas `pt-BR` | §2 | Visual | Paridade | revisão + teste formatDate | ⬜ |
| V-10 | Sem erros de console; build ESM sem `require` | §12 | Técnico | Paridade | lint anti-`require` ✅ (PR #2); console sem erros ⬜ (e2e) | 🟨 |

## Rotas e acesso
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| R-01 | Todas as rotas da REF registradas | §3 | Funcional | Paridade | `routes.test.jsx` (PR #2) | ✅ |
| R-02 | Auth: login, register, forgot, reset | §3 | Funcional | Paridade | `auth-pages.test.jsx` + roteiro manual local com Mailpit/Playwright (PR #15) | ✅ |
| R-03 | Rotas protegidas redirecionam para `/login` | §3 | Segurança | Paridade | `guards.test.jsx` (PR #15) | ✅ |
| R-04 | `/` redireciona analista → `/meu-desenvolvimento` | §3 | Funcional | Paridade | `routes.test.jsx` + `guards.test.jsx` (PR #15) | ✅ |
| R-05 | `/curadoria` e `/satisfacao` redirecionam não supervisor → `/` | §3 | Funcional | Paridade | `routes.test.jsx` + `guards.test.jsx` (PR #15) | ✅ |
| R-06 | `/pesquisa/:token` pública, fora do layout | §3 | Funcional | Paridade | `routes.test.jsx` (PR #15) | ✅ |
| R-07 | Página 404 | §3 | Funcional | Paridade | `routes.test.jsx` (PR #2) | ✅ |

## Dados e segurança
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| S-01 | 9 entidades + perfis em PostgreSQL | §4 | Funcional | D-002, D-010 | migrações + pgTAP `03`/`04` (PR #16, #18) | ✅ |
| S-02 | Analista vê só os próprios dados | §4 | Segurança | Paridade | pgTAP `04_rls_negocio` (matriz 6 personas × 15 objetos) (PR #18) | ✅ |
| S-03 | Analista vê a análise só das próprias avaliações; nunca de outro analista ou outra organização | §1, §7.4 | Segurança | **Alterado D-011** | pgTAP `04_rls_negocio` (A não lê avaliação/scores/oportunidades/feedback/CSAT de B; Y × X) (PR #18) | ✅ |
| S-04 | Veredito de supervisor só por supervisor da organização (API e banco); prevalece sobre o do analista | §4 | Segurança | Corrigido D-007#2 + D-011 | pgTAP `04_rls_negocio` (RPCs `decide_*` só gestor; `effective_feedback` D-024) (PR #18) | ✅ |
| S-05 | `curation_logs` imutável | §4.6 | Segurança | Corrigido | pgTAP `03_entidades_negocio` (CX021, inclusive como `postgres` e `TRUNCATE`) (PR #16) | ✅ |
| S-06 | Papel não controlável pelo usuário | — | Segurança | SEC-04 | pgTAP `01_entrada`/`02_acesso` (CX016) (PR #11) + `AuthProvider.test.jsx` ignora metadata (PR #15) | ✅ |
| S-07 | Storage privado com URLs assinadas 3600 s | §10 | Segurança | Paridade | teste | ⬜ |
| S-08 | Sem acesso `anon` a tabelas internas | §4.5 | Segurança | Corrigido | pgTAP SEC-10 em `03`/`04` (`anon` sem privilégio em tabelas, view e RPCs) (PR #16, #18) | ✅ |
| S-09 | Seed `csat_positive_threshold=4` e `ProtocolVersion V1.1` | §11.7 | Funcional | Paridade | pgTAP `03_entidades_negocio` (limiar 4; V1.1 inativa e V1.2 ativa, D-019) (PR #16) | ✅ |
| S-10 | Protocolo único sob concorrência | — | Integridade | D-012 | teste concorrente | ⬜ |
| S-11 | Arquivos sem órfãos | — | Integridade | D-007#9 | teste | ⬜ |

## Domínio (`lib/cx.js`)
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| D-01 | Constantes exatas (competências, severidades, origens, confianças, tendências, status, níveis CSAT) | §5 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-02 | `scoreClassification` incl. decimais e null/NaN | §5 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-03 | `csatBand` com limiar configurável | §5 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-04 | `deriveScoreFromLevel`, `parseNota`, `scoreFromSentiment` | §5, §6 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-05 | `normalizeTrend` | §7.4 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-06 | `formatDate` pt-BR, `—`, string crua inválida | §5 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| D-07 | `STATUS_LABELS` ("Em curadoria" para analisado) | §5 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |

## Motor de IA
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| A-01 | `PROTOCOL_PROMPT V1.1` verbatim e versionado | §6.2 | Funcional | Paridade | teste de hash do prompt | ⬜ |
| A-02 | Prompt de extração de prints verbatim | §6.1 | Funcional | Paridade | teste de hash | ⬜ |
| A-03 | Validação: exatamente 6 competências, nomes exatos, 0–10/null | §6.2 | Funcional | Paridade | testes com saídas sintéticas | ⬜ |
| A-04 | Oportunidades 0..n com 8 campos e enums | §6.2 | Funcional | Paridade | teste | ⬜ |
| A-05 | Tendência qualitativa, sem percentuais | §6.2 | Funcional | Paridade | teste | ⬜ |
| A-06 | CSAT real nunca no contexto do modelo | §1 | Segurança | SEC-13 | teste | ⬜ |
| A-07 | Saída incompleta/inválida tratada; avaliação não muda de estado | — | Robustez | D-007#8 | teste | ⬜ |
| A-08 | Chave/modelo só no servidor | — | Segurança | SEC-01 | revisão + varredura | ⬜ |
| A-09 | Reanálise preserva curadorias anteriores | §7.4 | Integridade | Corrigido D-007#3 | teste | ⬜ |
| A-10 | Extração de CSAT de PDF/print | §6 | Funcional | Paridade | teste com mock | ⬜ |
| A-11 | Importação universal de planilha + detecção de linhas de resumo | §6.3 | Funcional | Paridade | testes de `normalizeSpreadsheetRow` | ⬜ |

## Telas
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| P-01 | Dashboard: badge curadoria pendente | §7.1 | Funcional | Paridade | teste | ⬜ |
| P-02 | Dashboard: 4 StatCards (CSAT+, média, total, taxa de resposta) | §7.1 | Funcional | Paridade; fórmulas README-DEV Bloco F (taxa de resposta = avaliações com ≥1 CSAT / avaliações) | teste com dataset | ⬜ |
| P-03 | Dashboard: CsatDistribution + SeverityChart + contadores de curadoria | §7.1 | Funcional | Paridade | teste | ⬜ |
| P-04 | Dashboard: CompetencyEvolution (6 meses, `AAAA-MM`) | §7.1 | Funcional | Paridade | teste | ⬜ |
| P-05 | Dashboard: AnalystComparison | §7.1 | Funcional | Paridade | teste | ⬜ |
| P-06 | Dashboard: comportamento × satisfação com aviso de não causalidade | §7.1 | Funcional | Paridade | teste | ⬜ |
| P-07 | Indicadores sem limites fixos | §7.1 | Integridade | Corrigido D-007#4 | teste com > 1000 registros | ⬜ |
| P-08 | Avaliações: lista, busca, badges, "Nota real", empty state | §7.2 | Funcional | Paridade | teste | ⬜ |
| P-09 | Nova avaliação: campos, canais, analista travado p/ analista | §7.3 | Funcional | Paridade (+D-013) | teste | ⬜ |
| P-10 | Nova avaliação: aba colar conversa sem limite | §7.3 | Funcional | Paridade | teste | ⬜ |
| P-11 | Nova avaliação: aba prints (upload privado, extrair) | §7.3 | Funcional | Paridade | e2e | ⬜ |
| P-12 | Nova avaliação: aba importar planilha | §7.3 | Funcional | Paridade | e2e | ⬜ |
| P-13 | Nova avaliação: regras de `source` e `status` | §7.3 | Funcional | Paridade | teste | ⬜ |
| P-14 | Detalhe: cabeçalho (kicker, título, linha meta, status, Reanalisar) | §7.4 | Visual/Func. | Paridade | screenshot + teste | ⬜ |
| P-15 | Detalhe: 3 métricas | §7.4 | Funcional | Paridade | teste | ⬜ |
| P-16 | Detalhe: Competências visíveis ao analista dono + controles de validação | §7.4 | Funcional | **Alterado D-011** | teste | ⬜ |
| P-17 | Detalhe: DiagnosisCard, CurationCard, CsatPanel | §7.4 | Funcional | Paridade | teste | ⬜ |
| P-18 | Detalhe: oportunidades com decisões do supervisor | §7.4 | Funcional | Paridade | teste | ⬜ |
| P-19 | Detalhe não analisado: PrintGallery, editar/salvar transcrição, Analisar | §7.4 | Funcional | Paridade | teste | ⬜ |
| P-20 | Curadoria: fila pendente + curadoria recente (10) | §7.5 | Funcional | Paridade | teste | ⬜ |
| P-21 | Curadoria grava log por decisão | §7.4 | Funcional | Paridade | teste | 🟨 log atômico nas RPCs (PR #18); tela na Fase 4 |
| P-22 | Meu desenvolvimento: só itens com veredito efetivo positivo, 3 StatCards | §7.6 | Funcional | **Alterado D-011** | teste | ⬜ |
| P-23 | Meu desenvolvimento: barras por competência, cartões por avaliação | §7.6 | Funcional | Paridade | teste | ⬜ |
| P-24 | Satisfação: StatCards | §7.7 | Funcional | Paridade | teste | ⬜ |
| P-25 | Satisfação: importar planilha / PDF-print com prévia | §7.7 | Funcional | Paridade | e2e | ⬜ |
| P-26 | Satisfação: lançamento manual | §7.7 | Funcional | Paridade | teste | ⬜ |
| P-27 | Satisfação: limiar configurável 1–5 | §7.7 | Funcional | Paridade | teste | ⬜ |
| P-28 | Satisfação: respostas de pesquisa Registrar/Descartar | §7.7 | Funcional | Paridade | teste | ⬜ |
| P-29 | Satisfação: tabela de registros | §7.7 | Funcional | Paridade | teste | ⬜ |
| P-30 | Notas derivadas distinguidas de reais | — | Integridade | Corrigido D-007#6 | teste | ⬜ |
| P-31 | Protocolo: documento vivo, cards e classificações | §7.8 | Funcional | Paridade | snapshot | ⬜ |
| P-32 | Protocolo: histórico de versões + aprendizado contínuo | §7.8 | Funcional | Paridade | teste | ⬜ |
| P-33 | Pesquisa: valida token, escala 1–5, comentário, estados | §7.9 | Funcional | Paridade | e2e | ⬜ |
| P-34 | Pesquisa: uso único, sem duplicidade | — | Segurança | Corrigido D-007#5 | teste | ⬜ |
| P-35 | CsatPanel: geração de link de pesquisa com copiar | §8 | Funcional | Paridade (token no servidor) | teste | ⬜ |
| P-36 | SpreadsheetImport: máquina de estados e coluna "O que será feito" | §8 | Funcional | Paridade | teste | ⬜ |
| P-37 | Mensagens de falha de IA acionáveis | — | Robustez | D-007#8 | teste | ⬜ |
| P-38 | Responsividade (sidebar ≥ lg, pills abaixo) | §12 | Visual | Paridade | capturas 375/1280 (PR #8); falta 768 | 🟨 |
| P-39 | Comparação visual com a aplicação original | — | Visual | — | screenshots lado a lado *[requer acesso à app Base44]* | ⬜ |
| P-40 | ScoreList, StatCard, CompetencyCard, OpportunityCard conforme REF | §8 | Visual | Paridade | StatCard (PR #8); demais componentes na Fase 4 | 🟨 |
| P-41 | Fluxo ponta a ponta: registrar → analisar → curar → analista vê aprovado → CSAT | §1 | Funcional | Paridade | e2e | ⬜ |
| P-42 | Supervisor lê tudo | §1 | Funcional | Paridade | matriz RLS | ⬜ |
| P-43 | Cálculos de indicadores conferidos contra dataset de referência | §7.1 | Funcional | — | teste | ⬜ |
| P-44 | Limpeza de arquivos ao remover print | §7.3 | Integridade | D-007#9 | teste | ⬜ |
| P-45 | Edge Functions validam papel | — | Segurança | SEC-12 | teste | ⬜ |
| P-46 | Logs de falha sem PII | — | Segurança | SEC-14 | teste | ⬜ |
| P-47 | Varredura de segredos no CI | — | Segurança | SEC-01 | CI | ⬜ |
| P-48 | Pipeline CI (lint, test, build) | — | Técnico | — | CI run 39986235495 (workflow manual desde D-021) | ✅ |
| P-49 | Documentação de execução local | — | Técnico | — | README (PR #2) | ✅ |
| P-50 | Auditoria de custos (planos gratuitos) | — | Infra | — | relatório Fase 6 | ⬜ |
| P-51 | Defaults de oportunidade (Desejável / Indeterminada / Médio / pendente) | README-DEV C.3 | Funcional | Paridade | `src/__tests__/cx.test.js` (PR #4) | ✅ |
| P-52 | Classificação calculada pelo sistema, não confiada ao LLM | README-DEV C.3 | Funcional | Paridade | `scoreClassification` testada (PR #4); falta uso no motor (Fase 3) | 🟨 |
| P-53 | CSAT: todos os registros nas médias; badge da lista usa o mais recente | README-DEV B.4, F | Funcional | Paridade | teste | ⬜ |
| P-54 | Mensagens literais (bloqueio em curadoria, zero oportunidades, pesquisa inválida, obrigado) | README-DEV E.3 | Visual | Paridade | snapshot de texto | ⬜ |
| P-55 | Charts: cores, alturas e formas (Bar h-64, Line h-72 domain 0–10, donut 55/85) | README-DEV E.3 | Visual | Paridade | snapshot | ⬜ |
| P-56 | Reimportação não duplica CSAT | README-DEV D.10 | Integridade | Corrigido D-007 | teste | ⬜ |

## Funcionalidades novas (fora da paridade — não entram no percentual)
| ID | Funcionalidade | Decisão | Especificação | Status |
|---|---|---|---|---|
| N-01 | Organizações, vínculos e admin da plataforma | D-002, D-017 | ARCHITECTURE §3 | ✅ banco (PR #11) + cadastro/onboarding na interface (PR #15) |
| N-02 | Login Google + cadastro aberto | D-008 | ARCHITECTURE §3 | 🟨 cadastro aberto e botão Google com PKCE (PR #15); credenciais reais do Google pendentes (TASK-015) |
| N-03 | Validação do analista (gostei/útil/comentário) em diagnóstico e oportunidades | D-011 | specs/VALIDACAO_E_CURADORIA | 🟨 RPC `submit_feedback` (PR #18); tela na Fase 4 |
| N-04 | Veredito do supervisor com prioridade | D-011 | specs/VALIDACAO_E_CURADORIA | 🟨 RPCs `decide_*` + `effective_feedback` (PR #18); tela na Fase 4 |
| N-05 | Taxa de utilidade da IA (individual p/ analista; organização p/ supervisor) | D-011 | specs/VALIDACAO_E_CURADORIA | ⬜ |
| N-06 | Configuração de provedor/modelo/chave de IA pela interface | D-009 | specs/PROVEDOR_IA | ⬜ |
| N-07 | Supervisor escolhe analista ao criar avaliação | D-013 | ARCHITECTURE §4 | ⬜ |
| N-08 | Extensão de captura com salvamento automático em `.txt` | D-018 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-09 | "Analisar ao vivo" na extensão | D-018 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-10 | Ingestão por número do ticket (URL) | D-018, D-012 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-11 | Modelos locais de IA | D-009 (futuro distante) | specs/PROVEDOR_IA §4 | 💤 |
| N-12 | Oportunidades com comunicação assertiva e rapport (Protocolo V1.2) + campo `communication_techniques` | D-019 | specs/PROTOCOLO_PROMPT_V1.2 | 🟨 lista e filtro em `cx.js` (PR #4) |
| N-13 | Importação de `.txt` da extensão (ticket como protocolo) | D-018 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-14 | Entrada na organização por domínio de e-mail | D-017 | DECISIONS D-017 | ⬜ |
