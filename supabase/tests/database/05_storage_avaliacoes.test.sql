-- TASK-013 — Storage privado, políticas por persona, registro e órfãos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(96);

-- Dados sintéticos; SQL em storage.objects só simula a API nesta transação.
-- Em produção, a remoção dos bytes deve sempre usar a API de Storage.
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role',case when p_uid is null then 'anon' else 'authenticated' end)::text,true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end; $$;
insert into public.organizations (id,name) values ('a1300000-0000-4000-8000-000000000007','Empresa Sintética Storage X'),('a1300000-0000-4000-8000-000000000008','Empresa Sintética Storage Y');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000001','admin@storage.test',now(),'{}');
insert into public.platform_admins (user_id) values ('a1300000-0000-4000-8000-000000000001');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000002','supX@storage.test',now(),'{}');
insert into public.memberships (user_id,organization_id,role) values ('a1300000-0000-4000-8000-000000000002','a1300000-0000-4000-8000-000000000007','supervisor');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000003','anaA@storage.test',now(),'{}');
insert into public.memberships (user_id,organization_id,role) values ('a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000007','analista');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000004','anaB@storage.test',now(),'{}');
insert into public.memberships (user_id,organization_id,role) values ('a1300000-0000-4000-8000-000000000004','a1300000-0000-4000-8000-000000000007','analista');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000005','supY@storage.test',now(),'{}');
insert into public.memberships (user_id,organization_id,role) values ('a1300000-0000-4000-8000-000000000005','a1300000-0000-4000-8000-000000000008','supervisor');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('a1300000-0000-4000-8000-000000000006','anaY@storage.test',now(),'{}');
insert into public.memberships (user_id,organization_id,role) values ('a1300000-0000-4000-8000-000000000006','a1300000-0000-4000-8000-000000000008','analista');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000009','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','rascunho');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000010','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000004','a1300000-0000-4000-8000-000000000004','rascunho');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000011','a1300000-0000-4000-8000-000000000008','prints','a1300000-0000-4000-8000-000000000006','a1300000-0000-4000-8000-000000000006','rascunho');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000012','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','transcrito');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000013','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','analisado');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000014','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','curado');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000015','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','rascunho');
insert into public.evaluations (id,organization_id,source,analyst_user_id,created_by,status) values ('a1300000-0000-4000-8000-000000000016','a1300000-0000-4000-8000-000000000007','prints','a1300000-0000-4000-8000-000000000003','a1300000-0000-4000-8000-000000000003','rascunho');

-- Bucket e conversão segura de caminhos.
select is((select count(*)::int from storage.buckets where id='evaluation-files' and name=id and not public and file_size_limit=20971520), 1, 'bucket privado com limite de 20 MiB');
select set_eq($$ select unnest(allowed_mime_types) from storage.buckets where id='evaluation-files' $$, array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'lista MIME exata');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'), 'a1300000-0000-4000-8000-000000000009'::uuid, 'caminho válido resolve a avaliação');
select is(private.storage_eval_id(''), null::uuid, 'caminho inválido retorna NULL: ');
select is(private.storage_eval_id('x'), null::uuid, 'caminho inválido retorna NULL: x');
select is(private.storage_eval_id('x/y/z.png'), null::uuid, 'caminho inválido retorna NULL: x/y/z.png');
select is(private.storage_eval_id('errado/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'), null::uuid, 'caminho inválido retorna NULL: errado/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/errado/a1300000-0000-4000-8000-000000000017.png'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007/errado/a1300000-0000-4000-8000-000000000017.png');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png/extra'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png/extra');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.exe'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.exe');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.PNG'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.PNG');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/arquivo.png'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/arquivo.png');
select is(private.storage_eval_id('/a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'), null::uuid, 'caminho inválido retorna NULL: /a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000007//a1300000-0000-4000-8000-000000000009//a1300000-0000-4000-8000-000000000017.png'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000007//a1300000-0000-4000-8000-000000000009//a1300000-0000-4000-8000-000000000017.png');
select is(private.storage_eval_id('a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'), null::uuid, 'caminho inválido retorna NULL: a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png');
select is(private.storage_eval_id(null), null::uuid, 'caminho nulo retorna NULL');

-- INSERT com identidade real de cada persona.
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'A envia PNG na própria avaliação');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000010/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'A não envia na avaliação de B');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000011/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'A não envia na organização Y');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000018.png'',''a1300000-0000-4000-8000-000000000004'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'A não forja owner B');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000018.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'organização do caminho deve coincidir com avaliação');
select throws_ok('insert into storage.objects (bucket_id,name,owner) values (''evaluation-files'',''malformado'',''a1300000-0000-4000-8000-000000000003'')', '42501', null, 'caminho inválido é recusado por RLS, sem erro de cast');
select throws_ok('insert into storage.objects (bucket_id,name,owner) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/nao-uuid/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'')', '42501', null, 'caminho inválido é recusado por RLS, sem erro de cast');
select throws_ok('insert into storage.objects (bucket_id,name,owner) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.exe'',''a1300000-0000-4000-8000-000000000003'')', '42501', null, 'caminho inválido é recusado por RLS, sem erro de cast');
select throws_ok('insert into storage.objects (bucket_id,name,owner) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/sem-uuid.png'',''a1300000-0000-4000-8000-000000000003'')', '42501', null, 'caminho inválido é recusado por RLS, sem erro de cast');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000013/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'A não envia em analisado');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000014/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'A não envia em curado');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000012/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'A envia em transcrito');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '23505', null, 'nome já existente não é sobrescrito');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000005');
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000018.png'',''a1300000-0000-4000-8000-000000000005'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'supervisor Y não envia em X');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000004');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000010/a1300000-0000-4000-8000-000000000018.png'',''a1300000-0000-4000-8000-000000000004'',''{"mimetype":"image/png","size":68}'')', 'B envia em sua avaliação');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000006');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000011/a1300000-0000-4000-8000-000000000019.png'',''a1300000-0000-4000-8000-000000000006'',''{"mimetype":"image/png","size":68}'')', 'analista Y envia em Y');
reset role; select pg_temp.login(null);
select throws_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', '42501', null, 'anon não envia');

-- SELECT e UPDATE: sem sobrescrita mesmo para gestores/admin.
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 2, 'anaA: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'anaA: UPDATE não altera objeto algum');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000004');
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 1, 'anaB: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'anaB: UPDATE não altera objeto algum');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 3, 'supX: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'supX: UPDATE não altera objeto algum');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000005');
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 1, 'supY: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'supY: UPDATE não altera objeto algum');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000001');
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 4, 'admin: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'admin: UPDATE não altera objeto algum');
reset role; select pg_temp.login(null);
select is((select count(*)::int from storage.objects where bucket_id='evaluation-files'), 0, 'anon: contagem visível de objetos');
select is_empty($$ update storage.objects set metadata = '{"size":999}' where bucket_id='evaluation-files' returning id $$, 'anon: UPDATE não altera objeto algum');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select is_empty($$ select 1 from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000010/a1300000-0000-4000-8000-000000000018.png' $$, 'A não vê objeto de B');
select is_empty($$ select 1 from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000011/a1300000-0000-4000-8000-000000000019.png' $$, 'A não vê objeto de Y');
select is((select count(*)::int from public.evaluation_files), 2, 'A lê somente os próprios registros');
select throws_ok('insert into public.evaluation_files (organization_id,evaluation_id,storage_path,kind) values (''a1300000-0000-4000-8000-000000000007'',''a1300000-0000-4000-8000-000000000009'',''forjado'',''print'')', '42501', null, 'escrita direta em evaluation_files é recusada');
select throws_ok('update public.evaluation_files set kind=''txt''', '42501', null, 'escrita direta em evaluation_files é recusada');
select throws_ok('delete from public.evaluation_files', '42501', null, 'escrita direta em evaluation_files é recusada');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000002');
select is_empty($$ select 1 from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000011/a1300000-0000-4000-8000-000000000019.png' $$, 'supervisor X não vê objeto de Y');
select is((select count(*)::int from public.evaluation_files), 3, 'supervisor X lê arquivos de X');
select throws_ok('delete from public.evaluation_files', '42501', null, 'gestor também não remove registro diretamente');

-- Trigger registra todos os tipos e metadados.
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.jpg'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload jpg aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.jpg'), 'print'::text, 'extensão jpg registrada como print');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.jpeg'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload jpeg aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.jpeg'), 'print'::text, 'extensão jpeg registrada como print');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.webp'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload webp aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.webp'), 'print'::text, 'extensão webp registrada como print');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.pdf'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload pdf aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.pdf'), 'pdf'::text, 'extensão pdf registrada como pdf');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.txt'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload txt aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.txt'), 'txt'::text, 'extensão txt registrada como txt');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.csv'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload csv aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.csv'), 'planilha'::text, 'extensão csv registrada como planilha');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.xlsx'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'upload xlsx aceito');
select is((select kind from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.xlsx'), 'planilha'::text, 'extensão xlsx registrada como planilha');
select results_eq($$ select organization_id,evaluation_id,kind,mime_type,size_bytes,created_by from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' $$, $$ values ('a1300000-0000-4000-8000-000000000007'::uuid,'a1300000-0000-4000-8000-000000000009'::uuid,'print'::text,'image/png'::text,68::bigint,'a1300000-0000-4000-8000-000000000003'::uuid) $$, 'PNG registra tenant, avaliação, MIME, tamanho e owner');

-- DELETE, transição de status e exclusão ordenada do rascunho (§8b).
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000004');
select is_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' returning id $$, 'B não apaga objeto de A');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000015/a1300000-0000-4000-8000-000000000020.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'A envia no rascunho destinado à exclusão');
select throws_ok('delete from public.evaluations where id=''a1300000-0000-4000-8000-000000000015''', '23503', null, 'FK impede apagar rascunho com arquivo');
select isnt_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000015/a1300000-0000-4000-8000-000000000020.png' returning id $$, 'owner apaga objeto em rascunho');
select is_empty($$ select 1 from public.evaluation_files where evaluation_id='a1300000-0000-4000-8000-000000000015' $$, 'trigger remove registro junto com objeto');
select isnt_empty($$ delete from public.evaluations where id='a1300000-0000-4000-8000-000000000015' returning id $$, 'rascunho pode ser apagado após remover arquivo');
reset role; update public.evaluations set status='analisado' where id='a1300000-0000-4000-8000-000000000009';
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select is_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' returning id $$, 'owner não apaga após analisado');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000005');
select is_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' returning id $$, 'gestor Y não apaga arquivo de X');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000002');
select isnt_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' returning id $$, 'gestor X apaga mesmo após analisado');
select is_empty($$ select 1 from public.evaluation_files where storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000009/a1300000-0000-4000-8000-000000000017.png' $$, 'registro removido também no DELETE de gestor');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000001');
select isnt_empty($$ delete from storage.objects where bucket_id='evaluation-files' and name='a1300000-0000-4000-8000-000000000008/a1300000-0000-4000-8000-000000000011/a1300000-0000-4000-8000-000000000019.png' returning id $$, 'admin apaga arquivo de Y');

-- Órfãos: simula inconsistência administrativa, sem mexer nos bytes reais.
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000003');
select lives_ok('insert into storage.objects (bucket_id,name,owner,metadata) values (''evaluation-files'',''a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000016/a1300000-0000-4000-8000-000000000021.png'',''a1300000-0000-4000-8000-000000000003'',''{"mimetype":"image/png","size":68}'')', 'cria objeto para simulação de avaliação removida');
reset role;
delete from public.evaluation_files where evaluation_id='a1300000-0000-4000-8000-000000000016';
delete from public.evaluations where id='a1300000-0000-4000-8000-000000000016';
insert into public.evaluation_files (organization_id,evaluation_id,storage_path,kind)
values ('a1300000-0000-4000-8000-000000000007','a1300000-0000-4000-8000-000000000010','sintetico/sem-objeto.txt','txt');
select isnt_empty($$ select 1 from private.orphan_evaluation_files where orphan_type='object_without_evaluation' and storage_path='a1300000-0000-4000-8000-000000000007/a1300000-0000-4000-8000-000000000016/a1300000-0000-4000-8000-000000000021.png' $$, 'view lista objeto cuja avaliação foi removida');
select isnt_empty($$ select 1 from private.orphan_evaluation_files where orphan_type='record_without_object' and storage_path='sintetico/sem-objeto.txt' $$, 'view lista registro sem objeto');
select ok(not has_table_privilege('authenticated','private.orphan_evaluation_files','SELECT'), 'authenticated sem SELECT na view de órfãos');
select ok(not has_table_privilege('anon','private.orphan_evaluation_files','SELECT'), 'anon sem SELECT na view de órfãos');
select ok(not has_table_privilege('service_role','private.orphan_evaluation_files','SELECT'), 'service_role sem SELECT na view de órfãos');
reset role; select pg_temp.login('a1300000-0000-4000-8000-000000000001');
select throws_ok('select * from private.orphan_evaluation_files', '42501', null, 'nem admin da API lê a view privada');
reset role;

-- Segurança estrutural (SEC-15/16), ausência de políticas UPDATE e anon.
select is_empty($$ select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') and not c.relrowsecurity $$, 'SEC-16: todas as tabelas public com RLS');
select ok((select relrowsecurity from pg_class where oid='storage.objects'::regclass), 'storage.objects mantém RLS');
select is((select count(*)::int from pg_policy where polrelid='storage.objects'::regclass and polname like 'evaluation_objects_%'), 3, 'só SELECT, INSERT e DELETE para o bucket');
select is_empty($$ select polname from pg_policy where polrelid='storage.objects'::regclass and (polcmd in ('w','*') or 0=any(polroles) or 'anon'::regrole=any(polroles)) $$, 'nenhuma política UPDATE, ALL, public ou anon em storage.objects');
select ok((select not prosecdef and provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='private.storage_eval_id(text)'::regprocedure), 'parser invoker stable com search_path vazio');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.sync_evaluation_file()'::regprocedure), 'trigger SECURITY DEFINER com search_path vazio');
select ok(not has_function_privilege('authenticated','private.sync_evaluation_file()','EXECUTE') and not has_function_privilege('anon','private.sync_evaluation_file()','EXECUTE'), 'API não executa trigger diretamente');
select ok(not has_function_privilege('anon','private.storage_eval_id(text)','EXECUTE'), 'anon não executa parser');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='private.orphan_evaluation_files'::regclass), 'view privada security_invoker');

select * from finish();
rollback;
