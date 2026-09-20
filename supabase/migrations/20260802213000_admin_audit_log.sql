-- Immutable audit trail for operational and content administration.
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_kind text NOT NULL CHECK (actor_kind IN ('admin', 'staff', 'system')),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  reason text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx
  ON public.admin_audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON public.admin_audit_logs(target_type, target_id, created_at DESC);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_logs_admin_read ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_admin_read
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    previous_data := to_jsonb(OLD);
    SELECT coalesce(array_agg(keys.key ORDER BY keys.key), '{}')
      INTO changed
    FROM (
      SELECT key FROM jsonb_object_keys(row_data) key
      WHERE row_data -> key IS DISTINCT FROM previous_data -> key
    ) keys;
  ELSIF TG_OP = 'INSERT' THEN
    changed := ARRAY(SELECT jsonb_object_keys(row_data) ORDER BY 1);
  END IF;

  IF actor IS NOT NULL THEN
    SELECT email INTO actor_email_snapshot FROM auth.users WHERE id = actor;
    IF public.has_role(actor, 'admin') THEN
      actor_kind_value := 'admin';
    ELSIF public.has_role(actor, 'staff') THEN
      actor_kind_value := 'staff';
    END IF;
  END IF;

  target_value := coalesce(
    row_data ->> 'id',
    row_data ->> 'key',
    row_data ->> 'appointment_id',
    row_data ->> 'therapist_id',
    row_data ->> 'template_key'
  );
  reason_value := coalesce(
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(row_data ->> 'cancel_reason', ''),
    nullif(row_data ->> 'failed_reason', ''),
    nullif(row_data ->> 'note', ''),
    format('%s %s completed', replace(TG_TABLE_NAME, '_', ' '), operation)
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, actor_kind, action, target_type,
    target_id, reason, changed_fields
  ) VALUES (
    actor,
    actor_email_snapshot,
    actor_kind_value,
    TG_TABLE_NAME || '.' || operation,
    TG_TABLE_NAME,
    target_value,
    left(reason_value, 500),
    changed
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  audited_tables text[] := ARRAY[
    'appointments', 'payments', 'payment_reviews', 'payment_settings',
    'email_settings', 'email_template_settings', 'reminder_settings',
    'google_oauth_settings', 'therapist_google_connections', 'site_settings',
    'therapists', 'therapist_services', 'services', 'availability_rules',
    'availability_exceptions', 'content_entries', 'content_media',
    'testimonials', 'faqs', 'redirects', 'contact_submissions',
    'intake_submissions'
  ];
BEGIN
  FOREACH table_name IN ARRAY audited_tables LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_audit_log', table_name);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_log()',
        table_name || '_audit_log',
        table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- Audit rows are append-only, including for administrators.
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs FROM anon, authenticated;
