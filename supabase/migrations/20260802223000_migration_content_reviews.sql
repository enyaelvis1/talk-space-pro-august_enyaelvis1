-- Record explicit content-owner migration decisions separately from publication state.

CREATE TABLE IF NOT EXISTS public.migration_content_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_entry_id uuid NOT NULL UNIQUE REFERENCES public.content_entries(id) ON DELETE CASCADE,
  source_kind public.content_entry_kind NOT NULL,
  source_id bigint NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL,
  proposed_path text,
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'excluded', 'needs_revision')),
  review_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (decision = 'pending' AND reviewed_at IS NULL)
    OR
    (decision <> 'pending' AND reviewed_at IS NOT NULL AND length(trim(review_reason)) >= 3)
  )
);

CREATE INDEX IF NOT EXISTS migration_content_reviews_decision_idx
  ON public.migration_content_reviews (decision, source_kind, updated_at DESC);

INSERT INTO public.migration_content_reviews (
  content_entry_id,
  source_kind,
  source_id,
  source_url,
  title,
  proposed_path
)
SELECT
  entry.id,
  entry.kind,
  entry.source_id,
  CASE entry.kind
    WHEN 'category' THEN 'https://www.talkspace.ng/category/' || entry.slug || '/'
    ELSE 'https://www.talkspace.ng/' || entry.slug || '/'
  END,
  entry.title,
  entry.canonical_path
FROM public.content_entries entry
ON CONFLICT (content_entry_id) DO NOTHING;

ALTER TABLE public.migration_content_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.migration_content_reviews TO authenticated;
GRANT ALL ON public.migration_content_reviews TO service_role;

DROP POLICY IF EXISTS migration_content_reviews_admin_read ON public.migration_content_reviews;
CREATE POLICY migration_content_reviews_admin_read
  ON public.migration_content_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS migration_content_reviews_admin_insert ON public.migration_content_reviews;
CREATE POLICY migration_content_reviews_admin_insert
  ON public.migration_content_reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS migration_content_reviews_admin_update ON public.migration_content_reviews;
CREATE POLICY migration_content_reviews_admin_update
  ON public.migration_content_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS migration_content_reviews_set_updated_at
  ON public.migration_content_reviews;
CREATE TRIGGER migration_content_reviews_set_updated_at
  BEFORE UPDATE ON public.migration_content_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The generic audit function stores field names and the review reason, never content bodies.
CREATE OR REPLACE FUNCTION public.capture_admin_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email_snapshot text;
  actor_kind_value text := 'system';
  row_data jsonb;
  previous_data jsonb;
  changed text[] := '{}';
  target_value text;
  reason_value text;
  operation text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    previous_data := to_jsonb(OLD);
    SELECT coalesce(array_agg(keys.key ORDER BY keys.key), '{}') INTO changed
    FROM (
      SELECT key FROM jsonb_object_keys(row_data) key
      WHERE row_data -> key IS DISTINCT FROM previous_data -> key
    ) keys;
  ELSIF TG_OP = 'INSERT' THEN
    changed := ARRAY(SELECT jsonb_object_keys(row_data) ORDER BY 1);
  END IF;

  IF actor IS NOT NULL THEN
    SELECT email INTO actor_email_snapshot FROM auth.users WHERE id = actor;
    IF public.has_role(actor, 'admin') THEN actor_kind_value := 'admin';
    ELSIF public.has_role(actor, 'staff') THEN actor_kind_value := 'staff';
    END IF;
  END IF;

  target_value := coalesce(
    row_data ->> 'id', row_data ->> 'key', row_data ->> 'appointment_id',
    row_data ->> 'therapist_id', row_data ->> 'template_key'
  );
  reason_value := coalesce(
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(row_data ->> 'review_reason', ''),
    nullif(row_data ->> 'cancel_reason', ''),
    nullif(row_data ->> 'failed_reason', ''),
    nullif(row_data ->> 'note', ''),
    format('%s %s completed', replace(TG_TABLE_NAME, '_', ' '), operation)
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, actor_kind, action, target_type,
    target_id, reason, changed_fields
  ) VALUES (
    actor, actor_email_snapshot, actor_kind_value, TG_TABLE_NAME || '.' || operation,
    TG_TABLE_NAME, target_value, left(reason_value, 500), changed
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS migration_content_reviews_capture_audit
  ON public.migration_content_reviews;
CREATE TRIGGER migration_content_reviews_capture_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.migration_content_reviews
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_log();
