-- TASK-012 — RLS de negócio, validação do analista, curadoria do supervisor e veredito
-- efetivo (D-011, D-013, D-016, D-024). Dados estritamente sintéticos; tudo é revertido.
begin;
create extension if not exists pgtap with schema extensions;
select plan(207);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Identificadores sintéticos por apelido.
create temp table ids (k text primary key, v uuid not null);
grant select on ids to authenticated, anon;
insert into ids values
  ('admin', 'a1000000-0000-4000-8000-000000000001'),
  ('supX',  'a1000000-0000-4000-8000-000000000002'),
  ('anaA',  'a1000000-0000-4000-8000-000000000003'),
  ('anaB',  'a1000000-0000-4000-8000-000000000004'),
  ('supY',  'a1000000-0000-4000-8000-000000000005'),
  ('semV',  'a1000000-0000-4000-8000-000000000006'),
  ('anaY',  'a1000000-0000-4000-8000-000000000007'),
  ('X', 'b1000000-0000-4000-8000-000000000001'),
  ('Y', 'b1000000-0000-4000-8000-000000000002'),
  ('evalA',  'c1000000-0000-4000-8000-000000000001'),
  ('evalB',  'c1000000-0000-4000-8000-000000000002'),
  ('evalY1', 'c1000000-0000-4000-8000-000000000003'),
  ('evalY2', 'c1000000-0000-4000-8000-000000000004'),
  ('evalA2', 'c1000000-0000-4000-8000-000000000005'),
  ('evalF',  'c1000000-0000-4000-8000-000000000006'),
  ('evalA3', 'c1000000-0000-4000-8000-000000000007'),
  ('runA',   'd1000000-0000-4000-8000-000000000001'),
  ('runB',   'd1000000-0000-4000-8000-000000000002'),
  ('runY1',  'd1000000-0000-4000-8000-000000000003'),
  ('runY2',  'd1000000-0000-4000-8000-000000000004'),
  ('runAold','d1000000-0000-4000-8000-000000000005'),
  ('runF',   'd1000000-0000-4000-8000-000000000006'),
  ('runA3',  'd1000000-0000-4000-8000-000000000007'),
  ('oppA1',  'e1000000-0000-4000-8000-000000000001'),
  ('oppA2',  'e1000000-0000-4000-8000-000000000002'),
  ('oppB1',  'e1000000-0000-4000-8000-000000000003'),
  ('oppB2',  'e1000000-0000-4000-8000-000000000004'),
  ('oppY1a', 'e1000000-0000-4000-8000-000000000005'),
  ('oppY1b', 'e1000000-0000-4000-8000-000000000006'),
  ('oppY2a', 'e1000000-0000-4000-8000-000000000007'),
  ('oppY2b', 'e1000000-0000-4000-8000-000000000008'),
  ('oppAold','e1000000-0000-4000-8000-000000000009'),
  ('oppA31', 'e1000000-0000-4000-8000-00000000000a'),
  ('oppA32', 'e1000000-0000-4000-8000-00000000000b'),
  ('oppA33', 'e1000000-0000-4000-8000-00000000000c'),
  ('csatA',  'f1000000-0000-4000-8000-000000000001'),
  ('csatB',  'f1000000-0000-4000-8000-000000000002'),
  ('csatY1', 'f1000000-0000-4000-8000-000000000003'),
  ('csatY2', 'f1000000-0000-4000-8000-000000000004'),
  ('ticketX','f2000000-0000-4000-8000-000000000001'),
  ('ticketY','f2000000-0000-4000-8000-000000000002'),
  ('fbA',    'f7000000-0000-4000-8000-000000000001'),
  ('fbB',    'f7000000-0000-4000-8000-000000000002'),
  ('pvX11',  'f8000000-0000-4000-8000-000000000001');

create function pg_temp.id(p_k text) returns uuid language sql stable as $$
  select v from pg_temp.ids where k = p_k;
$$;

-- Troca a identidade da sessão (chamar como postgres).
create function pg_temp.login(p_k text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.id(p_k), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  execute 'set local role anon';
end;
$$;

-- Executa um comando e sempre o desfaz. Devolve 'ok:<linhas afetadas>' ou o SQLSTATE.
create function pg_temp.try(p_sql text) returns text language plpgsql as $$
declare
  v_n bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    raise exception 'desfaz' using errcode = 'ZZ999';
  exception
    when sqlstate 'ZZ999' then return 'ok:' || v_n;
    when others then return sqlstate;
  end;
end;
$$;

-- Personas: cria usuário, perfil (trigger) e vínculo.
create function pg_temp.persona(p_k text, p_email text, p_org text, p_role text) returns void
language plpgsql as $$
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (pg_temp.id(p_k), p_email, now(), '{}');
  if p_org is not null then
    insert into public.memberships (user_id, organization_id, role) values (pg_temp.id(p_k), pg_temp.id(p_org), p_role);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Personas e organizações
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name) values
  (pg_temp.id('X'), 'Empresa Sintética X'), (pg_temp.id('Y'), 'Empresa Sintética Y');
select pg_temp.persona('admin', 'admin@plataforma-rls.test', null, null);
insert into public.platform_admins (user_id) values (pg_temp.id('admin'));
select pg_temp.persona('supX', 'supervisor@x-rls.test', 'X', 'supervisor');
select pg_temp.persona('anaA', 'analista.a@x-rls.test', 'X', 'analista');
select pg_temp.persona('anaB', 'analista.b@x-rls.test', 'X', 'analista');
select pg_temp.persona('supY', 'supervisor@y-rls.test', 'Y', 'supervisor');
select pg_temp.persona('anaY', 'analista@y-rls.test', 'Y', 'analista');
select pg_temp.persona('semV', 'pessoa@sem-vinculo-rls.test', null, null);
update public.protocol_versions set id = pg_temp.id('pvX11')
  where organization_id = pg_temp.id('X') and version = 'V1.1';

-- ---------------------------------------------------------------------------
-- 2. evaluations: criação pela API (também monta a massa)
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
select lives_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id, status, transcript)
  values (pg_temp.id('X'), 'X-A', 'texto', pg_temp.id('anaA'), 'transcrito', 'Transcrição sintética A') $$,
  'analista A cria a avaliação do próprio chat (analyst_user_id = A)');
select isnt_empty($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id)
  values (pg_temp.id('X'), 'X-A-RET', 'texto', pg_temp.id('anaA')) returning id $$,
  'INSERT ... RETURNING devolve a linha recém-criada ao analista');
select throws_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id)
  values (pg_temp.id('X'), 'X-A-PARA-B', 'texto', pg_temp.id('anaB')) $$, '42501', null,
  'analista A não cria avaliação para o analista B');
select throws_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_name)
  values (pg_temp.id('X'), 'X-A-NOME', 'texto', 'Nome livre') $$, '42501', null,
  'analista A não cria avaliação só com nome livre');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, status)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA'), 'analisado') $$, '42501', null,
  'INSERT com status analisado falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, status)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA'), 'curado') $$, '42501', null,
  'INSERT com status curado falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, diagnosis_status)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA'), 'aprovado') $$, '42501', null,
  'INSERT com diagnosis_status preenchido falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, supervisor_review)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA'), 'forjado') $$, '42501', null,
  'INSERT com supervisor_review preenchido falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, created_by)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA'), pg_temp.id('anaB')) $$, '42501', null,
  'INSERT com created_by forjado falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id)
  values (pg_temp.id('Y'), 'texto', pg_temp.id('anaA')) $$, '42501', null,
  'INSERT com organization_id de Y falha');
reset role;

select pg_temp.login('supX');
select lives_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id, status, transcript)
  values (pg_temp.id('X'), 'X-B', 'texto', pg_temp.id('anaB'), 'transcrito', 'Transcrição sintética B') $$,
  'supervisor X cria avaliação para o analista B (D-013)');
select throws_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id)
  values (pg_temp.id('X'), 'X-PARA-Y', 'texto', pg_temp.id('anaY')) $$, '42501', null,
  'supervisor X não cria avaliação para usuário de Y');
select lives_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_name)
  values (pg_temp.id('X'), 'X-NOME', 'importacao', 'Analista sem cadastro') $$,
  'supervisor X cria com analyst_user_id nulo e nome livre');
select throws_ok($$ insert into public.evaluations (organization_id, protocol, source)
  values (pg_temp.id('X'), 'X-SEM-ANALISTA', 'texto') $$, '42501', null,
  'supervisor X não cria sem analista nem nome');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id, current_analysis_run_id)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaB'), gen_random_uuid()) $$, '42501', null,
  'INSERT com current_analysis_run_id preenchido falha');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id)
  values (pg_temp.id('Y'), 'texto', pg_temp.id('supX')) $$, '42501', null,
  'supervisor X não cria avaliação na organização Y');
reset role;

select pg_temp.login('admin');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id)
  values (pg_temp.id('X'), 'texto', pg_temp.id('anaA')) $$, '42501', null,
  'admin da plataforma não cria avaliação (não é membro; acesso global é de leitura e gestão)');
reset role;
select pg_temp.login('semV');
select throws_ok($$ insert into public.evaluations (organization_id, source, analyst_user_id)
  values (pg_temp.id('X'), 'texto', pg_temp.id('semV')) $$, '42501', null,
  'usuário sem vínculo não cria avaliação');
reset role;
select pg_temp.anon();
select throws_ok($$ insert into public.evaluations (organization_id, source) values (pg_temp.id('X'), 'texto') $$,
  '42501', null, 'anon não cria avaliação');
reset role;

select pg_temp.login('anaY');
select lives_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id, status)
  values (pg_temp.id('Y'), 'Y-1', 'texto', pg_temp.id('anaY'), 'transcrito') $$, 'analista de Y cria a própria avaliação');
reset role;
select pg_temp.login('supY');
select lives_ok($$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id, status)
  values (pg_temp.id('Y'), 'Y-2', 'texto', pg_temp.id('anaY'), 'transcrito') $$, 'supervisor Y cria avaliação para analista de Y');
reset role;

-- Como postgres: fixa ids conhecidos e remove as linhas auxiliares de criação.
select ok((select created_by = pg_temp.id('anaA') and organization_id = pg_temp.id('X')
  from public.evaluations where protocol = 'X-A'), 'created_by e organização gravados de auth.uid()/linha');
update public.evaluations set id = pg_temp.id('evalA') where protocol = 'X-A';
update public.evaluations set id = pg_temp.id('evalB') where protocol = 'X-B';
update public.evaluations set id = pg_temp.id('evalY1') where protocol = 'Y-1';
update public.evaluations set id = pg_temp.id('evalY2') where protocol = 'Y-2';
delete from public.evaluations where protocol in ('X-A-RET', 'X-NOME');

-- ---------------------------------------------------------------------------
-- Massa sintética (como postgres)
-- ---------------------------------------------------------------------------
insert into public.evaluations (id, organization_id, protocol, source, analyst_user_id, status, transcript, created_by)
values (pg_temp.id('evalA2'), pg_temp.id('X'), 'X-A2', 'texto', pg_temp.id('anaA'), 'transcrito', 'Rascunho sintético', pg_temp.id('anaA'));

create function pg_temp.mass_run(p_org text, p_eval text, p_run text, p_opp1 text, p_opp2 text) returns void
language plpgsql as $$
begin
  insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version, finished_at)
  values (pg_temp.id(p_run), pg_temp.id(p_org), pg_temp.id(p_eval), 1, 'sucesso', 'V1.2', now());
  insert into public.evaluation_scores (organization_id, evaluation_id, analysis_run_id, competency, score)
  select pg_temp.id(p_org), pg_temp.id(p_eval), pg_temp.id(p_run), c, 7
  from unnest(array['Empatia e acolhimento', 'Comunicação e clareza', 'Eficiência do atendimento',
    'Conhecimento e condução técnica', 'Experiência do cliente e Customer Success',
    'Gestão comunicacional durante o multiatendimento']) c;
  insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position, recommendation) values
    (pg_temp.id(p_opp1), pg_temp.id(p_org), pg_temp.id(p_eval), pg_temp.id(p_run), 0, 'Recomendação sintética 1'),
    (pg_temp.id(p_opp2), pg_temp.id(p_org), pg_temp.id(p_eval), pg_temp.id(p_run), 1, 'Recomendação sintética 2');
  update public.evaluations set current_analysis_run_id = pg_temp.id(p_run), status = 'analisado',
    diagnosis_status = 'pendente' where id = pg_temp.id(p_eval);
end;
$$;
select pg_temp.mass_run('X', 'evalA', 'runA', 'oppA1', 'oppA2');
select pg_temp.mass_run('X', 'evalB', 'runB', 'oppB1', 'oppB2');
select pg_temp.mass_run('Y', 'evalY1', 'runY1', 'oppY1a', 'oppY1b');
select pg_temp.mass_run('Y', 'evalY2', 'runY2', 'oppY2a', 'oppY2b');

insert into public.analysis_feedback (id, organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, liked, useful) values
  (pg_temp.id('fbA'), pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runA'), 'diagnostico', pg_temp.id('anaA'), 'analista', false, false),
  (pg_temp.id('fbB'), pg_temp.id('X'), pg_temp.id('evalB'), pg_temp.id('runB'), 'diagnostico', pg_temp.id('anaB'), 'analista', true, true),
  (gen_random_uuid(), pg_temp.id('Y'), pg_temp.id('evalY1'), pg_temp.id('runY1'), 'diagnostico', pg_temp.id('anaY'), 'analista', true, true),
  (gen_random_uuid(), pg_temp.id('Y'), pg_temp.id('evalY2'), pg_temp.id('runY2'), 'diagnostico', pg_temp.id('anaY'), 'analista', true, true);

insert into public.csat_records (id, organization_id, evaluation_id, analyst_user_id, score, score_origin, source) values
  (pg_temp.id('csatA'), pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('anaA'), 5, 'real', 'planilha'),
  (pg_temp.id('csatB'), pg_temp.id('X'), pg_temp.id('evalB'), pg_temp.id('anaB'), 3, 'real', 'planilha'),
  (pg_temp.id('csatY1'), pg_temp.id('Y'), pg_temp.id('evalY1'), pg_temp.id('anaY'), 4, 'real', 'planilha'),
  (pg_temp.id('csatY2'), pg_temp.id('Y'), pg_temp.id('evalY2'), pg_temp.id('anaY'), 2, 'real', 'planilha');

insert into public.survey_tickets (id, organization_id, evaluation_id) values
  (pg_temp.id('ticketX'), pg_temp.id('X'), pg_temp.id('evalA')),
  (pg_temp.id('ticketY'), pg_temp.id('Y'), pg_temp.id('evalY1'));
insert into public.survey_responses (organization_id, ticket_id, score) values
  (pg_temp.id('X'), pg_temp.id('ticketX'), 5), (pg_temp.id('Y'), pg_temp.id('ticketY'), 4);
insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action, actor_id) values
  (pg_temp.id('X'), pg_temp.id('evalB'), pg_temp.id('runB'), 'diagnóstico', 'diagnóstico aprovado', pg_temp.id('supX')),
  (pg_temp.id('Y'), pg_temp.id('evalY2'), pg_temp.id('runY2'), 'diagnóstico', 'diagnóstico aprovado', pg_temp.id('supY'));
insert into public.ai_failures (organization_id, evaluation_id, stage, error_code) values
  (pg_temp.id('X'), pg_temp.id('evalA'), 'analise', 'timeout'), (pg_temp.id('Y'), pg_temp.id('evalY1'), 'analise', 'timeout');
insert into public.ai_provider_configs (organization_id, provider, base_url, model, secret_ref, key_last4, is_active) values
  (pg_temp.id('X'), 'openai_compativel', 'https://api.exemplo.test/v1', 'modelo_x', gen_random_uuid(), 'abcd', true),
  (pg_temp.id('Y'), 'openai_compativel', 'https://api.exemplo.test/v1', 'modelo_y', gen_random_uuid(), 'wxyz', true);

-- ---------------------------------------------------------------------------
-- 1. Matriz tabela × persona × operação
-- Resultado: 'ok:N' = comando aceito afetando/lendo N linhas; '42501' = sem privilégio
-- ou violação de política RLS; '55000' = a view não aceita escrita (não é atualizável).
-- Todo comando é desfeito por pg_temp.try.
-- ---------------------------------------------------------------------------
create temp table m_select (ord int, tbl text);
insert into m_select values (1, 'evaluations'), (2, 'analysis_runs'), (3, 'evaluation_scores'), (4, 'opportunities'),
  (5, 'analysis_feedback'), (6, 'csat_records'), (7, 'survey_tickets'), (8, 'survey_responses'), (9, 'app_settings'),
  (10, 'protocol_versions'), (11, 'curation_logs'), (12, 'ai_failures'), (13, 'ai_provider_configs'),
  (14, 'effective_feedback'), (15, 'evaluation_files');
grant select on m_select to authenticated, anon;

-- SELECT: linhas visíveis da organização X e da organização Y.
create function pg_temp.matrix_select() returns table (tbl text, org_x text, org_y text) language sql as $$
  select s.tbl,
    pg_temp.try(format('select 1 from public.%I where organization_id = %L', s.tbl, pg_temp.id('X'))),
    pg_temp.try(format('select 1 from public.%I where organization_id = %L', s.tbl, pg_temp.id('Y')))
  from pg_temp.m_select s order by s.ord;
$$;

-- INSERT, UPDATE e DELETE contra linhas da organização X.
create temp table m_write (op text, ord int, alvo text, cmd text);
insert into m_write values
  ('insert', 1, 'evaluations (analyst = auth.uid())',
   $q$ insert into public.evaluations (organization_id, protocol, source, analyst_user_id) values (pg_temp.id('X'), 'MATRIZ', 'texto', auth.uid()) $q$),
  ('insert', 2, 'analysis_runs',
   $q$ insert into public.analysis_runs (organization_id, evaluation_id, run_number, status, prompt_version) values (pg_temp.id('X'), pg_temp.id('evalA2'), 9, 'sucesso', 'V1.2') $q$),
  ('insert', 3, 'evaluation_scores',
   $q$ insert into public.evaluation_scores (organization_id, evaluation_id, analysis_run_id, competency, score) values (pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runA'), 'Empatia e acolhimento', 1) $q$),
  ('insert', 4, 'opportunities',
   $q$ insert into public.opportunities (organization_id, evaluation_id, analysis_run_id, position) values (pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runA'), 9) $q$),
  ('insert', 5, 'analysis_feedback',
   $q$ insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, opportunity_id, author_id, author_role) values (pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runA'), 'oportunidade', pg_temp.id('oppA2'), auth.uid(), 'supervisor') $q$),
  ('insert', 6, 'csat_records (manual, analyst = auth.uid())',
   $q$ insert into public.csat_records (organization_id, analyst_user_id, source) values (pg_temp.id('X'), auth.uid(), 'manual') $q$),
  ('insert', 7, 'csat_records (planilha, analyst = A)',
   $q$ insert into public.csat_records (organization_id, analyst_user_id, source) values (pg_temp.id('X'), pg_temp.id('anaA'), 'planilha') $q$),
  ('insert', 8, 'survey_tickets (sem token)',
   $q$ insert into public.survey_tickets (organization_id, evaluation_id) values (pg_temp.id('X'), pg_temp.id('evalA')) $q$),
  ('insert', 9, 'survey_responses',
   $q$ insert into public.survey_responses (organization_id, ticket_id, score) values (pg_temp.id('X'), pg_temp.id('ticketX'), 1) $q$),
  ('insert', 10, 'app_settings',
   $q$ insert into public.app_settings (organization_id, key, value) values (pg_temp.id('X'), 'nova_chave', '1') $q$),
  ('insert', 11, 'protocol_versions',
   $q$ insert into public.protocol_versions (organization_id, version) values (pg_temp.id('X'), 'V9') $q$),
  ('insert', 12, 'curation_logs',
   $q$ insert into public.curation_logs (organization_id, evaluation_id, target, action) values (pg_temp.id('X'), pg_temp.id('evalA'), 'diagnóstico', 'diagnóstico aprovado') $q$),
  ('insert', 13, 'ai_failures',
   $q$ insert into public.ai_failures (organization_id, stage, error_code) values (pg_temp.id('X'), 'analise', 'timeout') $q$),
  ('insert', 14, 'ai_provider_configs',
   $q$ insert into public.ai_provider_configs (organization_id, provider, base_url, model) values (pg_temp.id('X'), 'openai_compativel', 'https://api.exemplo.test/v1', 'm') $q$),
  ('insert', 15, 'effective_feedback',
   $q$ insert into public.effective_feedback (organization_id) values (pg_temp.id('X')) $q$),

  ('update', 1, 'evaluations (de A)',
   $q$ update public.evaluations set protocol = protocol where id = pg_temp.id('evalA') $q$),
  ('update', 2, 'evaluations (de B)',
   $q$ update public.evaluations set protocol = protocol where id = pg_temp.id('evalB') $q$),
  ('update', 3, 'analysis_runs',
   $q$ update public.analysis_runs set model = model where evaluation_id = pg_temp.id('evalA') $q$),
  ('update', 4, 'evaluation_scores',
   $q$ update public.evaluation_scores set score = 1 where evaluation_id = pg_temp.id('evalA') $q$),
  ('update', 5, 'opportunities (status)',
   $q$ update public.opportunities set status = 'aprovada' where id = pg_temp.id('oppA1') $q$),
  ('update', 6, 'analysis_feedback',
   $q$ update public.analysis_feedback set liked = true where id = pg_temp.id('fbA') $q$),
  ('update', 7, 'csat_records (de A)',
   $q$ update public.csat_records set comment = 'alterado' where id = pg_temp.id('csatA') $q$),
  ('update', 8, 'survey_tickets',
   $q$ update public.survey_tickets set protocol = 'p' where id = pg_temp.id('ticketX') $q$),
  ('update', 9, 'survey_responses',
   $q$ update public.survey_responses set score = 1 where ticket_id = pg_temp.id('ticketX') $q$),
  ('update', 10, 'app_settings (value)',
   $q$ update public.app_settings set value = '3' where organization_id = pg_temp.id('X') $q$),
  ('update', 11, 'protocol_versions (is_active)',
   $q$ update public.protocol_versions set is_active = false where organization_id = pg_temp.id('X') $q$),
  ('update', 12, 'curation_logs',
   $q$ update public.curation_logs set note = 'x' where organization_id = pg_temp.id('X') $q$),
  ('update', 13, 'ai_failures',
   $q$ update public.ai_failures set stage = 'analise' where organization_id = pg_temp.id('X') $q$),
  ('update', 14, 'ai_provider_configs',
   $q$ update public.ai_provider_configs set model = 'outro' where organization_id = pg_temp.id('X') $q$),
  ('update', 15, 'effective_feedback',
   $q$ update public.effective_feedback set analyst_comment = 'x' $q$),

  ('delete', 1, 'evaluations (de A, transcrito, sem execução)',
   $q$ delete from public.evaluations where id = pg_temp.id('evalA2') $q$),
  ('delete', 2, 'evaluations (de A, analisado, com execução)',
   $q$ delete from public.evaluations where id = pg_temp.id('evalA') $q$),
  ('delete', 3, 'analysis_runs',
   $q$ delete from public.analysis_runs where evaluation_id = pg_temp.id('evalA') $q$),
  ('delete', 4, 'evaluation_scores',
   $q$ delete from public.evaluation_scores where evaluation_id = pg_temp.id('evalA') $q$),
  ('delete', 5, 'opportunities',
   $q$ delete from public.opportunities where evaluation_id = pg_temp.id('evalA') $q$),
  ('delete', 6, 'analysis_feedback',
   $q$ delete from public.analysis_feedback where id = pg_temp.id('fbA') $q$),
  ('delete', 7, 'csat_records (de A)',
   $q$ delete from public.csat_records where id = pg_temp.id('csatA') $q$),
  ('delete', 8, 'survey_tickets',
   $q$ delete from public.survey_tickets where id = pg_temp.id('ticketX') $q$),
  ('delete', 9, 'survey_responses',
   $q$ delete from public.survey_responses where ticket_id = pg_temp.id('ticketX') $q$),
  ('delete', 10, 'app_settings',
   $q$ delete from public.app_settings where organization_id = pg_temp.id('X') $q$),
  ('delete', 11, 'protocol_versions',
   $q$ delete from public.protocol_versions where organization_id = pg_temp.id('X') $q$),
  ('delete', 12, 'curation_logs',
   $q$ delete from public.curation_logs where organization_id = pg_temp.id('X') $q$),
  ('delete', 13, 'ai_failures',
   $q$ delete from public.ai_failures where organization_id = pg_temp.id('X') $q$),
  ('delete', 14, 'ai_provider_configs',
   $q$ delete from public.ai_provider_configs where organization_id = pg_temp.id('X') $q$),
  ('delete', 15, 'effective_feedback',
   $q$ delete from public.effective_feedback $q$);
grant select on m_write to authenticated, anon;

create function pg_temp.matrix_write(p_op text) returns table (alvo text, resultado text) language sql as $$
  select w.alvo, pg_temp.try(w.cmd) from pg_temp.m_write w where w.op = p_op order by w.ord;
$$;

-- Admin da plataforma ------------------------------------------------------
select pg_temp.login('admin');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:3', 'ok:2'), ('analysis_runs', 'ok:2', 'ok:2'), ('evaluation_scores', 'ok:12', 'ok:12'),
  ('opportunities', 'ok:4', 'ok:4'), ('analysis_feedback', 'ok:2', 'ok:2'), ('csat_records', 'ok:2', 'ok:2'),
  ('survey_tickets', 'ok:1', 'ok:1'), ('survey_responses', 'ok:1', 'ok:1'), ('app_settings', 'ok:1', 'ok:1'),
  ('protocol_versions', 'ok:2', 'ok:2'), ('curation_logs', 'ok:1', 'ok:1'), ('ai_failures', 'ok:1', 'ok:1'),
  ('ai_provider_configs', 'ok:1', 'ok:1'), ('effective_feedback', 'ok:6', 'ok:6'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — admin da plataforma lê X e Y');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', '42501'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', '42501'),
  ('csat_records (planilha, analyst = A)', 'ok:1'), ('survey_tickets (sem token)', 'ok:1'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — admin da plataforma');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:1'), ('evaluations (de B)', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:1'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:1'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — admin da plataforma');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:1'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:1'), ('survey_tickets', 'ok:1'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — admin da plataforma');
reset role;

-- Supervisor X -------------------------------------------------------------
select pg_temp.login('supX');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:3', 'ok:0'), ('analysis_runs', 'ok:2', 'ok:0'), ('evaluation_scores', 'ok:12', 'ok:0'),
  ('opportunities', 'ok:4', 'ok:0'), ('analysis_feedback', 'ok:2', 'ok:0'), ('csat_records', 'ok:2', 'ok:0'),
  ('survey_tickets', 'ok:1', 'ok:0'), ('survey_responses', 'ok:1', 'ok:0'), ('app_settings', 'ok:1', 'ok:0'),
  ('protocol_versions', 'ok:2', 'ok:0'), ('curation_logs', 'ok:1', 'ok:0'), ('ai_failures', 'ok:1', 'ok:0'),
  ('ai_provider_configs', 'ok:1', 'ok:0'), ('effective_feedback', 'ok:6', 'ok:0'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — supervisor X lê toda a organização X e nada de Y');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', 'ok:1'),
  ('csat_records (planilha, analyst = A)', 'ok:1'), ('survey_tickets (sem token)', 'ok:1'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — supervisor X');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:1'), ('evaluations (de B)', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:1'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:1'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — supervisor X');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:1'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:1'), ('survey_tickets', 'ok:1'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — supervisor X');
reset role;

-- Analista A ---------------------------------------------------------------
select pg_temp.login('anaA');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:2', 'ok:0'), ('analysis_runs', 'ok:1', 'ok:0'), ('evaluation_scores', 'ok:6', 'ok:0'),
  ('opportunities', 'ok:2', 'ok:0'), ('analysis_feedback', 'ok:1', 'ok:0'), ('csat_records', 'ok:1', 'ok:0'),
  ('survey_tickets', 'ok:0', 'ok:0'), ('survey_responses', 'ok:0', 'ok:0'), ('app_settings', 'ok:1', 'ok:0'),
  ('protocol_versions', 'ok:2', 'ok:0'), ('curation_logs', 'ok:0', 'ok:0'), ('ai_failures', 'ok:0', 'ok:0'),
  ('ai_provider_configs', 'ok:0', 'ok:0'), ('effective_feedback', 'ok:3', 'ok:0'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — analista A lê só o que é dele em X e nada de Y');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', 'ok:1'),
  ('csat_records (planilha, analyst = A)', '42501'), ('survey_tickets (sem token)', '42501'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — analista A');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:1'), ('evaluations (de B)', 'ok:0'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:0'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:0'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — analista A');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:1'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:0'), ('survey_tickets', 'ok:0'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — analista A');
-- A não lê nada de B.
select is((select count(*)::int from public.evaluations where id = pg_temp.id('evalB')), 0, 'A não lê a avaliação de B');
select is((select count(*)::int from public.evaluation_scores where evaluation_id = pg_temp.id('evalB')), 0, 'A não lê os scores de B');
select is((select count(*)::int from public.opportunities where evaluation_id = pg_temp.id('evalB')), 0, 'A não lê as oportunidades de B');
select is((select count(*)::int from public.analysis_feedback where evaluation_id = pg_temp.id('evalB')), 0, 'A não lê o feedback de B');
select is((select count(*)::int from public.csat_records where id = pg_temp.id('csatB')), 0, 'A não lê o CSAT de B');
select is((select count(*)::int from public.effective_feedback where evaluation_id = pg_temp.id('evalB')), 0, 'A não lê o veredito de B');
reset role;

-- Analista B ---------------------------------------------------------------
select pg_temp.login('anaB');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:1', 'ok:0'), ('analysis_runs', 'ok:1', 'ok:0'), ('evaluation_scores', 'ok:6', 'ok:0'),
  ('opportunities', 'ok:2', 'ok:0'), ('analysis_feedback', 'ok:1', 'ok:0'), ('csat_records', 'ok:1', 'ok:0'),
  ('survey_tickets', 'ok:0', 'ok:0'), ('survey_responses', 'ok:0', 'ok:0'), ('app_settings', 'ok:1', 'ok:0'),
  ('protocol_versions', 'ok:2', 'ok:0'), ('curation_logs', 'ok:0', 'ok:0'), ('ai_failures', 'ok:0', 'ok:0'),
  ('ai_provider_configs', 'ok:0', 'ok:0'), ('effective_feedback', 'ok:3', 'ok:0'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — analista B lê só o que é dele (avaliação criada pelo supervisor)');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', 'ok:1'),
  ('csat_records (planilha, analyst = A)', '42501'), ('survey_tickets (sem token)', '42501'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — analista B');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:0'), ('evaluations (de B)', 'ok:1'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:0'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:0'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — analista B');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:0'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:0'), ('survey_tickets', 'ok:0'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — analista B');
reset role;

-- Supervisor Y -------------------------------------------------------------
select pg_temp.login('supY');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:0', 'ok:2'), ('analysis_runs', 'ok:0', 'ok:2'), ('evaluation_scores', 'ok:0', 'ok:12'),
  ('opportunities', 'ok:0', 'ok:4'), ('analysis_feedback', 'ok:0', 'ok:2'), ('csat_records', 'ok:0', 'ok:2'),
  ('survey_tickets', 'ok:0', 'ok:1'), ('survey_responses', 'ok:0', 'ok:1'), ('app_settings', 'ok:0', 'ok:1'),
  ('protocol_versions', 'ok:0', 'ok:2'), ('curation_logs', 'ok:0', 'ok:1'), ('ai_failures', 'ok:0', 'ok:1'),
  ('ai_provider_configs', 'ok:0', 'ok:1'), ('effective_feedback', 'ok:0', 'ok:6'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — supervisor Y lê toda a organização Y e nada de X');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', '42501'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', '42501'),
  ('csat_records (planilha, analyst = A)', '42501'), ('survey_tickets (sem token)', '42501'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — supervisor Y não grava na organização X');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:0'), ('evaluations (de B)', 'ok:0'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:0'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:0'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — supervisor Y não altera a organização X');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:0'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:0'), ('survey_tickets', 'ok:0'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — supervisor Y não apaga na organização X');
-- Escrita do supervisor Y na própria organização (isolamento nos dois sentidos).
select is(pg_temp.try($$ update public.app_settings set value = '3' where organization_id = pg_temp.id('Y') $$), 'ok:1',
  'supervisor Y altera app_settings da própria organização');
select is(pg_temp.try($$ insert into public.survey_tickets (organization_id, evaluation_id) values (pg_temp.id('Y'), pg_temp.id('evalY1')) $$), 'ok:1',
  'supervisor Y cria ticket na própria organização');
reset role;

-- Usuário sem vínculo -----------------------------------------------------
select pg_temp.login('semV');
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', 'ok:0', 'ok:0'), ('analysis_runs', 'ok:0', 'ok:0'), ('evaluation_scores', 'ok:0', 'ok:0'),
  ('opportunities', 'ok:0', 'ok:0'), ('analysis_feedback', 'ok:0', 'ok:0'), ('csat_records', 'ok:0', 'ok:0'),
  ('survey_tickets', 'ok:0', 'ok:0'), ('survey_responses', 'ok:0', 'ok:0'), ('app_settings', 'ok:0', 'ok:0'),
  ('protocol_versions', 'ok:0', 'ok:0'), ('curation_logs', 'ok:0', 'ok:0'), ('ai_failures', 'ok:0', 'ok:0'),
  ('ai_provider_configs', 'ok:0', 'ok:0'), ('effective_feedback', 'ok:0', 'ok:0'), ('evaluation_files', 'ok:0', 'ok:0') $$,
  'matriz SELECT — usuário sem vínculo não lê nada');
select results_eq($$ select * from pg_temp.matrix_write('insert') $$, $$ values
  ('evaluations (analyst = auth.uid())', '42501'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities', '42501'), ('analysis_feedback', '42501'), ('csat_records (manual, analyst = auth.uid())', '42501'),
  ('csat_records (planilha, analyst = A)', '42501'), ('survey_tickets (sem token)', '42501'), ('survey_responses', '42501'),
  ('app_settings', '42501'), ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz INSERT — usuário sem vínculo');
select results_eq($$ select * from pg_temp.matrix_write('update') $$, $$ values
  ('evaluations (de A)', 'ok:0'), ('evaluations (de B)', 'ok:0'), ('analysis_runs', '42501'), ('evaluation_scores', '42501'),
  ('opportunities (status)', '42501'), ('analysis_feedback', '42501'), ('csat_records (de A)', 'ok:0'),
  ('survey_tickets', '42501'), ('survey_responses', '42501'), ('app_settings (value)', 'ok:0'),
  ('protocol_versions (is_active)', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'),
  ('ai_provider_configs', '42501'), ('effective_feedback', '55000') $$,
  'matriz UPDATE — usuário sem vínculo');
select results_eq($$ select * from pg_temp.matrix_write('delete') $$, $$ values
  ('evaluations (de A, transcrito, sem execução)', 'ok:0'), ('evaluations (de A, analisado, com execução)', 'ok:0'),
  ('analysis_runs', '42501'), ('evaluation_scores', '42501'), ('opportunities', '42501'), ('analysis_feedback', '42501'),
  ('csat_records (de A)', 'ok:0'), ('survey_tickets', 'ok:0'), ('survey_responses', '42501'), ('app_settings', '42501'),
  ('protocol_versions', '42501'), ('curation_logs', '42501'), ('ai_failures', '42501'), ('ai_provider_configs', '42501'),
  ('effective_feedback', '55000') $$,
  'matriz DELETE — usuário sem vínculo');
reset role;

-- anon ---------------------------------------------------------------------
select pg_temp.anon();
select results_eq($$ select * from pg_temp.matrix_select() $$, $$ values
  ('evaluations', '42501', '42501'), ('analysis_runs', '42501', '42501'), ('evaluation_scores', '42501', '42501'),
  ('opportunities', '42501', '42501'), ('analysis_feedback', '42501', '42501'), ('csat_records', '42501', '42501'),
  ('survey_tickets', '42501', '42501'), ('survey_responses', '42501', '42501'), ('app_settings', '42501', '42501'),
  ('protocol_versions', '42501', '42501'), ('curation_logs', '42501', '42501'), ('ai_failures', '42501', '42501'),
  ('ai_provider_configs', '42501', '42501'), ('effective_feedback', '42501', '42501'), ('evaluation_files', '42501', '42501') $$,
  'matriz SELECT — anon sem privilégio em nenhuma tabela nem na view');
select is_empty($$ select alvo from pg_temp.matrix_write('insert') where resultado <> case alvo when 'effective_feedback' then '55000' else '42501' end $$, 'matriz INSERT — anon negado em tudo');
select is_empty($$ select alvo from pg_temp.matrix_write('update') where resultado <> case alvo when 'effective_feedback' then '55000' else '42501' end $$, 'matriz UPDATE — anon negado em tudo');
select is_empty($$ select alvo from pg_temp.matrix_write('delete') where resultado <> case alvo when 'effective_feedback' then '55000' else '42501' end $$, 'matriz DELETE — anon negado em tudo');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Trigger private.protect_evaluation()
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
-- Colunas sem grant de UPDATE: o privilégio de coluna barra antes do trigger.
select throws_ok($$ update public.evaluations set diagnosis_status = 'aprovado' where id = pg_temp.id('evalA') $$, '42501', null,
  'A não altera diagnosis_status');
select throws_ok($$ update public.evaluations set supervisor_review = 'forjado' where id = pg_temp.id('evalA') $$, '42501', null,
  'A não altera supervisor_review');
select throws_ok($$ update public.evaluations set organization_id = pg_temp.id('Y') where id = pg_temp.id('evalA') $$, '42501', null,
  'A não altera organization_id');
select throws_ok($$ update public.evaluations set current_analysis_run_id = null where id = pg_temp.id('evalA') $$, '42501', null,
  'A não altera current_analysis_run_id');
select throws_ok($$ update public.evaluations set created_by = pg_temp.id('anaB') where id = pg_temp.id('evalA2') $$, '42501', null,
  'A não altera created_by');
select throws_ok($$ update public.evaluations set status = 'analisado' where id = pg_temp.id('evalA2') $$, 'CX033', null,
  'A não muda status de transcrito para analisado');
select throws_ok($$ update public.evaluations set status = 'curado' where id = pg_temp.id('evalA2') $$, 'CX033', null,
  'A não muda status de transcrito para curado');
select throws_ok($$ update public.evaluations set status = 'rascunho' where id = pg_temp.id('evalA') $$, 'CX033', null,
  'A não devolve avaliação analisada para rascunho');
select lives_ok($$ update public.evaluations set status = 'rascunho' where id = pg_temp.id('evalA2') $$,
  'A alterna status entre transcrito e rascunho');
select throws_ok($$ update public.evaluations set analyst_user_id = pg_temp.id('anaB') where id = pg_temp.id('evalA2') $$, 'CX034', null,
  'A não troca analyst_user_id');
select throws_ok($$ update public.evaluations set transcript = 'Outra transcrição' where id = pg_temp.id('evalA') $$, 'CX036', null,
  'A não altera a transcrição de avaliação analisada');
select lives_ok($$ update public.evaluations set transcript = 'Rascunho editado' where id = pg_temp.id('evalA2') $$,
  'A altera a transcrição de avaliação ainda não analisada');
reset role;

select pg_temp.login('supX');
select throws_ok($$ update public.evaluations set analyst_user_id = pg_temp.id('anaY') where id = pg_temp.id('evalA2') $$, 'CX035', null,
  'supervisor X não troca o analista para usuário de Y');
select throws_ok($$ update public.evaluations set analyst_user_id = null where id = pg_temp.id('evalA2') $$, 'CX035', null,
  'supervisor X não remove o analista pela API');
select throws_ok($$ update public.evaluations set status = 'curado' where id = pg_temp.id('evalB') $$, 'CX033', null,
  'supervisor X também não muda status para curado por UPDATE direto');
select lives_ok($$ update public.evaluations set analyst_user_id = pg_temp.id('anaB') where id = pg_temp.id('evalA2') $$,
  'supervisor X troca o analista para B');
reset role;
select is((select analyst_user_id from public.evaluations where id = pg_temp.id('evalA2')), pg_temp.id('anaB'),
  'troca de analista gravada');
select pg_temp.login('anaA');
select is((select count(*)::int from public.evaluations where id = pg_temp.id('evalA2')), 1,
  'A continua lendo a avaliação que criou (created_by)');
reset role;
update public.evaluations set analyst_user_id = pg_temp.id('anaA') where id = pg_temp.id('evalA2');

-- Defesa em profundidade: mesmo se um grant de coluna vazar, o trigger barra.
grant update (organization_id, created_by, diagnosis_status, supervisor_review, current_analysis_run_id)
  on public.evaluations to authenticated;
select pg_temp.login('anaA');
select throws_ok($$ update public.evaluations set diagnosis_status = 'aprovado' where id = pg_temp.id('evalA') $$, 'CX032', null,
  'trigger barra diagnosis_status mesmo com grant indevido');
select throws_ok($$ update public.evaluations set supervisor_review = 'forjado' where id = pg_temp.id('evalA') $$, 'CX032', null,
  'trigger barra supervisor_review mesmo com grant indevido');
select throws_ok($$ update public.evaluations set organization_id = pg_temp.id('Y') where id = pg_temp.id('evalA') $$, 'CX032', null,
  'trigger barra organization_id mesmo com grant indevido');
select throws_ok($$ update public.evaluations set current_analysis_run_id = null where id = pg_temp.id('evalA') $$, 'CX032', null,
  'trigger barra current_analysis_run_id mesmo com grant indevido');
select throws_ok($$ update public.evaluations set created_by = pg_temp.id('anaB') where id = pg_temp.id('evalA') $$, 'CX032', null,
  'trigger barra created_by mesmo com grant indevido');
reset role;
revoke update (organization_id, created_by, diagnosis_status, supervisor_review, current_analysis_run_id)
  on public.evaluations from authenticated;
select ok(not has_column_privilege('authenticated', 'public.evaluations', 'diagnosis_status', 'UPDATE'),
  'grant temporário do teste revogado');

-- ---------------------------------------------------------------------------
-- 4. DELETE de avaliações
-- ---------------------------------------------------------------------------
-- evalF: transcrito, com execução que falhou (não é atual).
insert into public.evaluations (id, organization_id, protocol, source, analyst_user_id, status, created_by)
values (pg_temp.id('evalF'), pg_temp.id('X'), 'X-F', 'texto', pg_temp.id('anaA'), 'transcrito', pg_temp.id('anaA'));
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version, error_code)
values (pg_temp.id('runF'), pg_temp.id('X'), pg_temp.id('evalF'), 1, 'falha', 'V1.2', 'timeout');

select pg_temp.login('anaB');
select is_empty($$ delete from public.evaluations where id = pg_temp.id('evalA2') returning id $$, 'B não apaga o rascunho de A');
reset role;
select pg_temp.login('supX');
select is_empty($$ delete from public.evaluations where id = pg_temp.id('evalA') returning id $$, 'supervisor não apaga avaliação analisada');
select throws_ok($$ delete from public.evaluations where id = pg_temp.id('evalF') $$, '23503', null,
  'supervisor não apaga avaliação transcrita com execução (histórico D-016)');
reset role;
select pg_temp.login('admin');
select is_empty($$ delete from public.evaluations where id = pg_temp.id('evalA') returning id $$, 'admin não apaga avaliação analisada pela API');
select throws_ok($$ delete from public.evaluations where id = pg_temp.id('evalF') $$, '23503', null,
  'admin não apaga avaliação com execução pela API');
reset role;
select pg_temp.login('anaA');
select throws_ok($$ delete from public.evaluations where id = pg_temp.id('evalF') $$, '23503', null,
  'A não apaga a própria avaliação com execução');
select isnt_empty($$ delete from public.evaluations where id = pg_temp.id('evalA2') returning id $$, 'A apaga o próprio rascunho sem execução');
reset role;
select ok(exists (select 1 from public.evaluations where id = pg_temp.id('evalA'))
  and exists (select 1 from public.evaluations where id = pg_temp.id('evalF')), 'avaliações com execução preservadas');

-- ---------------------------------------------------------------------------
-- 5. submit_feedback
-- ---------------------------------------------------------------------------
-- Execução antiga (não atual) da avaliação de A, com uma oportunidade própria.
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version)
values (pg_temp.id('runAold'), pg_temp.id('X'), pg_temp.id('evalA'), 2, 'sucesso', 'V1.2');
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position)
values (pg_temp.id('oppAold'), pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runAold'), 0);

-- A declara papel de supervisor nos claims: nada disso é usado (SEC-03).
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('anaA'), 'role', 'authenticated',
  'user_role', 'supervisor', 'app_metadata', json_build_object('role', 'supervisor'))::text, true);
set local role authenticated;
select is(public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, true, true, 'Gostei'), pg_temp.id('fbA'),
  'A valida o diagnóstico da própria avaliação (upsert sobre a linha existente)');
select is(public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, true, false, 'Mudei de ideia'), pg_temp.id('fbA'),
  'A muda a própria validação: mesmo id, sem duplicar');
select results_eq($$ select author_id, author_role, liked, useful, comment from public.analysis_feedback
  where analysis_run_id = pg_temp.id('runA') and target_type = 'diagnostico' $$,
  $$ values (pg_temp.id('anaA'), 'analista'::text, true, false, 'Mudei de ideia'::text) $$,
  'uma única linha do analista, atualizada; author_role = analista apesar dos claims');
select isnt(public.submit_feedback(pg_temp.id('runA'), 'oportunidade', pg_temp.id('oppA1'), true, true, null), null,
  'A valida uma oportunidade da própria avaliação');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runAold'), 'diagnostico', null, true, true, null) $$, 'CX025', null,
  'execução que não é a atual → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'oportunidade', pg_temp.id('oppAold'), true, true, null) $$, 'CX027', null,
  'oportunidade de outra execução → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'oportunidade', pg_temp.id('oppB1'), true, true, null) $$, 'CX027', null,
  'oportunidade de outra avaliação → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'oportunidade', null, true, true, null) $$, 'CX027', null,
  'validação de oportunidade sem oportunidade → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', pg_temp.id('oppA1'), true, true, null) $$, 'CX024', null,
  'diagnóstico com oportunidade → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'supervisor', null, true, true, null) $$, 'CX024', null,
  'alvo inválido → erro');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runB'), 'diagnostico', null, true, true, null) $$, 'CX023', null,
  'A não valida a avaliação de B');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runY1'), 'diagnostico', null, true, true, null) $$, 'CX023', null,
  'A não valida avaliação de outra organização');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runF'), 'diagnostico', null, true, true, null) $$, 'CX025', null,
  'execução com falha que não é a atual → erro');
select throws_ok($$ insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role)
  values (pg_temp.id('X'), pg_temp.id('evalA'), pg_temp.id('runA'), 'diagnostico', pg_temp.id('supX'), 'supervisor') $$, '42501', null,
  'author_role/author_id não são forjáveis por INSERT direto');
select throws_ok($$ select public.submit_feedback(p_run => pg_temp.id('runA'), p_target => 'diagnostico', p_opportunity => null,
  p_liked => true, p_useful => true, p_comment => null, p_author_role => 'supervisor') $$, '42883', null,
  'a RPC não aceita author_role como parâmetro');
reset role;

select pg_temp.login('anaB');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, false, false, 'Sabotagem') $$, 'CX023', null,
  'B não valida a avaliação de A');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'oportunidade', pg_temp.id('oppA1'), false, false, null) $$, 'CX023', null,
  'B não valida oportunidade de A');
reset role;
select pg_temp.login('supY');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, false, false, null) $$, 'CX023', null,
  'supervisor Y não valida avaliação de X');
reset role;
select pg_temp.login('semV');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, false, false, null) $$, 'CX023', null,
  'usuário sem vínculo não valida');
reset role;
select pg_temp.anon();
select throws_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, true, true, null) $$, '42501', null,
  'anon não executa submit_feedback');
reset role;

select pg_temp.login('supX');
select lives_ok($$ select public.submit_feedback(pg_temp.id('runA'), 'diagnostico', null, true, true, 'Visão do supervisor') $$,
  'supervisor X valida o diagnóstico de A');
reset role;
select results_eq($$ select author_role, author_id from public.analysis_feedback
  where analysis_run_id = pg_temp.id('runA') and target_type = 'diagnostico' order by author_role $$,
  $$ values ('analista'::text, pg_temp.id('anaA')), ('supervisor', pg_temp.id('supX')) $$,
  'supervisor grava como supervisor sem tocar na validação do analista');

-- Execução atual com falha.
update public.evaluations set current_analysis_run_id = pg_temp.id('runF') where id = pg_temp.id('evalF');
select pg_temp.login('anaA');
select throws_ok($$ select public.submit_feedback(pg_temp.id('runF'), 'diagnostico', null, true, true, null) $$, 'CX026', null,
  'execução atual sem sucesso → erro');
reset role;

-- ---------------------------------------------------------------------------
-- 6. decide_opportunity / decide_diagnosis
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'aprovada', null, null) $$, 'CX030', null,
  'analista não decide oportunidade (SEC-06/SEC-07)');
select throws_ok($$ select public.decide_diagnosis(pg_temp.id('evalA'), 'aprovado', null) $$, 'CX030', null,
  'analista não decide diagnóstico (SEC-06/SEC-07)');
select throws_ok($$ update public.opportunities set status = 'aprovada' where id = pg_temp.id('oppA1') $$, '42501', null,
  'analista não altera opportunities.status pela API');
reset role;
select pg_temp.login('supY');
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'rejeitada', null, null) $$, 'CX030', null,
  'supervisor Y não decide oportunidade de X');
select throws_ok($$ select public.decide_diagnosis(pg_temp.id('evalA'), 'rejeitado', null) $$, 'CX030', null,
  'supervisor Y não decide diagnóstico de X');
reset role;
select pg_temp.anon();
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'aprovada', null, null) $$, '42501', null,
  'anon não executa decide_opportunity');
select throws_ok($$ select public.decide_diagnosis(pg_temp.id('evalA'), 'aprovado', null) $$, '42501', null,
  'anon não executa decide_diagnosis');
reset role;

select pg_temp.login('supX');
select throws_ok($$ update public.opportunities set status = 'aprovada' where id = pg_temp.id('oppA1') $$, '42501', null,
  'UPDATE direto em opportunities.status pela API falha (também para o supervisor)');
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'aprovada', null, 'Texto ajustado') $$, 'CX029', null,
  'p_adjusted com aprovada → erro');
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'pendente', null, null) $$, 'CX028', null,
  'decisão inválida → erro');
select throws_ok($$ select public.decide_opportunity(pg_temp.id('oppAold'), 'aprovada', null, null) $$, 'CX025', null,
  'oportunidade de execução que não é a atual → erro');
select lives_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'rejeitada', 'Não se aplica', null) $$,
  'supervisor X rejeita a oportunidade');
select results_eq($$ select status, supervisor_note, adjusted_recommendation from public.opportunities where id = pg_temp.id('oppA1') $$,
  $$ values ('rejeitada'::text, 'Não se aplica'::text, null::text) $$, 'decisão gravada na oportunidade');
select results_eq($$ select target, action, note, actor_id, analysis_run_id from public.curation_logs where opportunity_id = pg_temp.id('oppA1') $$,
  $$ values ('oportunidade'::text, 'rejeitada'::text, 'Não se aplica'::text, pg_temp.id('supX'), pg_temp.id('runA')) $$,
  'log de curadoria criado na mesma transação');
select lives_ok($$ select public.decide_opportunity(pg_temp.id('oppA1'), 'ajustada', 'Ajuste fino', 'Recomendação revisada') $$,
  'supervisor X redecide como ajustada');
select results_eq($$ select status, adjusted_recommendation from public.opportunities where id = pg_temp.id('oppA1') $$,
  $$ values ('ajustada'::text, 'Recomendação revisada'::text) $$, 'ajuste gravado');
select lives_ok($$ select public.decide_opportunity(pg_temp.id('oppA2'), 'ajustada', null, null) $$,
  'ajustada sem texto ajustado é aceita (D-024: padrão = texto da IA)');
select is((select count(*)::int from public.curation_logs where opportunity_id = pg_temp.id('oppA1')), 2,
  'cada decisão gera um novo log');
select throws_ok($$ update public.curation_logs set note = 'x' $$, '42501', null, 'supervisor não altera curation_logs');
select throws_ok($$ delete from public.curation_logs $$, '42501', null, 'supervisor não apaga curation_logs');

select throws_ok($$ select public.decide_diagnosis(pg_temp.id('evalA'), 'aprovada', null) $$, 'CX028', null,
  'decisão de diagnóstico inválida → erro');
select throws_ok($$ select public.decide_diagnosis(pg_temp.id('evalF'), 'aprovado', null) $$, 'CX026', null,
  'diagnóstico sem execução atual com sucesso → erro');
select lives_ok($$ select public.decide_diagnosis(pg_temp.id('evalA'), 'aprovado', 'Diagnóstico consistente') $$,
  'supervisor X aprova o diagnóstico');
select results_eq($$ select status, diagnosis_status, supervisor_review from public.evaluations where id = pg_temp.id('evalA') $$,
  $$ values ('curado'::text, 'aprovado'::text, 'Diagnóstico consistente'::text) $$, 'diagnóstico aprovado leva status a curado');
select results_eq($$ select target, action, actor_id, analysis_run_id from public.curation_logs
  where evaluation_id = pg_temp.id('evalA') and target = 'diagnóstico' $$,
  $$ values ('diagnóstico'::text, 'diagnóstico aprovado'::text, pg_temp.id('supX'), pg_temp.id('runA')) $$,
  'log do diagnóstico criado');
reset role;
select pg_temp.login('admin');
select lives_ok($$ select public.decide_diagnosis(pg_temp.id('evalY1'), 'rejeitado', null) $$,
  'admin da plataforma decide em qualquer organização');
reset role;
select is((select action from public.curation_logs where evaluation_id = pg_temp.id('evalY1')), 'diagnóstico rejeitado',
  'log com ação "diagnóstico rejeitado"');
select pg_temp.login('anaA');
select results_eq($$ select status, supervisor_note from public.opportunities where id = pg_temp.id('oppA1') $$,
  $$ values ('ajustada'::text, 'Ajuste fino'::text) $$, 'analista vê o veredito e a nota do supervisor (VALIDACAO §4.4)');
select is((select count(*)::int from public.curation_logs), 0, 'analista não lê curation_logs');
reset role;

-- ---------------------------------------------------------------------------
-- 7. effective_feedback (D-024)
-- ---------------------------------------------------------------------------
insert into public.evaluations (id, organization_id, protocol, source, analyst_user_id, status, created_by)
values (pg_temp.id('evalA3'), pg_temp.id('X'), 'X-A3', 'texto', pg_temp.id('anaA'), 'transcrito', pg_temp.id('anaA'));
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version)
values (pg_temp.id('runA3'), pg_temp.id('X'), pg_temp.id('evalA3'), 1, 'sucesso', 'V1.2');
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position) values
  (pg_temp.id('oppA31'), pg_temp.id('X'), pg_temp.id('evalA3'), pg_temp.id('runA3'), 0),
  (pg_temp.id('oppA32'), pg_temp.id('X'), pg_temp.id('evalA3'), pg_temp.id('runA3'), 1),
  (pg_temp.id('oppA33'), pg_temp.id('X'), pg_temp.id('evalA3'), pg_temp.id('runA3'), 2);
update public.evaluations set current_analysis_run_id = pg_temp.id('runA3'), status = 'analisado', diagnosis_status = 'pendente'
  where id = pg_temp.id('evalA3');

select pg_temp.login('anaA');
select lives_ok($$ select public.submit_feedback(pg_temp.id('runA3'), 'diagnostico', null, true, true, null) $$,
  'A valida o diagnóstico como positivo');
select lives_ok($$ select public.submit_feedback(pg_temp.id('runA3'), 'oportunidade', pg_temp.id('oppA31'), true, true, null) $$,
  'A valida a oportunidade 1 como positiva');
select lives_ok($$ select public.submit_feedback(pg_temp.id('runA3'), 'oportunidade', pg_temp.id('oppA32'), true, false, null) $$,
  'A valida a oportunidade 2 com gostei = sim e útil = não');
reset role;
select pg_temp.login('supX');
select lives_ok($$ select public.decide_opportunity(pg_temp.id('oppA31'), 'rejeitada', null, null) $$, 'supervisor rejeita a oportunidade 1');
-- A validação do supervisor (gostei/útil) não é decisão de curadoria: não sobrepõe.
select lives_ok($$ select public.submit_feedback(pg_temp.id('runA3'), 'oportunidade', pg_temp.id('oppA33'), false, false, null) $$,
  'supervisor valida (gostei/útil) a oportunidade 3');
reset role;

select pg_temp.login('anaA');
select results_eq($$ select target_type, opportunity_id, effective, source, supervisor_decision from public.effective_feedback
  where analysis_run_id = pg_temp.id('runA3') order by target_type, opportunity_id nulls first $$,
  $$ values
    ('diagnostico'::text, null::uuid, 'positivo'::text, 'analista'::text, null::text),
    ('oportunidade', pg_temp.id('oppA31'), 'negativo', 'supervisor', 'rejeitada'),
    ('oportunidade', pg_temp.id('oppA32'), 'negativo', 'analista', null),
    ('oportunidade', pg_temp.id('oppA33'), 'sem_validacao', null, null) $$,
  'D-024: positivo/analista; supervisor rejeitada → negativo/supervisor; útil = não → negativo; nada → sem_validacao');
select results_eq($$ select analyst_liked, analyst_useful from public.effective_feedback where opportunity_id = pg_temp.id('oppA32') $$,
  $$ values (true, false) $$, 'view expõe a validação do analista');
select results_eq($$ select target_type, effective, source, supervisor_decision from public.effective_feedback
  where analysis_run_id = pg_temp.id('runA') order by target_type, opportunity_id $$,
  $$ values ('diagnostico'::text, 'positivo'::text, 'supervisor'::text, 'aprovado'::text),
            ('oportunidade', 'positivo', 'supervisor', 'ajustada'),
            ('oportunidade', 'positivo', 'supervisor', 'ajustada') $$,
  'decisões do supervisor sobrepõem (diagnóstico aprovado; ajustada → positivo)');
select results_eq($$ select effective, source, supervisor_decision from public.effective_feedback
  where analysis_run_id = pg_temp.id('runAold') and target_type = 'diagnostico' $$,
  $$ values ('sem_validacao'::text, null::text, null::text) $$,
  'decisão do diagnóstico vale só para a execução atual');
select is((select count(*)::int from public.effective_feedback where analysis_run_id = pg_temp.id('runF')), 0,
  'execução com falha não gera alvo');
select is_empty($$ select 1 from public.effective_feedback where analyst_user_id is distinct from pg_temp.id('anaA') $$,
  'A vê pela view só as linhas próprias');
select is((select count(*)::int from public.effective_feedback), 9, 'A vê os 9 alvos das próprias avaliações');
reset role;
select pg_temp.login('supX');
select is((select count(*)::int from public.effective_feedback), 12, 'supervisor X vê todos os alvos da organização');
select is_empty($$ select 1 from public.effective_feedback where organization_id <> pg_temp.id('X') $$,
  'supervisor X não vê alvos de Y pela view');
select isnt_empty($$ select 1 from public.effective_feedback where analyst_user_id = pg_temp.id('anaB') $$,
  'supervisor X vê as linhas do analista B');
reset role;
select is((select count(*)::int from public.effective_feedback where organization_id = pg_temp.id('X')), 12,
  'contagem do supervisor X confere com o total de X');

-- ---------------------------------------------------------------------------
-- 8. csat_records
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
select lives_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source, score, score_origin)
  values (pg_temp.id('X'), pg_temp.id('anaA'), 'manual', 4, 'real') $$, 'A insere CSAT manual próprio');
select throws_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source)
  values (pg_temp.id('X'), pg_temp.id('anaA'), 'planilha') $$, '42501', null, 'A não insere CSAT de planilha');
select throws_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source)
  values (pg_temp.id('X'), pg_temp.id('anaB'), 'manual') $$, '42501', null, 'A não insere CSAT manual de B');
select throws_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source, evaluation_id)
  values (pg_temp.id('X'), pg_temp.id('anaA'), 'manual', pg_temp.id('evalB')) $$, '42501', null,
  'A não vincula CSAT à avaliação de B');
select throws_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source)
  values (pg_temp.id('Y'), pg_temp.id('anaA'), 'manual') $$, '42501', null, 'A não insere CSAT em Y');
select is_empty($$ update public.csat_records set score = 5 where id = pg_temp.id('csatA') returning id $$, 'A não atualiza o próprio CSAT');
select is_empty($$ delete from public.csat_records where id = pg_temp.id('csatA') returning id $$, 'A não apaga o próprio CSAT');
select throws_ok($$ update public.csat_records set organization_id = pg_temp.id('Y') $$, '42501', null, 'organization_id do CSAT é imutável pela API');
reset role;
select pg_temp.login('supX');
select lives_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source, score, score_origin)
  values (pg_temp.id('X'), pg_temp.id('anaB'), 'planilha', 2, 'real') $$, 'supervisor insere CSAT de qualquer analista de X');
select throws_ok($$ insert into public.csat_records (organization_id, analyst_user_id, source)
  values (pg_temp.id('X'), pg_temp.id('anaY'), 'manual') $$, '42501', null, 'supervisor não atribui CSAT a usuário de Y');
select throws_ok($$ insert into public.csat_records (organization_id, source) values (pg_temp.id('Y'), 'manual') $$, '42501', null,
  'supervisor X não insere CSAT em Y');
select isnt_empty($$ update public.csat_records set comment = 'Revisado' where id = pg_temp.id('csatB') returning id $$, 'supervisor atualiza CSAT');
select throws_ok($$ update public.csat_records set analyst_user_id = pg_temp.id('anaY') where id = pg_temp.id('csatB') $$, '42501', null,
  'supervisor não move CSAT para usuário de Y');
select isnt_empty($$ delete from public.csat_records where id = pg_temp.id('csatB') returning id $$, 'supervisor apaga CSAT');
select is_empty($$ update public.csat_records set comment = 'x' where id = pg_temp.id('csatY1') returning id $$, 'supervisor X não atualiza CSAT de Y');
reset role;

-- ---------------------------------------------------------------------------
-- 9. survey_tickets
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
select is((select count(*)::int from public.survey_tickets), 0, 'analista não lê tickets');
select throws_ok($$ insert into public.survey_tickets (organization_id, evaluation_id) values (pg_temp.id('X'), pg_temp.id('evalA')) $$,
  '42501', null, 'analista não cria ticket');
reset role;
select pg_temp.login('supX');
select lives_ok($$ insert into public.survey_tickets (organization_id, evaluation_id, protocol)
  values (pg_temp.id('X'), pg_temp.id('evalA'), 'TICKET-NOVO') $$, 'supervisor cria ticket sem informar o token');
select is((select length(token) from public.survey_tickets where protocol = 'TICKET-NOVO'), 64, 'token gerado no servidor (64 hex)');
select throws_ok($$ insert into public.survey_tickets (organization_id, evaluation_id, token)
  values (pg_temp.id('X'), pg_temp.id('evalA'), repeat('a', 64)) $$, '42501', null, 'token informado é rejeitado por privilégio');
select throws_ok($$ update public.survey_tickets set used_at = now() $$, '42501', null, 'supervisor não altera tickets');
select throws_ok($$ insert into public.survey_tickets (organization_id, evaluation_id) values (pg_temp.id('Y'), pg_temp.id('evalY1')) $$,
  '42501', null, 'supervisor X não cria ticket em Y');
reset role;
select pg_temp.anon();
select throws_ok($$ select * from public.survey_tickets $$, '42501', null, 'anon não lê survey_tickets');
reset role;

-- ---------------------------------------------------------------------------
-- 10. ai_provider_configs
-- ---------------------------------------------------------------------------
select pg_temp.login('supX');
select results_eq($$ select provider, model from public.ai_provider_configs $$, $$ values ('openai_compativel'::text, 'modelo_x'::text) $$,
  'supervisor lê provider e model da própria organização');
select throws_ok($$ select secret_ref from public.ai_provider_configs $$, '42501', null, 'select secret_ref falha por privilégio');
select throws_ok($$ select * from public.ai_provider_configs $$, '42501', null, 'select * também falha (inclui secret_ref)');
reset role;
select pg_temp.login('anaA');
select is((select count(*)::int from public.ai_provider_configs), 0, 'analista não lê ai_provider_configs');
reset role;

-- ---------------------------------------------------------------------------
-- 11. set_active_protocol_version
-- ---------------------------------------------------------------------------
select pg_temp.login('anaA');
select throws_ok($$ select public.set_active_protocol_version(pg_temp.id('pvX11')) $$, 'CX031', null,
  'analista não ativa versão do protocolo');
reset role;
select pg_temp.login('supY');
select throws_ok($$ select public.set_active_protocol_version(pg_temp.id('pvX11')) $$, 'CX031', null,
  'supervisor Y não ativa versão de X');
reset role;
select pg_temp.anon();
select throws_ok($$ select public.set_active_protocol_version(pg_temp.id('pvX11')) $$, '42501', null,
  'anon não executa set_active_protocol_version');
reset role;
select pg_temp.login('supX');
select lives_ok($$ select public.set_active_protocol_version(pg_temp.id('pvX11')) $$, 'supervisor X ativa a V1.1');
select results_eq($$ select version from public.protocol_versions where is_active $$, $$ values ('V1.1'::text) $$,
  'exatamente uma versão ativa em X, a escolhida');
select lives_ok($$ select public.set_active_protocol_version(pg_temp.id('pvX11')) $$, 'reativar a mesma versão é idempotente');
select is((select count(*)::int from public.protocol_versions where is_active), 1, 'continua uma única versão ativa');
reset role;
select is((select count(*)::int from public.protocol_versions where organization_id = pg_temp.id('Y') and is_active and version = 'V1.2'), 1,
  'a versão ativa de Y não muda');

-- ---------------------------------------------------------------------------
-- 12. SEC-16, SEC-10 e SEC-15 para os objetos novos
-- ---------------------------------------------------------------------------
select is_empty($$ select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace
  and c.relkind in ('r', 'p') and not c.relrowsecurity $$, 'SEC-16: todas as tabelas public têm RLS');
select is_empty($$ select c.relname || ':' || p from pg_class c
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v')
    and has_table_privilege('anon', c.oid, p) $$, 'SEC-10: anon sem privilégio em tabelas e views de public');
select is_empty($$ select pol.polname from pg_policy pol
  where pol.polrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
    and (0 = any(pol.polroles) or 'anon'::regrole = any(pol.polroles)) $$, 'SEC-10: nenhuma política para anon ou public');
select is_empty($$ select pol.polname from pg_policy pol
  where pol.polrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
    and pol.polroles <> array['authenticated'::regrole]::oid[] $$, 'todas as políticas de public são só para authenticated');
select is_empty($$ select p.oid::regprocedure::text from pg_proc p
  where p.oid in ('public.submit_feedback(uuid,text,uuid,boolean,boolean,text)'::regprocedure,
    'public.decide_opportunity(uuid,text,text,text)'::regprocedure, 'public.decide_diagnosis(uuid,text,text)'::regprocedure,
    'public.set_active_protocol_version(uuid)'::regprocedure, 'private.is_org_manager(uuid)'::regprocedure,
    'private.can_read_evaluation(uuid)'::regprocedure, 'private.can_edit_evaluation(uuid)'::regprocedure,
    'private.protect_evaluation()'::regprocedure)
    and has_function_privilege('anon', p.oid, 'EXECUTE') $$, 'SEC-10: anon não executa nenhuma função nova');
select ok(not has_function_privilege('authenticated', 'private.protect_evaluation()', 'EXECUTE'),
  'trigger protect_evaluation não é executável pela API');
select is_empty($$ select p.oid::regprocedure::text from pg_proc p
  where p.oid in ('public.submit_feedback(uuid,text,uuid,boolean,boolean,text)'::regprocedure,
    'public.decide_opportunity(uuid,text,text,text)'::regprocedure, 'public.decide_diagnosis(uuid,text,text)'::regprocedure,
    'public.set_active_protocol_version(uuid)'::regprocedure, 'private.is_org_manager(uuid)'::regprocedure,
    'private.can_read_evaluation(uuid)'::regprocedure, 'private.can_edit_evaluation(uuid)'::regprocedure)
    and not (p.prosecdef and p.proconfig @> array['search_path=""']) $$,
  'SEC-15: funções novas são security definer com search_path vazio');
select ok((select proconfig @> array['search_path=""'] and not prosecdef from pg_proc
  where oid = 'private.protect_evaluation()'::regprocedure), 'SEC-15: trigger com search_path vazio, sem security definer');
select is_empty($$ select p.oid::regprocedure::text from pg_proc p
  where p.oid in ('private.is_org_manager(uuid)'::regprocedure, 'private.can_read_evaluation(uuid)'::regprocedure,
    'private.can_edit_evaluation(uuid)'::regprocedure) and p.provolatile <> 's' $$, 'funções auxiliares são stable');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.effective_feedback'::regclass),
  'effective_feedback usa security_invoker');
select ok(has_table_privilege('authenticated', 'public.effective_feedback', 'SELECT')
  and not has_table_privilege('authenticated', 'public.effective_feedback', 'INSERT')
  and not has_table_privilege('authenticated', 'public.effective_feedback', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.effective_feedback', 'DELETE'),
  'effective_feedback: authenticated só tem SELECT');
select ok(not has_column_privilege('authenticated', 'public.ai_provider_configs', 'secret_ref', 'SELECT'),
  'SEC-19: secret_ref sem SELECT para authenticated');
select ok(not has_column_privilege('authenticated', 'public.survey_tickets', 'token', 'INSERT')
  and not has_column_privilege('authenticated', 'public.survey_tickets', 'token', 'UPDATE'),
  'SEC-11: token sem INSERT/UPDATE para authenticated');
select is_empty($$ select pol.polname from pg_policy pol where pol.polrelid = 'public.evaluation_files'::regclass $$,
  'evaluation_files segue sem políticas (TASK-013)');

select * from finish();
rollback;
