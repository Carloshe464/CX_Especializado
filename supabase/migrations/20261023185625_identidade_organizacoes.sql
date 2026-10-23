-- TASK-010 — Identidade, organizações e papéis (D-002, D-008, D-017, D-023).
-- Regras cobertas: SEC-03, SEC-04, SEC-10, SEC-15, SEC-16, SEC-18 (identidade) e SEC-22.
--
-- Códigos de erro próprios (SQLSTATE) usados pelas RPCs e triggers desta migração:
--   CX001 autenticação necessária
--   CX002 e-mail não verificado
--   CX003 usuário já vinculado a uma organização
--   CX004 nome da organização inválido
--   CX005 domínio diferente do domínio do e-mail verificado
--   CX006 domínio de e-mail público
--   CX007 domínio já pertence a outra organização
--   CX008 domínio em formato inválido
--   CX009 nenhuma empresa cadastrada para o domínio do e-mail
--   CX010 sem permissão para alterar o papel
--   CX011 papel inválido
--   CX012 alteração do próprio papel
--   CX013 a organização ficaria sem supervisor
--   CX014 usuário alvo sem vínculo
--   CX015 alteração de usuário ou organização de um vínculo
--   CX016 alteração de papel fora da RPC set_member_role

-- ---------------------------------------------------------------------------
-- Schema privado: não exposto pela API. Só recebe permissões pontuais.
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public, anon, authenticated;
-- As políticas RLS chamam funções deste schema com a identidade de quem consulta.
grant usage on schema private to authenticated;

-- Domínios de e-mail públicos, que nunca servem de domínio de empresa (SEC-22).
create table private.public_email_domains (
  domain text primary key
);
revoke all on table private.public_email_domains from public, anon, authenticated;

insert into private.public_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'),
  ('outlook.com'), ('hotmail.com'), ('live.com'), ('msn.com'),
  ('yahoo.com'), ('yahoo.com.br'), ('icloud.com'), ('me.com'), ('aol.com'),
  ('proton.me'), ('protonmail.com'),
  ('uol.com.br'), ('bol.com.br'), ('terra.com.br'), ('ig.com.br'),
  ('gmx.com'), ('zoho.com'), ('yandex.com'), ('mail.com');

-- Atualiza updated_at em toda alteração de linha.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Perfil 1:1 com auth.users. Não guarda papel (o papel fica em memberships).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um domínio pertence a uma única organização (D-017/D-023).
create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  domain text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_domains_domain_normalizado check (domain = lower(btrim(domain))),
  constraint organization_domains_domain_formato check (
    domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  )
);
create index organization_domains_organization_id_idx on public.organization_domains (organization_id);

-- Uma organização por usuário (unique em user_id).
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('supervisor', 'analista')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_organization_id_idx on public.memberships (organization_id);

-- Admin da plataforma: gravável só pelo banco/painel, nunca pela API.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organization_domains_set_updated_at before update on public.organization_domains
  for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger platform_admins_set_updated_at before update on public.platform_admins
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Triggers de integridade
-- ---------------------------------------------------------------------------

-- Rejeita domínios públicos em organization_domains (SEC-22).
create function private.reject_public_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.public_email_domains d where d.domain = new.domain) then
    raise exception 'Domínios de e-mail públicos não podem ser usados como domínio da empresa.'
      using errcode = 'CX006';
  end if;
  return new;
end;
$$;

create trigger organization_domains_reject_public before insert or update of domain on public.organization_domains
  for each row execute function private.reject_public_domain();

-- Cria o perfil quando um usuário é criado no Auth.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Mantém profiles.email igual ao e-mail do Auth.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Protege vínculos (SEC-04): usuário e organização são imutáveis; ninguém altera o
-- próprio papel; papel só muda pela RPC set_member_role (que roda como dono da função).
create function private.protect_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id or new.organization_id is distinct from old.organization_id then
    raise exception 'O usuário e a organização de um vínculo não podem ser alterados.'
      using errcode = 'CX015';
  end if;
  if new.role is distinct from old.role then
    if old.user_id = (select auth.uid()) then
      raise exception 'Você não pode alterar o seu próprio papel.' using errcode = 'CX012';
    end if;
    if current_user in ('anon', 'authenticated') then
      raise exception 'O papel só pode ser alterado pela função set_member_role.' using errcode = 'CX016';
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_protect before update on public.memberships
  for each row execute function private.protect_membership();

-- ---------------------------------------------------------------------------
-- Funções de papel (usadas pelas políticas). Leem memberships/platform_admins
-- sem RLS e dependem apenas de auth.uid() (SEC-03).
-- ---------------------------------------------------------------------------

-- Organização do usuário autenticado, ou null.
create function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid());
$$;

-- O usuário autenticado pertence à organização?
create function private.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.organization_id = org
  );
$$;

-- O usuário autenticado é supervisor da organização?
create function private.is_supervisor(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.organization_id = org and m.role = 'supervisor'
  );
$$;

-- O usuário autenticado é admin da plataforma?
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

-- Nenhuma função privada é executável pela API, exceto as usadas pelas políticas.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_supervisor(uuid) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de entrada na organização (SEC-03, SEC-22, D-023)
-- ---------------------------------------------------------------------------

-- Cria uma organização (D-023). Dois caminhos:
-- (1) Admin da plataforma (caminho principal no lançamento): cria a organização sem
--     vínculo para si, com qualquer domínio não público e livre. O primeiro supervisor
--     entra pelo domínio, como analista, e o admin o promove com set_member_role.
-- (2) Autoatendimento: exige e-mail verificado e ausência de vínculo; o chamador vira
--     supervisor. O domínio, se informado, precisa ser exatamente o do e-mail verificado.
create function public.create_organization(p_name text, p_domain text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_name text := btrim(coalesce(p_name, ''));
  v_domain text := nullif(lower(btrim(coalesce(p_domain, ''))), '');
  v_org_id uuid;
  v_is_admin boolean;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;

  v_is_admin := private.is_platform_admin();

  if not v_is_admin then
    select u.email, u.email_confirmed_at into v_email, v_confirmed_at
    from auth.users u where u.id = v_uid;
    if v_email is null or v_confirmed_at is null then
      raise exception 'Confirme o seu e-mail antes de criar uma empresa.' using errcode = 'CX002';
    end if;

    if exists (select 1 from public.memberships m where m.user_id = v_uid) then
      raise exception 'Você já está vinculado a uma empresa.' using errcode = 'CX003';
    end if;
  end if;

  if length(v_name) not between 2 and 120 then
    raise exception 'O nome da empresa deve ter entre 2 e 120 caracteres.' using errcode = 'CX004';
  end if;

  if v_domain is not null then
    if v_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then
      raise exception 'Domínio em formato inválido.' using errcode = 'CX008';
    end if;
    -- No autoatendimento o domínio precisa ser o do e-mail verificado; o admin é global.
    if not v_is_admin and v_domain <> lower(substring(v_email from '@([^@]+)$')) then
      raise exception 'O domínio da empresa deve ser o mesmo do seu e-mail verificado.' using errcode = 'CX005';
    end if;
    if exists (select 1 from private.public_email_domains d where d.domain = v_domain) then
      raise exception 'Domínios de e-mail públicos não podem ser usados como domínio da empresa.'
        using errcode = 'CX006';
    end if;
    if exists (select 1 from public.organization_domains od where od.domain = v_domain) then
      raise exception 'Este domínio já pertence a outra empresa.' using errcode = 'CX007';
    end if;
  end if;

  insert into public.organizations (name, created_by) values (v_name, v_uid) returning id into v_org_id;
  -- O admin da plataforma não recebe vínculo: o acesso dele é global.
  if not v_is_admin then
    insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org_id, 'supervisor');
  end if;
  if v_domain is not null then
    insert into public.organization_domains (organization_id, domain) values (v_org_id, v_domain);
  end if;

  return v_org_id;
exception
  -- Corrida entre duas chamadas simultâneas: traduz a violação de unicidade.
  when unique_violation then
    if not v_is_admin and exists (select 1 from public.memberships m where m.user_id = v_uid) then
      raise exception 'Você já está vinculado a uma empresa.' using errcode = 'CX003';
    end if;
    raise exception 'Este domínio já pertence a outra empresa.' using errcode = 'CX007';
end;
$$;

-- Vincula o chamador, sempre como analista, à organização do domínio do seu e-mail verificado.
create function public.join_organization_by_domain()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed_at
  from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmed_at is null then
    raise exception 'Confirme o seu e-mail antes de entrar em uma empresa.' using errcode = 'CX002';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = v_uid) then
    raise exception 'Você já está vinculado a uma empresa.' using errcode = 'CX003';
  end if;

  select od.organization_id into v_org_id
  from public.organization_domains od
  where od.domain = lower(substring(v_email from '@([^@]+)$'));
  if v_org_id is null then
    raise exception 'Nenhuma empresa cadastrada para o domínio do seu e-mail.' using errcode = 'CX009';
  end if;

  insert into public.memberships (user_id, organization_id, role) values (v_uid, v_org_id, 'analista');
  return v_org_id;
exception
  when unique_violation then
    raise exception 'Você já está vinculado a uma empresa.' using errcode = 'CX003';
end;
$$;

-- Altera o papel de um membro. Só supervisor da mesma organização ou admin da
-- plataforma; nunca o próprio papel; a organização não pode ficar sem supervisor.
create function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_target public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = 'CX001';
  end if;
  if p_role is null or p_role not in ('supervisor', 'analista') then
    raise exception 'Papel inválido. Use "supervisor" ou "analista".' using errcode = 'CX011';
  end if;
  if p_user_id = v_uid then
    raise exception 'Você não pode alterar o seu próprio papel.' using errcode = 'CX012';
  end if;

  v_is_admin := private.is_platform_admin();
  select * into v_target from public.memberships m where m.user_id = p_user_id for update;

  if not found then
    -- Para quem não é admin, não revela se o usuário existe em outra organização.
    if v_is_admin then
      raise exception 'O usuário informado não está vinculado a nenhuma empresa.' using errcode = 'CX014';
    end if;
    raise exception 'Você não tem permissão para alterar o papel deste usuário.' using errcode = 'CX010';
  end if;

  if not v_is_admin and not private.is_supervisor(v_target.organization_id) then
    raise exception 'Você não tem permissão para alterar o papel deste usuário.' using errcode = 'CX010';
  end if;

  if v_target.role = p_role then
    return;
  end if;

  if v_target.role = 'supervisor' then
    -- Trava os supervisores da organização para evitar rebaixamentos simultâneos.
    perform 1 from public.memberships m
    where m.organization_id = v_target.organization_id and m.role = 'supervisor'
    for update;
    if (select count(*) from public.memberships m
        where m.organization_id = v_target.organization_id and m.role = 'supervisor') <= 1 then
      raise exception 'A empresa precisa ter ao menos um supervisor.' using errcode = 'CX013';
    end if;
  end if;

  update public.memberships set role = p_role where id = v_target.id;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
revoke execute on function public.join_organization_by_domain() from public, anon;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.join_organization_by_domain() to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS e privilégios (SEC-10, SEC-16, SEC-18). Nenhuma política para anon.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_domains enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;

revoke all on table public.profiles, public.organizations, public.organization_domains,
  public.memberships, public.platform_admins from anon, authenticated;

-- profiles: leitura do próprio, do supervisor sobre membros da organização e do admin;
-- escrita só de full_name na própria linha.
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_supervisor(private.current_org_id()))
      and exists (
        select 1 from public.memberships m
        where m.user_id = profiles.id and m.organization_id = (select private.current_org_id())
      )
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: leitura por membros e admin; só o nome é alterável, por supervisor ou admin.
grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated
  using ((select private.is_member(id)) or (select private.is_platform_admin()));

create policy organizations_update on public.organizations
  for update to authenticated
  using ((select private.is_supervisor(id)) or (select private.is_platform_admin()))
  with check ((select private.is_supervisor(id)) or (select private.is_platform_admin()));

-- organization_domains: somente leitura pela API.
grant select on table public.organization_domains to authenticated;

create policy organization_domains_select on public.organization_domains
  for select to authenticated
  using ((select private.is_member(organization_id)) or (select private.is_platform_admin()));

-- memberships: somente leitura pela API (escrita apenas pelas RPCs).
grant select on table public.memberships to authenticated;

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_supervisor(organization_id))
    or (select private.is_platform_admin())
  );

-- platform_admins: cada um vê apenas a própria linha; nenhuma escrita pela API.
grant select on table public.platform_admins to authenticated;

create policy platform_admins_select_own on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));
