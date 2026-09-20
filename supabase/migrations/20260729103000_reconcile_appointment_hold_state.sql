-- Reconcile stale appointment hold/payment writes with the current booking flow.
--
-- Some live environments still have a mixed appointment state history where
-- rows can reach `pending_payment` while retaining a hold expiry, or reach
-- `hold` without one. This trigger normalizes the row before the table
-- constraints run so the booking flow stays resilient even if an older RPC is
-- still active remotely.

update public.appointments
set hold_expires_at = null
where status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show')
  and hold_expires_at is not null;

update public.appointments
set hold_expires_at = coalesce(hold_expires_at, created_at + interval '5 minutes')
where status = 'hold'
  and hold_expires_at is null;

create or replace function public.normalize_appointment_hold_state()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'hold' then
    if new.hold_expires_at is null then
      if tg_op = 'INSERT' or old.status is distinct from new.status or old.hold_expires_at is distinct from new.hold_expires_at then
        new.hold_expires_at := now() + interval '5 minutes';
      end if;
    end if;
  else
    new.hold_expires_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_normalize_hold_state on public.appointments;
create trigger appointments_normalize_hold_state
before insert or update of status, hold_expires_at on public.appointments
for each row execute function public.normalize_appointment_hold_state();
