-- Give high-risk booking and payment changes explicit audit actions.
-- The existing audit trigger remains the single writer, so these entries are
-- not duplicated by application-level logging.
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
  action_value text := TG_TABLE_NAME || '.' || operation;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

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
    IF public.has_role(actor, 'admin') THEN
      actor_kind_value := 'admin';
    ELSIF public.has_role(actor, 'staff') THEN
      actor_kind_value := 'staff';
    END IF;
  END IF;

  target_value := coalesce(
    row_data ->> 'id', row_data ->> 'key', row_data ->> 'appointment_id',
    row_data ->> 'therapist_id', row_data ->> 'template_key'
  );
  reason_value := coalesce(
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(row_data ->> 'archive_reason', ''),
    nullif(row_data ->> 'cancel_reason', ''),
    nullif(row_data ->> 'failed_reason', ''),
    nullif(row_data ->> 'note', ''),
    format('%s %s completed', replace(TG_TABLE_NAME, '_', ' '), operation)
  );

  IF TG_TABLE_NAME = 'appointments' AND TG_OP = 'UPDATE' THEN
    IF previous_data -> 'archived_at' IS DISTINCT FROM row_data -> 'archived_at' THEN
      IF row_data ->> 'archived_at' IS NULL THEN
        action_value := 'appointments.restore';
        reason_value := 'admin_restore';
      ELSE
        action_value := 'appointments.archive';
      END IF;
    ELSIF previous_data ->> 'status' IS DISTINCT FROM row_data ->> 'status'
      AND row_data ->> 'status' = 'cancelled' THEN
      action_value := 'appointments.cancel_release';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'UPDATE'
    AND previous_data ->> 'status' IS DISTINCT FROM row_data ->> 'status' THEN
    IF row_data ->> 'status' = 'succeeded' THEN
      action_value := 'payments.verify';
    ELSIF row_data ->> 'status' = 'refunded' THEN
      action_value := 'payments.refund';
    ELSIF row_data ->> 'status' IN ('failed', 'cancelled') THEN
      action_value := 'payments.resolve';
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, actor_kind, action, target_type,
    target_id, reason, changed_fields
  ) VALUES (
    actor, actor_email_snapshot, actor_kind_value, action_value, TG_TABLE_NAME,
    target_value, left(reason_value, 500), changed
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
