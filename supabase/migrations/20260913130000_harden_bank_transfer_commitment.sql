-- Bank-transfer submissions must match the stored service price, and replaying a
-- reference must not undo an already approved or refunded payment.
create or replace function public.submit_bank_transfer(
  p_appointment_id uuid,
  p_reference text,
  p_amount_kobo bigint,
  p_transfer_note text default null,
  p_transfer_reference text default null,
  p_receipt_path text default null,
  p_manage_token_hash text default null
) returns public.payments
language plpgsql security definer set search_path = public, extensions
as $$
declare
  appt public.appointments%rowtype;
  service_record public.services%rowtype;
  actor text;
  expected_amount_kobo bigint;
  p public.payments;
begin
  select * into appt
  from public.appointments
  where id = p_appointment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  if actor is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select * into service_record
  from public.services
  where id = appt.service_id
    and is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'service_unavailable';
  end if;

  expected_amount_kobo := round(
    coalesce(
      case when appt.session_mode = 'in_person'
        then service_record.in_person_price_ngn
        else service_record.price_ngn
      end,
      service_record.price_ngn
    ) * 100
  )::bigint;
  if expected_amount_kobo <= 0 or p_amount_kobo <> expected_amount_kobo then
    raise exception using errcode = 'P0001', message = 'invalid_amount';
  end if;
  if nullif(trim(p_transfer_reference), '') is null then
    raise exception using errcode = 'P0001', message = 'transfer_reference_required';
  end if;

  insert into public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    transfer_note, transfer_reference, receipt_path, metadata, created_by
  ) values (
    p_appointment_id, 'bank_transfer', p_reference, p_amount_kobo,
    'awaiting_confirmation', nullif(trim(p_transfer_note), ''),
    nullif(trim(p_transfer_reference), ''), p_receipt_path,
    jsonb_build_object('submitted_via', actor), auth.uid()
  )
  on conflict (reference) do update
    set transfer_note = coalesce(excluded.transfer_note, public.payments.transfer_note),
        transfer_reference = coalesce(excluded.transfer_reference, public.payments.transfer_reference),
        receipt_path = coalesce(excluded.receipt_path, public.payments.receipt_path),
        status = case
          when public.payments.status in ('succeeded', 'refunded') then public.payments.status
          else 'awaiting_confirmation'::public.payment_status
        end,
        updated_at = now()
  returning * into p;

  update public.appointments
  set status = case
      when status = 'hold' then 'pending_payment'::public.appointment_status
      else status
    end,
    hold_expires_at = case when status = 'hold' then null else hold_expires_at end,
    payment_reference = p.reference,
    updated_at = now()
  where id = p_appointment_id;

  return p;
end $$;

grant execute on function public.submit_bank_transfer(uuid, text, bigint, text, text, text, text)
to authenticated, service_role;
