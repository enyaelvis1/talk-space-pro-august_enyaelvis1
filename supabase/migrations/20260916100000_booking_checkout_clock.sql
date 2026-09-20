-- Keep the client countdown aligned with the database checkout guard.
-- This is intentionally service-role-only because it exposes booking timing metadata.
create or replace function public.get_booking_checkout_clock(p_appointment_ids uuid[])
returns table(
  appointment_id uuid,
  checkout_expires_at timestamptz,
  server_now timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    appointment.id,
    public.booking_checkout_deadline(appointment),
    now()
  from public.appointments appointment
  where appointment.id = any(p_appointment_ids);
$$;

revoke all on function public.get_booking_checkout_clock(uuid[]) from public, anon, authenticated;
grant execute on function public.get_booking_checkout_clock(uuid[]) to service_role;
