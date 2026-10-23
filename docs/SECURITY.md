# Segurança — Protocolo CX 1.1

Regras obrigatórias para todos os agentes. Cada regra tem um identificador usado na `PARITY_MATRIX.md` e nos testes.

## Papéis

| Papel | Valor | Pode |
|---|---|---|
| Admin da plataforma | `platform_admins` | acesso global entre organizações; gestão de organizações (D-017) |
| Supervisor | `supervisor` (por organização) | ler tudo da organização; avaliar com prioridade; gerenciar CSAT, pesquisas, configurações, provedor de IA, versões do protocolo |
| Analista | `analista` (por organização) | ler e criar as próprias avaliações; ver a análise da IA assim que pronta; validar diagnóstico e oportunidades das próprias avaliações (D-011) |
| Anônimo | `anon` | somente a Edge Function de pesquisa pública; **nenhuma** tabela |

## Regras

| ID | Regra | Onde é imposta |
|---|---|---|
| SEC-01 | Nenhum segredo (service_role/secret key, chave de IA, senhas) no repositório ou no bundle do frontend | revisão + varredura de segredos no CI |
| SEC-02 | Frontend usa somente URL do projeto + chave pública (anon/publishable) | `src/lib/env.js` |
| SEC-03 | `role` e `user_id` nunca aceitos do cliente; derivados de `auth.uid()`, `memberships` e `platform_admins` | RLS, RPC, Edge Functions |
| SEC-04 | Usuário não altera o próprio papel nem a própria organização | RLS + trigger em `memberships`; `platform_admins` sem escrita pela API |
| SEC-05 | Analista lê apenas registros da sua organização com `analyst_user_id = auth.uid()` | RLS |
| SEC-06 | Analista lê a análise só das próprias avaliações e grava validação só como ele mesmo; não lê nem altera a avaliação de outro analista; "Meu desenvolvimento" usa só itens com veredito efetivo positivo | RLS + RPC (D-011) |
| SEC-07 | Veredito do supervisor gravado somente por supervisor da mesma organização, via RPC, com log na mesma transação; prevalece sobre o do analista | RPC + trigger |
| SEC-08 | `curation_logs` é append-only (sem UPDATE/DELETE pela API) | RLS + revoke |
| SEC-09 | Buckets privados; acesso por política espelhando a avaliação; URLs assinadas com TTL | Storage policies |
| SEC-10 | Nenhuma política para `anon` em tabelas internas | RLS + teste |
| SEC-11 | Token de pesquisa gerado no servidor, ≥128 bits, uso único, com expiração e rate limit | Edge Function `survey` |
| SEC-12 | Edge Functions privilegiadas validam JWT e papel antes de agir | código + testes |
| SEC-13 | CSAT real nunca enviado ao modelo de IA | Edge Function de análise + teste |
| SEC-14 | Logs de falha de IA sem PII (sem transcrição, nomes ou comentários) | `ai_failures` |
| SEC-15 | Funções `SECURITY DEFINER` com `search_path` fixo e checagem explícita de papel | revisão de migrações |
| SEC-16 | RLS habilitada em **todas** as tabelas do schema `public` | teste automatizado |
| SEC-17 | Dados de teste sintéticos/anonimizados | revisão |
| SEC-18 | Isolamento total entre organizações (inclusive supervisor); só `platform_admins` cruza organizações | RLS + teste |
| SEC-19 | Chave da API de IA cifrada no servidor (Vault); nunca devolvida ao navegador; troca só por supervisor/admin | Edge Function + RLS |
| SEC-20 | Extensão: token de sessão com escopo mínimo, sem chave de IA; arquivos locais só na pasta escolhida; envio ao sistema só por ação/regra explícita | revisão da extensão |
| SEC-22 | Entrada por domínio: e-mail verificado, domínios públicos bloqueados, domínio único por organização, entrada sempre como analista | trigger/Edge Function de onboarding + teste |
| SEC-21 | Transcrições contêm dados pessoais de clientes: aviso de privacidade (LGPD), retenção definida e exclusão sob demanda | política + implementação |

## Testes exigidos (a partir da Fase 2)
Para cada tabela: matriz `{admin da plataforma, supervisor org X, analista A org X, analista B org X, supervisor org Y, anon} × {select, insert, update, delete}` com resultado esperado, executada contra Supabase local. Casos obrigatórios: organização X não lê nada da organização Y; analista A não lê dados de B; analista não grava veredito de supervisor nem altera validação alheia por chamada direta; ninguém altera `curation_logs`; `anon` não lê `survey_tickets`.

## Processo para mudanças remotas
Nenhuma migração ou configuração é aplicada ao projeto Supabase remoto sem: (1) conteúdo e finalidade apresentados, (2) sintaxe validada localmente, (3) políticas revisadas, (4) testes demonstrados, (5) autorização explícita do responsável. O MCP do Supabase permanece somente leitura; não contornar por outro canal.
