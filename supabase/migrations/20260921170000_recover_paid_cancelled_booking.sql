-- Mark paid cancelled bank-transfer appointments for review and provide a
-- guarded, atomic admin recovery path that recreates the manage link.

UPDATE public.payments AS pay
SET metadata = pay.metadata || jsonb_build_object(
  'booking_review_required', true,
  'booking_review_reason', 'cancelled_paid_booking'
),
    updated_at = now()
FROM public.appointments AS appt
WHERE appt.id = pay.appointment_id
  AND pay.provider = 'bank_transfer'
  AND pay.status = 'succeeded'
  AND appt.status = 'cancelled'
  AND NOT COALESCE((pay.metadata->>'booking_review_required')::boolean, false);

CREATE OR REPLACE FUNCTION public.recover_paid_bank_transfer_booking(
  p_payment_id uuid
) RETURNS TABLE(
  id uuid,
  booking_reference text,
  status public.appointment_status,
  manage_token text,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payment_row public.payments%rowtype;
  appointment_row public.appointments%rowtype;
  service_duration integer;
  new_token text;
  new_hash text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;

  SELECT * INTO payment_row
  FROM public.payments
  WHERE public.payments.id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'payment_not_found';
  END IF;
  IF payment_row.provider <> 'bank_transfer' OR payment_row.status <> 'succeeded' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'payment_not_confirmed';
  END IF;

  SELECT * INTO appointment_row
  FROM public.appointments
  WHERE public.appointments.id = payment_row.appointment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'appointment_not_found';
  END IF;
  IF appointment_row.status <> 'cancelled' OR appointment_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'booking_not_recoverable';
  END IF;
  IF appointment_row.starts_at <= now() THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'booking_started';
  END IF;

  SELECT duration_minutes INTO service_duration
  FROM public.services
  WHERE public.services.id = appointment_row.service_id;
  IF service_duration IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'service_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.list_available_slots(
      appointment_row.service_id,
      (appointment_row.starts_at AT TIME ZONE 'Africa/Lagos')::date,
      (appointment_row.starts_at AT TIME ZONE 'Africa/Lagos')::date,
      appointment_row.session_mode
    ) available
    WHERE available.therapist_id = appointment_row.therapist_id
      AND available.starts_at = appointment_row.starts_at
      AND available.ends_at = appointment_row.starts_at + make_interval(mins => service_duration)
      AND available.mode = appointment_row.session_mode
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
  END IF;

  new_token := encode(gen_random_bytes(32), 'hex');
  new_hash := encode(digest(new_token, 'sha256'), 'hex');

  UPDATE public.appointments AS appt
  SET status = 'confirmed',
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancel_reason = NULL,
      hold_expires_at = NULL,
      manage_token = new_token,
      manage_token_hash = new_hash,
      manage_token_expires_at = greatest(appt.ends_at, now()) + interval '30 days',
      manage_token_revoked_at = NULL,
      manage_token_revoked_by = NULL,
      manage_token_revocation_reason = NULL,
      paid_amount_kobo = payment_row.amount_kobo,
      payment_reference = payment_row.reference,
      updated_at = now()
  WHERE appt.id = appointment_row.id
  RETURNING appt.id, appt.booking_reference, appt.status, appt.manage_token,
    appt.starts_at, appt.ends_at
  INTO id, booking_reference, status, manage_token, starts_at, ends_at;

  UPDATE public.payments AS pay
  SET metadata = pay.metadata
        - 'booking_review_required'
        - 'booking_review_reason'
        || jsonb_build_object('booking_recovered_at', now(), 'booking_recovery_reason', 'admin_confirmed_transfer'),
      updated_at = now()
  WHERE pay.id = payment_row.id;

  RETURN NEXT;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
END;
$$;

REVOKE ALL ON FUNCTION public.recover_paid_bank_transfer_booking(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.recover_paid_bank_transfer_booking(uuid) TO authenticated, service_role;
