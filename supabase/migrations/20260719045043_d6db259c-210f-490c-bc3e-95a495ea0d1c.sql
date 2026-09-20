
CREATE TABLE public.payment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve','reject')),
  previous_status public.payment_status,
  new_status public.payment_status NOT NULL,
  note text,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_email text,
  reviewer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_reviews_payment_idx ON public.payment_reviews(payment_id, created_at DESC);

GRANT SELECT ON public.payment_reviews TO authenticated;
GRANT ALL ON public.payment_reviews TO service_role;

ALTER TABLE public.payment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_reviews_admin_staff_read"
  ON public.payment_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Backfill from existing verified bank transfers
INSERT INTO public.payment_reviews (payment_id, action, previous_status, new_status, note, reviewer_id, reviewer_email, reviewer_name, created_at)
SELECT
  p.id,
  CASE WHEN p.status = 'succeeded' THEN 'approve' ELSE 'reject' END,
  NULL,
  p.status,
  NULLIF(coalesce(p.metadata->>'verifier_note', p.failed_reason), ''),
  p.verified_by,
  u.email,
  pr.full_name,
  coalesce(p.verified_at, p.updated_at)
FROM public.payments p
LEFT JOIN auth.users u ON u.id = p.verified_by
LEFT JOIN public.profiles pr ON pr.id = p.verified_by
WHERE p.provider = 'bank_transfer'
  AND p.status IN ('succeeded','failed')
  AND p.verified_at IS NOT NULL;

-- Update verify_bank_transfer to write audit entries
CREATE OR REPLACE FUNCTION public.verify_bank_transfer(p_payment_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.payments;
  prev_status public.payment_status;
  new_status public.payment_status;
  reviewer_email text;
  reviewer_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='payment_not_found'; END IF;
  IF p.provider <> 'bank_transfer' THEN
    RAISE EXCEPTION USING errcode='P0001', message='not_bank_transfer';
  END IF;

  prev_status := p.status;
  new_status := CASE WHEN p_approve THEN 'succeeded'::public.payment_status ELSE 'failed'::public.payment_status END;

  p := public.mark_payment_status(
    p.reference,
    new_status,
    NULL,
    CASE WHEN p_approve THEN NULL ELSE coalesce(p_note, 'rejected_by_staff') END,
    jsonb_build_object('verifier_note', coalesce(p_note, ''))
  );

  SELECT email INTO reviewer_email FROM auth.users WHERE id = auth.uid();
  SELECT full_name INTO reviewer_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.payment_reviews (
    payment_id, action, previous_status, new_status, note,
    reviewer_id, reviewer_email, reviewer_name
  ) VALUES (
    p_payment_id,
    CASE WHEN p_approve THEN 'approve' ELSE 'reject' END,
    prev_status,
    new_status,
    NULLIF(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    reviewer_email,
    reviewer_name
  );

  RETURN p;
END $function$;
