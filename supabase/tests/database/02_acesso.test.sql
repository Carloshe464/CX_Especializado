-- TASK-010 — Proteção de vínculos (SEC-04), isolamento entre organizações (SEC-18)
-- e funções de papel derivadas só de auth.uid() (SEC-03).
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Troca a identidade da sessão para um usuário autenticado (chamar como postgres).
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Personas sintéticas. A analista A declara "role: supervisor" nos metadados (SEC-03).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'admin@plataforma.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000002', 'supervisor@exemplo.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000003', 'analista.a@exemplo.test', now(), '{"role": "supervisor"}'),
  ('00000000-0000-4000-8000-000000000004', 'analista.b@exemplo.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000005', 'supervisor@outraempresa.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000006', 'pessoa@semempresa.test', now(), '{}');
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-000000000001');

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select public.create_organization('Empresa X', 'exemplo.test');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select public.join_organization_by_domain();
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000004');
select public.join_organization_by_domain();
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000005');
select public.create_organization('Empresa Y', 'outraempresa.test');
reset role;

create temp table orgs as
  select (select organization_id from public.organization_domains where domain = 'exemplo.test') as x,
         (select organization_id from public.organization_domains where domain = 'outraempresa.test') as y;
grant select on orgs to authenticated, anon;

-- 8. SEC-04: nenhuma alteração direta de vínculo pela API -------------------
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select throws_ok($$ update public.memberships set role = 'supervisor' $$, '42501', null,
  'analista não altera role diretamente');
select throws_ok($$ update public.memberships set organization_id = (select y from orgs) $$, '42501', null,
  'analista não altera organization_id diretamente');
select throws_ok($$ update public.memberships set user_id = '00000000-0000-4000-8000-000000000006' $$, '42501', null,
  'analista não altera user_id diretamente');
select throws_ok($$ insert into public.memberships (user_id, organization_id, role)
  values ('00000000-0000-4000-8000-000000000003', (select y from orgs), 'supervisor') $$, '42501', null,
  'analista não insere vínculo diretamente');
select throws_ok($$ delete from public.memberships $$, '42501', null, 'analista não apaga vínculo');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select throws_ok($$ update public.memberships set role = 'supervisor'
  where user_id = '00000000-0000-4000-8000-000000000003' $$, '42501', null,
  'supervisor não altera role diretamente');
select throws_ok($$ update public.memberships set organization_id = (select y from orgs) $$, '42501', null,
  'supervisor não altera organization_id diretamente');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select throws_ok($$ update public.memberships set role = 'supervisor' $$, '42501', null,
  'admin não altera role diretamente pela API');
select throws_ok($$ insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-000000000006') $$,
  '42501', null, 'admin não insere em platform_admins pela API');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000006');
select throws_ok($$ insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-000000000006') $$,
  '42501', null, 'authenticated não se torna admin da plataforma');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ update public.memberships set role = 'supervisor' $$, '42501', null, 'anon não altera vínculos');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon não lê profiles');
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anon não lê organizations');
select throws_ok($$ select private.is_platform_admin() $$, '42501', null, 'anon não usa o schema private');
reset role;

-- Trigger como defesa extra, mesmo para o dono das tabelas (painel/banco).
select throws_ok($$ update public.memberships set organization_id = (select y from orgs)
  where user_id = '00000000-0000-4000-8000-000000000003' $$, 'CX015', null,
  'trigger impede trocar a organização de um vínculo');
select throws_ok($$ update public.memberships set user_id = '00000000-0000-4000-8000-000000000006'
  where user_id = '00000000-0000-4000-8000-000000000003' $$, 'CX015', null,
  'trigger impede trocar o usuário de um vínculo');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000003", "role": "authenticated"}', true);
select throws_ok($$ update public.memberships set role = 'supervisor'
  where user_id = '00000000-0000-4000-8000-000000000003' $$, 'CX012', null,
  'trigger impede alterar o próprio papel');
select set_config('request.jwt.claims', '', true);

-- 9. SEC-18: isolamento entre organizações ---------------------------------
select pg_temp.login('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.organizations where id = (select x from orgs))::int, 0,
  'supervisor Y não vê a organização X');
select is((select count(*) from public.organization_domains where organization_id = (select x from orgs))::int, 0,
  'supervisor Y não vê os domínios de X');
select is((select count(*) from public.memberships where organization_id = (select x from orgs))::int, 0,
  'supervisor Y não vê os vínculos de X');
select is((select count(*) from public.profiles where email like '%@exemplo.test')::int, 0,
  'supervisor Y não vê perfis de X');
select is_empty($$ update public.organizations set name = 'Invadida' where id = (select x from orgs) returning id $$,
  'supervisor Y não renomeia a organização X');
select results_eq($$ select count(*)::int from public.memberships $$, $$ values (1) $$,
  'supervisor Y vê só os vínculos de Y');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000003');
select results_eq($$ select user_id from public.memberships $$,
  $$ values ('00000000-0000-4000-8000-000000000003'::uuid) $$, 'analista A vê só a própria linha de memberships');
select results_eq($$ select id from public.profiles $$,
  $$ values ('00000000-0000-4000-8000-000000000003'::uuid) $$, 'analista A vê só o próprio perfil');
select results_eq($$ select id from public.organizations $$, $$ select x from orgs $$,
  'analista A vê a própria organização');
select results_eq($$ select domain from public.organization_domains $$, $$ values ('exemplo.test'::text) $$,
  'analista A vê os domínios da própria organização');
select is_empty($$ select user_id from public.platform_admins $$, 'analista A não vê platform_admins');
select is_empty($$ update public.organizations set name = 'Renomeada' returning id $$,
  'analista não renomeia a organização');
select is_empty($$ update public.profiles set full_name = 'Outro nome'
  where id = '00000000-0000-4000-8000-000000000004' returning id $$, 'analista não altera perfil alheio');
select lives_ok($$ update public.profiles set full_name = 'Analista A' where id = auth.uid() $$,
  'usuário altera o próprio full_name');
select throws_ok($$ update public.profiles set email = 'falso@exemplo.test' where id = auth.uid() $$, '42501', null,
  'usuário não altera o próprio e-mail em profiles');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.memberships)::int, 3, 'supervisor X vê os 3 vínculos de X');
select set_eq($$ select id from public.profiles $$,
  $$ values ('00000000-0000-4000-8000-000000000002'::uuid), ('00000000-0000-4000-8000-000000000003'::uuid),
            ('00000000-0000-4000-8000-000000000004'::uuid) $$, 'supervisor X vê os perfis dos membros de X');
select isnt_empty($$ update public.organizations set name = 'Empresa X Ltda' where id = (select x from orgs) returning id $$,
  'supervisor X renomeia a própria organização');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select is((select count(*) from public.organizations)::int, 2, 'admin vê todas as organizações');
select is((select count(*) from public.organization_domains)::int, 2, 'admin vê todos os domínios');
select is((select count(*) from public.memberships)::int, 4, 'admin vê todos os vínculos');
select is((select count(*) from public.profiles)::int, 6, 'admin vê todos os perfis');
select results_eq($$ select user_id from public.platform_admins $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::uuid) $$, 'admin vê a própria linha de platform_admins');
reset role;

-- 10. SEC-03: funções de papel por persona ---------------------------------
create temp table esperado (uid uuid, org_atual text, membro_x bool, supervisor_x bool, supervisor_y bool, admin bool);
insert into esperado values
  ('00000000-0000-4000-8000-000000000001', null, false, false, false, true),
  ('00000000-0000-4000-8000-000000000002', 'x', true, true, false, false),
  ('00000000-0000-4000-8000-000000000003', 'x', true, false, false, false),
  ('00000000-0000-4000-8000-000000000004', 'x', true, false, false, false),
  ('00000000-0000-4000-8000-000000000005', 'y', false, false, true, false),
  ('00000000-0000-4000-8000-000000000006', null, false, false, false, false);
grant select on esperado to authenticated;

create function pg_temp.papeis() returns table (org_atual text, membro_x bool, supervisor_x bool, supervisor_y bool, admin bool)
language sql as $$
  select case private.current_org_id() when (select x from orgs) then 'x' when (select y from orgs) then 'y' end,
         private.is_member((select x from orgs)), private.is_supervisor((select x from orgs)),
         private.is_supervisor((select y from orgs)), private.is_platform_admin()
$$;

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: admin da plataforma');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000002');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: supervisor X');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: analista A ignora role em raw_user_meta_data');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000004');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: analista B');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000005');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: supervisor Y');
reset role;
select pg_temp.login('00000000-0000-4000-8000-000000000006');
select results_eq('select * from pg_temp.papeis()',
  $$ select org_atual, membro_x, supervisor_x, supervisor_y, admin from esperado where uid = auth.uid() $$,
  'funções de papel: usuário sem vínculo');
reset role;

-- Claims forjadas no JWT (ex.: user_role) também não concedem papel.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000003", "role": "authenticated", "user_role": "supervisor", "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select ok(not private.is_supervisor((select x from orgs)) and not private.is_platform_admin(),
  'claims extras no JWT não concedem papel');
reset role;

select * from finish();
rollback;
