-- Allow staff to recover a paid booking that was cancelled after a temporary
-- slot conflict. Ordinary cancelled bookings remain immutable.
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_manage_token_hash text DEFAULT NULL,
  p_new_therapist_id uuid DEFAULT NULL,
  p_new_session_mode public.session_mode DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  booking_reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  appt public.appointments%rowtype;
  actor text;
  target_therapist uuid;
  target_mode public.session_mode;
  service_duration integer;
  new_ends timestamptz;
  paid_review boolean;
BEGIN
  SELECT * INTO appt
  FROM public.appointments
  WHERE public.appointments.id = p_appointment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found';
  END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.payments pay
    WHERE pay.appointment_id = appt.id
      AND pay.status = 'succeeded'
      AND COALESCE((pay.metadata->>'booking_review_required')::boolean, false)
  ) INTO paid_review;

  IF appt.status = 'cancelled' AND NOT (actor IN ('admin', 'staff') AND paid_review) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;
  IF appt.status NOT IN ('hold', 'pending_payment', 'confirmed', 'cancelled') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  IF actor IN ('client_owner', 'manage_token') AND appt.starts_at < now() + interval '48 hours' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'too_late';
  END IF;

  target_therapist := COALESCE(p_new_therapist_id, appt.therapist_id);
  target_mode := COALESCE(p_new_session_mode, appt.session_mode);

  SELECT duration_minutes INTO service_duration
  FROM public.services
  WHERE public.services.id = appt.service_id;
  new_ends := p_new_starts_at + make_interval(mins => service_duration);

  IF p_new_starts_at < now()
     OR extract(minute FROM (p_new_starts_at AT TIME ZONE 'Africa/Lagos'))::int % 15 <> 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_slot';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE public.appointments.id = appt.id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.list_available_slots(
      appt.service_id,
      (p_new_starts_at AT TIME ZONE 'Africa/Lagos')::date,
      (p_new_starts_at AT TIME ZONE 'Africa/Lagos')::date,
      target_mode
    ) av
    WHERE av.therapist_id = target_therapist
      AND av.starts_at = p_new_starts_at
      AND av.ends_at = new_ends
      AND av.mode = target_mode
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
  END IF;

  UPDATE public.appointments
  SET status = CASE WHEN paid_review THEN 'confirmed' ELSE appt.status END,
      starts_at = p_new_starts_at,
      ends_at = new_ends,
      therapist_id = target_therapist,
      session_mode = target_mode,
      cancelled_at = CASE WHEN paid_review THEN NULL ELSE cancelled_at END,
      cancelled_by = CASE WHEN paid_review THEN NULL ELSE cancelled_by END,
      cancel_reason = CASE WHEN paid_review THEN NULL ELSE cancel_reason END,
      rescheduled_from_starts_at = COALESCE(appt.rescheduled_from_starts_at, appt.starts_at),
      hold_expires_at = CASE WHEN appt.status = 'hold' THEN now() + interval '5 minutes' ELSE NULL END,
      updated_at = now()
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id,
    public.appointments.booking_reference,
    public.appointments.starts_at,
    public.appointments.ends_at,
    public.appointments.status
  INTO id, booking_reference, starts_at, ends_at, status;
  RETURN NEXT;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz, text, uuid, public.session_mode)
  FROM public;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, text, uuid, public.session_mode)
  TO anon, authenticated, service_role;
