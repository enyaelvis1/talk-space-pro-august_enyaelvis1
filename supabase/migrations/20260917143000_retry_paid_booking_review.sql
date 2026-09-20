-- Allow an admin to retry appointment commitment after a paid checkout hit a
-- temporary slot conflict. Ordinary succeeded payments remain idempotent.
CREATE OR REPLACE FUNCTION public.mark_payment_status(
  p_reference text,
  p_new_status public.payment_status,
  p_provider_reference text DEFAULT NULL,
  p_failed_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments;
  group_ref text;
  problem text;
BEGIN
  SELECT COALESCE(checkout_group_reference, reference)
    INTO group_ref
  FROM public.payments
  WHERE reference = p_reference
     OR checkout_group_reference = p_reference
  LIMIT 1;

  IF group_ref IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'payment_not_found';
  END IF;

  PERFORM id
  FROM public.payments
  WHERE reference = group_ref OR checkout_group_reference = group_ref
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO p
  FROM public.payments
  WHERE reference = p_reference
     OR checkout_group_reference = p_reference
  ORDER BY CASE WHEN reference = p_reference THEN 0 ELSE 1 END, id
  LIMIT 1;

  IF p.status = 'refunded'
     OR (p.status = 'succeeded' AND p_new_status <> 'refunded'
         AND NOT COALESCE((p.metadata->>'booking_review_required')::boolean, false)) THEN
    RETURN p;
  END IF;

  UPDATE public.payments
  SET status = p_new_status,
      provider_reference = COALESCE(p_provider_reference, provider_reference),
      failed_reason = CASE
        WHEN p_new_status = 'succeeded' THEN NULL
        ELSE COALESCE(p_failed_reason, failed_reason)
      END,
      metadata = metadata || COALESCE(p_metadata, '{}'::jsonb),
      verified_by = CASE
        WHEN p_new_status IN ('succeeded', 'refunded') THEN auth.uid()
        ELSE verified_by
      END,
      verified_at = CASE
        WHEN p_new_status IN ('succeeded', 'refunded') THEN now()
        ELSE verified_at
      END,
      updated_at = now()
  WHERE reference = group_ref OR checkout_group_reference = group_ref;

  IF p_new_status = 'succeeded' AND p.payment_kind = 'package_purchase' THEN
    PERFORM public.confirm_package_purchase(
      p.reference,
      NULLIF(p.metadata->>'service_id', '')::uuid,
      NULLIF(p.metadata->>'client_id', '')::uuid,
      p.metadata->>'client_name',
      p.metadata->>'client_email',
      p.metadata->>'client_phone',
      COALESCE((p.metadata->>'purchased_sessions')::integer, 1)
    );
  ELSIF p_new_status = 'succeeded' THEN
    BEGIN
      PERFORM t.id
      FROM public.therapists t
      WHERE t.id IN (
        SELECT a.therapist_id
        FROM public.appointments a
        JOIN public.payments pay ON pay.appointment_id = a.id
        WHERE pay.reference = group_ref OR pay.checkout_group_reference = group_ref
      )
      ORDER BY t.id
      FOR UPDATE;

      IF EXISTS (
        SELECT 1
        FROM public.appointments a
        JOIN public.payments pay ON pay.appointment_id = a.id
        WHERE (pay.reference = group_ref OR pay.checkout_group_reference = group_ref)
          AND (a.status NOT IN ('hold', 'pending_payment') OR a.archived_at IS NOT NULL)
      ) THEN
        RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
      END IF;

      UPDATE public.appointments a
      SET status = 'confirmed',
          hold_expires_at = NULL,
          paid_amount_kobo = pay.amount_kobo,
          payment_reference = group_ref,
          updated_at = now()
      FROM public.payments pay
      WHERE a.id = pay.appointment_id
        AND (pay.reference = group_ref OR pay.checkout_group_reference = group_ref);
    EXCEPTION
      WHEN exclusion_violation OR SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS problem = message_text;
        IF SQLSTATE = 'P0001' AND problem <> 'slot_unavailable' THEN
          RAISE;
        END IF;

        UPDATE public.payments
        SET metadata = metadata || jsonb_build_object(
          'booking_review_required', true,
          'booking_review_reason', 'slot_unavailable'
        )
        WHERE reference = group_ref OR checkout_group_reference = group_ref;
    END;
  END IF;

  SELECT * INTO p
  FROM public.payments
  WHERE reference = p_reference
     OR checkout_group_reference = p_reference
  ORDER BY CASE WHEN reference = p_reference THEN 0 ELSE 1 END, id
  LIMIT 1;
  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb)
  TO service_role;
