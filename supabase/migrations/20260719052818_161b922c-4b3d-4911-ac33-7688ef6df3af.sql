-- google_oauth_settings alignment
ALTER TABLE public.google_oauth_settings
  ADD COLUMN IF NOT EXISTS redirect_path text NOT NULL DEFAULT '/api/public/google/callback',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.google_oauth_settings
  ALTER COLUMN scopes SET DEFAULT 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

-- therapist_google_connections column alignment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_google_connections'
      AND column_name = 'access_token_expires_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_google_connections'
      AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE public.therapist_google_connections
      RENAME COLUMN access_token_expires_at TO token_expires_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_google_connections'
      AND column_name = 'last_synced_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_google_connections'
      AND column_name = 'last_sync_at'
  ) THEN
    ALTER TABLE public.therapist_google_connections
      RENAME COLUMN last_synced_at TO last_sync_at;
  END IF;
END $$;
ALTER TABLE public.therapist_google_connections
  DROP COLUMN IF EXISTS is_active;
DROP POLICY IF EXISTS "Admins manage google connections" ON public.therapist_google_connections;
DROP POLICY IF EXISTS tgc_admin_all ON public.therapist_google_connections;
DROP POLICY IF EXISTS tgc_staff_read ON public.therapist_google_connections;
CREATE POLICY tgc_admin_all ON public.therapist_google_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY tgc_staff_read ON public.therapist_google_connections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'staff'));

-- availability_exceptions Google-sync columns
ALTER TABLE public.availability_exceptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_ref text;
CREATE INDEX IF NOT EXISTS availability_exceptions_source_idx
  ON public.availability_exceptions (therapist_id, source);

-- payment_reviews: rebuild with audit columns
DROP TABLE IF EXISTS public.payment_reviews;
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
CREATE POLICY payment_reviews_admin_staff_read ON public.payment_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Upgraded verify_bank_transfer with audit logging
CREATE OR REPLACE FUNCTION public.verify_bank_transfer(p_payment_id uuid, p_approve boolean, p_note text DEFAULT NULL)
 RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE p public.payments; prev_status public.payment_status; new_status public.payment_status;
  reviewer_email text; reviewer_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden'; END IF;
  SELECT * INTO p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='payment_not_found'; END IF;
  IF p.provider <> 'bank_transfer' THEN RAISE EXCEPTION USING errcode='P0001', message='not_bank_transfer'; END IF;
  prev_status := p.status;
  new_status := CASE WHEN p_approve THEN 'succeeded'::public.payment_status ELSE 'failed'::public.payment_status END;
  p := public.mark_payment_status(p.reference, new_status, NULL,
    CASE WHEN p_approve THEN NULL ELSE coalesce(p_note,'rejected_by_staff') END,
    jsonb_build_object('verifier_note', coalesce(p_note,'')));
  SELECT email INTO reviewer_email FROM auth.users WHERE id = auth.uid();
  SELECT full_name INTO reviewer_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.payment_reviews (payment_id, action, previous_status, new_status, note,
    reviewer_id, reviewer_email, reviewer_name)
  VALUES (p_payment_id, CASE WHEN p_approve THEN 'approve' ELSE 'reject' END,
    prev_status, new_status, NULLIF(trim(coalesce(p_note,'')), ''),
    auth.uid(), reviewer_email, reviewer_name);
  RETURN p;
END $$;
