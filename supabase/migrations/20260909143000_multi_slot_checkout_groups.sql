-- Allow one checkout reference to confirm multiple appointment holds.
-- Existing single-appointment payments continue to work through appointment_id.

alter table public.payments
  add column if not exists checkout_group_reference text;

create index if not exists payments_checkout_group_reference_idx
  on public.payments(checkout_group_reference);

create or replace function public.mark_payment_status(
  p_reference text,
  p_new_status public.payment_status,
  p_provider_reference text default null,
  p_failed_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  group_ref text;
begin
  select coalesce(checkout_group_reference, reference)
    into group_ref
  from public.payments
  where reference = p_reference
  limit 1;

  if group_ref is null then
    raise exception using errcode='P0001', message='payment_not_found';
  end if;

  update public.payments
    set status = p_new_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        failed_reason = coalesce(p_failed_reason, failed_reason),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        verified_by = case when p_new_status in ('succeeded','refunded') then auth.uid() else verified_by end,
        verified_at = case when p_new_status in ('succeeded','refunded') then now() else verified_at end,
        updated_at = now()
  where reference = p_reference
     or checkout_group_reference = group_ref;

  select * into p
  from public.payments
  where reference = p_reference
  limit 1;

  if p.id is null then
    raise exception using errcode='P0001', message='payment_not_found';
  end if;

  if p_new_status = 'succeeded' then
    update public.appointments
      set status = 'confirmed'::public.appointment_status,
          paid_amount_kobo = linked.amount_kobo,
          payment_reference = linked.checkout_group_reference,
          hold_expires_at = null,
          updated_at = now()
      from (
        select appointment_id, amount_kobo, coalesce(checkout_group_reference, reference) as checkout_group_reference
        from public.payments
        where reference = p_reference
           or checkout_group_reference = group_ref
      ) linked
      where public.appointments.id = linked.appointment_id
        and public.appointments.status in ('hold','pending_payment','confirmed');
  elsif p_new_status in ('failed','cancelled') then
    update public.appointments
      set updated_at = now()
      where id in (
        select appointment_id
        from public.payments
        where reference = p_reference
           or checkout_group_reference = group_ref
      );
  end if;

  return p;
end $$;
