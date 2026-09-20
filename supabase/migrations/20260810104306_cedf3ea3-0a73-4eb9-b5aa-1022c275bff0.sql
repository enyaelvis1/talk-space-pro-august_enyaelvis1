CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  bucket text NOT NULL,
  identifier text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, identifier)
);

GRANT ALL ON public.security_rate_limits TO service_role;
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  identifier text,
  route text,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON public.security_events (created_at DESC);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'security_events'
      AND policyname = 'Admins can view security events'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view security events" ON public.security_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  INSERT INTO public.security_rate_limits AS s (bucket, identifier, window_started_at, hit_count, updated_at)
  VALUES (p_bucket, p_identifier, now(), 1, now())
  ON CONFLICT (bucket, identifier) DO UPDATE
    SET hit_count = CASE
          WHEN s.window_started_at < now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE s.hit_count + 1
        END,
        window_started_at = CASE
          WHEN s.window_started_at < now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE s.window_started_at
        END,
        updated_at = now()
  RETURNING s.window_started_at, s.hit_count INTO v_window_start, v_count;

  RETURN QUERY SELECT
    v_count <= p_limit,
    GREATEST(p_limit - v_count, 0),
    GREATEST(
      CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer,
      0
    );
END $$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_identifier text,
  p_route text,
  p_severity text,
  p_details jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (event_type, identifier, route, severity, details)
  VALUES (p_event_type, p_identifier, p_route, COALESCE(p_severity, 'warning'), COALESCE(p_details, '{}'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.log_security_event(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_rate_limits()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.security_rate_limits WHERE updated_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.purge_expired_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_rate_limits() TO service_role;