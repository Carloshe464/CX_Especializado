-- TASK-010 — Perfil automático e RPCs de entrada: create_organization,
-- join_organization_by_domain e set_member_role (SEC-03, SEC-22, D-023).
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Troca a identidade da sessão para um usuário autenticado (chamar como postgres).
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Personas sintéticas.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'admin@plataforma.test', now(), '{"full_name": "Admin da Plataforma"}'),
  ('00000000-0000-4000-8000-000000000002', 'supervisor@exemplo.test', now(), '{"name": "Supervisor X"}'),
  ('00000000-0000-4000-8000-000000000003', 'analista.a@exemplo.test', now(), '{"full_name": "Analista A"}'),
  ('00000000-0000-4000-8000-000000000004', 'analista.b@exemplo.test', now(), '{"full_name": "Analista B"}'),
  ('00000000-0000-4000-8000-000000000005', 'supervisor@outraempresa.test', now(), '{"full_name": "Supervisor Y"}'),
  ('00000000-0000-4000-8000-000000000006', 'pessoa@semempresa.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000007', 'nao.verificado@exemplo.test', null, '{}'),
  ('00000000-0000-4000-8000-000000000008', 'pessoa@gmail.com', now(), '{}'),
  ('00000000-0000-4000-8000-000000000009', 'segundo@exemplo.test', now(), '{}');
insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-000000000001');

-- 4. Trigger de perfil ------------------------------------------------------
select results_eq(
  $$ select email, full_name from public.profiles where id = '00000000-0000-4000-8000-000000000003' $$,
  $$ values ('analista.a@exemplo.test'::text, 'Analista A'::text) $$,
  'inserir em auth.users cria o perfil com e-mail e full_name'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'Supervisor X', 'full_name usa raw_user_meta_data->>name como alternativa'
);
update auth.users set email = 'pessoa.nova@semempresa.test' where id = '00000000-0000-4000-8000-000000000006';
select is(
  (select email from public.profiles where id = '00000000-0000-4000-8000-000000000006'),
  'pessoa.nova@semempresa.test', 'mudar o e-mail no Auth sincroniza profiles.email'
);
update auth.users set email = 'pessoa@semempresa.test' where id = '00000000-0000-4000-8000-000000000006';

-- 5. create_organization: autoatendimento -----------------------------------
select pg_temp.login('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.create_organization('Empresa X', 'exemplo.test') $$,
  'CX002', null, 'recusa e-mail não verificado');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.create_organization('   ', null) $$,
  'CX004', null, 'recusa nome vazio');
select throws_ok($$ select public.create_organization('Empresa X', 'outraempresa.test') $$,
  'CX005', null, 'recusa domínio diferente do e-mail');
select throws_ok($$ select public.create_organization('Empresa X', 'exemplo') $$,
  'CX008', null, 'recusa domínio em formato inválido');
select lives_ok($$ select public.create_organization('  Empresa X  ', '  Exemplo.TEST ') $$,
  'caminho feliz: cria a organização com domínio normalizado');
reset role;

select results_eq(
  $$ select o.name, m.role, d.domain, o.created_by from public.organizations o
     join public.memberships m on m.organization_id = o.id
     join public.organization_domains d on d.organization_id = o.id
     where m.user_id = '00000000-0000-4000-8000-000000000002' $$,
  $$ values ('Empresa X'::text, 'supervisor'::text, 'exemplo.test'::text,
             '00000000-0000-4000-8000-000000000002'::uuid) $$,
  'criador vira supervisor; nome e domínio gravados normalizados'
);

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.create_organization('Outra Empresa', null) $$,
  'CX003', null, 'recusa usuário já vinculado');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000008');
select throws_ok($$ select public.create_organization('Empresa Gmail', 'gmail.com') $$,
  'CX006', null, 'recusa domínio público (gmail.com)');
reset role;
select ok(not exists (select 1 from public.memberships where user_id = '00000000-0000-4000-8000-000000000008'),
  'recusa não deixa vínculo parcial');

select pg_temp.login('00000000-0000-4000-8000-000000000009');
select throws_ok($$ select public.create_organization('Empresa Concorrente', 'exemplo.test') $$,
  'CX007', null, 'recusa domínio já usado por outra organização');
reset role;

-- 5. create_organization: caminho do admin da plataforma (D-023) -------------
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.create_organization('Empresa Pública', 'gmail.com') $$,
  'CX006', null, 'admin: recusa domínio público');
select throws_ok($$ select public.create_organization('Empresa Duplicada', 'exemplo.test') $$,
  'CX007', null, 'admin: recusa domínio já em uso');
select isnt(public.create_organization('Empresa Y', 'outraempresa.test'), null,
  'admin cria organização com domínio de outra empresa (outraempresa.test)');
reset role;

select ok(not exists (select 1 from public.memberships where user_id = '00000000-0000-4000-8000-000000000001'),
  'admin não ganha vínculo ao criar a organização');
select results_eq(
  $$ select o.name, o.created_by from public.organizations o
     join public.organization_domains d on d.organization_id = o.id where d.domain = 'outraempresa.test' $$,
  $$ values ('Empresa Y'::text, '00000000-0000-4000-8000-000000000001'::uuid) $$,
  'organização do admin gravada com o domínio informado'
);

-- Fluxo do lançamento: usuário do domínio entra como analista e o admin o promove.
select pg_temp.login('00000000-0000-4000-8000-000000000005');
select lives_ok($$ select public.join_organization_by_domain() $$,
  'usuário de outraempresa.test entra na organização criada pelo admin');
reset role;
select is((select role from public.memberships where user_id = '00000000-0000-4000-8000-000000000005'),
  'analista', 'o primeiro usuário entra como analista');

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000005', 'supervisor') $$,
  'admin promove o primeiro supervisor');
reset role;
select is((select role from public.memberships where user_id = '00000000-0000-4000-8000-000000000005'),
  'supervisor', 'supervisor Y promovido pelo admin');

select throws_ok(
  $$ insert into public.organization_domains (organization_id, domain)
     select id, 'hotmail.com' from public.organizations limit 1 $$,
  'CX006', null, 'trigger rejeita domínio público mesmo em inserção direta'
);

-- 6. join_organization_by_domain -------------------------------------------
create temp table org_x as select organization_id from public.organization_domains where domain = 'exemplo.test';
grant select on org_x to authenticated;
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select is(public.join_organization_by_domain(), (select organization_id from org_x),
  'analista A entra na organização do domínio do e-mail');
select throws_ok($$ select public.join_organization_by_domain() $$,
  'CX003', null, 'recusa usuário já vinculado');
reset role;

select is((select role from public.memberships where user_id = '00000000-0000-4000-8000-000000000003'),
  'analista', 'entrada por domínio é sempre como analista');

select pg_temp.login('00000000-0000-4000-8000-000000000004');
select lives_ok($$ select public.join_organization_by_domain() $$, 'analista B entra na organização X');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.join_organization_by_domain() $$,
  'CX009', 'Nenhuma empresa cadastrada para o domínio do seu e-mail.', 'recusa domínio sem empresa');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.join_organization_by_domain() $$,
  'CX002', null, 'recusa e-mail não verificado');
reset role;

-- 7. set_member_role --------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000003', 'supervisor') $$,
  'CX010', null, 'supervisor Y não altera membro de X');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000004', 'supervisor') $$,
  'CX010', null, 'analista não altera papel de ninguém');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000003', 'supervisor') $$,
  'CX012', null, 'analista não altera o próprio papel');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000002', 'analista') $$,
  'CX012', null, 'supervisor não altera o próprio papel');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000003', 'admin') $$,
  'CX011', null, 'recusa papel inválido');
select lives_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000003', 'supervisor') $$,
  'supervisor X promove A');
reset role;

select is((select role from public.memberships where user_id = '00000000-0000-4000-8000-000000000003'),
  'supervisor', 'A agora é supervisor');

-- A rebaixa o supervisor X; depois ninguém consegue rebaixar o último supervisor.
select pg_temp.login('00000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000002', 'analista') $$,
  'supervisor A rebaixa X enquanto houver outro supervisor');
reset role;

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000003', 'analista') $$,
  'CX013', null, 'recusa remover o último supervisor (mesmo para o admin)');
select lives_ok($$ select public.set_member_role('00000000-0000-4000-8000-000000000004', 'supervisor') $$,
  'admin da plataforma altera papel em qualquer organização');
reset role;

select is((select role from public.memberships where user_id = '00000000-0000-4000-8000-000000000004'),
  'supervisor', 'B promovido pelo admin');

-- anon não executa as RPCs.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$ select public.create_organization('Empresa Anônima', null) $$,
  '42501', null, 'anon não executa create_organization');
reset role;

select * from finish();
rollback;
