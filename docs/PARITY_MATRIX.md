# Matriz de paridade

Meta: **99% de paridade verificável**. Um item só conta como atingido com status **✅ Verificado** e um teste/evidência rastreável na coluna "Verificação". Itens marcados **Corrigido** reproduzem o objetivo funcional da REF com o comportamento ajustado por uma decisão (D-xxx).

Itens **Alterado** seguem a nova regra decidida pelo responsável (não a REF) e contam como paridade quando a regra nova estiver verificada.

Status: ⬜ Não iniciado · 🟨 Em andamento · 🟦 Implementado (sem evidência) · ✅ Verificado · ⛔ Bloqueado
REF = `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`

**Paridade atual comprovada: 0 / 102 itens (0%).**

## Fundação e visual
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| V-01 | `index.html` `lang="pt-BR"`, título "Protocolo de Inteligência CX", Fraunces + Inter | §9.3 | Visual | Paridade | teste de build/HTML | ⬜ |
| V-02 | Tokens HSL `:root` exatos | §9.1 | Visual | Paridade | teste comparando CSS | ⬜ |
| V-03 | `tailwind.config.js`: cores por token, radius, fontes, opacity 1%, animate | §9.2 | Visual | Paridade | revisão + build | ⬜ |
| V-04 | Layout: sidebar `w-64` ≥ lg, logo `HeartHandshake`, e-mail + papel + Sair | §8 Layout | Visual | Paridade | teste de componente + screenshot | ⬜ |
| V-05 | Topbar mobile sticky com pills; ativo `bg-primary` | §8 Layout | Visual | Paridade | screenshot mobile | ⬜ |
| V-06 | Itens de menu por papel (Painel, Avaliações, Nova avaliação, Curadoria, Satisfação, Protocolo, Meu desenvolvimento) | §8 Layout | Funcional | Paridade | teste por papel | ⬜ |
| V-07 | Cards `rounded-2xl border bg-card`, títulos `font-heading`, placeholders dashed, `Loader2` | §8 | Visual | Paridade | screenshot | ⬜ |
| V-08 | Estilos de badges (classificação, gravidade, tendência, status) | §5 | Visual | Paridade | snapshot | ⬜ |
| V-09 | UI integralmente em pt-BR; datas `pt-BR` | §2 | Visual | Paridade | revisão + teste formatDate | ⬜ |
| V-10 | Sem erros de console; build ESM sem `require` | §12 | Técnico | Paridade | lint + e2e | ⬜ |

## Rotas e acesso
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| R-01 | Todas as rotas da REF registradas | §3 | Funcional | Paridade | teste de rotas | ⬜ |
| R-02 | Auth: login, register, forgot, reset | §3 | Funcional | Paridade | e2e | ⬜ |
| R-03 | Rotas protegidas redirecionam para `/login` | §3 | Segurança | Paridade | teste | ⬜ |
| R-04 | `/` redireciona analista → `/meu-desenvolvimento` | §3 | Funcional | Paridade | teste | ⬜ |
| R-05 | `/curadoria` e `/satisfacao` redirecionam não supervisor → `/` | §3 | Funcional | Paridade | teste | ⬜ |
| R-06 | `/pesquisa/:token` pública, fora do layout | §3 | Funcional | Paridade | teste | ⬜ |
| R-07 | Página 404 | §3 | Funcional | Paridade | teste | ⬜ |

## Dados e segurança
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| S-01 | 9 entidades + perfis em PostgreSQL | §4 | Funcional | D-002, D-010 | migração + testes | ⬜ |
| S-02 | Analista vê só os próprios dados | §4 | Segurança | Paridade | matriz RLS | ⬜ |
| S-03 | Analista vê a análise só das próprias avaliações; nunca de outro analista ou outra organização | §1, §7.4 | Segurança | **Alterado D-011** | matriz RLS | ⬜ |
| S-04 | Veredito de supervisor só por supervisor da organização (API e banco); prevalece sobre o do analista | §4 | Segurança | Corrigido D-007#2 + D-011 | matriz RLS | ⬜ |
| S-05 | `curation_logs` imutável | §4.6 | Segurança | Corrigido | teste | ⬜ |
| S-06 | Papel não controlável pelo usuário | — | Segurança | SEC-04 | teste | ⬜ |
| S-07 | Storage privado com URLs assinadas 3600 s | §10 | Segurança | Paridade | teste | ⬜ |
| S-08 | Sem acesso `anon` a tabelas internas | §4.5 | Segurança | Corrigido | teste | ⬜ |
| S-09 | Seed `csat_positive_threshold=4` e `ProtocolVersion V1.1` | §11.7 | Funcional | Paridade | teste de seed | ⬜ |
| S-10 | Protocolo único sob concorrência | — | Integridade | D-012 | teste concorrente | ⬜ |
| S-11 | Arquivos sem órfãos | — | Integridade | D-007#9 | teste | ⬜ |

## Domínio (`lib/cx.js`)
| ID | Requisito | REF | Tipo | Decisão | Verificação | Status |
|---|---|---|---|---|---|---|
| D-01 | Constantes exatas (competências, severidades, origens, confianças, tendências, status, níveis CSAT) | §5 | Funcional | Paridade | teste unitário | ⬜ |
| D-02 | `scoreClassification` incl. decimais e null/NaN | §5 | Funcional | Paridade | teste com fronteiras (8.99, 9, 6.5…) | ⬜ |
| D-03 | `csatBand` com limiar configurável | §5 | Funcional | Paridade | teste | ⬜ |
| D-04 | `deriveScoreFromLevel`, `parseNota`, `scoreFromSentiment` | §5, §6 | Funcional | Paridade | teste | ⬜ |
| D-05 | `normalizeTrend` | §7.4 | Funcional | Paridade | teste | ⬜ |
| D-06 | `formatDate` pt-BR, `—`, string crua inválida | §5 | Funcional | Paridade | teste | ⬜ |
| D-07 | `STATUS_LABELS` ("Em curadoria" para analisado) | §5 | Funcional | Paridade | teste | ⬜ |

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
| P-21 | Curadoria grava log por decisão | §7.4 | Funcional | Paridade | teste | ⬜ |
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
| P-38 | Responsividade (sidebar ≥ lg, pills abaixo) | §12 | Visual | Paridade | screenshots 375/768/1280 | ⬜ |
| P-39 | Comparação visual com a aplicação original | — | Visual | — | screenshots lado a lado *[requer acesso à app Base44]* | ⬜ |
| P-40 | ScoreList, StatCard, CompetencyCard, OpportunityCard conforme REF | §8 | Visual | Paridade | snapshot | ⬜ |
| P-41 | Fluxo ponta a ponta: registrar → analisar → curar → analista vê aprovado → CSAT | §1 | Funcional | Paridade | e2e | ⬜ |
| P-42 | Supervisor lê tudo | §1 | Funcional | Paridade | matriz RLS | ⬜ |
| P-43 | Cálculos de indicadores conferidos contra dataset de referência | §7.1 | Funcional | — | teste | ⬜ |
| P-44 | Limpeza de arquivos ao remover print | §7.3 | Integridade | D-007#9 | teste | ⬜ |
| P-45 | Edge Functions validam papel | — | Segurança | SEC-12 | teste | ⬜ |
| P-46 | Logs de falha sem PII | — | Segurança | SEC-14 | teste | ⬜ |
| P-47 | Varredura de segredos no CI | — | Segurança | SEC-01 | CI | ⬜ |
| P-48 | Pipeline CI (lint, test, build) | — | Técnico | — | CI verde | ⬜ |
| P-49 | Documentação de execução local | — | Técnico | — | README | ⬜ |
| P-50 | Auditoria de custos (planos gratuitos) | — | Infra | — | relatório Fase 6 | ⬜ |
| P-51 | Defaults de oportunidade (Desejável / Indeterminada / Médio / pendente) | README-DEV C.3 | Funcional | Paridade | teste | ⬜ |
| P-52 | Classificação calculada pelo sistema, não confiada ao LLM | README-DEV C.3 | Funcional | Paridade | teste | ⬜ |
| P-53 | CSAT: todos os registros nas médias; badge da lista usa o mais recente | README-DEV B.4, F | Funcional | Paridade | teste | ⬜ |
| P-54 | Mensagens literais (bloqueio em curadoria, zero oportunidades, pesquisa inválida, obrigado) | README-DEV E.3 | Visual | Paridade | snapshot de texto | ⬜ |
| P-55 | Charts: cores, alturas e formas (Bar h-64, Line h-72 domain 0–10, donut 55/85) | README-DEV E.3 | Visual | Paridade | snapshot | ⬜ |
| P-56 | Reimportação não duplica CSAT | README-DEV D.10 | Integridade | Corrigido D-007 | teste | ⬜ |

## Funcionalidades novas (fora da paridade — não entram no percentual)
| ID | Funcionalidade | Decisão | Especificação | Status |
|---|---|---|---|---|
| N-01 | Organizações, vínculos e admin da plataforma | D-002, D-017 | ARCHITECTURE §3 | ⬜ |
| N-02 | Login Google + cadastro aberto | D-008 | ARCHITECTURE §3 | ⬜ |
| N-03 | Validação do analista (gostei/útil/comentário) em diagnóstico e oportunidades | D-011 | specs/VALIDACAO_E_CURADORIA | ⬜ |
| N-04 | Veredito do supervisor com prioridade | D-011 | specs/VALIDACAO_E_CURADORIA | ⬜ |
| N-05 | Taxa de utilidade da IA (individual p/ analista; organização p/ supervisor) | D-011 | specs/VALIDACAO_E_CURADORIA | ⬜ |
| N-06 | Configuração de provedor/modelo/chave de IA pela interface | D-009 | specs/PROVEDOR_IA | ⬜ |
| N-07 | Supervisor escolhe analista ao criar avaliação | D-013 | ARCHITECTURE §4 | ⬜ |
| N-08 | Extensão de captura com salvamento automático em `.txt` | D-018 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-09 | "Analisar ao vivo" na extensão | D-018 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-10 | Ingestão por número do ticket (URL) | D-018, D-012 | specs/EXTENSAO_CAPTURA | ⬜ |
| N-11 | Modelos locais de IA | D-009 (futuro distante) | specs/PROVEDOR_IA §4 | 💤 |
| N-12 | Oportunidades com comunicação assertiva e rapport (Protocolo V1.2) + campo `communication_techniques` | D-019 | specs/PROTOCOLO_PROMPT_V1.2 | ⬜ |
