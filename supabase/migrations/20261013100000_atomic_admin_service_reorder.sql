-- Replace one PATCH per service with one authorized transactional reorder.

create or replace function public.reorder_services(p_order jsonb)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
  service_count integer;
  submitted_count integer;
  matched_count integer;
  updated_count integer;
begin
  if actor is null or not public.has_role(actor, 'admin') then
    raise exception using errcode = 'P0001', message = 'admin authorization required';
  end if;

  if p_order is null
     or jsonb_typeof(p_order) <> 'array'
     or jsonb_array_length(p_order) = 0
     or jsonb_array_length(p_order) > 500 then
    raise exception using errcode = 'P0001', message = 'service order must contain between 1 and 500 items';
  end if;

  select count(*)::integer into service_count from public.services;
  select count(*)::integer
    into submitted_count
  from jsonb_to_recordset(p_order) as item(id uuid, display_order integer);

  if submitted_count <> service_count then
    raise exception using errcode = 'P0001', message = 'complete service order required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
    group by item.id
    having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate service id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
    where item.display_order is null or item.display_order < 0
  ) then
    raise exception using errcode = 'P0001', message = 'invalid service display order';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
    group by item.display_order
    having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'duplicate service display order';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
    left join public.services service on service.id = item.id
    where service.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'unknown service id';
  end if;

  select count(*)::integer
    into matched_count
  from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
  join public.services service on service.id = item.id;

  if matched_count <> service_count then
    raise exception using errcode = 'P0001', message = 'service order does not match current services';
  end if;

  perform set_config('app.audit_reason', 'admin service reorder', true);

  with incoming as (
    select item.id, item.display_order
    from jsonb_to_recordset(p_order) as item(id uuid, display_order integer)
  )
  update public.services as service
  set display_order = incoming.display_order,
      updated_at = now()
  from incoming
  where service.id = incoming.id
    and service.display_order is distinct from incoming.display_order;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.reorder_services(jsonb) from public, anon;
grant execute on function public.reorder_services(jsonb) to authenticated, service_role;
