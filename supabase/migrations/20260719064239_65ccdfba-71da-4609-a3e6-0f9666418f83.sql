
ALTER TABLE public.content_entries
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_entries_scheduled_publish_at_idx
  ON public.content_entries (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_entries_archived_at_idx
  ON public.content_entries (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.publish_scheduled_content()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'staff') THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  UPDATE public.content_entries
     SET source_status = 'publish',
         published_at = COALESCE(published_at, scheduled_publish_at, now()),
         scheduled_publish_at = NULL
   WHERE scheduled_publish_at IS NOT NULL
     AND scheduled_publish_at <= now()
     AND archived_at IS NULL
     AND source_status <> 'publish';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_scheduled_content() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_scheduled_content() TO authenticated, service_role;
