-- Client-feedback hardening: do not commit incomplete contacts, zero-value
-- payments, or package purchases without the contact metadata needed to create
-- a client record. This migration is additive and must be applied to staging
-- only after the prerequisite booking/payment migrations documented in
-- docs/TALKSPACE_P0_BOOKING_PAYMENT_MIGRATION_REQUIRED.md.

CREATE OR REPLACE FUNCTION public.guard_confirmed_appointment_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed'::public.appointment_status
     AND (
       length(trim(COALESCE(NEW.client_name, ''))) < 2
       OR length(trim(COALESCE(NEW.client_email, ''))) < 3
       OR length(trim(COALESCE(NEW.client_phone, ''))) < 7
     ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'confirmed_contact_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_confirmed_contact_guard ON public.appointments;
CREATE TRIGGER appointments_confirmed_contact_guard
  BEFORE INSERT OR UPDATE OF status, client_name, client_email, client_phone
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_confirmed_appointment_contact();

CREATE OR REPLACE FUNCTION public.guard_succeeded_payment_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded'::public.payment_status THEN
    IF NEW.amount_kobo IS NULL OR NEW.amount_kobo <= 0 OR NEW.currency <> 'NGN' THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_succeeded_payment';
    END IF;

    IF NEW.payment_kind = 'package_purchase'::public.payment_kind
       AND (
         length(trim(COALESCE(NEW.metadata->>'client_name', ''))) < 2
         OR length(trim(COALESCE(NEW.metadata->>'client_email', ''))) < 3
         OR length(trim(COALESCE(NEW.metadata->>'client_phone', ''))) < 7
       ) THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'package_contact_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_succeeded_integrity_guard ON public.payments;
CREATE TRIGGER payments_succeeded_integrity_guard
  BEFORE INSERT OR UPDATE OF status, amount_kobo, currency, payment_kind, appointment_id, metadata
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_succeeded_payment_integrity();

-- Do not fall back to the online service price for an in-person transfer.
-- The application uses the same policy through resolveServicePriceNgn; this
-- database function keeps direct RPC callers subject to the same invariant.
CREATE OR REPLACE FUNCTION public.submit_bank_transfer(
  p_appointment_id uuid,
  p_reference text,
  p_amount_kobo bigint,
  p_transfer_note text DEFAULT NULL,
  p_transfer_reference text DEFAULT NULL,
  p_receipt_path text DEFAULT NULL,
  p_manage_token_hash text DEFAULT NULL
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  appt public.appointments%rowtype;
  service_record public.services%rowtype;
  actor text;
  expected_amount_kobo bigint;
  p public.payments;
BEGIN
  SELECT * INTO appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found';
  END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;

  SELECT * INTO service_record
  FROM public.services
  WHERE id = appt.service_id
    AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'service_unavailable';
  END IF;

  expected_amount_kobo := round(
    CASE WHEN appt.session_mode = 'in_person'
      THEN service_record.in_person_price_ngn
      ELSE service_record.price_ngn
    END * 100
  )::bigint;
  IF expected_amount_kobo IS NULL OR expected_amount_kobo <= 0
     OR p_amount_kobo <> expected_amount_kobo THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_amount';
  END IF;
  IF nullif(trim(p_transfer_reference), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'transfer_reference_required';
  END IF;

  INSERT INTO public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    transfer_note, transfer_reference, receipt_path, metadata, created_by
  ) VALUES (
    p_appointment_id, 'bank_transfer', p_reference, p_amount_kobo,
    'awaiting_confirmation', nullif(trim(p_transfer_note), ''),
    nullif(trim(p_transfer_reference), ''), p_receipt_path,
    jsonb_build_object('submitted_via', actor), auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET transfer_note = coalesce(excluded.transfer_note, public.payments.transfer_note),
        transfer_reference = coalesce(excluded.transfer_reference, public.payments.transfer_reference),
        receipt_path = coalesce(excluded.receipt_path, public.payments.receipt_path),
        status = CASE
          WHEN public.payments.status IN ('succeeded', 'refunded') THEN public.payments.status
          ELSE 'awaiting_confirmation'::public.payment_status
        END,
        updated_at = now()
  RETURNING * INTO p;

  UPDATE public.appointments
  SET status = CASE
      WHEN status = 'hold' THEN 'pending_payment'::public.appointment_status
      ELSE status
    END,
    hold_expires_at = CASE WHEN status = 'hold' THEN NULL ELSE hold_expires_at END,
    payment_reference = p.reference,
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bank_transfer(uuid, text, bigint, text, text, text, text)
  TO authenticated, service_role;
