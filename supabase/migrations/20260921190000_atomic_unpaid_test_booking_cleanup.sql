-- Delete only an unpaid/test appointment, atomically revoking its manage token
-- and clearing any hold before the row is removed. Paid or review-relevant
-- payments remain protected by the database, not just by the admin UI.
create or replace function public.delete_unpaid_test_appointment(
  p_appointment_id uuid,
  p_reason text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target public.appointments%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = 'P0001', message = 'cleanup_reason_required';
  end if;

  select a.* into target
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_not_found';
  end if;
  if target.status not in ('hold'::public.appointment_status, 'pending_payment'::public.appointment_status, 'cancelled'::public.appointment_status) then
    raise exception using errcode = 'P0001', message = 'appointment_not_eligible_for_deletion';
  end if;
  if exists (
    select 1
    from public.payments p
    where p.appointment_id = target.id
      and p.status in (
        'succeeded'::public.payment_status,
        'awaiting_confirmation'::public.payment_status,
        'refunded'::public.payment_status
      )
  ) then
    raise exception using errcode = 'P0001', message = 'payment_history_protected';
  end if;

  perform set_config('app.audit_reason', left(trim(p_reason), 500), true);
  update public.appointments
  set manage_token = null,
      manage_token_hash = null,
      hold_expires_at = null,
      manage_token_revoked_at = coalesce(manage_token_revoked_at, now()),
      manage_token_revoked_by = coalesce(manage_token_revoked_by, auth.uid()),
      manage_token_revocation_reason = coalesce(
        manage_token_revocation_reason,
        left(trim(p_reason), 200)
      )
  where public.appointments.id = target.id;

  delete from public.appointments where public.appointments.id = target.id;
  return query select target.id;
end;
$$;

revoke all on function public.delete_unpaid_test_appointment(uuid, text) from public, anon;
grant execute on function public.delete_unpaid_test_appointment(uuid, text) to authenticated, service_role;
