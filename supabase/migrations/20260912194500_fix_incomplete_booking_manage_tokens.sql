-- Incomplete booking tokens must not resolve into a valid manage link or
-- committed booking state. Only fully committed bookings retain active manage tokens.

create or replace function public.appointment_manage_token_is_active(
  p_appointment public.appointments
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_appointment.manage_token_hash is not null
     and p_appointment.manage_token_revoked_at is null
     and (
        p_appointment.manage_token_expires_at is null
        or p_appointment.manage_token_expires_at > now()
     )
     and p_appointment.status not in ('hold', 'pending_payment', 'cancelled', 'completed', 'no_show');
$$;

revoke all on function public.appointment_manage_token_is_active(public.appointments) from public;
grant execute on function public.appointment_manage_token_is_active(public.appointments)
  to anon, authenticated, service_role;
