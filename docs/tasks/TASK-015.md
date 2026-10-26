# TASK-015 — Preparação do Supabase remoto: correções de auth, inventário somente leitura e aplicação autorizada

| Campo | Valor |
|---|---|
| Fase | 2 — Banco e autenticação (fechamento) |
| Responsável | Operador (Codex, com o conector Supabase) |
| Revisor | Claude Code (orquestrador): revisão de segurança antes e depois da aplicação remota |
| Depende de | TASK-010 a TASK-014 mescladas ✅ |
| Branch | `task/015-supabase-remoto` (a partir de `main`) |
| PR | `TASK-015: Auth por token_hash, inventário remoto e plano de aplicação` → `main` |
| Itens | SEC-01, SEC-02, SEC-09, SEC-10, SEC-15, SEC-16, SEC-18, SEC-19; backlog das revisões das TASK-014/013; processo de mudanças remotas da `SECURITY.md` |

A tarefa tem **três etapas com portões**. As etapas 1 e 2 entram no mesmo PR. A etapa 3 só começa depois de dois sinais:
- a aprovação do orquestrador no PR;
- a autorização **escrita** do responsável na sessão.

---

## PROMPT PARA O OPERADOR (copiar a partir daqui)

Você é o operador de desenvolvimento do projeto **Protocolo CX 1.1** no repositório `Carloshe464/CX_Especializado`. Siga `AGENTS.md` integralmente. Sua tarefa é a **TASK-015**, em três etapas:
1. corrigir no repositório o que precisa estar pronto antes do Supabase real;
2. inspecionar o projeto Supabase remoto **somente com leitura** e montar o plano de aplicação;
3. **só com autorização explícita**, aplicar e verificar.

### 0. Regras invioláveis
- **Etapas 1 e 2:** nenhuma escrita no projeto remoto, sem exceção.
  - O conector Supabase é usado só para leitura: listar, consultar `SELECT` e consultar advisors.
  - Proibidos `apply_migration`, `execute_sql` com DDL/DML, `deploy_edge_function`, criar branch, alterar configuração, `supabase link`, `db push` e `config push`.
- **Pare e pergunte** se o projeto remoto não estiver vazio de objetos do app: tabelas em `public` ou `private`, buckets, ou histórico de migrações. Não sobrescreva nada.
- **Segredos:**
  - nenhuma chave (`service_role`/secret, senha do banco, access token, credencial do Google) no repositório, no PR, em logs colados ou em capturas;
  - a URL e a chave **publishable** do projeto também ficam fora do repositório.
- **Dados:** não crie usuários, organizações nem dados no projeto remoto, nem sintéticos, em nenhuma etapa.
- **Sem custo:** não ative serviço pago, add-on, upgrade de plano, SMTP pago nem a proteção de senhas vazadas, que depende do plano. Se algo exigir isso, liste como decisão do responsável.
- Não dispare o Actions (D-021). Não altere migrações existentes.

### 1. Leitura obrigatória
- `AGENTS.md`, `docs/SECURITY.md` (inteira, inclusive "Processo para mudanças remotas" e "Códigos de erro") e `docs/DECISIONS.md` D-008, D-021, D-023, D-024 e D-025.
- As 4 migrações em `supabase/migrations/` e os testes em `supabase/tests/database/`.
- `src/auth/AuthProvider.jsx`, `src/pages/ResetPassword.jsx`, `src/pages/Register.jsx`, `src/pages/ForgotPassword.jsx` e `src/App.jsx`.
- Documentação oficial atual do Supabase:
  - Auth com PKCE e templates de e-mail com `{{ .TokenHash }}`, mais `verifyOtp({ token_hash, type })`;
  - `config.toml` (`[auth.email.template.*]`, `minimum_password_length`);
  - limites do SMTP padrão;
  - CLI `db push --dry-run`.
- No código instalado de `@supabase/auth-js`, confirme qual evento `verifyOtp` emite para `type: 'recovery'`. Cite o arquivo e a linha no relatório.

---

### ETAPA 1 — Correções no repositório (local)

**1.1 Senha mínima no servidor.** Em `supabase/config.toml`, mude `minimum_password_length = 8`. Não mude `password_requirements`.

**1.2 Links de e-mail que funcionam em qualquer navegador.** Com PKCE, o link padrão só funciona no navegador em que foi pedido (revisão da TASK-014). Troque para `token_hash`:
- **Templates** em `supabase/templates/`, em pt-BR, HTML simples e sem recursos externos:
  - `confirmation.html` (confirmar cadastro) → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`;
  - `recovery.html` (redefinir senha) → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`;
  - `email_change.html` (troca de e-mail) → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`.
  - Registre cada um no `config.toml` com `[auth.email.template.<tipo>]`, `subject` em pt-BR e `content_path`.
- **Nova página `src/pages/AuthConfirm.jsx`** na rota pública `/auth/confirm`, fora do `PublicOnlyRoute` e do layout:
  - lê `token_hash` e `type` da URL;
  - aceita só `email`, `recovery` e `email_change`;
  - chama `supabase.auth.verifyOtp({ token_hash, type })` **uma única vez** (cuidado com o StrictMode);
  - depois, remove os parâmetros da URL com `replace`.
  - Em caso de sucesso: `recovery` → `/reset-password`; os demais → `/`. Garanta que o `AuthProvider` marque `passwordRecovery`: use o evento confirmado no §1; se ele não for `PASSWORD_RECOVERY`, exponha no contexto uma função `markPasswordRecovery()` e chame-a.
  - Em caso de erro ou parâmetro inválido: "Link inválido ou expirado." com links para `/login` e `/forgot-password`.
- `Register.jsx` (`emailRedirectTo`) e `ForgotPassword.jsx` (`redirectTo`) continuam funcionando com os templates novos, sem quebrar o fluxo PKCE existente.
- **Testes** com o cliente falso de `src/test/fakeSupabase.js`:
  - os três tipos válidos;
  - tipo inválido;
  - `token_hash` ausente;
  - erro do `verifyOtp`;
  - chamada única;
  - recuperação levando a `/reset-password` com o formulário liberado.

**1.3 Teste manual local** com o Mailpit:
- cadastro → link no Mailpit → confirmação **num navegador diferente** (ou contexto anônimo do Playwright) → `/onboarding`;
- recuperação → link aberto em **outro contexto** → nova senha → login com a nova senha;
- senha de 7 caracteres recusada pelo servidor (chamada direta a `signUp`, sem passar pela tela).

**1.4 Validação**, com a saída real no PR:
```
supabase start && supabase db reset && supabase test db && supabase db lint --level warning && supabase stop
npm ci && npm run lint && npm run test && npm run build
git status --short
```

---

### ETAPA 2 — Inventário remoto e plano (somente leitura, pelo conector)

Colete e coloque no relatório do PR **sem segredos e sem dados de usuários**: nada de e-mails, nomes nem IDs de usuário.

**2.1 Projeto:**
- ref (pode citar);
- região;
- versão do Postgres, que precisa ser **≥ 15** por causa do `ON DELETE SET NULL (coluna)` (o ideal é a 17, igual ao local);
- plano/tier;
- status.

**2.2 Estado atual:**
- tabelas e views por schema (`public`, `private`, `storage`);
- extensões instaladas, confirmando `pgcrypto` no schema `extensions` (usada por `extensions.gen_random_bytes`);
- histórico de migrações remoto;
- buckets;
- funções em `public` e `private`;
- quantidade de usuários em `auth.users` (só o número).

**2.3 Advisors** de segurança e de performance: o resultado atual, antes da aplicação.

**2.4 Compatibilidade:** para cada migração local, avalie se ela aplica limpa no estado remoto. Aponte objetos que já existam, extensões ausentes e diferenças de versão do Storage, por exemplo no guard de delete e em `storage.extension()` e `storage.foldername()`.

**2.5 Configuração de Auth remota**, como está hoje (leitura pelo painel, sem alterar):
- `site_url` e URLs de redirecionamento;
- confirmação de e-mail;
- senha mínima;
- provedores ativos;
- SMTP (padrão ou próprio);
- templates.

**2.6 Plano de aplicação**, para o responsável aprovar:
1. **Canal de escrita:**
   - **(A) CLI, preferencial:** `supabase link` e `db push --dry-run`, com o access token e a senha do banco fornecidos pelo responsável **só no seu ambiente**. Preserva as versões das migrações.
   - **(B) Conector em modo escrita, temporário:** só se o responsável preferir. Registre o mapeamento entre versão local e versão remota.
2. **Ordem:** as 4 migrações, na ordem dos arquivos.
3. **Checklist de Auth para o responsável aplicar no painel:**
   - senha mínima 8;
   - confirmação de e-mail ligada;
   - templates da Etapa 1;
   - `site_url` e URLs de redirecionamento: o domínio de produção ainda não existe (Fase 6). Proponha o valor provisório e explique.
4. **Google:** **fora** desta aplicação. Depende de o responsável criar as credenciais no Google Cloud. Liste os passos e as URLs de callback.
5. **SMTP:** o SMTP padrão do Supabase tem limite baixo de envio. Registre o limite atual documentado e deixe a escolha de um SMTP próprio como **decisão do responsável**, sem contratar nada.
6. **Rollback:** o que fazer se uma migração falhar no meio. O `db push` aplica cada arquivo em transação. Diga o que fica aplicado e como reverter sem perder dados; no projeto vazio, basta reverter os objetos criados.

**Ao terminar as etapas 1 e 2:** abra o PR e **pare**. Não avance para a etapa 3 por conta própria.

---

### ETAPA 3 — Aplicação e verificação remota (somente após os dois portões)

Comece só quando **as duas** condições forem verdadeiras:
- (a) o orquestrador aprovou o plano no PR;
- (b) o responsável escreveu na sessão a autorização, nomeando o canal (A ou B).

1. Aplique as 4 migrações pelo canal autorizado. Com a CLI, rode `db push --dry-run` primeiro e cole a saída.
2. **Verificação remota**, só com leitura (consultas ao catálogo, sem criar dados):
   - **SEC-16:** todas as tabelas de `public` com RLS.
   - **SEC-10:** `anon` sem privilégio em tabelas e views de `public`, e sem `EXECUTE` nas RPCs.
   - **SEC-15:** toda função `security definer` com `search_path` vazio. A lista de funções e de políticas tem de bater com a do banco local; compare as contagens por tabela.
   - **SEC-19 e SEC-11:** `authenticated` sem `SELECT` em `ai_provider_configs.secret_ref` e sem `INSERT` em `survey_tickets.token`.
   - **SEC-09:** bucket `evaluation-files` privado, com 20 MiB e a lista MIME exata.
   - **Seed:** o trigger de seed existe. Nenhuma organização é criada nesta tarefa.
   - **Advisors** de segurança depois da aplicação: zero itens de nível ERROR/WARN atribuíveis às migrações. Justifique cada um que restar.
3. Para os ajustes de Auth do checklist, peça ao responsável que os aplique no painel, ou aplique você mesmo **se** ele autorizar o canal. Confirme por leitura.
4. Atualize o PR com as saídas e com a comparação local × remoto.

### 4. Fora do escopo
- Publicar o frontend; o domínio de produção fica para a Fase 6.
- Google em produção.
- SMTP próprio.
- Edge Functions (Fase 3).
- Criar o primeiro admin da plataforma e as organizações: o responsável faz isso no momento de divulgar (D-023), com orientação em tarefa própria.
- Job de órfãos.
- LGPD (SEC-21).
- Botão "Sair" no celular (Fase 4).

### 5. Critérios de aceitação
| # | Critério | Evidência |
|---|---|---|
| 1 | Senha mínima 8 no servidor local | teste manual §1.3 |
| 2 | Confirmação e recuperação funcionam em outro navegador (`token_hash`) | testes da §1.2 + roteiro §1.3 |
| 3 | Inventário remoto completo, sem segredos nem dados pessoais | relatório §2.1–2.5 |
| 4 | Plano de aplicação com canal, ordem, checklist de Auth, Google, SMTP e rollback | relatório §2.6 |
| 5 | Nenhuma escrita remota nas etapas 1–2 | declaração + lista de chamadas feitas ao conector |
| 6 | (Etapa 3) migrações aplicadas e verificação SEC-09/10/11/15/16/19 igual ao local | saídas coladas |
| 7 | Lint, testes e build verdes; `supabase test db` verde | saídas |

### 6. Entrega
PR `TASK-015: Auth por token_hash, inventário remoto e plano de aplicação` para `main`, com o relatório do `AGENTS.md`, as saídas reais e a **lista de todas as chamadas feitas ao conector**: ferramenta e finalidade. Não faça merge. Depois da etapa 3, atualize o mesmo PR, ou abra `TASK-015b`, se o primeiro já tiver sido mesclado.

## FIM DO PROMPT
