-- TASK-010 — Estrutura: RLS (SEC-16), search_path das funções SECURITY DEFINER (SEC-15),
-- ausência de privilégios para anon (SEC-10) e isolamento do schema private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- SEC-16: todas as tabelas de public têm RLS habilitada.
select set_eq(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') $$,
  array['profiles', 'organizations', 'organization_domains', 'memberships', 'platform_admins'],
  'public contém exatamente as tabelas de identidade'
);
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'SEC-16: todas as tabelas de public têm relrowsecurity = true'
);

-- SEC-15: funções SECURITY DEFINER de public e private têm search_path fixo.
select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'SEC-15: toda função security definer tem search_path fixado'
);
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef $$,
  array['create_organization', 'join_organization_by_domain', 'set_member_role'],
  'em public, só as RPCs de entrada são security definer'
);
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.prosecdef $$,
  array['current_org_id', 'is_member', 'is_supervisor', 'is_platform_admin',
        'handle_new_user', 'handle_user_email_change', 'reject_public_domain'],
  'funções privilegiadas restantes ficam no schema private'
);

-- SEC-10: anon não tem privilégio em nenhuma tabela de public.
select is_empty(
  $$ select c.relname || ':' || priv from pg_class c join pg_namespace n on n.oid = c.relnamespace
     cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) priv
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and has_table_privilege('anon', c.oid, priv) $$,
  'SEC-10: anon sem SELECT/INSERT/UPDATE/DELETE em public'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'SEC-10: anon não executa as RPCs de entrada'
);
select is_empty(
  $$ select polname from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and (0 = any(pol.polroles) or 'anon'::regrole = any(pol.polroles)) $$,
  'SEC-10: nenhuma política para anon ou public'
);

-- platform_admins e memberships sem escrita pela API.
select ok(
  not has_table_privilege('authenticated', 'public.platform_admins', 'INSERT')
  and not has_table_privilege('authenticated', 'public.platform_admins', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.platform_admins', 'DELETE'),
  'platform_admins: authenticated sem INSERT/UPDATE/DELETE'
);
select ok(
  not has_table_privilege('authenticated', 'public.memberships', 'INSERT')
  and not has_table_privilege('authenticated', 'public.memberships', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.memberships', 'DELETE'),
  'memberships: authenticated sem INSERT/UPDATE/DELETE'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'profiles: authenticated atualiza só full_name'
);

-- Schema private: anon sem acesso; authenticated só executa as funções de papel.
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon sem USAGE em private');
select ok(not has_table_privilege('authenticated', 'private.public_email_domains', 'SELECT'),
  'authenticated não lê private.public_email_domains');
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'EXECUTE') $$,
  array['current_org_id', 'is_member', 'is_supervisor', 'is_platform_admin'],
  'authenticated executa somente as funções de papel em private'
);

select * from finish();
rollback;
