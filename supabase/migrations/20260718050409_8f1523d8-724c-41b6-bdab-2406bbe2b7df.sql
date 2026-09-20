-- Columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from_starts_at timestamptz;

CREATE INDEX IF NOT EXISTS appointments_manage_token_hash_idx
  ON public.appointments (manage_token_hash);

-- Helper: authorize caller for an appointment (returns actor role: 'client_owner','manage_token','staff','admin')
CREATE OR REPLACE FUNCTION public.appointment_actor(
  p_appointment public.appointments,
  p_manage_token_hash text
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN 'admin'
    WHEN auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'staff') THEN 'staff'
    WHEN auth.uid() IS NOT NULL AND p_appointment.client_id = auth.uid() THEN 'client_owner'
    WHEN p_manage_token_hash IS NOT NULL
      AND lower(trim(p_manage_token_hash)) = p_appointment.manage_token_hash THEN 'manage_token'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.appointment_actor(public.appointments, text) FROM public;
GRANT EXECUTE ON FUNCTION public.appointment_actor(public.appointments, text) TO anon, authenticated, service_role;

-- Reschedule
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_manage_token_hash text DEFAULT NULL,
  p_new_therapist_id uuid DEFAULT NULL,
  p_new_session_mode session_mode DEFAULT NULL
) RETURNS TABLE(
  id uuid, booking_reference text, starts_at timestamptz, ends_at timestamptz, status appointment_status
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  appt public.appointments%rowtype;
  actor text;
  target_therapist uuid;
  target_mode session_mode;
  service_duration integer;
  new_ends timestamptz;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE public.appointments.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found'; END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden'; END IF;

  IF appt.status NOT IN ('hold','pending_payment','confirmed') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  IF actor IN ('client_owner','manage_token') AND appt.starts_at < now() + interval '24 hours' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'too_late';
  END IF;

  target_therapist := coalesce(p_new_therapist_id, appt.therapist_id);
  target_mode := coalesce(p_new_session_mode, appt.session_mode);

  SELECT duration_minutes INTO service_duration FROM public.services WHERE public.services.id = appt.service_id;
  new_ends := p_new_starts_at + make_interval(mins => service_duration);

  IF p_new_starts_at < now() OR extract(minute from (p_new_starts_at at time zone 'Africa/Lagos'))::int % 15 <> 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_slot';
  END IF;

  -- Free the current slot first so the exclusion constraint check for the new slot ignores it
  UPDATE public.appointments SET status = 'cancelled', updated_at = now()
    WHERE public.appointments.id = appt.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.list_available_slots(appt.service_id,
      (p_new_starts_at at time zone 'Africa/Lagos')::date,
      (p_new_starts_at at time zone 'Africa/Lagos')::date, target_mode) av
    WHERE av.therapist_id = target_therapist AND av.starts_at = p_new_starts_at
      AND av.ends_at = new_ends AND av.mode = target_mode
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
  END IF;

  UPDATE public.appointments SET
    status = appt.status,
    starts_at = p_new_starts_at,
    ends_at = new_ends,
    therapist_id = target_therapist,
    session_mode = target_mode,
    rescheduled_from_starts_at = coalesce(appt.rescheduled_from_starts_at, appt.starts_at),
    hold_expires_at = CASE WHEN appt.status = 'hold' THEN now() + interval '5 minutes' ELSE NULL END,
    updated_at = now()
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id, public.appointments.booking_reference,
    public.appointments.starts_at, public.appointments.ends_at, public.appointments.status
  INTO id, booking_reference, starts_at, ends_at, status;
  RETURN NEXT;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz, text, uuid, session_mode) FROM public;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, text, uuid, session_mode) TO anon, authenticated, service_role;

-- Cancel
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL,
  p_manage_token_hash text DEFAULT NULL
) RETURNS TABLE(id uuid, status appointment_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  appt public.appointments%rowtype;
  actor text;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE public.appointments.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found'; END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden'; END IF;

  IF appt.status IN ('cancelled','completed','no_show') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  IF actor IN ('client_owner','manage_token') AND appt.starts_at < now() + interval '24 hours'
     AND appt.status <> 'hold' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'too_late';
  END IF;

  UPDATE public.appointments SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = nullif(trim(p_reason), ''),
    hold_expires_at = NULL,
    updated_at = now()
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id, public.appointments.status
  INTO id, status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text, text) TO anon, authenticated, service_role;

-- Mark status (staff/admin only): completed | no_show
CREATE OR REPLACE FUNCTION public.mark_appointment_status(
  p_appointment_id uuid,
  p_new_status appointment_status
) RETURNS TABLE(id uuid, status appointment_status)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  appt public.appointments%rowtype;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;
  IF p_new_status NOT IN ('completed','no_show') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_status';
  END IF;

  SELECT * INTO appt FROM public.appointments WHERE public.appointments.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found'; END IF;
  IF appt.status NOT IN ('confirmed','pending_payment') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  UPDATE public.appointments SET status = p_new_status, updated_at = now(), hold_expires_at = NULL
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id, public.appointments.status
  INTO id, status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_appointment_status(uuid, appointment_status) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_appointment_status(uuid, appointment_status) TO authenticated, service_role;

-- Sweep expired holds
CREATE OR REPLACE FUNCTION public.expire_stale_holds() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.appointments SET status = 'cancelled', updated_at = now(), hold_expires_at = NULL
  WHERE status = 'hold' AND hold_expires_at IS NOT NULL AND hold_expires_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_holds() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_stale_holds() TO anon, authenticated, service_role;

-- Lookup by manage token (public, for guest manage flow)
CREATE OR REPLACE FUNCTION public.get_appointment_by_manage_token(p_manage_token_hash text)
RETURNS TABLE(
  id uuid, booking_reference text, status appointment_status,
  starts_at timestamptz, ends_at timestamptz, session_mode session_mode,
  client_name text, client_email text, client_phone text,
  service_id uuid, therapist_id uuid, hold_expires_at timestamptz,
  cancelled_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.booking_reference, a.status, a.starts_at, a.ends_at, a.session_mode,
    a.client_name, a.client_email, a.client_phone, a.service_id, a.therapist_id,
    a.hold_expires_at, a.cancelled_at
  FROM public.appointments a
  WHERE a.manage_token_hash = lower(trim(p_manage_token_hash))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_appointment_by_manage_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) TO anon, authenticated, service_role;
