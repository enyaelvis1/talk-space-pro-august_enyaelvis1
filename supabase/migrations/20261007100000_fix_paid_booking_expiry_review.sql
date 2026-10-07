-- A checkout deadline limits unpaid bearer-token actions, not already verified
-- money. Keep settlement and slot commitment separate and never revive an
-- explicitly cancelled or archived booking from a provider callback.
BEGIN;

CREATE OR REPLACE FUNCTION public.apply_appointment_manage_token_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.package_id IS DISTINCT FROM OLD.package_id AND NEW.package_id IS NOT NULL
      AND OLD.status <> 'confirmed' AND
      (OLD.status NOT IN ('hold', 'pending_payment') OR
       NOT COALESCE(public.appointment_manage_token_is_active(OLD), false)) THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'checkout_expired';
    END IF;
    IF NEW.status = 'confirmed' AND OLD.status IN ('hold', 'pending_payment')
      AND public.booking_checkout_deadline(OLD) <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.payments pay
        WHERE pay.appointment_id = NEW.id AND pay.status = 'succeeded'
      ) THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'checkout_expired';
    END IF;
    -- The existing admin reschedule RPC can resolve a paid cancelled booking.
    -- Its old checkout bearer must not stay revoked after commitment succeeds.
    IF NEW.status = 'confirmed' AND OLD.status = 'cancelled'
      AND (NEW.manage_token IS NULL OR NEW.manage_token_revoked_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.payments pay WHERE pay.appointment_id = NEW.id AND pay.status = 'succeeded') THEN
      NEW.manage_token := encode(gen_random_bytes(32), 'hex');
      NEW.manage_token_hash := encode(digest(NEW.manage_token, 'sha256'), 'hex');
      NEW.manage_token_revoked_at := NULL;
      NEW.manage_token_revoked_by := NULL;
      NEW.manage_token_revocation_reason := NULL;
    END IF;
  END IF;
  IF NEW.status IN ('hold', 'pending_payment') THEN
    NEW.manage_token_expires_at := public.booking_checkout_deadline(NEW);
  ELSIF NEW.status = 'confirmed' AND NEW.manage_token_revoked_at IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.manage_token_expires_at := COALESCE(NEW.manage_token_expires_at,
        greatest(NEW.ends_at, now()) + interval '30 days');
    ELSIF OLD.status IN ('hold', 'pending_payment') OR NEW.manage_token_hash IS DISTINCT FROM OLD.manage_token_hash THEN
      NEW.manage_token_expires_at := greatest(NEW.ends_at, now()) + interval '30 days';
    END IF;
  END IF;
  IF NEW.status IN ('completed', 'no_show') OR
      (NEW.status = 'cancelled' AND NEW.cancelled_at IS NOT NULL) THEN
    NEW.manage_token := NULL;
    NEW.manage_token_revoked_at := COALESCE(NEW.manage_token_revoked_at, now());
    NEW.manage_token_revocation_reason := COALESCE(NEW.manage_token_revocation_reason, 'status_' || NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_holds() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.appointments appt SET status = 'cancelled', hold_expires_at = NULL,
    cancelled_at = COALESCE(appt.cancelled_at, now()), updated_at = now(),
    manage_token = NULL, manage_token_revoked_at = COALESCE(appt.manage_token_revoked_at, now()),
    manage_token_revocation_reason = COALESCE(appt.manage_token_revocation_reason, 'hold_expired')
  WHERE appt.status IN ('hold', 'pending_payment')
    AND public.booking_checkout_deadline(appt) <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.payments pay WHERE pay.appointment_id = appt.id
        AND (pay.status = 'succeeded' OR
          (pay.provider = 'bank_transfer' AND pay.status = 'awaiting_confirmation'))
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payment_status(
  p_reference text, p_new_status public.payment_status,
  p_provider_reference text DEFAULT NULL, p_failed_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  payment_row public.payments;
  group_ref text;
  problem text;
  appt public.appointments;
  new_token text;
BEGIN
  SELECT COALESCE(pay.checkout_group_reference, pay.reference) INTO group_ref
  FROM public.payments pay
  WHERE pay.reference = p_reference OR pay.checkout_group_reference = p_reference LIMIT 1;
  IF group_ref IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'payment_not_found';
  END IF;
  PERFORM pay.id FROM public.payments pay
  WHERE pay.reference = group_ref OR pay.checkout_group_reference = group_ref
  ORDER BY pay.id FOR UPDATE;
  SELECT pay.* INTO payment_row FROM public.payments pay
  WHERE pay.reference = p_reference OR pay.checkout_group_reference = p_reference
  ORDER BY CASE WHEN pay.reference = p_reference THEN 0 ELSE 1 END, pay.id LIMIT 1;

  -- Never downgrade settled money, even when slot commitment needs review.
  IF EXISTS (SELECT 1 FROM public.payments pay
      WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
        AND pay.status = 'refunded')
    OR (payment_row.status = 'succeeded' AND p_new_status NOT IN ('succeeded', 'refunded')) THEN
    RETURN payment_row;
  END IF;
  IF payment_row.status = 'succeeded' AND p_new_status = 'succeeded'
    AND (payment_row.payment_kind = 'package_purchase' OR NOT EXISTS (
      SELECT 1 FROM public.appointments a JOIN public.payments pay ON pay.appointment_id = a.id
      WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
        AND a.status NOT IN ('confirmed', 'completed', 'no_show') AND a.archived_at IS NULL
    )) THEN RETURN payment_row; END IF;

  UPDATE public.payments pay SET status = p_new_status,
    provider_reference = COALESCE(p_provider_reference, pay.provider_reference),
    failed_reason = CASE WHEN p_new_status = 'succeeded' THEN NULL ELSE COALESCE(p_failed_reason, pay.failed_reason) END,
    metadata = COALESCE(pay.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
    verified_by = CASE WHEN p_new_status IN ('succeeded', 'refunded') THEN COALESCE(pay.verified_by, auth.uid()) ELSE pay.verified_by END,
    verified_at = CASE WHEN p_new_status IN ('succeeded', 'refunded') THEN COALESCE(pay.verified_at, now()) ELSE pay.verified_at END,
    updated_at = now()
  WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
    AND (pay.status IS DISTINCT FROM p_new_status
      OR (p_provider_reference IS NOT NULL AND pay.provider_reference IS DISTINCT FROM p_provider_reference)
      OR (p_failed_reason IS NOT NULL AND pay.failed_reason IS DISTINCT FROM p_failed_reason)
      OR (COALESCE(pay.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)) IS DISTINCT FROM pay.metadata);

  IF p_new_status = 'succeeded' AND payment_row.payment_kind = 'package_purchase' THEN
    PERFORM public.confirm_package_purchase(payment_row.reference,
      NULLIF(payment_row.metadata->>'service_id', '')::uuid,
      NULLIF(payment_row.metadata->>'client_id', '')::uuid,
      payment_row.metadata->>'client_name', payment_row.metadata->>'client_email',
      payment_row.metadata->>'client_phone', COALESCE((payment_row.metadata->>'purchased_sessions')::integer, 1));
  ELSIF p_new_status = 'succeeded' THEN
    BEGIN
      PERFORM t.id FROM public.therapists t WHERE t.id IN (
        SELECT a.therapist_id FROM public.appointments a JOIN public.payments pay ON pay.appointment_id = a.id
        WHERE pay.reference = group_ref OR pay.checkout_group_reference = group_ref
      ) ORDER BY t.id FOR UPDATE;

      FOR appt IN SELECT a.* FROM public.appointments a
        WHERE a.id IN (SELECT pay.appointment_id FROM public.payments pay
          WHERE pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
        ORDER BY a.id FOR UPDATE
      LOOP
        IF appt.archived_at IS NOT NULL OR (
          appt.status NOT IN ('hold', 'pending_payment', 'confirmed', 'completed', 'no_show') AND NOT (
            appt.status = 'cancelled' AND appt.cancelled_by IS NULL AND appt.cancel_reason IS NULL
            AND appt.manage_token_revocation_reason IN ('checkout_expired', 'hold_expired')
          )) THEN
          RAISE EXCEPTION USING errcode = 'P0001', message = 'booking_cancelled';
        END IF;
        IF appt.status IN ('confirmed', 'completed', 'no_show') THEN CONTINUE; END IF;
        -- Regenerate a revoked checkout token only after money is verified.
        new_token := CASE WHEN appt.manage_token IS NULL OR appt.manage_token_revoked_at IS NOT NULL
          THEN encode(gen_random_bytes(32), 'hex') ELSE appt.manage_token END;
        UPDATE public.appointments a SET status = 'confirmed', hold_expires_at = NULL,
          cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL,
          manage_token = new_token, manage_token_hash = encode(digest(new_token, 'sha256'), 'hex'),
          manage_token_expires_at = greatest(a.ends_at, now()) + interval '30 days',
          manage_token_revoked_at = NULL, manage_token_revoked_by = NULL, manage_token_revocation_reason = NULL,
          paid_amount_kobo = pay.amount_kobo, payment_reference = group_ref, updated_at = now()
        FROM public.payments pay WHERE a.id = appt.id AND pay.appointment_id = a.id
          AND (pay.reference = group_ref OR pay.checkout_group_reference = group_ref);
        -- Fail the entire group rather than reporting success after a trigger
        -- silently refused commitment. Existing slot/contact guards still run.
        IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appt.id AND a.status = 'confirmed') THEN
          RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
        END IF;
      END LOOP;
      UPDATE public.payments pay SET metadata = pay.metadata - 'booking_review_required' - 'booking_review_reason', updated_at = now()
      WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
        AND (pay.metadata ? 'booking_review_required' OR pay.metadata ? 'booking_review_reason');
    EXCEPTION WHEN exclusion_violation OR SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS problem = MESSAGE_TEXT;
      IF SQLSTATE = 'P0001' AND problem NOT IN ('slot_unavailable', 'booking_cancelled') THEN RAISE; END IF;
      IF SQLSTATE = '23P01' THEN problem := 'slot_unavailable'; END IF;
      UPDATE public.payments pay SET metadata = pay.metadata || jsonb_build_object(
        'booking_review_required', true, 'booking_review_reason', problem), updated_at = now()
      WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
        AND (pay.metadata->>'booking_review_required' IS DISTINCT FROM 'true'
          OR pay.metadata->>'booking_review_reason' IS DISTINCT FROM problem);
    END;
  END IF;
  SELECT pay.* INTO payment_row FROM public.payments pay
  WHERE pay.reference = p_reference OR pay.checkout_group_reference = p_reference
  ORDER BY CASE WHEN pay.reference = p_reference THEN 0 ELSE 1 END, pay.id LIMIT 1;
  RETURN payment_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb) TO service_role;

-- Later availability migrations reintroduced unpaid holds/pending transfers
-- into the slot filter. Only committed unarchived bookings reserve a slot.
CREATE OR REPLACE FUNCTION public.list_available_slots(
  p_service_id uuid, p_from date, p_to date, p_mode public.session_mode DEFAULT NULL
) RETURNS TABLE (therapist_id uuid, starts_at timestamptz, ends_at timestamptz, mode public.session_mode)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH selected_service AS (
    SELECT svc.* FROM public.services svc WHERE svc.id = p_service_id AND svc.is_active
  ), days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day WHERE p_from <= p_to
  ), recurring_windows AS (
    SELECT rule.therapist_id,
      ((days.day::timestamp + rule.starts_at) AT TIME ZONE rule.timezone) AS window_start,
      ((days.day::timestamp + rule.ends_at) AT TIME ZONE rule.timezone) AS window_end, rule.mode
    FROM public.availability_rules rule
    JOIN public.therapist_services assignment ON assignment.therapist_id = rule.therapist_id AND assignment.service_id = p_service_id
    JOIN public.therapists therapist ON therapist.id = rule.therapist_id AND therapist.is_active
    CROSS JOIN days WHERE rule.is_active AND extract(dow FROM days.day) = rule.day_of_week
      AND (p_mode IS NULL OR rule.mode = p_mode)
  ), added_windows AS (
    SELECT exception.therapist_id, exception.starts_at AS window_start, exception.ends_at AS window_end,
      COALESCE(exception.mode, p_mode, 'online'::public.session_mode) AS mode
    FROM public.availability_exceptions exception
    JOIN public.therapist_services assignment ON assignment.therapist_id = exception.therapist_id AND assignment.service_id = p_service_id
    JOIN public.therapists therapist ON therapist.id = exception.therapist_id AND therapist.is_active
    WHERE exception.kind = 'added' AND timezone('Africa/Lagos', exception.starts_at)::date BETWEEN p_from AND p_to
      AND (p_mode IS NULL OR exception.mode IS NULL OR exception.mode = p_mode)
  ), windows AS (
    SELECT * FROM recurring_windows UNION ALL SELECT * FROM added_windows
  ), candidate_slots AS (
    SELECT windows.therapist_id, slot.starts_at,
      slot.starts_at + make_interval(mins => svc.duration_minutes) AS ends_at, windows.mode,
      svc.buffer_before_minutes, svc.buffer_after_minutes, svc.minimum_lead_time_minutes
    FROM windows CROSS JOIN selected_service svc
    CROSS JOIN LATERAL generate_series(windows.window_start,
      windows.window_end - make_interval(mins => svc.duration_minutes), interval '15 minutes') AS slot(starts_at)
  )
  SELECT DISTINCT candidate.therapist_id, candidate.starts_at, candidate.ends_at, candidate.mode
  FROM candidate_slots candidate
  WHERE candidate.starts_at >= now() + make_interval(mins => candidate.minimum_lead_time_minutes)
    AND NOT EXISTS (
      SELECT 1 FROM public.availability_exceptions blocked
      WHERE blocked.therapist_id = candidate.therapist_id AND blocked.kind = 'blocked'
        AND (blocked.mode IS NULL OR blocked.mode = candidate.mode)
        AND tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes), '[)')
    ) AND NOT EXISTS (
      SELECT 1 FROM public.appointments a JOIN public.services booked_service ON booked_service.id = a.service_id
      WHERE a.therapist_id = candidate.therapist_id AND a.archived_at IS NULL AND a.status = 'confirmed'
        AND tstzrange(a.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          a.ends_at + make_interval(mins => booked_service.buffer_after_minutes), '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes), '[)')
    )
  ORDER BY candidate.starts_at, candidate.therapist_id;
$$;

GRANT EXECUTE ON FUNCTION public.list_available_slots(uuid, date, date, public.session_mode) TO anon, authenticated;

-- Enable the existing admin reschedule RPC for legacy paid cancellations, which
-- previously had a UI-only review flag. Never restore/rebook records here.
UPDATE public.payments pay SET metadata = pay.metadata || jsonb_build_object(
  'booking_review_required', true, 'booking_review_reason', 'booking_cancelled'), updated_at = now()
FROM public.appointments a WHERE a.id = pay.appointment_id
  AND pay.status = 'succeeded' AND a.status = 'cancelled' AND a.archived_at IS NULL
  AND pay.metadata->>'booking_review_required' IS DISTINCT FROM 'true';
UPDATE public.payments pay SET metadata = pay.metadata - 'booking_review_required' - 'booking_review_reason', updated_at = now()
FROM public.appointments a WHERE a.id = pay.appointment_id AND pay.status = 'succeeded'
  AND a.status IN ('confirmed', 'completed', 'no_show')
  AND (pay.metadata ? 'booking_review_required' OR pay.metadata ? 'booking_review_reason');

COMMIT;
