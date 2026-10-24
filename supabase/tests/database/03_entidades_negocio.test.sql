-- TASK-011 — Integridade de negócio, histórico, seed e negação total pela API.
begin;
create extension if not exists pgtap with schema extensions;
select plan(253);

-- Dados estritamente sintéticos; toda alteração é revertida no fim do arquivo.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000010', 'supervisor@entidades.test', now(), '{}'),
  ('00000000-0000-4000-8000-000000000011', 'analista@outraempresa.test', now(), '{}');
insert into public.organizations (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Empresa Sintética X'), ('00000000-0000-4000-8000-000000000002', 'Empresa Sintética Y');
insert into public.memberships (user_id, organization_id, role) values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'supervisor'), ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'analista');

-- Seed por organização, antes de qualquer alteração dos registros iniciais.
select is((select value from public.app_settings where organization_id = '00000000-0000-4000-8000-000000000001' and key = 'csat_positive_threshold'), '4'::text, 'seed cria threshold 4');
select results_eq($$ select version, is_active, description from public.protocol_versions where organization_id = '00000000-0000-4000-8000-000000000001' order by version $$,
  $$ values ('V1.1'::text, false, 'Linha de base de paridade'::text), ('V1.2', true, 'Comunicação assertiva e rapport nas oportunidades — D-019') $$, 'seed cria V1.1 inativa e V1.2 ativa com descrições exatas');
select is((select count(*) from public.app_settings), 2::bigint, 'seed isolado nas duas organizações');
select is((select count(*) from public.protocol_versions where is_active), 2::bigint, 'uma versão ativa em cada organização');
select throws_ok('update public.app_settings set value = ''6'' where key = ''csat_positive_threshold''', '23514', null, 'threshold 6 rejeitado');
select throws_ok('insert into public.protocol_versions (organization_id, version, is_active) values (''00000000-0000-4000-8000-000000000001'', ''V9'', true)', '23505', null, 'segunda versão ativa por organização rejeitada');
select throws_ok('insert into public.protocol_versions (organization_id, version) values (''00000000-0000-4000-8000-000000000001'', ''V1.1'')', '23505', null, 'versão repetida por organização rejeitada');
insert into public.evaluations (id, organization_id, protocol, analyst_user_id, source) values ('00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000001', 'ABC-1', '00000000-0000-4000-8000-000000000010', 'texto');
insert into public.evaluations (id, organization_id, protocol, source) values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', 'XYZ-2', 'texto');
insert into public.evaluations (id, organization_id, protocol, source) values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'OUTRO', 'texto');
insert into public.evaluations (id, organization_id, protocol, source) values ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'APAGAR', 'texto');
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version) values ('00000000-0000-4000-8000-000000000200', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', 1, 'em_andamento', 'V1.2');
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 1, 'em_andamento', 'V1.2');
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version) values ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 1, 'em_andamento', 'V1.2');
insert into public.analysis_runs (id, organization_id, evaluation_id, run_number, status, prompt_version) values ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', 2, 'em_andamento', 'V1.2');
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position) values ('00000000-0000-4000-8000-000000000300', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000200', 0);
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position) values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 0);
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position) values ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000202', 0);
insert into public.opportunities (id, organization_id, evaluation_id, analysis_run_id, position) values ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000203', 0);
insert into public.evaluation_scores (id, organization_id, evaluation_id, analysis_run_id, competency, score) values ('00000000-0000-4000-8000-000000000400', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000200', 'Empatia e acolhimento', 7.5);
insert into public.analysis_feedback (id, organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role) values ('00000000-0000-4000-8000-000000000500', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000200', 'diagnostico', '00000000-0000-4000-8000-000000000010', 'analista');
insert into public.csat_records (id, organization_id, evaluation_id, source, score, score_origin) values ('00000000-0000-4000-8000-000000000800', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'manual', 4, 'real');
insert into public.survey_tickets (id, organization_id, evaluation_id) values ('00000000-0000-4000-8000-000000000600', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100');
insert into public.survey_responses (id, organization_id, ticket_id, score) values ('00000000-0000-4000-8000-000000000700', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000600', 4);
insert into public.curation_logs (id, organization_id, evaluation_id, analysis_run_id, target, action) values ('00000000-0000-4000-8000-000000001200', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', '00000000-0000-4000-8000-000000000200', 'diagnóstico', 'diagnóstico aprovado');
insert into public.ai_failures (id, organization_id, evaluation_id, stage, error_code) values ('00000000-0000-4000-8000-000000000900', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'analise', 'timeout');
insert into public.evaluation_files (id, organization_id, evaluation_id, storage_path, kind, size_bytes) values ('00000000-0000-4000-8000-000000001000', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000100', 'sintetico/arquivo.txt', 'txt', 10);
insert into public.ai_provider_configs (id, organization_id, provider, base_url, model) values ('00000000-0000-4000-8000-000000001100', '00000000-0000-4000-8000-000000000001', 'openai_compativel', 'https://api.exemplo.test/v1', 'modelo_sintetico');

-- Classificação: fronteiras independentes da implementação e coluna gerada.
select is(public.score_classification(10::numeric), 'Excelente', 'score_classification(10) → Excelente');
update public.evaluation_scores set score = 10 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Excelente', 'coluna gerada para nota 10');
select is(public.score_classification(9::numeric), 'Excelente', 'score_classification(9) → Excelente');
update public.evaluation_scores set score = 9 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Excelente', 'coluna gerada para nota 9');
select is(public.score_classification(8.99::numeric), 'Bom', 'score_classification(8.99) → Bom');
update public.evaluation_scores set score = 8.99 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Bom', 'coluna gerada para nota 8.99');
select is(public.score_classification(7::numeric), 'Bom', 'score_classification(7) → Bom');
update public.evaluation_scores set score = 7 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Bom', 'coluna gerada para nota 7');
select is(public.score_classification(6.99::numeric), 'Atenção', 'score_classification(6.99) → Atenção');
update public.evaluation_scores set score = 6.99 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Atenção', 'coluna gerada para nota 6.99');
select is(public.score_classification(6.5::numeric), 'Atenção', 'score_classification(6.5) → Atenção');
update public.evaluation_scores set score = 6.5 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Atenção', 'coluna gerada para nota 6.5');
select is(public.score_classification(5::numeric), 'Atenção', 'score_classification(5) → Atenção');
update public.evaluation_scores set score = 5 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Atenção', 'coluna gerada para nota 5');
select is(public.score_classification(4.99::numeric), 'Insatisfatório', 'score_classification(4.99) → Insatisfatório');
update public.evaluation_scores set score = 4.99 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Insatisfatório', 'coluna gerada para nota 4.99');
select is(public.score_classification(3::numeric), 'Insatisfatório', 'score_classification(3) → Insatisfatório');
update public.evaluation_scores set score = 3 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Insatisfatório', 'coluna gerada para nota 3');
select is(public.score_classification(2.99::numeric), 'Crítico', 'score_classification(2.99) → Crítico');
update public.evaluation_scores set score = 2.99 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Crítico', 'coluna gerada para nota 2.99');
select is(public.score_classification(0::numeric), 'Crítico', 'score_classification(0) → Crítico');
update public.evaluation_scores set score = 0 where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Crítico', 'coluna gerada para nota 0');
select is(public.score_classification(null::numeric), 'Não avaliável', 'score_classification(null) → Não avaliável');
update public.evaluation_scores set score = null where id = '00000000-0000-4000-8000-000000000400';
select is((select classification from public.evaluation_scores where id = '00000000-0000-4000-8000-000000000400'), 'Não avaliável', 'coluna gerada para nota null');
select is(public.score_classification(-1), 'Não avaliável'::text, 'nota negativa não avaliável na função');
select throws_ok('update public.evaluation_scores set score = -1 where id = ''00000000-0000-4000-8000-000000000400''', '23514', null, 'nota negativa não persistida');
select throws_ok('update public.evaluation_scores set score = 10.01 where id = ''00000000-0000-4000-8000-000000000400''', '23514', null, 'nota acima de 10 não persistida');
select throws_ok('update public.evaluation_scores set classification = ''Excelente'' where id = ''00000000-0000-4000-8000-000000000400''', '428C9', null, 'classificação não aceita escrita manual');
select ok((select provolatile = 'i' and not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.score_classification(numeric)'::regprocedure), 'função immutable, invoker e search_path vazio');
select results_eq($$ select severity, origin, confidence, status, communication_techniques from public.opportunities where id = '00000000-0000-4000-8000-000000000300' $$,
  $$ values ('Desejável'::text, 'Indeterminada'::text, 'Médio'::text, 'pendente'::text, '{}'::text[]) $$, 'defaults exatos da oportunidade');
select ok((select diagnosis_status from public.evaluations where id = '00000000-0000-4000-8000-000000000100') is null, 'diagnóstico nulo antes da primeira análise');

-- Todos os valores de cx.js são aceitos; valor desconhecido é rejeitado.
select lives_ok('update public.evaluations set status = ''rascunho'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.status: aceita rascunho');
select lives_ok('update public.evaluations set status = ''transcrito'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.status: aceita transcrito');
select lives_ok('update public.evaluations set status = ''analisado'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.status: aceita analisado');
select lives_ok('update public.evaluations set status = ''curado'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.status: aceita curado');
select throws_ok('update public.evaluations set status = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000100''', '23514', null, 'evaluations.status: rejeita valor desconhecido');
update public.evaluations set status = 'rascunho' where id = '00000000-0000-4000-8000-000000000100';
select lives_ok('update public.evaluations set channel = ''Chat'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.channel: aceita Chat');
select lives_ok('update public.evaluations set channel = ''WhatsApp'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.channel: aceita WhatsApp');
select lives_ok('update public.evaluations set channel = ''E-mail'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.channel: aceita E-mail');
select lives_ok('update public.evaluations set channel = ''Telefone'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.channel: aceita Telefone');
select lives_ok('update public.evaluations set channel = ''Outro'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.channel: aceita Outro');
select throws_ok('update public.evaluations set channel = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000100''', '23514', null, 'evaluations.channel: rejeita valor desconhecido');
update public.evaluations set channel = 'Chat' where id = '00000000-0000-4000-8000-000000000100';
select lives_ok('update public.evaluations set diagnosis_status = ''pendente'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.diagnosis_status: aceita pendente');
select lives_ok('update public.evaluations set diagnosis_status = ''aprovado'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.diagnosis_status: aceita aprovado');
select lives_ok('update public.evaluations set diagnosis_status = ''rejeitado'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.diagnosis_status: aceita rejeitado');
select throws_ok('update public.evaluations set diagnosis_status = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000100''', '23514', null, 'evaluations.diagnosis_status: rejeita valor desconhecido');
update public.evaluations set diagnosis_status = 'pendente' where id = '00000000-0000-4000-8000-000000000100';
select lives_ok('update public.evaluations set source = ''prints'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.source: aceita prints');
select lives_ok('update public.evaluations set source = ''texto'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.source: aceita texto');
select lives_ok('update public.evaluations set source = ''importacao'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.source: aceita importacao');
select lives_ok('update public.evaluations set source = ''extensao'' where id = ''00000000-0000-4000-8000-000000000100''', 'evaluations.source: aceita extensao');
select throws_ok('update public.evaluations set source = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000100''', '23514', null, 'evaluations.source: rejeita valor desconhecido');
update public.evaluations set source = 'prints' where id = '00000000-0000-4000-8000-000000000100';
select lives_ok('update public.analysis_runs set trend = ''Favorável'' where id = ''00000000-0000-4000-8000-000000000200''', 'analysis_runs.trend: aceita Favorável');
select lives_ok('update public.analysis_runs set trend = ''Incerta'' where id = ''00000000-0000-4000-8000-000000000200''', 'analysis_runs.trend: aceita Incerta');
select lives_ok('update public.analysis_runs set trend = ''Desfavorável'' where id = ''00000000-0000-4000-8000-000000000200''', 'analysis_runs.trend: aceita Desfavorável');
select throws_ok('update public.analysis_runs set trend = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000200''', '23514', null, 'analysis_runs.trend: rejeita valor desconhecido');
update public.analysis_runs set trend = 'Favorável' where id = '00000000-0000-4000-8000-000000000200';
select lives_ok('update public.evaluation_scores set competency = ''Empatia e acolhimento'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Empatia e acolhimento');
select lives_ok('update public.evaluation_scores set competency = ''Comunicação e clareza'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Comunicação e clareza');
select lives_ok('update public.evaluation_scores set competency = ''Eficiência do atendimento'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Eficiência do atendimento');
select lives_ok('update public.evaluation_scores set competency = ''Conhecimento e condução técnica'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Conhecimento e condução técnica');
select lives_ok('update public.evaluation_scores set competency = ''Experiência do cliente e Customer Success'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Experiência do cliente e Customer Success');
select lives_ok('update public.evaluation_scores set competency = ''Gestão comunicacional durante o multiatendimento'' where id = ''00000000-0000-4000-8000-000000000400''', 'evaluation_scores.competency: aceita Gestão comunicacional durante o multiatendimento');
select throws_ok('update public.evaluation_scores set competency = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000400''', '23514', null, 'evaluation_scores.competency: rejeita valor desconhecido');
update public.evaluation_scores set competency = 'Empatia e acolhimento' where id = '00000000-0000-4000-8000-000000000400';
select lives_ok('update public.opportunities set severity = ''Crítica'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.severity: aceita Crítica');
select lives_ok('update public.opportunities set severity = ''Importante'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.severity: aceita Importante');
select lives_ok('update public.opportunities set severity = ''Desejável'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.severity: aceita Desejável');
select throws_ok('update public.opportunities set severity = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'opportunities.severity: rejeita valor desconhecido');
update public.opportunities set severity = 'Crítica' where id = '00000000-0000-4000-8000-000000000300';
select lives_ok('update public.opportunities set origin = ''Analista'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.origin: aceita Analista');
select lives_ok('update public.opportunities set origin = ''Processo'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.origin: aceita Processo');
select lives_ok('update public.opportunities set origin = ''Produto'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.origin: aceita Produto');
select lives_ok('update public.opportunities set origin = ''Política empresarial'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.origin: aceita Política empresarial');
select lives_ok('update public.opportunities set origin = ''Indeterminada'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.origin: aceita Indeterminada');
select throws_ok('update public.opportunities set origin = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'opportunities.origin: rejeita valor desconhecido');
update public.opportunities set origin = 'Analista' where id = '00000000-0000-4000-8000-000000000300';
select lives_ok('update public.opportunities set confidence = ''Alto'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.confidence: aceita Alto');
select lives_ok('update public.opportunities set confidence = ''Médio'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.confidence: aceita Médio');
select lives_ok('update public.opportunities set confidence = ''Baixo'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.confidence: aceita Baixo');
select throws_ok('update public.opportunities set confidence = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'opportunities.confidence: rejeita valor desconhecido');
update public.opportunities set confidence = 'Alto' where id = '00000000-0000-4000-8000-000000000300';
select lives_ok('update public.opportunities set status = ''pendente'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.status: aceita pendente');
select lives_ok('update public.opportunities set status = ''aprovada'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.status: aceita aprovada');
select lives_ok('update public.opportunities set status = ''ajustada'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.status: aceita ajustada');
select lives_ok('update public.opportunities set status = ''rejeitada'' where id = ''00000000-0000-4000-8000-000000000300''', 'opportunities.status: aceita rejeitada');
select throws_ok('update public.opportunities set status = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'opportunities.status: rejeita valor desconhecido');
update public.opportunities set status = 'pendente' where id = '00000000-0000-4000-8000-000000000300';
select lives_ok('update public.analysis_feedback set author_role = ''analista'' where id = ''00000000-0000-4000-8000-000000000500''', 'analysis_feedback.author_role: aceita analista');
select lives_ok('update public.analysis_feedback set author_role = ''supervisor'' where id = ''00000000-0000-4000-8000-000000000500''', 'analysis_feedback.author_role: aceita supervisor');
select throws_ok('update public.analysis_feedback set author_role = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000500''', '23514', null, 'analysis_feedback.author_role: rejeita valor desconhecido');
update public.analysis_feedback set author_role = 'analista' where id = '00000000-0000-4000-8000-000000000500';
select lives_ok('update public.csat_records set source = ''planilha'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.source: aceita planilha');
select lives_ok('update public.csat_records set source = ''pesquisa'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.source: aceita pesquisa');
select lives_ok('update public.csat_records set source = ''manual'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.source: aceita manual');
select lives_ok('update public.csat_records set source = ''arquivo'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.source: aceita arquivo');
select throws_ok('update public.csat_records set source = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'csat_records.source: rejeita valor desconhecido');
update public.csat_records set source = 'planilha' where id = '00000000-0000-4000-8000-000000000800';
select lives_ok('update public.csat_records set level = ''Ótimo'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.level: aceita Ótimo');
select lives_ok('update public.csat_records set level = ''Bom'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.level: aceita Bom');
select lives_ok('update public.csat_records set level = ''Neutro'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.level: aceita Neutro');
select lives_ok('update public.csat_records set level = ''Ruim'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.level: aceita Ruim');
select lives_ok('update public.csat_records set level = ''Péssimo'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.level: aceita Péssimo');
select throws_ok('update public.csat_records set level = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'csat_records.level: rejeita valor desconhecido');
update public.csat_records set level = 'Ótimo' where id = '00000000-0000-4000-8000-000000000800';
select lives_ok('update public.csat_records set channel = ''Chat'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.channel: aceita Chat');
select lives_ok('update public.csat_records set channel = ''WhatsApp'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.channel: aceita WhatsApp');
select lives_ok('update public.csat_records set channel = ''E-mail'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.channel: aceita E-mail');
select lives_ok('update public.csat_records set channel = ''Telefone'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.channel: aceita Telefone');
select lives_ok('update public.csat_records set channel = ''Outro'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.channel: aceita Outro');
select throws_ok('update public.csat_records set channel = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'csat_records.channel: rejeita valor desconhecido');
update public.csat_records set channel = 'Chat' where id = '00000000-0000-4000-8000-000000000800';
select lives_ok('update public.csat_records set score_origin = ''real'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.score_origin: aceita real');
select lives_ok('update public.csat_records set score_origin = ''derivada_nivel'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.score_origin: aceita derivada_nivel');
select lives_ok('update public.csat_records set score_origin = ''derivada_sentimento'' where id = ''00000000-0000-4000-8000-000000000800''', 'csat_records.score_origin: aceita derivada_sentimento');
select throws_ok('update public.csat_records set score_origin = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'csat_records.score_origin: rejeita valor desconhecido');
update public.csat_records set score_origin = 'real' where id = '00000000-0000-4000-8000-000000000800';
select lives_ok('update public.ai_failures set stage = ''transcricao'' where id = ''00000000-0000-4000-8000-000000000900''', 'ai_failures.stage: aceita transcricao');
select lives_ok('update public.ai_failures set stage = ''analise'' where id = ''00000000-0000-4000-8000-000000000900''', 'ai_failures.stage: aceita analise');
select lives_ok('update public.ai_failures set stage = ''extracao_csat'' where id = ''00000000-0000-4000-8000-000000000900''', 'ai_failures.stage: aceita extracao_csat');
select lives_ok('update public.ai_failures set stage = ''importacao'' where id = ''00000000-0000-4000-8000-000000000900''', 'ai_failures.stage: aceita importacao');
select lives_ok('update public.ai_failures set stage = ''teste_conexao'' where id = ''00000000-0000-4000-8000-000000000900''', 'ai_failures.stage: aceita teste_conexao');
select throws_ok('update public.ai_failures set stage = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000000900''', '23514', null, 'ai_failures.stage: rejeita valor desconhecido');
update public.ai_failures set stage = 'transcricao' where id = '00000000-0000-4000-8000-000000000900';
select lives_ok('update public.evaluation_files set kind = ''print'' where id = ''00000000-0000-4000-8000-000000001000''', 'evaluation_files.kind: aceita print');
select lives_ok('update public.evaluation_files set kind = ''pdf'' where id = ''00000000-0000-4000-8000-000000001000''', 'evaluation_files.kind: aceita pdf');
select lives_ok('update public.evaluation_files set kind = ''planilha'' where id = ''00000000-0000-4000-8000-000000001000''', 'evaluation_files.kind: aceita planilha');
select lives_ok('update public.evaluation_files set kind = ''txt'' where id = ''00000000-0000-4000-8000-000000001000''', 'evaluation_files.kind: aceita txt');
select throws_ok('update public.evaluation_files set kind = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000001000''', '23514', null, 'evaluation_files.kind: rejeita valor desconhecido');
update public.evaluation_files set kind = 'print' where id = '00000000-0000-4000-8000-000000001000';
select lives_ok('update public.ai_provider_configs set provider = ''openai_compativel'' where id = ''00000000-0000-4000-8000-000000001100''', 'ai_provider_configs.provider: aceita openai_compativel');
select throws_ok('update public.ai_provider_configs set provider = ''valor_inexistente'' where id = ''00000000-0000-4000-8000-000000001100''', '23514', null, 'ai_provider_configs.provider: rejeita valor desconhecido');
update public.ai_provider_configs set provider = 'openai_compativel' where id = '00000000-0000-4000-8000-000000001100';
select throws_ok('update public.analysis_runs set status = ''desconhecido'' where id = ''00000000-0000-4000-8000-000000000200''', '23514', null, 'status de execução inválido rejeitado');
select throws_ok('update public.analysis_feedback set target_type = ''desconhecido'' where id = ''00000000-0000-4000-8000-000000000500''', '23514', null, 'tipo de alvo inválido rejeitado');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''oportunidade'', ''diagnóstico aprovado'')', 'log aceita alvo oportunidade');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''diagnóstico aprovado'')', 'log aceita alvo diagnóstico');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''aprovada'')', 'log aceita ação aprovada');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''ajustada'')', 'log aceita ação ajustada');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''rejeitada'')', 'log aceita ação rejeitada');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''diagnóstico aprovado'')', 'log aceita ação diagnóstico aprovado');
select lives_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''diagnóstico rejeitado'')', 'log aceita ação diagnóstico rejeitado');
select throws_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''desconhecido'', ''diagnóstico aprovado'')', '23514', null, 'log rejeita alvo inválido');
select throws_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''desconhecida'')', '23514', null, 'log rejeita ação inválida');
select lives_ok('update public.opportunities set communication_techniques = array[''Assertividade''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Assertividade');
select lives_ok('update public.opportunities set communication_techniques = array[''Rapport''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Rapport');
select lives_ok('update public.opportunities set communication_techniques = array[''Escuta ativa''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Escuta ativa');
select lives_ok('update public.opportunities set communication_techniques = array[''Validação emocional''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Validação emocional');
select lives_ok('update public.opportunities set communication_techniques = array[''Linguagem positiva''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Linguagem positiva');
select lives_ok('update public.opportunities set communication_techniques = array[''Clareza e objetividade''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita técnica Clareza e objetividade');
select lives_ok('update public.opportunities set communication_techniques = array[''Rapport'',''Assertividade''] where id = ''00000000-0000-4000-8000-000000000300''', 'aceita subconjunto de técnicas');
select throws_ok('update public.opportunities set communication_techniques = array[''Técnica inexistente''] where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'rejeita técnica desconhecida');
select throws_ok('update public.opportunities set communication_techniques = array[null]::text[] where id = ''00000000-0000-4000-8000-000000000300''', '23514', null, 'rejeita elemento nulo nas técnicas');

-- Unicidade normalizada do protocolo (D-012).
select throws_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', '' abc-1 '', ''00000000-0000-4000-8000-000000000010'', ''texto'')', '23505', null, 'mesma organização: espaços e caixa não distinguem protocolo');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000002'', '' abc-1 '', ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'outra organização pode ter o mesmo protocolo normalizado');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', null, ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo null não colide');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', null, ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo null não colide');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', '''', ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo "" não colide');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', '''', ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo "" não colide');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', ''   '', ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo "   " não colide');
select lives_ok('insert into public.evaluations (organization_id, protocol, analyst_user_id, source) values (''00000000-0000-4000-8000-000000000001'', ''   '', ''00000000-0000-4000-8000-000000000010'', ''texto'')', 'protocolo "   " não colide');

-- FKs compostas: pai e filho devem compartilhar organização e execução.
select throws_ok('insert into public.analysis_runs (organization_id, evaluation_id, run_number, status, prompt_version) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', 99, ''em_andamento'', ''V1.2'')', '23503', null, 'analysis_runs: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.evaluation_scores (organization_id, evaluation_id, analysis_run_id, competency, score) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000203'', ''Empatia e acolhimento'', 7.5)', '23503', null, 'evaluation_scores: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.opportunities (organization_id, evaluation_id, analysis_run_id, position) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', 0)', '23503', null, 'opportunities: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnostico'', ''00000000-0000-4000-8000-000000000010'', ''supervisor'')', '23503', null, 'analysis_feedback: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.evaluation_files (organization_id, evaluation_id, storage_path, kind, size_bytes) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''outra/arquivo.txt'', ''txt'', 10)', '23503', null, 'evaluation_files: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.survey_tickets (organization_id, evaluation_id) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'')', '23503', null, 'survey_tickets: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnóstico'', ''diagnóstico aprovado'')', '23503', null, 'curation_logs: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.csat_records (organization_id, evaluation_id, source, score, score_origin) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''manual'', 4, ''real'')', '23503', null, 'csat_records: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.ai_failures (organization_id, evaluation_id, stage, error_code) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000100'', ''analise'', ''timeout'')', '23503', null, 'ai_failures: avaliação de outra organização é rejeitada');
select throws_ok('insert into public.evaluation_scores (organization_id, evaluation_id, analysis_run_id, competency, score) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000202'', ''Empatia e acolhimento'', 7.5)', '23503', null, 'score: execução de outra avaliação é rejeitada');
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''oportunidade'', ''00000000-0000-4000-8000-000000000010'', ''analista'', ''00000000-0000-4000-8000-000000000303'')', '23503', null, 'feedback não pode apontar oportunidade de outra execução da mesma avaliação');
select throws_ok('insert into public.curation_logs (organization_id, evaluation_id, analysis_run_id, target, action, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', null, ''diagnóstico'', ''diagnóstico aprovado'', ''00000000-0000-4000-8000-000000000302'')', '23503', null, 'log sem execução também exige oportunidade da própria avaliação');
select throws_ok('update public.evaluations set current_analysis_run_id = ''00000000-0000-4000-8000-000000000202'' where id = ''00000000-0000-4000-8000-000000000100''', '23503', null, 'execução atual deve pertencer à própria avaliação');
select lives_ok('update public.evaluations set current_analysis_run_id = ''00000000-0000-4000-8000-000000000200'' where id = ''00000000-0000-4000-8000-000000000100''', 'atualiza ponteiro para execução da própria avaliação');
select throws_ok('insert into public.analysis_runs (organization_id, evaluation_id, run_number, status, prompt_version) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', 1, ''em_andamento'', ''V1.2'')', '23505', null, 'número de execução duplicado por avaliação é rejeitado');

-- Feedback por alvo e papel, inclusive NULLS NOT DISTINCT no diagnóstico.
update public.analysis_feedback set author_role = 'analista' where id = '00000000-0000-4000-8000-000000000500';
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnostico'', ''00000000-0000-4000-8000-000000000010'', ''analista'')', '23505', null, 'um diagnóstico vigente por papel mesmo com opportunity_id nulo');
select lives_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnostico'', ''00000000-0000-4000-8000-000000000010'', ''supervisor'')', 'outro papel pode dar feedback no mesmo diagnóstico');
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''oportunidade'', ''00000000-0000-4000-8000-000000000010'', ''analista'', null)', '23514', null, 'oportunidade exige opportunity_id');
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''diagnostico'', ''00000000-0000-4000-8000-000000000010'', ''analista'', ''00000000-0000-4000-8000-000000000300'')', '23514', null, 'diagnóstico não aceita opportunity_id');
select lives_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''oportunidade'', ''00000000-0000-4000-8000-000000000010'', ''analista'', ''00000000-0000-4000-8000-000000000300'')', 'feedback de oportunidade válida aceito');
select throws_ok('insert into public.analysis_feedback (organization_id, evaluation_id, analysis_run_id, target_type, author_id, author_role, opportunity_id) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''00000000-0000-4000-8000-000000000200'', ''oportunidade'', ''00000000-0000-4000-8000-000000000010'', ''analista'', ''00000000-0000-4000-8000-000000000300'')', '23505', null, 'feedback de oportunidade é único por papel');
select throws_ok('update public.analysis_feedback set comment = ''xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'' where id = ''00000000-0000-4000-8000-000000000500''', '23514', null, 'comentário de feedback acima de 2000 rejeitado');
select lives_ok('update public.analysis_feedback set comment = ''xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'' where id = ''00000000-0000-4000-8000-000000000500''', 'comentário de feedback com 2000 aceito');

-- CSAT e origem precisam coexistir, e a nota deve ser de 1 a 5.
select throws_ok('update public.csat_records set score = 0 where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'CSAT 0 rejeitado');
select throws_ok('update public.csat_records set score = 6 where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'CSAT 6 rejeitado');
select throws_ok('update public.csat_records set score = null where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'origem sem score rejeitada');
select throws_ok('update public.csat_records set score_origin = null where id = ''00000000-0000-4000-8000-000000000800''', '23514', null, 'score sem origem rejeitado');
select lives_ok('update public.csat_records set score = null, score_origin = null where id = ''00000000-0000-4000-8000-000000000800''', 'score e origem ambos nulos aceitos');

-- Tokens gerados no servidor, única resposta e tenant do ticket.
select ok((select length(token) = 64 and token ~ '^[0-9a-f]{64}$' from public.survey_tickets where id = '00000000-0000-4000-8000-000000000600'), 'token padrão tem 64 caracteres hex (256 bits)');
select lives_ok('insert into public.survey_tickets (organization_id, evaluation_id, id) values (''00000000-0000-4000-8000-000000000002'', ''00000000-0000-4000-8000-000000000101'', ''00000000-0000-4000-8000-000000000601'')', 'outro ticket gera token independente');
select is((select count(distinct token) from public.survey_tickets), 2::bigint, 'tokens gerados são únicos');
select throws_ok('insert into public.survey_tickets (organization_id, evaluation_id, token) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''curto'')', '23514', null, 'token fora do comprimento exigido rejeitado');
select throws_ok('insert into public.survey_responses (organization_id, ticket_id, score) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000600'', 4)', '23505', null, 'segunda resposta do mesmo ticket rejeitada');
select throws_ok('insert into public.survey_responses (organization_id, ticket_id, score) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000601'', 4)', 'CX022', null, 'resposta deve compartilhar organização do ticket');
select throws_ok('update public.survey_responses set organization_id = ''00000000-0000-4000-8000-000000000002'' where id = ''00000000-0000-4000-8000-000000000700''', 'CX022', null, 'UPDATE de resposta também valida organização');
select throws_ok('update public.survey_responses set score = 0 where id = ''00000000-0000-4000-8000-000000000700''', '23514', null, 'resposta CSAT 0 rejeitada');
select throws_ok('update public.survey_responses set score = 6 where id = ''00000000-0000-4000-8000-000000000700''', '23514', null, 'resposta CSAT 6 rejeitada');
select throws_ok('update public.survey_responses set comment = ''xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'' where id = ''00000000-0000-4000-8000-000000000700''', '23514', null, 'comentário de pesquisa acima de 2000 rejeitado');

-- Históricos são protegidos também para postgres, sem exceção por papel.
select is(current_user::text, 'postgres'::text, 'testes de imutabilidade executados como postgres/dono');
select lives_ok('update public.analysis_runs set summary_feedback = ''Diagnóstico sintético em andamento'' where id = ''00000000-0000-4000-8000-000000000200''', 'execução em andamento pode ser atualizada');
select lives_ok('update public.analysis_runs set status = ''sucesso'' where id = ''00000000-0000-4000-8000-000000000200''', 'execução pode concluir com sucesso');
select throws_ok('update public.analysis_runs set model = ''outro_modelo'' where id = ''00000000-0000-4000-8000-000000000200''', 'CX020', null, 'execução concluída com sucesso é imutável');
update public.analysis_runs set status = 'falha' where id = '00000000-0000-4000-8000-000000000201';
select throws_ok('update public.analysis_runs set error_code = ''alterado'' where id = ''00000000-0000-4000-8000-000000000201''', 'CX020', null, 'execução concluída com falha é imutável');
select throws_ok('delete from public.analysis_runs where id = ''00000000-0000-4000-8000-000000000200''', 'CX020', null, 'DELETE de execução 200 sempre bloqueado');
select throws_ok('delete from public.analysis_runs where id = ''00000000-0000-4000-8000-000000000201''', 'CX020', null, 'DELETE de execução 201 sempre bloqueado');
select throws_ok('delete from public.analysis_runs where id = ''00000000-0000-4000-8000-000000000202''', 'CX020', null, 'DELETE de execução 202 sempre bloqueado');
select throws_ok('update public.curation_logs set note = ''alterado'' where id = ''00000000-0000-4000-8000-000000001200''', 'CX021', null, 'UPDATE de log bloqueado para postgres');
select throws_ok('delete from public.curation_logs where id = ''00000000-0000-4000-8000-000000001200''', 'CX021', null, 'DELETE de log bloqueado para postgres');
select throws_ok('truncate public.curation_logs', 'CX021', null, 'TRUNCATE não contorna append-only');
select throws_ok('truncate public.analysis_runs cascade', 'CX020', null, 'TRUNCATE não apaga histórico de execuções');

-- Configuração de IA só referencia o Vault; erros não armazenam payload/PII.
select throws_ok('update public.ai_failures set error_code = ''erro com espaço'' where id = ''00000000-0000-4000-8000-000000000900''', '23514', null, 'error_code inválido rejeitado (15 caracteres)');
select throws_ok('update public.ai_failures set error_code = ''ErroMaiusculo'' where id = ''00000000-0000-4000-8000-000000000900''', '23514', null, 'error_code inválido rejeitado (13 caracteres)');
select throws_ok('update public.ai_failures set error_code = ''xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'' where id = ''00000000-0000-4000-8000-000000000900''', '23514', null, 'error_code inválido rejeitado (65 caracteres)');
select throws_ok('update public.ai_failures set error_code = '''' where id = ''00000000-0000-4000-8000-000000000900''', '23514', null, 'error_code inválido rejeitado (0 caracteres)');
select throws_ok('update public.ai_provider_configs set base_url = ''http://api.exemplo.test'' where id = ''00000000-0000-4000-8000-000000001100''', '23514', null, 'provedor exige HTTPS');
select lives_ok('update public.ai_provider_configs set is_active = ''true'' where id = ''00000000-0000-4000-8000-000000001100''', 'ativa primeira configuração da organização');
select throws_ok('insert into public.ai_provider_configs (organization_id, provider, base_url, model, is_active) values (''00000000-0000-4000-8000-000000000001'', ''openai_compativel'', ''https://api.exemplo.test/v1'', ''modelo_sintetico'', ''true'')', '23505', null, 'segunda configuração ativa na organização rejeitada');
select lives_ok('insert into public.ai_provider_configs (organization_id, provider, base_url, model, is_active) values (''00000000-0000-4000-8000-000000000002'', ''openai_compativel'', ''https://api.exemplo.test/v1'', ''modelo_sintetico'', ''true'')', 'outra organização pode ter configuração ativa');
select set_eq($$ select column_name::text from information_schema.columns where table_schema = 'public' and table_name = 'ai_failures' $$,
  array['id','organization_id','created_at','updated_at','evaluation_id','analysis_run_id','stage','error_code','prompt_version','provider','model'], 'ai_failures tem somente metadados técnicos autorizados');
select set_eq($$ select column_name::text from information_schema.columns where table_schema = 'public' and table_name = 'ai_provider_configs' $$,
  array['id','organization_id','created_at','updated_at','provider','base_url','model','supports_vision','secret_ref','key_last4','is_active','updated_by'], 'configuração de IA não tem coluna para chave da API');
select throws_ok('update public.evaluation_files set size_bytes = 0 where id = ''00000000-0000-4000-8000-000000001000''', '23514', null, 'arquivo não aceita tamanho zero');
select throws_ok('insert into public.evaluation_files (organization_id, evaluation_id, storage_path, kind, size_bytes) values (''00000000-0000-4000-8000-000000000001'', ''00000000-0000-4000-8000-000000000100'', ''sintetico/arquivo.txt'', ''txt'', 10)', '23505', null, 'caminho do arquivo é único');

-- SET NULL só na avaliação, sem apagar o tenant do CSAT/falha.
select lives_ok('delete from public.evaluations where id = ''00000000-0000-4000-8000-000000000103''', 'remove avaliação sem histórico preservado');
select ok((select evaluation_id from public.csat_records where id = '00000000-0000-4000-8000-000000000800') is null and (select organization_id from public.csat_records where id = '00000000-0000-4000-8000-000000000800') = '00000000-0000-4000-8000-000000000001'::uuid, 'CSAT mantém organização ao perder avaliação');
select ok((select evaluation_id from public.ai_failures where id = '00000000-0000-4000-8000-000000000900') is null and (select organization_id from public.ai_failures where id = '00000000-0000-4000-8000-000000000900') = '00000000-0000-4000-8000-000000000001'::uuid, 'falha mantém organização ao perder avaliação');
select throws_ok('delete from public.organizations where id = ''00000000-0000-4000-8000-000000000001''', '23503', null, 'organização com dados de negócio não pode ser removida');
update public.evaluations set transcript = 'Texto sintético', updated_at = '2000-01-01' where id = '00000000-0000-4000-8000-000000000100';
select ok((select updated_at from public.evaluations where id = '00000000-0000-4000-8000-000000000100') = now(), 'updated_at é mantido pelo trigger estrutural da TASK-010');

-- Nenhuma política de negócio nesta fase: negação total até TASK-012.
select is_empty($$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity $$, 'SEC-16: todas as tabelas public têm RLS');
select is_empty($$ select pol.polname from pg_policy pol join pg_class c on c.oid = pol.polrelid where c.relnamespace = 'public'::regnamespace and c.relname = any(array['ai_failures', 'ai_provider_configs', 'analysis_feedback', 'analysis_runs', 'app_settings', 'csat_records', 'curation_logs', 'evaluation_files', 'evaluation_scores', 'evaluations', 'opportunities', 'protocol_versions', 'survey_responses', 'survey_tickets']) $$, 'nenhuma tabela nova tem política RLS');
select is_empty($$ select c.relname || ':' || privilege from pg_class c cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and has_table_privilege('anon', c.oid, privilege) $$, 'SEC-10: anon sem qualquer privilégio em tabelas public');
select is_empty($$ select p.proname from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in ('protect_analysis_run','protect_curation_log','check_survey_response_org','seed_organization_business') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')) $$, 'funções estruturais novas não são executáveis pelos papéis da API');
select ok((select count(*) > 0 from public.ai_failures), 'ai_failures: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.ai_provider_configs), 'ai_provider_configs: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.analysis_feedback), 'analysis_feedback: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.analysis_runs), 'analysis_runs: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.app_settings), 'app_settings: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.csat_records), 'csat_records: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.curation_logs), 'curation_logs: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.evaluation_files), 'evaluation_files: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.evaluation_scores), 'evaluation_scores: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.evaluations), 'evaluations: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.opportunities), 'opportunities: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.protocol_versions), 'protocol_versions: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.survey_responses), 'survey_responses: existem dados para provar a negação de leitura');
select ok((select count(*) > 0 from public.survey_tickets), 'survey_tickets: existem dados para provar a negação de leitura');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}', true);
set local role authenticated;
select ok(private.is_supervisor('00000000-0000-4000-8000-000000000001'), 'persona é supervisor da organização X');
select is((select count(*) from public.ai_failures), 0::bigint, 'authenticated supervisor não lê ai_failures sem políticas');
select is((select count(*) from public.ai_provider_configs), 0::bigint, 'authenticated supervisor não lê ai_provider_configs sem políticas');
select is((select count(*) from public.analysis_feedback), 0::bigint, 'authenticated supervisor não lê analysis_feedback sem políticas');
select is((select count(*) from public.analysis_runs), 0::bigint, 'authenticated supervisor não lê analysis_runs sem políticas');
select is((select count(*) from public.app_settings), 0::bigint, 'authenticated supervisor não lê app_settings sem políticas');
select is((select count(*) from public.csat_records), 0::bigint, 'authenticated supervisor não lê csat_records sem políticas');
select is((select count(*) from public.curation_logs), 0::bigint, 'authenticated supervisor não lê curation_logs sem políticas');
select is((select count(*) from public.evaluation_files), 0::bigint, 'authenticated supervisor não lê evaluation_files sem políticas');
select is((select count(*) from public.evaluation_scores), 0::bigint, 'authenticated supervisor não lê evaluation_scores sem políticas');
select is((select count(*) from public.evaluations), 0::bigint, 'authenticated supervisor não lê evaluations sem políticas');
select is((select count(*) from public.opportunities), 0::bigint, 'authenticated supervisor não lê opportunities sem políticas');
select is((select count(*) from public.protocol_versions), 0::bigint, 'authenticated supervisor não lê protocol_versions sem políticas');
select is((select count(*) from public.survey_responses), 0::bigint, 'authenticated supervisor não lê survey_responses sem políticas');
select is((select count(*) from public.survey_tickets), 0::bigint, 'authenticated supervisor não lê survey_tickets sem políticas');
reset role;

select * from finish();
rollback;
