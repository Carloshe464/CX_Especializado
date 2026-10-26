-- TASK-012 — RLS de negócio, validação do analista, curadoria do supervisor e veredito
-- efetivo (D-011, D-013, D-016, D-024). Regras cobertas: SEC-03, SEC-05, SEC-06, SEC-07,
-- SEC-08, SEC-10, SEC-11 (coluna token), SEC-12 (RPC), SEC-15, SEC-16, SEC-18, SEC-19.
--
-- Códigos de erro próprios (SQLSTATE) desta migração. CX020–CX022 já são usados pela
-- TASK-011, por isso a numeração nova começa em CX023. CX001 (autenticação necessária)
-- é reaproveitado da TASK-010.
--   CX023 avaliação ou execução não encontrada, ou sem permissão para validá-la
--   CX024 alvo de validação inválido (diagnostico/oportunidade)
--   CX025 a execução não é a atual da avaliação
--   CX026 a execução atual não terminou com sucesso
--   CX027 a oportunidade não pertence à execução
--   CX028 decisão de curadoria inválida
--   CX029 recomendação ajustada só é aceita com a decisão "ajustada"
--   CX030 somente o supervisor da organização decide a curadoria
--   CX031 versão do protocolo não encontrada ou sem permissão
--   CX032 coluna protegida de evaluations alterada pela API
--   CX033 transição de status não permitida pela API
--   CX034 somente o supervisor da organização troca o analista
--   CX035 o analista informado não é membro da organização da avaliação
--   CX036 transcrição bloqueada em avaliação analisada ou curada

-- ---------------------------------------------------------------------------
-- Funções auxiliares (usadas pelas políticas). Identidade só de auth.uid() (SEC-03).
-- ---------------------------------------------------------------------------

-- Admin da plataforma ou supervisor da organização.
create function private.is_org_manager(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin() or private.is_supervisor(p_org);
$$;

-- Leitura da avaliação: admin; supervisor da organização; membro da organização que é
-- o analista da avaliação ou quem a criou (SEC-05, SEC-06, SEC-18).
create function private.can_read_evaluation(p_eval uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_eval
      and (
        private.is_org_manager(e.organization_id)
        or (
          private.is_member(e.organization_id)
          and (e.analyst_user_id = (select auth.uid()) or e.created_by = (select auth.uid()))
        )
      )
  );
$$;

-- Edição da avaliação: mesmas pessoas da leitura. As regras finas ficam no trigger
-- private.protect_evaluation().
create function private.can_edit_evaluation(p_eval uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_eval
      and (
        private.is_org_manager(e.organization_id)
        or (
          private.is_member(e.organization_id)
          and (e.created_by = (select auth.uid()) or e.analyst_user_id = (select auth.uid()))
        )
      )
  );
$$;

revoke all on function private.is_org_manager(uuid), private.can_read_evaluation(uuid),
  private.can_edit_evaluation(uuid) from public, anon, authenticated;
grant execute on function private.is_org_manager(uuid), private.can_read_evaluation(uuid),
  private.can_edit_evaluation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger de proteção de evaluations (chamadas diretas pela API).
-- Roda com a identidade de quem chama: as RPCs security definer rodam como o dono
-- das tabelas e por isso não são bloqueadas aqui.
-- ---------------------------------------------------------------------------
create function private.protect_evaluation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by
     or new.diagnosis_status is distinct from old.diagnosis_status
     or new.supervisor_review is distinct from old.supervisor_review
     or new.current_analysis_run_id is distinct from old.current_analysis_run_id then
    raise exception 'Esta coluna da avaliação só é alterada pelo servidor.' using errcode = 'CX032';
  end if;

  if new.status is distinct from old.status
     and (old.status not in ('rascunho', 'transcrito') or new.status not in ('rascunho', 'transcrito')) then
    raise exception 'Transição de status não permitida.' using errcode = 'CX033';
  end if;

  if new.analyst_user_id is distinct from old.analyst_user_id then
    if not private.is_org_manager(old.organization_id) then
      raise exception 'Somente o supervisor da organização pode trocar o analista.' using errcode = 'CX034';
    end if;
    -- A leitura de memberships respeita a RLS de quem chama: o supervisor vê os
    -- vínculos da própria organização e o admin vê todos.
    if new.analyst_user_id is null or not exists (
      select 1 from public.memberships m
      where m.user_id = new.analyst_user_id and m.organization_id = old.organization_id
    ) then
      raise exception 'O analista informado não pertence à organização da avaliação.' using errcode = 'CX035';
    end if;
  end if;

  if new.transcript is distinct from old.transcript and old.status in ('analisado', 'curado') then
    raise exception 'A transcrição não pode mudar depois da análise.' using errcode = 'CX036';
  end if;

  return new;
end;
$$;
revoke all on function private.protect_evaluation() from public, anon, authenticated;

create trigger evaluations_protect before update on public.evaluations
  for each row execute function private.protect_evaluation();

-- ---------------------------------------------------------------------------
-- evaluations
-- As políticas repetem em linha a regra de private.can_read_evaluation/can_edit_evaluation
-- sobre as colunas da própria linha. Chamar a função com o id leria o snapshot anterior
-- ao comando, e o INSERT ... RETURNING (supabase-js .insert().select()) não enxergaria
-- a linha recém-criada.
-- ---------------------------------------------------------------------------
revoke all on table public.evaluations from public, anon, authenticated;
grant select on table public.evaluations to authenticated;
grant insert (organization_id, protocol, channel, source, transcript, analyst_name, analyst_user_id, status)
  on table public.evaluations to authenticated;
grant update (protocol, channel, source, transcript, analyst_name, analyst_user_id, status)
  on table public.evaluations to authenticated;
grant delete on table public.evaluations to authenticated;

create policy evaluations_select on public.evaluations
  for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (
      (select private.is_member(organization_id))
      and (analyst_user_id = (select auth.uid()) or created_by = (select auth.uid()))
    )
  );

-- Analista cria a avaliação do próprio chat; supervisor escolhe um membro da mesma
-- organização (D-013) ou usa só o nome livre. Nada de veredito na criação.
create policy evaluations_insert on public.evaluations
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and created_by = (select auth.uid())
    and status in ('rascunho', 'transcrito')
    and diagnosis_status is null
    and supervisor_review is null
    and current_analysis_run_id is null
    and (
      analyst_user_id = (select auth.uid())
      or (
        (select private.is_supervisor(organization_id))
        and (
          (analyst_user_id is null and nullif(btrim(analyst_name), '') is not null)
          or exists (
            select 1 from public.memberships m
            where m.user_id = evaluations.analyst_user_id and m.organization_id = evaluations.organization_id
          )
        )
      )
    )
  );

create policy evaluations_update on public.evaluations
  for update to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or (
      (select private.is_member(organization_id))
      and (created_by = (select auth.uid()) or analyst_user_id = (select auth.uid()))
    )
  )
  with check (
    (select private.is_org_manager(organization_id))
    or (
      (select private.is_member(organization_id))
      and (created_by = (select auth.uid()) or analyst_user_id = (select auth.uid()))
    )
  );

-- Com execução de IA a avaliação não é apagada (D-016): o status sai de rascunho/transcrito
-- e a FK de analysis_runs impede a exclusão nos demais casos.
create policy evaluations_delete on public.evaluations
  for delete to authenticated
  using (
    status in ('rascunho', 'transcrito')
    and current_analysis_run_id is null
    and (
      (select private.is_org_manager(organization_id))
      or (
        (select private.is_member(organization_id))
        and (created_by = (select auth.uid()) or analyst_user_id = (select auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Resultado da IA e validações: somente leitura pela API.
-- Escrita pela Edge Function (Fase 3) e pelas RPCs abaixo.
-- ---------------------------------------------------------------------------
revoke all on table public.analysis_runs, public.evaluation_scores, public.opportunities,
  public.analysis_feedback from public, anon, authenticated;
grant select on table public.analysis_runs, public.evaluation_scores, public.opportunities,
  public.analysis_feedback to authenticated;

create policy analysis_runs_select on public.analysis_runs
  for select to authenticated
  using ((select private.can_read_evaluation(evaluation_id)));

create policy evaluation_scores_select on public.evaluation_scores
  for select to authenticated
  using ((select private.can_read_evaluation(evaluation_id)));

create policy opportunities_select on public.opportunities
  for select to authenticated
  using ((select private.can_read_evaluation(evaluation_id)));

create policy analysis_feedback_select on public.analysis_feedback
  for select to authenticated
  using ((select private.can_read_evaluation(evaluation_id)));

-- ---------------------------------------------------------------------------
-- csat_records
-- ---------------------------------------------------------------------------
revoke all on table public.csat_records from public, anon, authenticated;
grant select on table public.csat_records to authenticated;
grant insert (organization_id, evaluation_id, protocol, analyst_name, analyst_user_id, score, score_origin,
  level, sentiment, channel, subject, comment, reason, themes, evidence, recommended_action, evaluator,
  team, brand, evaluated_at, opened_at, source)
  on table public.csat_records to authenticated;
grant update (evaluation_id, protocol, analyst_name, analyst_user_id, score, score_origin,
  level, sentiment, channel, subject, comment, reason, themes, evidence, recommended_action, evaluator,
  team, brand, evaluated_at, opened_at, source)
  on table public.csat_records to authenticated;
grant delete on table public.csat_records to authenticated;

create policy csat_records_select on public.csat_records
  for select to authenticated
  using (
    (select private.is_org_manager(organization_id))
    or ((select private.is_member(organization_id)) and analyst_user_id = (select auth.uid()))
  );

-- O analista vinculado precisa ser membro da organização; a avaliação, se informada,
-- precisa ser legível por quem grava (a FK composta garante a mesma organização).
create policy csat_records_insert on public.csat_records
  for insert to authenticated
  with check (
    (
      (select private.is_org_manager(organization_id))
      or (
        (select private.is_member(organization_id))
        and analyst_user_id = (select auth.uid())
        and source = 'manual'
      )
    )
    and (evaluation_id is null or (select private.can_read_evaluation(evaluation_id)))
    and (
      analyst_user_id is null
      or exists (
        select 1 from public.memberships m
        where m.user_id = csat_records.analyst_user_id and m.organization_id = csat_records.organization_id
      )
    )
  );

create policy csat_records_update on public.csat_records
  for update to authenticated
  using ((select private.is_org_manager(organization_id)))
  with check (
    (select private.is_org_manager(organization_id))
    and (
      analyst_user_id is null
      or exists (
        select 1 from public.memberships m
        where m.user_id = csat_records.analyst_user_id and m.organization_id = csat_records.organization_id
      )
    )
  );

create policy csat_records_delete on public.csat_records
  for delete to authenticated
  using ((select private.is_org_manager(organization_id)));

-- ---------------------------------------------------------------------------
-- survey_tickets / survey_responses. Token gerado no servidor (SEC-11): sem grant.
-- ---------------------------------------------------------------------------
revoke all on table public.survey_tickets, public.survey_responses from public, anon, authenticated;
grant select on table public.survey_tickets to authenticated;
grant insert (organization_id, evaluation_id, protocol) on table public.survey_tickets to authenticated;
grant delete on table public.survey_tickets to authenticated;
grant select on table public.survey_responses to authenticated;

create policy survey_tickets_select on public.survey_tickets
  for select to authenticated
  using ((select private.is_org_manager(organization_id)));

create policy survey_tickets_insert on public.survey_tickets
  for insert to authenticated
  with check ((select private.is_org_manager(organization_id)));

create policy survey_tickets_delete on public.survey_tickets
  for delete to authenticated
  using ((select private.is_org_manager(organization_id)));

create policy survey_responses_select on public.survey_responses
  for select to authenticated
  using ((select private.is_org_manager(organization_id)));

-- ---------------------------------------------------------------------------
-- Configurações, versões do protocolo, logs e falhas de IA.
-- ---------------------------------------------------------------------------
revoke all on table public.app_settings, public.protocol_versions, public.curation_logs,
  public.ai_failures, public.ai_provider_configs from public, anon, authenticated;
grant select on table public.app_settings to authenticated;
grant update (value) on table public.app_settings to authenticated;
grant select on table public.protocol_versions to authenticated;
grant select on table public.curation_logs to authenticated;
grant select on table public.ai_failures to authenticated;
-- secret_ref nunca é legível pela API (SEC-19).
grant select (id, organization_id, created_at, updated_at, provider, base_url, model, supports_vision,
  key_last4, is_active, updated_by)
  on table public.ai_provider_configs to authenticated;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select private.is_member(organization_id)) or (select private.is_platform_admin()));

create policy app_settings_update on public.app_settings
  for update to authenticated
  using ((select private.is_org_manager(organization_id)))
  with check ((select private.is_org_manager(organization_id)));

create policy protocol_versions_select on public.protocol_versions
  for select to authenticated
  using ((select private.is_member(organization_id)) or (select private.is_platform_admin()));

create policy curation_logs_select on public.curation_logs
  for select to authenticated
  using ((select private.is_org_manager(organization_id)));

create policy ai_failures_select on public.ai_failures
  for select to authenticated
  using ((select private.is_org_manager(organization_id)));

create policy ai_provider_configs_select on public.ai_provider_configs
  for select to authenticated
  using ((select private.is_org_manager(organization_id)));

-- evaluation_files continua sem políticas até a TASK-013.

-- ---------------------------------------------------------------------------
-- RPCs de validação e curadoria (SEC-03, SEC-06, SEC-07, SEC-08, SEC-12)
-- ---------------------------------------------------------------------------

-- Validação (gostei/útil/comentário) do diagnóstico ou de uma oportunidade da execução
-- atual. Autor e papel vêm de auth.uid() e memberships, nunca de parâmetro.
create function public.submit_feedback(
  p_run uuid,
  p_target text,
  p_opportunity uuid,
  p_liked boolean,
  p_useful boolean,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_run public.analysis_runs%rowtype;
  v_eval public.evaluations%rowtype;
  v_role text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;
  if p_target is null or p_target not in ('diagnostico', 'oportunidade') then
    raise exception 'Alvo de validação inválido. Use "diagnostico" ou "oportunidade".' using errcode = 'CX024';
  end if;

  select * into v_run from public.analysis_runs r where r.id = p_run;
  if found then
    select * into v_eval from public.evaluations e where e.id = v_run.evaluation_id;
  end if;
  -- Mesma mensagem para inexistente e sem permissão: não revela dados de outra organização.
  if v_run.id is null then
    raise exception 'Avaliação não encontrada ou sem permissão para validá-la.' using errcode = 'CX023';
  end if;

  if private.is_org_manager(v_eval.organization_id) then
    v_role := 'supervisor';
  elsif private.is_member(v_eval.organization_id) and v_eval.analyst_user_id = v_uid then
    v_role := 'analista';
  else
    raise exception 'Avaliação não encontrada ou sem permissão para validá-la.' using errcode = 'CX023';
  end if;

  if v_eval.current_analysis_run_id is distinct from v_run.id then
    raise exception 'Só a análise atual da avaliação pode ser validada.' using errcode = 'CX025';
  end if;
  if v_run.status <> 'sucesso' then
    raise exception 'A análise atual não terminou com sucesso.' using errcode = 'CX026';
  end if;

  if p_target = 'diagnostico' then
    if p_opportunity is not null then
      raise exception 'A validação do diagnóstico não recebe oportunidade.' using errcode = 'CX024';
    end if;
  elsif p_opportunity is null or not exists (
    select 1 from public.opportunities o where o.id = p_opportunity and o.analysis_run_id = v_run.id
  ) then
    raise exception 'A oportunidade não pertence a esta análise.' using errcode = 'CX027';
  end if;

  insert into public.analysis_feedback (
    organization_id, evaluation_id, analysis_run_id, target_type, opportunity_id,
    author_id, author_role, liked, useful, comment
  ) values (
    v_eval.organization_id, v_eval.id, v_run.id, p_target, p_opportunity,
    v_uid, v_role, p_liked, p_useful, nullif(btrim(p_comment), '')
  )
  on conflict (analysis_run_id, target_type, opportunity_id, author_role) do update
    set author_id = excluded.author_id,
        liked = excluded.liked,
        useful = excluded.useful,
        comment = excluded.comment
  returning id into v_id;

  return v_id;
end;
$$;

-- Decisão de curadoria de uma oportunidade da execução atual, com log na mesma transação.
create function public.decide_opportunity(
  p_opportunity uuid,
  p_decision text,
  p_note text,
  p_adjusted text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_opp public.opportunities%rowtype;
  v_eval public.evaluations%rowtype;
  v_adjusted text := nullif(btrim(p_adjusted), '');
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;
  if p_decision is null or p_decision not in ('aprovada', 'ajustada', 'rejeitada') then
    raise exception 'Decisão inválida. Use "aprovada", "ajustada" ou "rejeitada".' using errcode = 'CX028';
  end if;

  select * into v_opp from public.opportunities o where o.id = p_opportunity for update;
  if found then
    select * into v_eval from public.evaluations e where e.id = v_opp.evaluation_id;
  end if;
  if v_opp.id is null or not private.is_org_manager(v_eval.organization_id) then
    raise exception 'Somente o supervisor da organização decide a curadoria.' using errcode = 'CX030';
  end if;

  if v_adjusted is not null and p_decision <> 'ajustada' then
    raise exception 'A recomendação ajustada só é aceita com a decisão "ajustada".' using errcode = 'CX029';
  end if;
  if v_eval.current_analysis_run_id is distinct from v_opp.analysis_run_id then
    raise exception 'Só oportunidades da análise atual podem ser decididas.' using errcode = 'CX025';
  end if;

  update public.opportunities
    set status = p_decision,
        supervisor_note = nullif(btrim(p_note), ''),
        adjusted_recommendation = v_adjusted
    where id = v_opp.id;

  insert into public.curation_logs (
    organization_id, evaluation_id, opportunity_id, analysis_run_id, target, action, note, actor_id
  ) values (
    v_eval.organization_id, v_eval.id, v_opp.id, v_opp.analysis_run_id, 'oportunidade', p_decision,
    nullif(btrim(p_note), ''), v_uid
  );
end;
$$;

-- Decisão do supervisor sobre o diagnóstico da execução atual; conclui a curadoria.
create function public.decide_diagnosis(
  p_evaluation uuid,
  p_decision text,
  p_review text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_eval public.evaluations%rowtype;
  v_run_status text;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;
  if p_decision is null or p_decision not in ('aprovado', 'rejeitado') then
    raise exception 'Decisão inválida. Use "aprovado" ou "rejeitado".' using errcode = 'CX028';
  end if;

  select * into v_eval from public.evaluations e where e.id = p_evaluation for update;
  if v_eval.id is null or not private.is_org_manager(v_eval.organization_id) then
    raise exception 'Somente o supervisor da organização decide a curadoria.' using errcode = 'CX030';
  end if;

  select r.status into v_run_status from public.analysis_runs r where r.id = v_eval.current_analysis_run_id;
  if v_run_status is distinct from 'sucesso' then
    raise exception 'A avaliação não tem análise atual concluída com sucesso.' using errcode = 'CX026';
  end if;

  update public.evaluations
    set diagnosis_status = p_decision,
        supervisor_review = nullif(btrim(p_review), ''),
        status = 'curado'
    where id = v_eval.id;

  insert into public.curation_logs (
    organization_id, evaluation_id, analysis_run_id, target, action, note, actor_id
  ) values (
    v_eval.organization_id, v_eval.id, v_eval.current_analysis_run_id, 'diagnóstico',
    case p_decision when 'aprovado' then 'diagnóstico aprovado' else 'diagnóstico rejeitado' end,
    nullif(btrim(p_review), ''), v_uid
  );
end;
$$;

-- Ativa uma versão do protocolo e desativa a anterior na mesma transação.
create function public.set_active_protocol_version(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;

  select pv.organization_id into v_org from public.protocol_versions pv where pv.id = p_version;
  if v_org is null or not private.is_org_manager(v_org) then
    raise exception 'Versão do protocolo não encontrada ou sem permissão.' using errcode = 'CX031';
  end if;

  -- Trava as versões da organização para evitar ativações simultâneas.
  perform 1 from public.protocol_versions pv where pv.organization_id = v_org for update;
  update public.protocol_versions set is_active = false
    where organization_id = v_org and is_active and id <> p_version;
  update public.protocol_versions set is_active = true
    where id = p_version and not is_active;
end;
$$;

revoke all on function public.submit_feedback(uuid, text, uuid, boolean, boolean, text),
  public.decide_opportunity(uuid, text, text, text),
  public.decide_diagnosis(uuid, text, text),
  public.set_active_protocol_version(uuid)
  from public, anon;
grant execute on function public.submit_feedback(uuid, text, uuid, boolean, boolean, text),
  public.decide_opportunity(uuid, text, text, text),
  public.decide_diagnosis(uuid, text, text),
  public.set_active_protocol_version(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Veredito efetivo (D-024): supervisor, se decidiu; senão, analista; senão, sem validação.
-- security_invoker: a view respeita a RLS de quem consulta.
-- ---------------------------------------------------------------------------
create view public.effective_feedback
with (security_invoker = true)
as
with alvos as (
  -- Diagnóstico de cada execução concluída. A decisão do supervisor no diagnóstico
  -- vale só para a execução atual; "pendente" não é decisão.
  select
    r.organization_id,
    r.evaluation_id,
    r.id as analysis_run_id,
    'diagnostico'::text as target_type,
    null::uuid as opportunity_id,
    case
      when e.current_analysis_run_id = r.id and e.diagnosis_status in ('aprovado', 'rejeitado')
        then e.diagnosis_status
    end as supervisor_decision
  from public.analysis_runs r
  join public.evaluations e on e.id = r.evaluation_id
  where r.status = 'sucesso'
  union all
  select
    o.organization_id,
    o.evaluation_id,
    o.analysis_run_id,
    'oportunidade'::text,
    o.id,
    nullif(o.status, 'pendente')
  from public.opportunities o
)
select
  a.organization_id,
  a.evaluation_id,
  a.analysis_run_id,
  a.target_type,
  a.opportunity_id,
  e.analyst_user_id,
  f.liked as analyst_liked,
  f.useful as analyst_useful,
  f.comment as analyst_comment,
  a.supervisor_decision,
  case
    when a.supervisor_decision in ('aprovada', 'ajustada', 'aprovado') then 'positivo'
    when a.supervisor_decision in ('rejeitada', 'rejeitado') then 'negativo'
    when f.liked and f.useful then 'positivo'
    when f.liked = false or f.useful = false then 'negativo'
    else 'sem_validacao'
  end as effective,
  case
    when a.supervisor_decision is not null then 'supervisor'
    when f.id is not null then 'analista'
  end as source
from alvos a
join public.evaluations e on e.id = a.evaluation_id
left join public.analysis_feedback f
  on f.analysis_run_id = a.analysis_run_id
  and f.target_type = a.target_type
  and f.opportunity_id is not distinct from a.opportunity_id
  and f.author_role = 'analista';

revoke all on table public.effective_feedback from public, anon, authenticated;
grant select on table public.effective_feedback to authenticated;
