# Segurança — Protocolo CX 1.1

Regras obrigatórias para todos os agentes. Cada regra tem um identificador usado na `PARITY_MATRIX.md` e nos testes.

## Papéis

| Papel | Valor | Pode |
|---|---|---|
| Supervisor | `admin` | ler tudo; curar; gerenciar CSAT, pesquisas, configurações, versões do protocolo |
| Analista | `user` | ler e criar as próprias avaliações; editar transcrição em rascunho/transcrito; ver **somente diagnóstico aprovado** e oportunidades aprovadas/ajustadas |
| Anônimo | `anon` | somente a Edge Function de pesquisa pública; **nenhuma** tabela |

## Regras

| ID | Regra | Onde é imposta |
|---|---|---|
| SEC-01 | Nenhum segredo (service_role/secret key, chave de IA, senhas) no repositório ou no bundle do frontend | revisão + varredura de segredos no CI |
| SEC-02 | Frontend usa somente URL do projeto + chave pública (anon/publishable) | `src/lib/env.js` |
| SEC-03 | `role` e `user_id` nunca aceitos do cliente; derivados de `auth.uid()` e `profiles` | RLS, RPC, Edge Functions |
| SEC-04 | Usuário não altera o próprio papel | RLS + trigger em `profiles` |
| SEC-05 | Analista lê apenas registros com `analyst_user_id = auth.uid()` | RLS |
| SEC-06 | Scores, oportunidades e diagnóstico só visíveis ao analista após `diagnosis_status='aprovado'`; oportunidades só `aprovada`/`ajustada` | RLS (D-010, D-011) |
| SEC-07 | Estados de curadoria alterados somente por supervisor, via RPC, com log na mesma transação | RPC + trigger |
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

## Testes exigidos (a partir da Fase 2)
Para cada tabela: matriz `{supervisor, analista A, analista B, anon} × {select, insert, update, delete}` com resultado esperado, executada contra Supabase local. Casos obrigatórios: analista A não lê dados de B; analista não lê diagnóstico pendente por nenhuma rota (tabela, view, RPC, Storage); analista não aprova oportunidade por chamada direta; ninguém altera `curation_logs`; `anon` não lê `survey_tickets`.

## Processo para mudanças remotas
Nenhuma migração ou configuração é aplicada ao projeto Supabase remoto sem: (1) conteúdo e finalidade apresentados, (2) sintaxe validada localmente, (3) políticas revisadas, (4) testes demonstrados, (5) autorização explícita do responsável. O MCP do Supabase permanece somente leitura; não contornar por outro canal.
