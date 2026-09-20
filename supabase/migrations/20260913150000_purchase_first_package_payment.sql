-- Allow package purchase payments to exist independently of an appointment.
-- This preserves the current appointment-bound payment flow while creating a legal
-- purchase-first state for later booking from package credit.

DO $$
BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('paystack', 'bank_transfer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.payment_kind AS ENUM ('appointment', 'package_purchase');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_kind public.payment_kind;

UPDATE public.payments
SET payment_kind = 'appointment'
WHERE payment_kind IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN payment_kind SET DEFAULT 'appointment';

ALTER TABLE public.payments
  ALTER COLUMN payment_kind SET NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_appointment_or_package_kind_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_appointment_or_package_kind_check
  CHECK (
    (payment_kind = 'appointment' AND appointment_id IS NOT NULL)
    OR (payment_kind = 'package_purchase' AND appointment_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS payments_kind_idx
  ON public.payments (payment_kind, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.mark_payment_status(
  p_reference TEXT,
  p_new_status public.payment_status,
  p_provider_reference TEXT DEFAULT NULL,
  p_failed_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payments;
BEGIN
  UPDATE public.payments
    SET status = p_new_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        failed_reason = coalesce(p_failed_reason, failed_reason),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        verified_by = CASE WHEN p_new_status IN ('succeeded','refunded') THEN auth.uid() ELSE verified_by END,
        verified_at = CASE WHEN p_new_status IN ('succeeded','refunded') THEN now() ELSE verified_at END,
        updated_at = now()
  WHERE reference = p_reference
  RETURNING * INTO p;

  IF p.id IS NULL THEN
    RAISE EXCEPTION USING errcode='P0001', message='payment_not_found';
  END IF;

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
    UPDATE public.appointments
      SET status = 'confirmed'::public.appointment_status,
          paid_amount_kobo = p.amount_kobo,
          payment_reference = p.reference,
          hold_expires_at = NULL,
          updated_at = now()
      WHERE id = p.appointment_id
        AND status IN ('hold','pending_payment','confirmed');
  ELSIF p_new_status IN ('failed','cancelled') THEN
    UPDATE public.appointments SET updated_at = now() WHERE id = p.appointment_id;
  END IF;

  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.record_payment_initiated(
  p_appointment_id UUID,
  p_provider public.payment_provider,
  p_reference TEXT,
  p_amount_kobo BIGINT,
  p_authorization_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payments;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION USING errcode='P0001', message='invalid_amount';
  END IF;

  INSERT INTO public.payments (
    appointment_id,
    payment_kind,
    provider,
    reference,
    amount_kobo,
    status,
    authorization_url,
    metadata,
    created_by
  ) VALUES (
    p_appointment_id,
    'appointment',
    p_provider,
    p_reference,
    p_amount_kobo,
    CASE WHEN p_provider = 'bank_transfer' THEN 'awaiting_confirmation'::public.payment_status
         ELSE 'initiated'::public.payment_status END,
    p_authorization_url,
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET authorization_url = EXCLUDED.authorization_url,
        metadata = public.payments.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO p;

  UPDATE public.appointments
    SET status = CASE WHEN status = 'hold' THEN 'pending_payment'::public.appointment_status ELSE status END,
        hold_expires_at = CASE WHEN status = 'hold' THEN NULL ELSE hold_expires_at END,
        payment_reference = p.reference,
        updated_at = now()
  WHERE id = p_appointment_id;

  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.record_package_purchase_initiated(
  p_provider public.payment_provider,
  p_reference TEXT,
  p_amount_kobo BIGINT,
  p_service_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payments;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION USING errcode='P0001', message='invalid_amount';
  END IF;

  INSERT INTO public.payments (
    appointment_id,
    payment_kind,
    provider,
    reference,
    amount_kobo,
    status,
    metadata,
    created_by
  ) VALUES (
    NULL,
    'package_purchase',
    p_provider,
    p_reference,
    p_amount_kobo,
    CASE WHEN p_provider = 'bank_transfer' THEN 'awaiting_confirmation'::public.payment_status
         ELSE 'initiated'::public.payment_status END,
    jsonb_set(
      coalesce(p_metadata, '{}'::jsonb),
      '{service_id}',
      to_jsonb(p_service_id),
      true
    ) || jsonb_build_object(
      'client_id', p_client_id,
      'client_name', p_client_name,
      'client_email', p_client_email,
      'client_phone', p_client_phone
    ),
    auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET metadata = public.payments.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO p;

  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_package_purchase(
  p_reference TEXT,
  p_service_id UUID,
  p_client_id UUID,
  p_client_name TEXT,
  p_client_email TEXT,
  p_client_phone TEXT,
  p_purchased_sessions INTEGER,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS public.client_session_packages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payment public.payments%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token TEXT;
BEGIN
  SELECT * INTO payment
  FROM public.payments
  WHERE reference = p_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode='P0001', message='payment_not_found';
  END IF;

  IF payment.payment_kind <> 'package_purchase' THEN
    RAISE EXCEPTION USING errcode='P0001', message='payment_kind_mismatch';
  END IF;

  IF payment.status <> 'succeeded' THEN
    RAISE EXCEPTION USING errcode='P0001', message='payment_not_succeeded';
  END IF;

  IF p_purchased_sessions IS NULL OR p_purchased_sessions <= 0 OR p_purchased_sessions > 50 THEN
    RAISE EXCEPTION USING errcode='P0001', message='invalid_session_count';
  END IF;

  SELECT * INTO pkg
  FROM public.client_session_packages
  WHERE source_payment_id = payment.id
  FOR UPDATE;

  IF NOT FOUND THEN
    raw_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.client_session_packages (
      client_id,
      client_name,
      client_email,
      client_phone,
      service_id,
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) VALUES (
      p_client_id,
      p_client_name,
      p_client_email,
      p_client_phone,
      p_service_id,
      payment.id,
      p_purchased_sessions,
      0,
      'active',
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      COALESCE(p_expires_at, now() + interval '6 months'),
      auth.uid()
    )
    RETURNING * INTO pkg;
  END IF;

  RETURN pkg;
END $$;

REVOKE ALL ON FUNCTION public.record_package_purchase_initiated(public.payment_provider, text, bigint, uuid, uuid, text, text, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_package_purchase_initiated(public.payment_provider, text, bigint, uuid, uuid, text, text, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.confirm_package_purchase(text, uuid, uuid, text, text, text, integer, timestamptz)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_package_purchase(text, uuid, uuid, text, text, text, integer, timestamptz)
  TO service_role;
