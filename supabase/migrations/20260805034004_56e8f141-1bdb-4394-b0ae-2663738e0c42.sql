ALTER TABLE public.content_entries ADD COLUMN IF NOT EXISTS scheduled_unpublish_at timestamptz;

CREATE OR REPLACE FUNCTION public.publish_scheduled_content()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE affected integer; unaffected integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'staff') THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  UPDATE public.content_entries
     SET source_status = 'publish',
         published_at = COALESCE(published_at, scheduled_publish_at, now()),
         scheduled_publish_at = NULL
   WHERE scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now()
     AND archived_at IS NULL AND source_status <> 'publish'
     AND (scheduled_unpublish_at IS NULL OR scheduled_unpublish_at > now());
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.content_entries
     SET source_status = 'draft',
         scheduled_unpublish_at = NULL
   WHERE scheduled_unpublish_at IS NOT NULL AND scheduled_unpublish_at <= now()
     AND source_status = 'publish';
  GET DIAGNOSTICS unaffected = ROW_COUNT;

  RETURN affected + unaffected;
END $function$;