-- Add transfer_reference to payments and extend submit_bank_transfer RPC

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transfer_reference TEXT;

CREATE INDEX IF NOT EXISTS payments_transfer_ref_idx ON public.payments (transfer_reference);

-- Replace submit_bank_transfer to accept a transfer_reference parameter and persist it
CREATE OR REPLACE FUNCTION public.submit_bank_transfer(
  p_appointment_id UUID,
  p_reference TEXT,
  p_amount_kobo BIGINT,
  p_transfer_note TEXT DEFAULT NULL,
  p_transfer_reference TEXT DEFAULT NULL,
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
    transfer_note, transfer_reference, receipt_path, metadata, created_by
  ) VALUES (
    p_appointment_id, 'bank_transfer', p_reference, p_amount_kobo,
    'awaiting_confirmation', nullif(trim(p_transfer_note), ''), nullif(trim(p_transfer_reference), ''), p_receipt_path,
    jsonb_build_object('submitted_via', actor), auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET transfer_note = coalesce(EXCLUDED.transfer_note, public.payments.transfer_note),
        transfer_reference = coalesce(EXCLUDED.transfer_reference, public.payments.transfer_reference),
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

-- Ensure execute permission for authenticated/service_role on new signature
GRANT EXECUTE ON FUNCTION public.submit_bank_transfer(uuid, text, bigint, text, text, text, text) TO authenticated, service_role;
