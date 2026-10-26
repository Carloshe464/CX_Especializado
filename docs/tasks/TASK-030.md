# TASK-030 — Base da Fase 4: "Sair" no celular, páginas sob demanda e massa de dados local

| Campo | Valor |
|---|---|
| Fase | 4 — Fluxo principal |
| Responsável | Operador |
| Revisor | Claude Code (orquestrador) |
| Depende de | TASK-015 mesclada ✅. **Paralela à TASK-031** (arquivos disjuntos: esta não toca `src/pages/Evaluations.jsx` nem `src/services/evaluations.js`) |
| Branch | `task/030-base-fase4` (a partir de `main`) |
| PR | `TASK-030: Sair no celular, páginas sob demanda e massa local` → `main` |
| Itens | Backlog das revisões da TASK-014 ("Sair" no celular; bundle de 512 kB); E.3 Layout (REF); SEC-17 (dados sintéticos) |

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-030**, que prepara a base da Fase 4 em três partes:
1. o botão "Sair" no cabeçalho do celular;
2. as páginas internas carregadas sob demanda;
3. um script de **massa de dados sintética só para o Supabase local**, para as próximas telas.

### 0. Regras invioláveis
- **Nada remoto.** O script da §3 **recusa** qualquer URL que não seja local, sem exceção e sem opção para contornar.
- A chave secret/`service_role` **local** só é lida de variável de ambiente no momento da execução. Nunca vai para arquivo versionado, `.env.example`, log colado nem PR.
- **Não toque** em `src/pages/Evaluations.jsx` nem em `src/services/evaluations.js` (são da TASK-031, em paralelo). Também não toque em migrações nem em testes de banco.
- **Sem dependências novas.** O script usa o `@supabase/supabase-js` que já está instalado.
- Não dispare o Actions (D-021). Textos em pt-BR.

### 1. Leitura obrigatória
- `AGENTS.md`.
- `docs/reference/README-DEV_AUDITORIA_TECNICA.md` §E.2–E.3 (Layout).
- `docs/reference/BASE44_PLATAFORMA_PROTOCOLO_CX.md` §8 (Layout).
- `src/components/cx/Layout.jsx`, `src/App.jsx`, `src/auth/*`.
- As 4 migrações, para conhecer as tabelas, as RPCs e os gatilhos.

### 2. Frontend

**2.1 "Sair" no celular** (`src/components/cx/Layout.jsx`)
- No cabeçalho móvel (`lg:hidden`), à direita da marca, mostre o rótulo do papel (como na barra lateral) e um botão "Sair" com o ícone `LogOut` e `aria-label="Sair"`, chamando `onSignOut`.
- Em 375 px o cabeçalho não pode quebrar nem gerar rolagem horizontal: o e-mail **não** aparece no celular, só o papel e o botão.
- A barra lateral do desktop continua como está.
- **Testes** em `layout.test.jsx`:
  - o botão existe no cabeçalho móvel e chama `onSignOut`;
  - a navegação desktop não muda.

**2.2 Páginas sob demanda** (`src/App.jsx`)
- Use `React.lazy` + `Suspense` para as páginas **internas**: Dashboard, Evaluations, NewEvaluation, EvaluationDetail, Curation, MyDevelopment, Satisfaction, ProtocolPage e Survey.
- As telas de entrada continuam com import direto, porque são a primeira tela: Login, Register, ForgotPassword, ResetPassword, AuthConfirm, Onboarding e PageNotFound.
- **Fallback:** o `LoadingSpinner` existente, centralizado e com `label="Carregando…"`.
- `npm run build` deve gerar um chunk por página e **sem** o aviso de 500 kB. Cole a saída.
- Os testes de rotas continuam passando. Use `await screen.findBy…` onde a página passou a carregar sob demanda; não use `waitFor` com tempo fixo.

### 3. Massa de dados local (`scripts/seed-local.mjs`)
Script Node (ESM) executado com `node scripts/seed-local.mjs`, que cria uma massa **sintética** e **reexecutável** no Supabase local.

- **Guarda obrigatória:**
  - leia `SUPABASE_URL` (padrão `http://127.0.0.1:54321`) e `SUPABASE_SECRET_KEY` da linha de comando ou do ambiente;
  - **aborte com erro** se o host não for `127.0.0.1` ou `localhost`;
  - aborte também se a chave estiver ausente.
- **Usuários**, via `auth.admin.createUser` com `email_confirm: true` e senha fixa de teste impressa no final (só local), todos em `@empresa-x.test` / `@empresa-y.test`:
  - supervisor X, analista A de X e analista B de X;
  - supervisor Y e analista de Y.
- **Organizações:** X (`empresa-x.test`) e Y (`empresa-y.test`).
  - Crie-as pelas **RPCs reais**: o supervisor chama `create_organization` e os analistas chamam `join_organization_by_domain`, cada um com a própria sessão (`signInWithPassword`). Assim o fluxo de entrada é exercitado.
  - O seed por organização (limiar 4, V1.1/V1.2) acontece pelo gatilho.
- **Avaliações**, via cliente com a chave local, porque o seed simula o servidor. Para cada organização, cerca de 8 avaliações cobrindo os 4 status, os 5 canais, as 3 tendências e avaliações sem protocolo, com transcrições curtas e **fictícias**.
  - **Análises fictícias** nas avaliações `analisado`/`curado`:
    - uma `analysis_runs` com `status = 'sucesso'`, `prompt_version = 'V1.2'`, `provider = 'seed-local'` e `model = 'seed-local'`;
    - 6 `evaluation_scores` com notas variadas, incluindo `null`;
    - de 0 a 3 `opportunities` com `communication_techniques`;
    - `current_analysis_run_id` apontando para a execução.
  - **Curadoria:** nas `curado`, use as **RPCs** `decide_opportunity`/`decide_diagnosis` com a sessão do supervisor, para gerar logs reais.
  - **Validação do analista:** em algumas, `submit_feedback` com a sessão do analista dono.
  - **CSAT:** em metade das avaliações, `csat_records` com notas 1–5 e `source` variados, alguns com mais de um registro por avaliação.
- **Reexecutável:** se a massa já existir (por exemplo, a organização X), o script não duplica. Ele informa e sai com código 0. A opção `--reset` só imprime a instrução `supabase db reset`; o script **não** apaga dados.
- **Saída final:** tabela com os e-mails de teste, o papel e a contagem do que foi criado. **Sem** chaves.
- **README:** acrescente uma seção curta "Massa de dados local", com os passos `supabase start`, `supabase db reset`, a variável `SUPABASE_SECRET_KEY` vinda do `supabase status` e `node scripts/seed-local.mjs`, mais o aviso de que o script recusa o projeto remoto.
- **Testes** em `src/__tests__/seedLocalGuard.test.js`:
  - extraia a guarda para uma função exportada (`assertLocalTarget(url, key)`) e teste que ela aceita `127.0.0.1` e `localhost`;
  - recusa `https://xxx.supabase.co`, IPs públicos e URLs malformadas;
  - recusa chave ausente.

### 4. Validação local (saída real)
```
npm ci && npm run lint && npm run test && npm run build
supabase start && supabase db reset
node scripts/seed-local.mjs            # 1ª execução: cria
node scripts/seed-local.mjs            # 2ª execução: não duplica
SUPABASE_URL=https://exemplo.supabase.co node scripts/seed-local.mjs   # deve recusar
supabase test db && supabase stop
git status --short
```
**Teste manual:**
- `npm run dev` em 375 px: o botão "Sair" funciona;
- entre com o analista A da massa e confira que o menu é de analista;
- no DevTools, confira que as páginas carregam chunks separados.
- Capturas do cabeçalho móvel e do desktop.

### 5. Fora do escopo
- O conteúdo das telas (TASK-031 em diante).
- Qualquer massa no projeto remoto.
- Alterar migrações ou RLS.

### 6. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | "Sair" no celular, sem rolagem horizontal em 375 px | teste + captura |
| 2 | Páginas internas sob demanda; build sem aviso de 500 kB | saída do build |
| 3 | Massa local completa, criada pelas RPCs reais onde houver RPC | saída do script |
| 4 | Script recusa alvo não local e é reexecutável sem duplicar | teste da guarda + saídas |
| 5 | Lint, testes, build e `supabase test db` verdes; nenhum segredo no diff | saídas + `git diff` |

### 7. Entrega
PR `TASK-030: Sair no celular, páginas sob demanda e massa local` para `main`, com o relatório do `AGENTS.md` e as saídas reais. Não faça merge.

## FIM DO PROMPT
