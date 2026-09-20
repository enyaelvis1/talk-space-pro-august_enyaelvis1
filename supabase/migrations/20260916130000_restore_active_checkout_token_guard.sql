-- Holds and pending payments still need an active manage token so clients can
-- start Paystack or submit a bank transfer during the checkout window.
-- Terminal and confirmed bookings retain their separate token rules.

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
     and p_appointment.status not in ('cancelled', 'completed', 'no_show')
     and case
       when p_appointment.status in ('hold', 'pending_payment')
         then public.booking_checkout_deadline(p_appointment) > now()
       else p_appointment.manage_token_expires_at > now()
     end;
$$;

revoke all on function public.appointment_manage_token_is_active(public.appointments) from public;
grant execute on function public.appointment_manage_token_is_active(public.appointments)
  to anon, authenticated, service_role;
