-- TASK-013 — Storage privado, espelhado na avaliação (SEC-09, SEC-18, D-025).
-- CX037: caminho/avaliação indisponível; CX038: metadados de arquivo inválidos.
-- Nenhuma limpeza de storage.objects por SQL: os bytes são geridos pela API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evaluation-files', 'evaluation-files', false, 20971520,
  array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

-- Invoker: além do formato, valida o tenant contra a avaliação visível ao chamador.
-- Os casts só ocorrem depois da validação, inclusive com segmentos vazios/longos.
create function private.storage_eval_id(name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  folders text[] := storage.foldername(name);
  uuid_pattern constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  result uuid;
begin
  if name is null or cardinality(folders) <> 2
     or folders[1] !~ ('^' || uuid_pattern || '$')
     or folders[2] !~ ('^' || uuid_pattern || '$')
     or storage.filename(name) !~ ('^' || uuid_pattern || '\.(png|jpg|jpeg|webp|pdf|txt|csv|xlsx)$') then
    return null;
  end if;
  select e.id into result from public.evaluations e
    where e.id = folders[2]::uuid and e.organization_id = folders[1]::uuid;
  return result;
end;
$$;
revoke all on function private.storage_eval_id(text) from public, anon, authenticated;
grant execute on function private.storage_eval_id(text) to authenticated;

create policy evaluation_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'evaluation-files'
    and private.can_read_evaluation(private.storage_eval_id(name)));

create policy evaluation_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evaluation-files'
    and owner = (select auth.uid())
    and private.can_edit_evaluation(private.storage_eval_id(name))
    and exists (select 1 from public.evaluations e
      where e.id = private.storage_eval_id(name) and e.status in ('rascunho', 'transcrito')));

-- Sem política UPDATE: não permite sobrescrever, renomear ou mover objetos.
create policy evaluation_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evaluation-files'
    and exists (select 1 from public.evaluations e
      where e.id = private.storage_eval_id(name)
        and (private.is_org_manager(e.organization_id)
          or (owner = (select auth.uid()) and e.status in ('rascunho', 'transcrito')))));

-- Escrita somente pelo trigger interno. A API recebe apenas leitura com RLS.
revoke all on table public.evaluation_files from public, anon, authenticated;
grant select on table public.evaluation_files to authenticated;
create policy evaluation_files_select on public.evaluation_files
  for select to authenticated
  using ((select private.can_read_evaluation(evaluation_id)));

-- Trigger-only: execução direta revogada. O INSERT/DELETE de origem já passou
-- pela RLS de storage.objects; servidores privilegiados também são sincronizados.
create function private.sync_evaluation_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  eval_id uuid;
  file_kind text;
  file_size bigint;
begin
  if tg_op = 'DELETE' then
    delete from public.evaluation_files where storage_path = old.name;
    return old;
  end if;
  eval_id := private.storage_eval_id(new.name);
  if eval_id is null then
    raise exception 'Arquivo indisponível ou caminho inválido.' using errcode = 'CX037';
  end if;
  file_kind := case storage.extension(new.name)
    when 'pdf' then 'pdf'
    when 'csv' then 'planilha'
    when 'xlsx' then 'planilha'
    when 'txt' then 'txt'
    else 'print'
  end;
  begin
    file_size := (new.metadata ->> 'size')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Metadados de arquivo inválidos.' using errcode = 'CX038';
  end;
  insert into public.evaluation_files
    (organization_id, evaluation_id, storage_path, kind, mime_type, size_bytes, created_by)
  select e.organization_id, e.id, new.name, file_kind,
    new.metadata ->> 'mimetype', file_size, new.owner
  from public.evaluations e where e.id = eval_id;
  return new;
end;
$$;
revoke all on function private.sync_evaluation_file() from public, anon, authenticated;

create trigger evaluation_objects_register after insert on storage.objects
  for each row when (new.bucket_id = 'evaluation-files')
  execute function private.sync_evaluation_file();
create trigger evaluation_objects_unregister after delete on storage.objects
  for each row when (old.bucket_id = 'evaluation-files')
  execute function private.sync_evaluation_file();

-- Diagnóstico sem limpeza: usar a API de Storage no futuro job de reconciliação.
-- Invoker + privilégios explícitos: somente postgres pode ler a view.
create view private.orphan_evaluation_files with (security_invoker = true) as
  select 'object_without_evaluation'::text as orphan_type,
    o.id as object_id, null::uuid as evaluation_file_id, o.name as storage_path
  from storage.objects o
  where o.bucket_id = 'evaluation-files' and private.storage_eval_id(o.name) is null
  union all
  select 'record_without_object'::text, null::uuid, f.id, f.storage_path
  from public.evaluation_files f
  where not exists (select 1 from storage.objects o
    where o.bucket_id = 'evaluation-files' and o.name = f.storage_path);
revoke all on table private.orphan_evaluation_files from public, anon, authenticated, service_role;
grant select on table private.orphan_evaluation_files to postgres;
