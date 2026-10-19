alter table public.appointments
  add column if not exists partner_name text,
  add column if not exists partner_email text,
  add column if not exists partner_phone text;

create or replace function public.hold_appointment_with_partner(
  p_service_id uuid,
  p_therapist_id uuid,
  p_session_mode public.session_mode,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_notes text,
  p_manage_token_hash text,
  p_client_id uuid default null,
  p_partner_name text default null,
  p_partner_email text default null,
  p_partner_phone text default null
)
returns table (
  id uuid,
  booking_reference text,
  hold_expires_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  held record;
begin
  select * into held
  from public.hold_appointment(
    p_service_id,
    p_therapist_id,
    p_session_mode,
    p_starts_at,
    p_client_name,
    p_client_email,
    p_client_phone,
    p_notes,
    p_manage_token_hash,
    p_client_id
  );

  update public.appointments
  set partner_name = nullif(trim(p_partner_name), ''),
      partner_email = nullif(lower(trim(p_partner_email)), ''),
      partner_phone = nullif(trim(p_partner_phone), '')
  where public.appointments.id = held.id;

  id := held.id;
  booking_reference := held.booking_reference;
  hold_expires_at := held.hold_expires_at;
  starts_at := held.starts_at;
  ends_at := held.ends_at;
  return next;
end;
$$;

grant execute on function public.hold_appointment_with_partner(
  uuid, uuid, public.session_mode, timestamptz, text, text, text, text, text, uuid, text, text, text
) to anon, authenticated;
