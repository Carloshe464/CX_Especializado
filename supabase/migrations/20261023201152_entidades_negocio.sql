-- TASK-011 — Entidades de negócio: integridade local e negação total pela API.
-- Sem políticas de negócio, RPCs de veredito, prompts ou segredos (TASK-012/021).
-- Listas de valores copiadas de src/lib/cx.js; checks mantêm os textos exatos.
-- CX020: execução concluída/imutável; CX021: log append-only;
-- CX022: organização da resposta não corresponde ao ticket.

create function public.score_classification(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null or p < 0 then 'Não avaliável'
    when p >= 9 then 'Excelente'
    when p >= 7 then 'Bom'
    when p >= 5 then 'Atenção'
    when p >= 3 then 'Insatisfatório'
    else 'Crítico'
  end;
$$;
revoke all on function public.score_classification(numeric) from public, anon;
grant execute on function public.score_classification(numeric) to authenticated, service_role;

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  protocol text,
  analyst_user_id uuid references public.profiles (id) on delete set null,
  analyst_name text,
  channel text check (channel in ('Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Outro')),
  source text not null check (source in ('prints', 'texto', 'importacao', 'extensao')),
  status text not null default 'rascunho' check (status in ('rascunho', 'transcrito', 'analisado', 'curado')),
  transcript text,
  diagnosis_status text check (diagnosis_status in ('pendente', 'aprovado', 'rejeitado')),
  supervisor_review text,
  current_analysis_run_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (id, organization_id)
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  run_number integer not null,
  status text not null check (status in ('em_andamento', 'sucesso', 'falha')),
  prompt_version text not null,
  provider text,
  model text,
  trend text check (trend in ('Favorável', 'Incerta', 'Desfavorável')),
  strengths text,
  summary_feedback text,
  uncertainties text,
  raw_output jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (evaluation_id, run_number),
  unique (id, evaluation_id),
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id)
);

create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  analysis_run_id uuid not null,
  competency text not null check (competency in ('Empatia e acolhimento', 'Comunicação e clareza', 'Eficiência do atendimento', 'Conhecimento e condução técnica', 'Experiência do cliente e Customer Success', 'Gestão comunicacional durante o multiatendimento')),
  score numeric(4,2) check (score between 0 and 10),
  classification text generated always as (public.score_classification(score)) stored,
  evidence text,
  unique (analysis_run_id, competency),
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id),
  foreign key (analysis_run_id, evaluation_id)
    references public.analysis_runs (id, evaluation_id)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  analysis_run_id uuid not null,
  position integer not null,
  severity text not null default 'Desejável' check (severity in ('Crítica', 'Importante', 'Desejável')),
  evidence text,
  description text,
  impact text,
  recommendation text,
  improved_example text,
  origin text not null default 'Indeterminada' check (origin in ('Analista', 'Processo', 'Produto', 'Política empresarial', 'Indeterminada')),
  confidence text not null default 'Médio' check (confidence in ('Alto', 'Médio', 'Baixo')),
  communication_techniques text[] not null default '{}' check (
    communication_techniques <@ array['Assertividade', 'Rapport', 'Escuta ativa', 'Validação emocional', 'Linguagem positiva', 'Clareza e objetividade']::text[]
  ),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'ajustada', 'rejeitada')),
  supervisor_note text,
  adjusted_recommendation text,
  unique (id, evaluation_id),
  unique (id, analysis_run_id, evaluation_id),
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id),
  foreign key (analysis_run_id, evaluation_id)
    references public.analysis_runs (id, evaluation_id)
);

create table public.analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  analysis_run_id uuid not null,
  target_type text not null check (target_type in ('diagnostico', 'oportunidade')),
  opportunity_id uuid,
  author_id uuid not null references public.profiles (id),
  author_role text not null check (author_role in ('analista', 'supervisor')),
  liked boolean,
  useful boolean,
  comment text check (length(comment) <= 2000),
  check ((target_type = 'oportunidade') = (opportunity_id is not null)),
  unique nulls not distinct (analysis_run_id, target_type, opportunity_id, author_role),
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id),
  foreign key (analysis_run_id, evaluation_id)
    references public.analysis_runs (id, evaluation_id),
  -- O alvo também deve pertencer à mesma avaliação e à mesma execução.
  foreign key (opportunity_id, analysis_run_id, evaluation_id)
    references public.opportunities (id, analysis_run_id, evaluation_id) on delete cascade
);

create table public.csat_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid,
  protocol text,
  analyst_name text,
  analyst_user_id uuid references public.profiles (id) on delete set null,
  score smallint check (score between 1 and 5),
  score_origin text check (score_origin in ('real', 'derivada_nivel', 'derivada_sentimento')),
  check ((score is null) = (score_origin is null)),
  level text check (level in ('Ótimo', 'Bom', 'Neutro', 'Ruim', 'Péssimo')),
  sentiment text,
  channel text check (channel in ('Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Outro')),
  subject text,
  comment text,
  reason text,
  themes text,
  evidence text,
  recommended_action text,
  evaluator text,
  team text,
  brand text,
  evaluated_at timestamptz,
  opened_at timestamptz,
  source text not null check (source in ('planilha', 'pesquisa', 'manual', 'arquivo')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- Postgres 17 permite anular só evaluation_id, preservando organization_id.
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id) on delete set null (evaluation_id)
);

create table public.survey_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex')
    check (length(token) = 64),
  protocol text,
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id)
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_id uuid not null unique references public.survey_tickets (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  comment text check (length(comment) <= 2000)
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null,
  value text not null,
  description text,
  unique (organization_id, key),
  check (key <> 'csat_positive_threshold' or value in ('1', '2', '3', '4', '5'))
);

create table public.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version text not null,
  description text,
  changes text,
  effective_date date,
  is_active boolean not null default false,
  unique (organization_id, version)
);

create table public.curation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  opportunity_id uuid,
  analysis_run_id uuid,
  target text not null check (target in ('oportunidade', 'diagnóstico')),
  action text not null check (action in ('aprovada', 'ajustada', 'rejeitada', 'diagnóstico aprovado', 'diagnóstico rejeitado')),
  note text,
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id),
  foreign key (analysis_run_id, evaluation_id)
    references public.analysis_runs (id, evaluation_id),
  foreign key (opportunity_id, evaluation_id)
    references public.opportunities (id, evaluation_id),
  foreign key (opportunity_id, analysis_run_id, evaluation_id)
    references public.opportunities (id, analysis_run_id, evaluation_id)
);

create table public.ai_failures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid,
  analysis_run_id uuid,
  stage text not null check (stage in ('transcricao', 'analise', 'extracao_csat', 'importacao', 'teste_conexao')),
  error_code text not null check (error_code ~ '^[a-z0-9_]{1,64}$'),
  prompt_version text,
  provider text,
  model text,
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id) on delete set null (evaluation_id),
  foreign key (analysis_run_id, evaluation_id)
    references public.analysis_runs (id, evaluation_id),
  -- Mesmo sem avaliação, uma referência de execução deve continuar válida.
  foreign key (analysis_run_id) references public.analysis_runs (id),
  check (analysis_run_id is null or evaluation_id is not null)
);

create table public.evaluation_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluation_id uuid not null,
  storage_path text not null unique,
  kind text not null check (kind in ('print', 'pdf', 'planilha', 'txt')),
  mime_type text,
  size_bytes bigint check (size_bytes > 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (evaluation_id, organization_id)
    references public.evaluations (id, organization_id)
);

create table public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null check (provider in ('openai_compativel')),
  base_url text not null check (base_url ~ '^https://'),
  model text not null,
  supports_vision boolean not null default false,
  secret_ref uuid,
  key_last4 text check (key_last4 ~ '^.{4}$'),
  is_active boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null
);

-- Uma execução atual só pode ser da própria avaliação, nunca de outro tenant.
alter table public.evaluations add constraint evaluations_current_run_fkey
  foreign key (current_analysis_run_id, id)
  references public.analysis_runs (id, evaluation_id)
  on delete set null (current_analysis_run_id);

create unique index evaluations_org_protocol_unique
  on public.evaluations (organization_id, lower(btrim(protocol)))
  where protocol is not null and btrim(protocol) <> '';
create unique index protocol_versions_one_active_per_org
  on public.protocol_versions (organization_id) where is_active;
create unique index ai_provider_configs_one_active_per_org
  on public.ai_provider_configs (organization_id) where is_active;

-- História de execução: permite somente alterações enquanto em andamento.
create function private.protect_analysis_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'Execuções de análise não podem ser apagadas.' using errcode = 'CX020';
  end if;
  if old.status <> 'em_andamento' then
    raise exception 'Uma execução concluída é imutável.' using errcode = 'CX020';
  end if;
  return new;
end;
$$;
create trigger analysis_runs_protect_history before update or delete on public.analysis_runs
  for each row execute function private.protect_analysis_run();
create trigger analysis_runs_protect_truncate before truncate on public.analysis_runs
  for each statement execute function private.protect_analysis_run();

create function private.protect_curation_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Logs de curadoria são somente de acréscimo.' using errcode = 'CX021';
end;
$$;
create trigger curation_logs_append_only before update or delete on public.curation_logs
  for each row execute function private.protect_curation_log();
create trigger curation_logs_protect_truncate before truncate on public.curation_logs
  for each statement execute function private.protect_curation_log();

-- Integridade do tenant também quando a organização de um ticket muda.
create function private.check_survey_response_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.survey_tickets t
    where t.id = new.ticket_id and t.organization_id = new.organization_id
  ) then
    raise exception 'A resposta deve pertencer à organização do ticket.' using errcode = 'CX022';
  end if;
  return new;
end;
$$;
create trigger survey_responses_check_org before insert or update on public.survey_responses
  for each row execute function private.check_survey_response_org();
-- FK complementar protege a integridade do lado do ticket, inclusive em concorrência.
alter table public.survey_tickets add unique (id, organization_id);
alter table public.survey_responses add constraint survey_responses_ticket_org_fkey
  foreign key (ticket_id, organization_id)
  references public.survey_tickets (id, organization_id) on delete cascade;

create function private.seed_organization_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_settings (organization_id, key, value, description)
  values (new.id, 'csat_positive_threshold', '4', 'Nota mínima de satisfação positiva');
  insert into public.protocol_versions (organization_id, version, description, is_active)
  values
    (new.id, 'V1.1', 'Linha de base de paridade', false),
    (new.id, 'V1.2', 'Comunicação assertiva e rapport nas oportunidades — D-019', true);
  return new;
end;
$$;
create trigger organizations_seed_business after insert on public.organizations
  for each row execute function private.seed_organization_business();

revoke all on function private.protect_analysis_run(), private.protect_curation_log(),
  private.check_survey_response_org(), private.seed_organization_business()
  from public, anon, authenticated;

-- updated_at reutiliza o trigger estrutural da TASK-010. Logs não são mutáveis.
create trigger evaluations_set_updated_at before update on public.evaluations
  for each row execute function private.set_updated_at();
create trigger analysis_runs_set_updated_at before update on public.analysis_runs
  for each row execute function private.set_updated_at();
create trigger evaluation_scores_set_updated_at before update on public.evaluation_scores
  for each row execute function private.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function private.set_updated_at();
create trigger analysis_feedback_set_updated_at before update on public.analysis_feedback
  for each row execute function private.set_updated_at();
create trigger csat_records_set_updated_at before update on public.csat_records
  for each row execute function private.set_updated_at();
create trigger survey_tickets_set_updated_at before update on public.survey_tickets
  for each row execute function private.set_updated_at();
create trigger survey_responses_set_updated_at before update on public.survey_responses
  for each row execute function private.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
create trigger protocol_versions_set_updated_at before update on public.protocol_versions
  for each row execute function private.set_updated_at();
create trigger ai_failures_set_updated_at before update on public.ai_failures
  for each row execute function private.set_updated_at();
create trigger evaluation_files_set_updated_at before update on public.evaluation_files
  for each row execute function private.set_updated_at();
create trigger ai_provider_configs_set_updated_at before update on public.ai_provider_configs
  for each row execute function private.set_updated_at();

-- Índices das referências de tenant/avaliação/execução.
create index evaluations_organization_id_idx on public.evaluations (organization_id);
create index analysis_runs_organization_id_idx on public.analysis_runs (organization_id);
create index analysis_runs_evaluation_org_idx on public.analysis_runs (evaluation_id, organization_id);
create index evaluation_scores_organization_id_idx on public.evaluation_scores (organization_id);
create index evaluation_scores_evaluation_org_idx on public.evaluation_scores (evaluation_id, organization_id);
create index evaluation_scores_analysis_run_idx on public.evaluation_scores (analysis_run_id, evaluation_id);
create index opportunities_organization_id_idx on public.opportunities (organization_id);
create index opportunities_evaluation_org_idx on public.opportunities (evaluation_id, organization_id);
create index opportunities_analysis_run_idx on public.opportunities (analysis_run_id, evaluation_id);
create index analysis_feedback_organization_id_idx on public.analysis_feedback (organization_id);
create index analysis_feedback_evaluation_org_idx on public.analysis_feedback (evaluation_id, organization_id);
create index analysis_feedback_analysis_run_idx on public.analysis_feedback (analysis_run_id, evaluation_id);
create index csat_records_organization_id_idx on public.csat_records (organization_id);
create index csat_records_evaluation_org_idx on public.csat_records (evaluation_id, organization_id);
create index survey_tickets_organization_id_idx on public.survey_tickets (organization_id);
create index survey_tickets_evaluation_org_idx on public.survey_tickets (evaluation_id, organization_id);
create index survey_responses_organization_id_idx on public.survey_responses (organization_id);
create index app_settings_organization_id_idx on public.app_settings (organization_id);
create index protocol_versions_organization_id_idx on public.protocol_versions (organization_id);
create index curation_logs_organization_id_idx on public.curation_logs (organization_id);
create index curation_logs_evaluation_org_idx on public.curation_logs (evaluation_id, organization_id);
create index curation_logs_analysis_run_idx on public.curation_logs (analysis_run_id, evaluation_id);
create index ai_failures_organization_id_idx on public.ai_failures (organization_id);
create index ai_failures_evaluation_org_idx on public.ai_failures (evaluation_id, organization_id);
create index ai_failures_analysis_run_idx on public.ai_failures (analysis_run_id, evaluation_id);
create index evaluation_files_organization_id_idx on public.evaluation_files (organization_id);
create index evaluation_files_evaluation_org_idx on public.evaluation_files (evaluation_id, organization_id);
create index ai_provider_configs_organization_id_idx on public.ai_provider_configs (organization_id);

-- RLS sem políticas = zero linhas para authenticated. anon não tem privilégios.
-- Nenhuma regra de acesso de negócio é antecipada aqui (TASK-012).
alter table public.evaluations enable row level security;
revoke all on table public.evaluations from public, anon, authenticated;
grant select on table public.evaluations to authenticated;
alter table public.analysis_runs enable row level security;
revoke all on table public.analysis_runs from public, anon, authenticated;
grant select on table public.analysis_runs to authenticated;
alter table public.evaluation_scores enable row level security;
revoke all on table public.evaluation_scores from public, anon, authenticated;
grant select on table public.evaluation_scores to authenticated;
alter table public.opportunities enable row level security;
revoke all on table public.opportunities from public, anon, authenticated;
grant select on table public.opportunities to authenticated;
alter table public.analysis_feedback enable row level security;
revoke all on table public.analysis_feedback from public, anon, authenticated;
grant select on table public.analysis_feedback to authenticated;
alter table public.csat_records enable row level security;
revoke all on table public.csat_records from public, anon, authenticated;
grant select on table public.csat_records to authenticated;
alter table public.survey_tickets enable row level security;
revoke all on table public.survey_tickets from public, anon, authenticated;
grant select on table public.survey_tickets to authenticated;
alter table public.survey_responses enable row level security;
revoke all on table public.survey_responses from public, anon, authenticated;
grant select on table public.survey_responses to authenticated;
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;
grant select on table public.app_settings to authenticated;
alter table public.protocol_versions enable row level security;
revoke all on table public.protocol_versions from public, anon, authenticated;
grant select on table public.protocol_versions to authenticated;
alter table public.curation_logs enable row level security;
revoke all on table public.curation_logs from public, anon, authenticated;
grant select on table public.curation_logs to authenticated;
alter table public.ai_failures enable row level security;
revoke all on table public.ai_failures from public, anon, authenticated;
grant select on table public.ai_failures to authenticated;
alter table public.evaluation_files enable row level security;
revoke all on table public.evaluation_files from public, anon, authenticated;
grant select on table public.evaluation_files to authenticated;
alter table public.ai_provider_configs enable row level security;
revoke all on table public.ai_provider_configs from public, anon, authenticated;
grant select on table public.ai_provider_configs to authenticated;
