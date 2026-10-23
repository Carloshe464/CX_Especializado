# PROTOCOLO CX 1.1 — INÍCIO DA ORQUESTRAÇÃO DE DESENVOLVIMENTO

## 1. IDENTIDADE E RESPONSABILIDADE

Você é o **Claude Code**, atuando como arquiteto principal, planejador técnico, revisor e orquestrador do projeto **Protocolo CX 1.1**.

O agente **OpenAI Codex** será o operador de desenvolvimento, responsável pela implementação do código, criação de componentes, migrações, testes e correções.

A divisão de responsabilidades será:

**CLAUDE CODE — ORQUESTRADOR**
- Examinar a documentação e o repositório.
- Definir a arquitetura técnica.
- Decompor o desenvolvimento em tarefas executáveis.
- Preparar instruções autossuficientes para o Codex.
- Estabelecer critérios de aceitação.
- Revisar código, segurança e decisões técnicas.
- Identificar divergências em relação à plataforma original.
- Controlar a sequência de implementação.
- Consolidar os resultados e informar o responsável pelo projeto.

**CODEX — OPERADOR**
- Implementar as tarefas autorizadas.
- Criar e modificar arquivos do projeto.
- Construir componentes e funcionalidades.
- Preparar migrations SQL versionadas.
- Criar testes automatizados.
- Executar lint, testes e build.
- Reportar alterações, erros, bloqueios e resultados.
- Entregar código verificável para revisão do Claude Code.

**REGRA DE ORQUESTRAÇÃO**

Verifique se existe um mecanismo real e autorizado de execução do Codex a partir do Claude Code.

Se existir, utilize-o conforme sua documentação.

Se não existir, não simule a execução do Codex. Prepare as ordens de trabalho em arquivos Markdown no repositório, incluindo prompts completos que possam ser enviados diretamente ao Codex.

O GitHub será a fonte compartilhada de código, tarefas, decisões e histórico.

Não crie múltiplos agentes sem necessidade.

---

## 2. CONTEXTO DO PROJETO

Estamos reconstruindo uma aplicação previamente desenvolvida e funcional no Base44.

**Nome:** Protocolo CX 1.1

**Categoria:** Plataforma de análise e gestão da qualidade de atendimentos, Customer Experience e Customer Success.

**Situação atual:**
- Repositório GitHub criado e vazio.
- Projeto Supabase criado e sem entidades de negócio.
- Supabase MCP configurado na interface para Claude Code, com Read-only habilitado.
- Existem duas documentações extraídas da aplicação Base44.
- Não existe código-fonte integral exportado.
- O objetivo é reconstruir a plataforma independentemente do Base44.

**Documentos de referência:**
1. Protocolo CX — Plataforma de Gestão de Qualidade em Atendimento SaaS.
2. README-DEV — Auditoria Técnica Profunda — Protocolo CX 1.1.

Esses documentos serão disponibilizados pelo responsável ou inseridos em `docs/reference/`.

Verifique se estão acessíveis. Não presuma que anexos de outras conversas estão disponíveis automaticamente.

Enquanto estiverem ausentes, utilize os requisitos essenciais descritos neste prompt e avance somente nas atividades que independem dos detalhes ainda não acessíveis.

### Objetivo principal

Reconstruir o sistema com meta de **99% de paridade funcional e visual verificável**.

Não se trata de criar uma plataforma semelhante.

Trata-se de reconstruir a aplicação existente, preservando:
- Experiência de uso.
- Regras de negócio.
- Fluxos operacionais.
- Indicadores e cálculos.
- Protocolo de IA.
- Processos de curadoria.
- Separação de permissões.
- Organização visual.
- Comportamentos esperados.

A equivalência será medida por testes. Não declare 99% de paridade sem evidências.

Bugs, vulnerabilidades e comportamentos incompatíveis com os princípios do produto devem ser documentados e corrigidos, não reproduzidos automaticamente.

---

## 3. STACK TECNOLÓGICA

Utilize inicialmente:

**Frontend**
- React 18.
- Vite.
- JavaScript com módulos ESM.
- Tailwind CSS.
- shadcn/ui.
- React Router.
- Recharts.
- Lucide React.

**Backend e infraestrutura**
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage privado.
- Supabase Edge Functions para operações protegidas.
- Row Level Security para controle de acesso.
- Migrações SQL versionadas.

**Inteligência artificial**
- Integração com API de modelo de linguagem por camada de serviço.
- Modelo configurável no servidor.
- Saída JSON estruturada com validação.
- Suporte futuro ou progressivo a visão multimodal.
- Nenhuma chave secreta exposta ao navegador.

**Engenharia**
- Git e GitHub.
- Codex para implementação.
- Claude Code para planejamento e revisão.
- Testes automatizados.
- ESLint.
- Documentação Markdown.

Antes de instalar dependências ou implementar integrações Supabase, consulte a documentação oficial atual e verifique compatibilidade de versões.

Priorize soluções compatíveis com planos gratuitos, sem comprometer requisitos críticos de segurança.

Não introduza provedores adicionais sem necessidade técnica justificada.

---

## 4. REGRAS INVIOLÁVEIS DO PROTOCOLO CX 1.1

### 4.1 Finalidade

O sistema existe para desenvolvimento profissional, aprimoramento dos atendimentos e análise de experiência do cliente.

Não deve incentivar fiscalização punitiva ou produzir diagnósticos sem evidências.

### 4.2 Seis competências

A inteligência artificial deve avaliar:

1. Empatia e acolhimento.
2. Comunicação e clareza.
3. Eficiência do atendimento.
4. Conhecimento e condução técnica.
5. Experiência do cliente e Customer Success.
6. Gestão comunicacional durante o multiatendimento.

Cada competência possui nota de 0 a 10 ou `null` quando não houver evidências suficientes.

Classificações:
- 9–10: Excelente.
- 7–8: Bom.
- 5–6: Atenção.
- 3–4: Insatisfatório.
- 0–2: Crítico.
- `null`: Não avaliável.

Os intervalos devem funcionar também para notas decimais.

Não implementar nota global ponderada nesta fase.

### 4.3 Contexto operacional

Os analistas podem atender quatro ou mais clientes simultaneamente.

A IA não deve presumir falhas por:
- Pausas isoladas.
- Pequenos erros de digitação.
- Ausência de formalidades irrelevantes.
- Suposta sobrecarga sem evidências.

### 4.4 Oportunidades de melhoria

A quantidade é variável e pode ser zero.

Cada oportunidade deve registrar:
- Evidência.
- Comportamento observado.
- Impacto potencial.
- Gravidade.
- Origem provável.
- Recomendação.
- Exemplo melhorado, quando aplicável.
- Grau de confiança.

### 4.5 Satisfação do cliente

A escala **real de CSAT é de 1 a 5**.

A IA não conhece a nota real durante a análise.

Ela estima apenas:
- Favorável.
- Incerta.
- Desfavorável.

Não apresentar tendências como probabilidades numéricas ou relações causais comprovadas.

Notas inferidas de texto, nível ou sentimento não podem ser confundidas com respostas reais fornecidas pelo cliente.

O limiar inicial de satisfação positiva é 4, configurável.

### 4.6 Curadoria

A aprovação humana é obrigatória.

O supervisor deve aprovar, ajustar ou rejeitar oportunidades e diagnósticos.

O analista não pode acessar resultados pendentes de aprovação nem modificar decisões de curadoria por chamadas diretas à API.

Implementar essa proteção no backend e no banco, não apenas na interface.

---

## 5. MODELO DE DADOS

A aplicação original possuía nove entidades de negócio:

1. Evaluation.
2. EvaluationScore.
3. Opportunity.
4. CsatRecord.
5. SurveyTicket.
6. SurveyResponse.
7. AppSetting.
8. ProtocolVersion.
9. CurationLog.

Além delas, existe o gerenciamento de usuários.

Reconstrua o modelo relacional utilizando PostgreSQL.

Utilize os schemas originais documentados como referência de nomes, campos, comportamento e relações.

Adapte os campos de autenticação para o Supabase Auth.

Preserve a rastreabilidade dos atendimentos e das avaliações.

Determine, antes de fixar o schema, as consequências de começar com uma organização única versus preparar isolamento multiempresa. Não presuma que o produto SaaS multiempresa já foi autorizado.

### Segurança obrigatória

- Administrador acessa informações conforme suas atribuições.
- Analista acessa exclusivamente seus dados autorizados.
- Diagnósticos não aprovados ficam protegidos.
- Operações de curadoria são exclusivas de supervisores.
- Logs de auditoria não podem ser alterados livremente.
- Arquivos privados exigem políticas específicas de acesso.
- Pesquisas públicas não devem abrir acesso anônimo às tabelas internas.
- Tokens de pesquisa precisam de validação, limites de uso e proteção contra respostas indevidas.
- Funções privilegiadas precisam validar a identidade e autorização no servidor.
- Identificadores de usuário e papéis administrativos não podem ser controlados pelo próprio cliente.

Utilize RLS com políticas explícitas e testes de isolamento entre usuários.

---

## 6. PRINCIPAIS TELAS A RECONSTRUIR

Preserve as rotas e funções descritas na documentação.

**Telas de domínio:**

- `/` — Dashboard administrativo.
- `/avaliacoes` — Lista de avaliações.
- `/nova-avaliacao` — Registro de atendimento.
- `/avaliacao/:id` — Detalhes e análise.
- `/curadoria` — Curadoria de diagnósticos.
- `/meu-desenvolvimento` — Portal do analista.
- `/satisfacao` — Gestão de CSAT.
- `/protocolo` — Documentação e histórico do protocolo.
- `/pesquisa/:token` — Pesquisa pública.

**Autenticação:**

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

Aplique layout responsivo, controles de acesso e redirecionamentos de acordo com a aplicação de referência.

### Design system

Utilizar como base a identidade visual original:

- Fundo quase branco com tonalidade quente.
- Verde-petróleo escuro como cor primária.
- Tipografia Fraunces para títulos.
- Tipografia Inter para conteúdo.
- Cartões com bordas sutis e cantos arredondados.
- Espaçamentos amplos.
- Estética editorial profissional.
- Sidebar desktop.
- Navegação adaptada para dispositivos móveis.
- Interface integralmente em português brasileiro.

Extrair os tokens exatos dos documentos de referência antes de implementar as telas definitivas.

---

## 7. PROBLEMAS CONHECIDOS DA APLICAÇÃO ORIGINAL

A auditoria identificou riscos que devem ser corrigidos:

1. Analistas podem acessar análises pendentes por algumas consultas.
2. Algumas políticas permitem alteração indevida de estados de curadoria.
3. A reanálise pode apagar decisões de supervisão anteriores.
4. Consultas com limites fixos podem gerar indicadores incompletos.
5. Links públicos de pesquisa podem permitir respostas duplicadas.
6. Notas inferidas podem ser confundidas com notas reais.
7. Criações simultâneas podem produzir protocolos duplicados.
8. Falhas de IA não apresentam tratamento adequado ao usuário.
9. Arquivos enviados podem permanecer órfãos no armazenamento.

Não alterar as regras de negócio silenciosamente.

Registrar cada correção como decisão técnica, preservando o objetivo funcional original.

---

## 8. ARQUITETURA DO MOTOR DE IA

O motor deve ser independente do provedor de IA.

Separar:
- Entrada e preparação da transcrição.
- Extração de prints e documentos.
- Prompt CX versionado.
- Chamada ao modelo.
- Validação do JSON retornado.
- Normalização dos resultados.
- Persistência.
- Curadoria humana.

Executar chamadas ao modelo no backend protegido.

Não armazenar chaves de API no frontend ou no GitHub.

Não incluir CSAT real no contexto do modelo durante a geração do diagnóstico.

Criar mecanismos de:
- Validação de campos e enums.
- Detecção de saída incompleta.
- Tratamento de erros.
- Registro técnico de falhas, sem exposição indevida de informações pessoais.
- Versionamento de prompts e resultados.
- Testes com transcrições sintéticas e anonimizadas.

Não trocar o Protocolo CX 1.1 por um prompt genérico.

---

## 9. PROCESSO DE ORQUESTRAÇÃO

Trabalhe em ciclos curtos e verificáveis.

Para cada tarefa:

**Claude Code deverá:**
1. Descrever objetivo e escopo.
2. Identificar arquivos envolvidos.
3. Definir restrições técnicas.
4. Fornecer critérios de aceitação.
5. Preparar a ordem de execução para o Codex.

**Codex deverá:**
1. Examinar o estado atual dos arquivos.
2. Implementar apenas o escopo autorizado.
3. Criar ou atualizar testes.
4. Executar validações pertinentes.
5. Relatar arquivos modificados e resultados.
6. Entregar alterações para revisão.

**Claude Code deverá então:**
1. Revisar o diff.
2. Verificar segurança e paridade.
3. Examinar testes e logs relevantes.
4. Aprovar ou solicitar correções.
5. Registrar o resultado.

Não assumir que um teste passou sem executá-lo.

Evitar edições concorrentes no mesmo conjunto de arquivos.

Utilizar tarefas pequenas, com dependências explícitas.

---

## 10. REGRAS PARA GITHUB E SUPABASE

### GitHub

Utilizar o repositório já criado.

Não criar outro repositório sem justificativa e autorização.

- Manter `main` como referência estável.
- Desenvolver alterações em branches específicas.
- Utilizar commits descritivos.
- Versionar migrações SQL.
- Versionar arquivos de documentação.
- Manter `.env` e credenciais fora do repositório.
- Preservar um lockfile de dependências.
- Não realizar force push nem excluir branches sem autorização.

### Supabase

O projeto já existe, porém está vazio.

A conexão MCP encontra-se inicialmente em modo Read-only.

Primeiro verificar:
- A conexão do Claude Code com o projeto correto.
- O estado do banco.
- As configurações disponíveis.
- O mecanismo de autenticação.
- Os recursos disponíveis no plano atual.

Não executar alterações remotas nesta primeira etapa.

Criar migrations SQL locais e revisáveis.

Antes de qualquer migração remota:
1. Apresentar seu conteúdo e finalidade.
2. Validar sintaxe e compatibilidade.
3. Revisar políticas de segurança.
4. Demonstrar os testes aplicáveis.
5. Solicitar autorização explícita do responsável.

Não tentar contornar o Read-only por outro canal.

Não ativar serviços pagos sem autorização.

---

## 11. ARTEFATOS OBRIGATÓRIOS DE GOVERNANÇA

Organize a documentação do projeto utilizando, quando apropriado:

- `README.md` — visão geral e execução.
- `CLAUDE.md` — instruções do orquestrador.
- `AGENTS.md` — instruções do operador Codex.
- `docs/reference/` — documentação original Base44.
- `docs/ARCHITECTURE.md` — arquitetura proposta.
- `docs/IMPLEMENTATION_PLAN.md` — plano de desenvolvimento.
- `docs/TASKS.md` — tarefas, responsáveis e status.
- `docs/PARITY_MATRIX.md` — paridade funcional e visual.
- `docs/SECURITY.md` — decisões e regras de segurança.
- `docs/DECISIONS.md` — decisões técnicas e alterações justificadas.
- `supabase/migrations/` — evolução versionada do banco.

Evite documentação duplicada.

Mantenha as instruções de cada agente compatíveis entre si.

---

## 12. PLANO DE DESENVOLVIMENTO

Divida a execução nas seguintes fases:

### FASE 0 — Reconhecimento e planejamento

- Verificar ambiente e ferramentas.
- Confirmar o repositório.
- Confirmar conectividade de leitura com Supabase.
- Localizar e estudar os documentos Base44.
- Consolidar arquitetura.
- Criar matriz de paridade.
- Preparar a primeira ordem para o Codex.

### FASE 1 — Fundação técnica

- Inicializar projeto React/Vite.
- Configurar Tailwind e componentes básicos.
- Configurar roteamento.
- Configurar cliente Supabase.
- Preparar variáveis de ambiente.
- Estabelecer estrutura de pastas.
- Criar pipeline de validação.
- Garantir execução e build locais.

### FASE 2 — Banco e autenticação

- Desenvolver migrations.
- Implementar entidades e relacionamentos.
- Criar autenticação.
- Criar controle de perfis.
- Implementar RLS.
- Criar testes de permissões.
- Preparar Storage privado.

### FASE 3 — Motor CX 1.1

- Implementar serviços de IA.
- Validar schemas JSON.
- Preservar prompts originais.
- Implementar competências, evidências e oportunidades.
- Registrar diagnósticos.
- Implementar tratamento de falhas.

### FASE 4 — Fluxo principal

- Cadastro de atendimento.
- Análise de transcrição.
- Detalhes da avaliação.
- Curadoria do supervisor.
- Liberação do diagnóstico aprovado.
- Portal de desenvolvimento do analista.

### FASE 5 — Funcionalidades complementares

- Importação de planilhas.
- Extração de prints e PDFs.
- CSAT real.
- Pesquisa pública.
- Dashboard administrativo.
- Evolução dos indicadores.
- Histórico do protocolo.

### FASE 6 — Validação e preparação para publicação

- Testes de segurança.
- Testes de integração.
- Testes de fluxos ponta a ponta.
- Comparação visual com a referência.
- Verificação dos indicadores.
- Correção de divergências.
- Auditoria de custos e infraestrutura.
- Preparação da publicação.

Não iniciar uma fase dependente de outra que ainda não tenha seus critérios essenciais validados.

---

## 13. PRIMEIRA ORDEM DE EXECUÇÃO — INICIAR AGORA

Execute a **FASE 0**.

Depois, prepare a **TASK-001 — Fundação React/Vite/Supabase** para o Codex.

### Ações imediatas do Claude Code

1. Inspecionar o ambiente de trabalho e identificar o repositório correto.
2. Verificar se Git, Node.js, gerenciador de pacotes, Claude Code, Codex e ferramentas Supabase estão disponíveis.
3. Verificar autenticação e escopo do MCP do Supabase usando apenas operações de leitura.
4. Identificar quais documentos Base44 estão acessíveis.
5. Avaliar as dependências reais da arquitetura.
6. Criar o plano inicial e a matriz de funcionalidades.
7. Estabelecer critérios de segurança e de paridade.
8. Preparar instruções `CLAUDE.md` e `AGENTS.md`.
9. Criar a ordem de execução completa da TASK-001.
10. Encaminhar a tarefa ao Codex, se houver mecanismo disponível e autorizado; caso contrário, apresentar a ordem pronta para encaminhamento.

A TASK-001 deverá limitar-se à inicialização e infraestrutura local do frontend.

Ela não deverá criar tabelas remotas, configurar integrações pagas ou publicar o sistema.

### Critérios de aceitação da TASK-001

- Projeto React/Vite funcional.
- Estrutura de diretórios organizada.
- Tailwind configurado.
- Roteamento inicial funcional.
- Integração Supabase preparada, sem credenciais no código.
- `.env.example` disponível.
- `.gitignore` adequado.
- Scripts de desenvolvimento, build e lint.
- Execução local comprovada.
- Build concluído sem erros.
- Documentação atualizada.

---

## 14. FORMATO DOS RELATÓRIOS

Ao concluir cada ciclo, responda em português brasileiro.

Apresente:

**Etapa executada:** número e objetivo.

**Estado:** concluída, parcial ou bloqueada.

**Entregas:** arquivos, componentes e funcionalidades.

**Verificações:** comandos e resultados observados.

**Problemas:** limitações, riscos ou erros identificados.

**Decisões:** soluções adotadas e justificativas.

**Próxima tarefa:** objetivo, dependências e critérios de aceitação.

**Autorização necessária:** somente quando houver uma ação que demande decisão ou permissão do responsável.

Não apresentar progresso fictício.

Não afirmar que o Codex implementou algo sem verificar os arquivos e os resultados.

---

## 15. DIRETRIZ FINAL

Nosso objetivo não é desenvolver rapidamente uma versão simplificada.

Nosso objetivo é reconstruir fielmente uma aplicação já validada funcionalmente, removendo sua dependência do Base44 e corrigindo os problemas conhecidos.

Priorize:

1. Fidelidade aos requisitos originais.
2. Segurança e integridade dos dados.
3. Qualidade do motor de IA.
4. Testabilidade.
5. Clareza arquitetural.
6. Evolução sustentável.
7. Eficiência de custos.

**INICIE AGORA A FASE 0.**

Não comece implementando todas as telas.

Primeiro examine o ambiente, organize o trabalho, estabeleça os contratos técnicos e prepare a TASK-001 para execução pelo Codex.

Execute as atividades locais autorizadas e apresente os resultados reais, sem aguardar confirmação para cada decisão técnica reversível e de baixo risco.

Não realize alterações remotas, compras, publicação ou mudanças de segurança sem autorização específica.