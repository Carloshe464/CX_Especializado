# Protocolo CX 1.1

Plataforma de análise e gestão da qualidade de atendimentos (Customer Experience e Customer Success), reconstruída de forma independente a partir da aplicação original desenvolvida no Base44.

> **Estado atual:** fundação local do frontend implementada pela [TASK-001](docs/tasks/TASK-001.md), com rotas provisórias. Autenticação, banco de dados e IA ainda não foram implementados.

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

Pré-requisitos: Node 22 atualizado (22.22.2 ou superior nesta linha, conforme as dependências) e npm. O arquivo `.nvmrc` seleciona a linha 22.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local` para copiar o arquivo. O servidor local abre em [http://localhost:5173](http://localhost:5173).

A configuração é opcional nesta fase: sem variáveis, as páginas continuam funcionando e um aviso aparece somente em desenvolvimento. Os valores de `.env.example` são placeholders. Para preparar o cliente, informe somente a URL e a chave pública `sb_publishable_...` do Supabase em `.env.local`; `VITE_SUPABASE_ANON_KEY` é aceita como alternativa legada. Nunca use chaves secretas ou `service_role`. Não versione `.env.local`.

| Comando | Finalidade |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Prévia local do build (porta 4173) |
| `npm run lint` | ESLint, sem erros nem warnings |
| `npm run test` | Testes em execução única |
| `npm run test:watch` | Testes em modo de observação |

## Massa de dados local

Com o Docker e a CLI do Supabase disponíveis:

1. Execute `supabase start` e `supabase db reset --local`.
2. Consulte `supabase status` e defina `SUPABASE_SECRET_KEY` **somente no ambiente do terminal** com a chave secret/service_role local. Não grave a chave em arquivos nem compartilhe a saída do status. A chave do servidor nunca deve usar prefixo `VITE_`.
3. Execute `node scripts/seed-local.mjs`. O destino padrão é `http://127.0.0.1:54321`; `SUPABASE_URL` ou `--url` permitem escolher outro endereço **local**.

O script recusa qualquer host diferente de `127.0.0.1` ou `localhost`, inclusive projetos remotos, e não segue redirecionamentos HTTP. Cria duas empresas e cinco usuários fictícios, com avaliações, análises, validações, curadoria e CSAT. Mostra os e-mails, papéis, contagens e a senha fixa de teste ao terminar.

Uma segunda execução informa que a massa já existe e não duplica registros. `--reset` apenas mostra a instrução `supabase db reset`; não apaga dados. Se uma execução falhar no meio, use o reset local para recomeçar. Depois do teste, execute `supabase stop` e remova a variável `SUPABASE_SECRET_KEY` do terminal.

Os testes pgTAP existentes usam contagens globais: execute-os em banco recém-recriado, antes de carregar a massa.

Todas as rotas exibem páginas provisórias. Ainda não há autenticação, banco de dados, migrações SQL ou chamadas ao Supabase remoto. O cliente preparado não recupera nem renova sessões automaticamente; a configuração de autenticação pertence à TASK-014.
