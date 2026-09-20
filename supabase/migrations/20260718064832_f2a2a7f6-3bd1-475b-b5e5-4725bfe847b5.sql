
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('paystack', 'bank_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'initiated', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. payment_settings (singleton, id=1)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  paystack_public_key TEXT,
  paystack_secret_ciphertext TEXT,
  paystack_secret_last4 TEXT,
  paystack_webhook_secret_ciphertext TEXT,
  is_paystack_enabled BOOLEAN NOT NULL DEFAULT false,
  is_bank_transfer_enabled BOOLEAN NOT NULL DEFAULT true,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_instructions TEXT,
  callback_path TEXT NOT NULL DEFAULT '/book/payment-callback',
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_settings_admin_all ON public.payment_settings;
CREATE POLICY payment_settings_admin_all ON public.payment_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS payment_settings_set_updated_at ON public.payment_settings;
CREATE TRIGGER payment_settings_set_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. payments ledger
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status public.payment_status NOT NULL DEFAULT 'initiated',
  authorization_url TEXT,
  receipt_path TEXT,
  transfer_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_appointment_idx ON public.payments(appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_ref_idx ON public.payments(provider, provider_reference);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_staff_read ON public.payments;
CREATE POLICY payments_staff_read ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS payments_staff_write ON public.payments;
CREATE POLICY payments_staff_write ON public.payments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

DROP POLICY IF EXISTS payments_client_read_own ON public.payments;
CREATE POLICY payments_client_read_own ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id AND a.client_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. appointment helper columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS paid_amount_kobo BIGINT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- 5. Storage policies for the payment-receipts bucket (bucket created via storage tool)
DROP POLICY IF EXISTS payment_receipts_authed_write ON storage.objects;
CREATE POLICY payment_receipts_authed_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS payment_receipts_staff_read ON storage.objects;
CREATE POLICY payment_receipts_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

-- 6. RPCs

CREATE OR REPLACE FUNCTION public.record_payment_initiated(
  p_appointment_id UUID,
  p_provider public.payment_provider,
  p_reference TEXT,
  p_amount_kobo BIGINT,
  p_authorization_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION USING errcode='P0001', message='invalid_amount';
  END IF;

  INSERT INTO public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    authorization_url, metadata, created_by
  ) VALUES (
    p_appointment_id, p_provider, p_reference, p_amount_kobo,
    CASE WHEN p_provider = 'bank_transfer' THEN 'awaiting_confirmation'::public.payment_status
         ELSE 'initiated'::public.payment_status END,
    p_authorization_url, coalesce(p_metadata, '{}'::jsonb), auth.uid()
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

CREATE OR REPLACE FUNCTION public.mark_payment_status(
  p_reference TEXT,
  p_new_status public.payment_status,
  p_provider_reference TEXT DEFAULT NULL,
  p_failed_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF p_new_status = 'succeeded' THEN
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

CREATE OR REPLACE FUNCTION public.submit_bank_transfer(
  p_appointment_id UUID,
  p_reference TEXT,
  p_amount_kobo BIGINT,
  p_transfer_note TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL,
  p_manage_token_hash TEXT DEFAULT NULL
) RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  appt public.appointments%rowtype;
  actor TEXT;
  p public.payments;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='not_found'; END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN RAISE EXCEPTION USING errcode='P0001', message='forbidden'; END IF;

  INSERT INTO public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    transfer_note, receipt_path, metadata, created_by
  ) VALUES (
    p_appointment_id, 'bank_transfer', p_reference, p_amount_kobo,
    'awaiting_confirmation', nullif(trim(p_transfer_note), ''), p_receipt_path,
    jsonb_build_object('submitted_via', actor), auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET transfer_note = coalesce(EXCLUDED.transfer_note, public.payments.transfer_note),
        receipt_path = coalesce(EXCLUDED.receipt_path, public.payments.receipt_path),
        status = 'awaiting_confirmation',
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

CREATE OR REPLACE FUNCTION public.verify_bank_transfer(
  p_payment_id UUID,
  p_approve BOOLEAN,
  p_note TEXT DEFAULT NULL
) RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='payment_not_found'; END IF;
  IF p.provider <> 'bank_transfer' THEN
    RAISE EXCEPTION USING errcode='P0001', message='not_bank_transfer';
  END IF;

  RETURN public.mark_payment_status(
    p.reference,
    CASE WHEN p_approve THEN 'succeeded'::public.payment_status ELSE 'failed'::public.payment_status END,
    NULL,
    CASE WHEN p_approve THEN NULL ELSE coalesce(p_note, 'rejected_by_staff') END,
    jsonb_build_object('verifier_note', coalesce(p_note, ''))
  );
END $$;
