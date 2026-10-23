# Registro de decisões técnicas

Status: **Aceita** (vigente) · **Proposta** (aguarda o responsável) · **Substituída**.
Toda correção de comportamento da aplicação original deve aparecer aqui, citando a referência (REF §n = `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md`).

| ID | Título | Status |
|---|---|---|
| D-001 | Orquestração sem mecanismo automático de execução do Codex | Aceita |
| D-002 | Multiempresa desde o início | Aceita (2026-10-23) |
| D-003 | React Router v7 em modo declarativo | Aceita |
| D-004 | Tailwind CSS v3 (não v4) | Aceita |
| D-005 | npm como gerenciador de pacotes | Aceita |
| D-006 | Vitest + Testing Library | Aceita |
| D-007 | Correções dos 9 problemas conhecidos | Aceita (detalhes por fase) |
| D-008 | Cadastro aberto com Google + e-mail | Aceita (2026-10-23) |
| D-009 | IA plugável configurada pela interface | Aceita (provedor inicial em aberto) |
| D-010 | Diagnóstico em `analysis_runs` versionadas | Aceita (fixar na Fase 2) |
| D-011 | Validação dupla: analista + supervisor (prevalece) | Aceita (2026-10-23) |
| D-012 | Protocolo único por organização | Aceita (2026-10-23) |
| D-013 | Supervisor escolhe o analista ao criar | Aceita (2026-10-23) |
| D-014 | Planilha: parser + IA só para mapear colunas | Aceita (2026-10-23) |
| D-015 | `tailwind-merge` 2.x | Aceita |
| D-016 | Reanálise pelo dono ou supervisor, com histórico | Aceita (2026-10-23) |
| D-017 | Papéis: admin da plataforma, supervisor, analista | Aceita (detalhes em aberto) |
| D-018 | Extensão de navegador para captura de atendimentos | Aceita (escopo); especificação em aberto |
| D-019 | Protocolo V1.2: comunicação assertiva e rapport nas oportunidades | Aceita (texto aprovado) |
| D-020 | Risco aceito: alertas moderados do Tailwind 3 (build) | Aceita (2026-10-23) |

---

### D-001 — Orquestração sem mecanismo automático de execução do Codex
**Contexto:** a sessão de orquestração não dispõe de CLI/integração do Codex (`codex` ausente no ambiente) e o responsável determinou que esta sessão apenas orquestre, valide, aprove PRs e gere prompts.
**Decisão:** ordens de trabalho são arquivos `docs/tasks/TASK-NNN.md` contendo um prompt completo para colar no Codex ou numa sessão Claude Code operadora. A entrega volta como PR no GitHub, revisado pelo orquestrador.
**Consequência:** nenhuma execução é simulada; status em `TASKS.md` só muda com evidência no PR.

### D-002 — Multiempresa desde o início *(Aceita em 2026-10-23 pelo responsável)*
**Decisão:** opção B. Tabelas `organizations` e `memberships(user_id, organization_id, role)`; toda tabela de negócio recebe `organization_id NOT NULL`; todas as políticas RLS filtram pela organização do usuário; o papel (supervisor/analista) passa a ser **por organização** (em `memberships`, não em `profiles`). Funções centrais: `current_org_ids()`, `is_supervisor(org_id)`. `app_settings` e `protocol_versions` ficam por organização (com seed por organização criada).
**Consequências:** matriz de testes de RLS inclui isolamento entre organizações (usuário da org A não lê nada da org B, inclusive supervisor); convites, criação de organização e troca de organização ativa precisam de definição de produto (ver perguntas abertas). Cobrança fica fora do escopo.

Análise original das opções:
**Opções:**
- **A. Organização única (recomendada):** sem `organization_id`. RLS simples (dono ou supervisor), menos superfície de erro, testes mais baratos. Migrar depois exige: adicionar `organization_id` em todas as tabelas, backfill com a organização padrão, reescrever políticas, escopar `is_supervisor()` por organização e unicidade de protocolo por organização. Esforço estimado moderado, mecânico, se as políticas forem centralizadas em funções.
- **B. Multiempresa desde já:** `organizations` + `memberships(role)`; toda política filtra por organização. Isolamento entre clientes SaaS pronto, porém dobra a matriz de testes de RLS e antecipa decisões de produto (cobrança, convite, papéis por organização) não autorizadas.

**Recomendação:** A, mantendo as políticas concentradas em funções (`is_supervisor()`, `can_read_evaluation(id)`) para facilitar a migração. **Aguarda decisão do responsável antes da TASK de schema (Fase 2).**

### D-003 — React Router v7 em modo declarativo
A REF §2 usa `react-router-dom v7` com `<Routes>/<Route>`. Mantido para paridade. v7 suporta React 18.

### D-004 — Tailwind CSS v3
A REF §9.2 depende de `tailwind.config.js`, tokens HSL `hsl(var(--x))` e `tailwindcss-animate`, padrão do shadcn/ui para Tailwind v3. A v4 muda o modelo de configuração e exigiria reescrever tokens. Usar a última 3.4.x; reavaliar migração após paridade visual comprovada.

### D-005 — npm
Disponível no ambiente (npm 10.9 / Node 22), padrão em CI, gera `package-lock.json`. Node fixado em 22 LTS via `.nvmrc` e `engines`.

### D-006 — Vitest + Testing Library
Integra nativamente com Vite; testes unitários de `lib/cx.js`, componentes e rotas. Testes de banco (RLS) serão SQL/pgTAP ou scripts com Supabase local na Fase 2.

### D-007 — Correções dos problemas conhecidos
| # | Problema (briefing §7) | Correção | Fase |
|---|---|---|---|
| 1 | Analista acessa análises pendentes | RLS nas tabelas de diagnóstico condicionada a `diagnosis_status='aprovado'`; diagnóstico fora da linha principal (D-010) | 2 |
| 2 | Alteração indevida de estados de curadoria | Colunas de curadoria só via RPC de supervisor; trigger rejeita alterações por outros papéis | 2 |
| 3 | Reanálise apaga decisões de supervisão | Reanálise cria nova `analysis_run`; histórico e `curation_logs` preservados; reanálise de avaliação já curada exige supervisor | 3 |
| 4 | Limites fixos geram indicadores incompletos | Agregações em SQL (views/RPC), sem `limit` | 5 |
| 5 | Respostas duplicadas em pesquisa | Token gerado no servidor, uso único, expiração, `unique(ticket_id)`, rate limit | 5 |
| 6 | Nota inferida confundida com real | Coluna `score_origin`; UI e indicadores distinguem real × derivada | 2/5 |
| 7 | Protocolos duplicados em criações simultâneas | Índice único (D-012) + upsert na importação | 2 |
| 8 | Falhas de IA sem tratamento | Estados de erro, `ai_failures`, mensagens acionáveis, avaliação não muda de estado | 3 |
| 9 | Arquivos órfãos | `evaluation_files` + limpeza ao remover/descartar + rotina periódica | 2/5 |

Problemas adicionais (REF e README-DEV Bloco H), tratados nas mesmas fases:
- **Reimportação do mesmo protocolo duplica `CsatRecord`** (README-DEV D.10) → chave de deduplicação por (avaliação, origem, data/linha de origem) na importação. Fase 5.
- **CSAT vindo de pesquisa fica sem `analyst_name`/`analyst_user_id`** (H.7) → herdar da avaliação do ticket. Fase 5.
- **Falhas de upload/IA sem mensagem** (H.9) → coberto por #8.
- **Remover print antes de salvar não apaga o arquivo** (H.11) → coberto por #9.
- **SurveyTicket com leitura pública (`read: {}`)** permite listar todos os tokens → sem acesso `anon`; validação via Edge Function.
- **Token de pesquisa gerado no cliente** → gerado no servidor.
- **Update de `Evaluation` por `created_by_id`** permite ao analista gravar `diagnosis_status='aprovado'` → coberto por #2.
- **`EvaluationScore`/`Opportunity` com update pelo dono** permite ao analista aprovar as próprias oportunidades → coberto por #2.

### D-008 — Cadastro aberto com Google + e-mail *(Aceita em 2026-10-23)*
**Decisão:** cadastro aberto (self-service), com login Google (Supabase Auth OAuth) e e-mail/senha, além de recuperação de senha. O fluxo de entrada na organização está na D-017.

Contexto original:
REF §11.8 indica convite pela plataforma, mas existe `/register`. O README-DEV (§0.3, A.8, B.10) confirma no original: e-mail/senha, **Google OAuth**, registro com OTP, reset de senha, e entrada de usuários **por convite**. Proposta: manter a rota `/register` (paridade), todo cadastro nasce com `role='user'`, papel `admin` atribuído somente por supervisor existente; avaliar com o responsável se o signup público deve ser desativado em produção.

### D-009 — IA plugável configurada pela interface *(Aceita em 2026-10-23)*
**Decisão:** o provedor ainda não foi escolhido e o modelo será o da API conectada. Uma tela de configuração permite informar provedor, endpoint, modelo e chave; o motor usa adaptadores (inicialmente: protocolo compatível com OpenAI, que cobre vários provedores e servidores locais, e adaptadores nativos conforme a escolha). **Chave por organização** (resposta de 2026-10-23): cada empresa informa e paga a própria API. Modelos locais: **em stand-by**. Especificação: `docs/specs/PROVEDOR_IA.md`.
**Segurança:** a chave é gravada só no servidor (cifrada, Supabase Vault), nunca retorna ao navegador (campo somente escrita, exibe apenas os 4 últimos caracteres) e só a Edge Function a lê.

Contexto original:
O original usa `InvokeLLM` sem modelo ("automatic", escolha interna e não inspecionável — README-DEV C.10/H.6), então não há modelo a copiar: é preciso **fixar** um. O motor é independente de provedor (adaptador). Escolha do provedor/modelo inicial, orçamento e chave ficam com o responsável antes da Fase 3. Requisitos: saída JSON estruturada, visão multimodal (prints/PDF), execução a partir de Edge Function.

### D-010 — Diagnóstico em `analysis_runs`
Separa o resultado de cada execução da IA da linha da avaliação: permite versionar prompt/modelo, preservar curadorias anteriores (#3) e proteger conteúdo pendente por RLS (#1). A UI continua exibindo os mesmos campos da REF §7.4.

### D-011 — Validação dupla: analista + supervisor *(Aceita em 2026-10-23)*
**Decisão do responsável (substitui a regra do briefing §4.6 e SEC-06 antigas):**
1. O analista vê a análise da IA assim que ela termina.
2. O analista valida **o diagnóstico e cada oportunidade**: gostei/não gostei, útil/não útil e comentário opcional.
3. O supervisor vê tudo e também avalia. **A avaliação do supervisor prevalece** sobre a do analista.
4. "Meu desenvolvimento" mostra só o que tem retorno positivo: aprovado pelo supervisor, ou marcado positivo pelo analista sem avaliação contrária do supervisor (*interpretação a confirmar*).
5. Taxa de utilidade da IA entra nos indicadores; o analista vê apenas a taxa das próprias avaliações.
Especificação: `docs/specs/VALIDACAO_E_CURADORIA.md`. Proteções que continuam valendo: o analista não altera a avaliação do supervisor nem a de outro analista, e o log de curadoria segue imutável.

Histórico (redação anterior):
**Resposta do responsável (2026-10-23):** "a aprovação do supervisor se dá a um analista validar a orientação da IA e confirmar se gostou e se foi útil. A questão do supervisor é conseguir visualizar tudo, mas o analista precisa conseguir criar uma avaliação de um chat dele", e haverá novas funções para o fluxo.
**Impacto:** altera a regra do briefing §4.6 ("o analista não pode acessar resultados pendentes de aprovação") e SEC-06. Como é decisão do responsável sobre regra de produto, prevalece, mas o novo modelo precisa ser especificado antes da Fase 2 (quem valida o quê, o que o supervisor ainda decide, o que alimenta "Meu desenvolvimento" e os indicadores). Texto anterior mantido abaixo como histórico.

Proposta anterior:
A REF §7.4 define `canSeeAnalysis = isAdmin || isOwner || diagnosis_status==='aprovado'`, com `isOwner = created_by_id === user.id`. Assim, um analista que criou a própria avaliação vê o diagnóstico antes da curadoria, contrariando REF §1 ("nada da IA chega ao analista sem aprovação") e o briefing §4.6. Proposta: `canSeeAnalysis = isSupervisor || diagnosis_status==='aprovado'` (o analista vê o placeholder "em curadoria"). O README-DEV confirma o comportamento (B.12, H.2) e o classifica como decisão de produto a registrar antes de replicar. Precisa de confirmação.

### D-012 — Protocolo único por organização *(Aceita em 2026-10-23)*
**Decisão:** índice único `(organization_id, lower(btrim(protocol)))` quando `protocol` não nulo; criação ou importação com protocolo existente vincula à avaliação existente em vez de duplicar.

Contexto original:
A REF reutiliza a avaliação por protocolo na importação, mas não impõe unicidade. Proposta: índice único sobre `lower(trim(protocol))` quando não nulo; criação concorrente retorna a avaliação existente. O README-DEV (B.1) confirma que não há chave única e que a deduplicação é só aplicacional na importação (criação manual não deduplica). Confirmar se o mesmo chamado pode ter mais de uma avaliação legítima (ex.: atendimentos distintos com o mesmo protocolo).

### D-013 — Supervisor escolhe o analista ao criar *(Aceita em 2026-10-23)*
**Decisão:** ao criar uma avaliação, o supervisor seleciona um analista da própria organização. O nome livre fica só para importações sem correspondência, com vinculação posterior.

Contexto original:
REF §7.3: supervisor cria com `analyst_user_id = null` e nome livre, logo o analista nunca vê a avaliação no portal. Proposta: o supervisor seleciona o analista (perfil existente) ao criar; nome livre permanece apenas para importações sem correspondência, com vinculação posterior.

### D-014 — Extração de planilhas *(Aceita em 2026-10-23: opção A)*
O original usa `ExtractDataFromUploadedFile` da plataforma, tolerante a qualquer layout (README-DEV C.5, A.8). Opções: (A) parser determinístico (CSV/XLSX → linhas) + **mapeamento de colunas por IA** apenas sobre o cabeçalho e amostra, seguido de `normalizeSpreadsheetRow` idêntico ao original; (B) enviar a planilha inteira ao LLM como o original. Recomendação: A — mais barato, reprodutível e testável, preservando o mesmo resultado de linhas (skip/avaliação/CSAT).

### D-015 — `tailwind-merge` 2.x
O original declara `tailwind-merge ^3`, linha voltada ao Tailwind v4, com `tailwindcss 3.4`. Usar 2.x, compatível com v3, sem efeito visual.

### D-016 — Reanálise pelo dono ou supervisor, com histórico *(Aceita em 2026-10-23)*
**Decisão:** quem pode reanalisar continua como no original (dono da avaliação ou supervisor), inclusive após a curadoria, mas **nada é apagado**: cada reanálise cria nova `analysis_run`; execuções anteriores, decisões e `curation_logs` permanecem consultáveis como histórico; a UI pede confirmação quando já houver validação/curadoria.

Contexto original:
No original, "Reanalisar" aparece também em `curado`, apaga oportunidades curadas e reabre o ciclo sem aviso (README-DEV C.7, H.4). Proposta: reanálise de avaliação curada só por supervisor, com confirmação explícita; cria nova `analysis_run` e mantém a anterior e seus logs consultáveis como histórico.

### D-017 — Papéis e entrada na organização *(Aceita; detalhes em aberto)*
**Decisão do responsável:** três níveis.
- **Admin da plataforma** (o responsável): papel global, único que pode pertencer a várias organizações e enxergá-las.
- **Supervisor**, por organização: vê e avalia tudo da organização.
- **Analista**, por organização: pertence a uma única organização.

O cadastro é self-service. **Entrada (respostas de 2026-10-23):** quem cria a empresa vira supervisor dela; os analistas entram **pelo domínio do e-mail**.
**Proteções obrigatórias da entrada por domínio:**
- só e-mail **verificado** (Google ou confirmação por e-mail);
- domínios públicos (gmail.com, outlook.com, hotmail.com, yahoo.com etc.) **nunca** servem de domínio de empresa;
- um domínio pertence a uma única organização (`organization_domains`, único);
- quem entra por domínio vira **analista**; promover a supervisor só pelo supervisor ou pelo admin geral.

*Em aberto:* comprovar a posse do domínio (ex.: registro DNS) ou aceitar o domínio do e-mail verificado do criador. O papel global fica numa tabela própria (`platform_admins`), gerenciada só pelo banco/painel, nunca pelo cliente.

### D-018 — Extensão de captura de atendimentos *(Aceita no escopo; especificação em aberto)*
**Decisão do responsável:** extensão de navegador, semelhante à Neeko, que:
- anota a transcrição do atendimento;
- salva em `.txt` numa pasta escolhida pelo analista, automaticamente ao fim do atendimento;
- tem um botão explícito "Analisar ao vivo", que captura até a última mensagem e anexa ao mesmo `.txt`;
- identifica o arquivo pelo número do atendimento/ticket extraído da URL, chave pela qual o sistema será alimentado.

Especificação e perguntas: `docs/specs/EXTENSAO_CAPTURA.md`. É um produto separado (pasta `extension/`), planejado como trilha própria após a Fase 4.

### D-019 — Protocolo V1.2: comunicação assertiva e rapport nas oportunidades *(Aceita como requisito em 2026-10-23)*
**Decisão do responsável:** o bloco de oportunidades de melhoria deve usar comunicação clara e efetiva, com técnicas de comunicação assertiva e de rapport.
**Implementação:** nova versão do prompt (V1.2), que acrescenta uma seção à V1.1 sem remover regras. A V1.1 continua verbatim como linha de base de paridade. Novo campo `communication_techniques` por oportunidade. Texto proposto em `docs/specs/PROTOCOLO_PROMPT_V1.2.md`, aguardando aprovação.

### D-020 — Risco aceito: alertas moderados na cadeia do Tailwind 3 *(Aceita em 2026-10-23)*
**Contexto:** `npm audit` aponta 4 ocorrências moderadas (GHSA-rj75-hqrm-r3gf, complexidade quadrática no `postcss-selector-parser`) via Tailwind 3.4.19, postcss-nested e tailwindcss-animate. Não há correção dentro da linha 3.
**Decisão:** aceitar o risco. A ferramenta só roda no build e processa apenas CSS do próprio repositório; não há entrada de CSS por usuários e nada disso entra no bundle. Reavaliar ao planejar a migração para o Tailwind v4 (D-004), após a paridade visual.
