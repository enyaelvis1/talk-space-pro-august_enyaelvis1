-- Keep archive and restore in the same authorized, audited transactional
-- boundary as cancellation and eligible deletion.
CREATE OR REPLACE FUNCTION public.archive_appointment_for_admin(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL
) RETURNS TABLE(id uuid, archived_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  archived_time timestamptz := now();
BEGIN
  IF actor IS NULL
     OR NOT (public.has_role(actor, 'admin') OR public.has_role(actor, 'staff')) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'archive_reason_required';
  END IF;

  PERFORM set_config('app.audit_reason', left(trim(p_reason), 500), true);
  RETURN QUERY
  UPDATE public.appointments AS appointment
  SET archived_at = archived_time,
      archived_by = actor,
      archive_reason = left(trim(p_reason), 200),
      updated_at = archived_time
  WHERE appointment.id = p_appointment_id
    AND appointment.archived_at IS NULL
  RETURNING appointment.id, appointment.archived_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'appointment_not_found_or_archived';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_appointment_for_admin(
  p_appointment_id uuid
) RETURNS TABLE(id uuid, archived_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL
     OR NOT (public.has_role(actor, 'admin') OR public.has_role(actor, 'staff')) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;

  PERFORM set_config('app.audit_reason', 'admin_restore', true);
  RETURN QUERY
  UPDATE public.appointments AS appointment
  SET archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL,
      updated_at = now()
  WHERE appointment.id = p_appointment_id
    AND appointment.archived_at IS NOT NULL
  RETURNING appointment.id, appointment.archived_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'appointment_not_found_or_active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_appointment_for_admin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_appointment_for_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_appointment_for_admin(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_appointment_for_admin(uuid) TO authenticated, service_role;
