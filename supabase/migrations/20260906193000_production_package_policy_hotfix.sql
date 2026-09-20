-- Production hotfix for manually-applied SQL: keep the public site settings
-- policy and package-session activation function in one complete script.

drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read
on public.site_settings for select
to anon, authenticated
using (
  key in (
    'home_hero',
    'home_specialties',
    'home_specialty_cards',
    'home_sections',
    'home_section_copy',
    'home_pricing',
    'google_reviews',
    'site_details',
    'form_templates',
    'footer_settings'
  )
);

create or replace function public.activate_session_package_for_payment(
  p_payment_id uuid
) returns table(
  package_id uuid,
  client_email text,
  purchased_sessions integer,
  used_sessions integer,
  remaining_sessions integer,
  access_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payment public.payments%rowtype;
  appt public.appointments%rowtype;
  service_record public.services%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token text;
begin
  select * into payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_not_found';
  end if;

  if payment.status <> 'succeeded' then
    return;
  end if;

  select * into appt
  from public.appointments
  where id = payment.appointment_id
  for update;
  if not found then
    return;
  end if;

  select * into service_record
  from public.services
  where id = appt.service_id;
  if not found or service_record.sessions_per_package <= 1 then
    return;
  end if;

  select * into pkg
  from public.client_session_packages
  where source_payment_id = payment.id
  for update;

  if not found then
    raw_token := encode(gen_random_bytes(32), 'hex');
    insert into public.client_session_packages (
      client_id,
      client_name,
      client_email,
      client_phone,
      service_id,
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) values (
      appt.client_id,
      appt.client_name,
      appt.client_email,
      appt.client_phone,
      appt.service_id,
      payment.id,
      service_record.sessions_per_package,
      1,
      case
        when service_record.sessions_per_package <= 1
          then 'exhausted'::public.session_package_status
        else 'active'::public.session_package_status
      end,
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      now() + interval '6 months',
      auth.uid()
    )
    returning * into pkg;
  end if;

  if appt.package_id is null then
    update public.appointments
    set package_id = pkg.id,
        updated_at = now()
    where id = appt.id;
  end if;

  if pkg.used_sessions = 0 then
    update public.client_session_packages
    set used_sessions = 1,
        status = case
          when purchased_sessions <= 1
            then 'exhausted'::public.session_package_status
          else status
        end,
        updated_at = now()
    where id = pkg.id
    returning * into pkg;
  end if;

  package_id := pkg.id;
  client_email := pkg.client_email;
  purchased_sessions := pkg.purchased_sessions;
  used_sessions := pkg.used_sessions;
  remaining_sessions := greatest(pkg.purchased_sessions - pkg.used_sessions, 0);
  access_token := pkg.access_token;
  return next;
end;
$$;

revoke all on function public.activate_session_package_for_payment(uuid) from public;
grant execute on function public.activate_session_package_for_payment(uuid)
  to authenticated, service_role;

update public.client_session_packages pkg
set used_sessions = 1,
    status = case
      when pkg.purchased_sessions <= 1
        then 'exhausted'::public.session_package_status
      else pkg.status
    end,
    updated_at = now()
where pkg.source_payment_id is not null
  and pkg.used_sessions = 0
  and exists (
    select 1
    from public.appointments appt
    where appt.package_id = pkg.id
  );
