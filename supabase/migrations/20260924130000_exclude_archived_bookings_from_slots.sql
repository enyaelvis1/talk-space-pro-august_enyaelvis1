-- Archived bookings are removed from the operational calendar and must not
-- continue to block the same therapist, date, and time for a new booking.
CREATE OR REPLACE FUNCTION public.list_available_slots(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_mode public.session_mode DEFAULT NULL
)
RETURNS TABLE (
  therapist_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode public.session_mode
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH selected_service AS (
    SELECT *
    FROM public.services
    WHERE id = p_service_id
      AND is_active
  ),
  days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
    WHERE p_from <= p_to
  ),
  recurring_windows AS (
    SELECT
      rule.therapist_id,
      ((days.day::timestamp + rule.starts_at) AT TIME ZONE rule.timezone) AS window_start,
      ((days.day::timestamp + rule.ends_at) AT TIME ZONE rule.timezone) AS window_end,
      rule.mode
    FROM public.availability_rules rule
    JOIN public.therapist_services assignment
      ON assignment.therapist_id = rule.therapist_id
     AND assignment.service_id = p_service_id
    JOIN public.therapists therapist
      ON therapist.id = rule.therapist_id
     AND therapist.is_active
    CROSS JOIN days
    WHERE rule.is_active
      AND extract(dow FROM days.day) = rule.day_of_week
      AND (p_mode IS NULL OR rule.mode = p_mode)
  ),
  added_windows AS (
    SELECT
      exception.therapist_id,
      exception.starts_at AS window_start,
      exception.ends_at AS window_end,
      coalesce(exception.mode, p_mode, 'online'::public.session_mode) AS mode
    FROM public.availability_exceptions exception
    JOIN public.therapist_services assignment
      ON assignment.therapist_id = exception.therapist_id
     AND assignment.service_id = p_service_id
    JOIN public.therapists therapist
      ON therapist.id = exception.therapist_id
     AND therapist.is_active
    WHERE exception.kind = 'added'
      AND timezone('Africa/Lagos', exception.starts_at)::date BETWEEN p_from AND p_to
      AND (p_mode IS NULL OR exception.mode IS NULL OR exception.mode = p_mode)
  ),
  windows AS (
    SELECT * FROM recurring_windows
    UNION ALL
    SELECT * FROM added_windows
  ),
  candidate_slots AS (
    SELECT
      windows.therapist_id,
      slot.starts_at,
      slot.starts_at + make_interval(mins => selected_service.duration_minutes) AS ends_at,
      windows.mode,
      selected_service.buffer_before_minutes,
      selected_service.buffer_after_minutes,
      selected_service.minimum_lead_time_minutes
    FROM windows
    CROSS JOIN selected_service
    CROSS JOIN LATERAL generate_series(
      windows.window_start,
      windows.window_end - make_interval(mins => selected_service.duration_minutes),
      interval '15 minutes'
    ) AS slot(starts_at)
  )
  SELECT
    candidate.therapist_id,
    candidate.starts_at,
    candidate.ends_at,
    candidate.mode
  FROM candidate_slots candidate
  WHERE candidate.starts_at >= now() + make_interval(mins => candidate.minimum_lead_time_minutes)
    AND NOT EXISTS (
      SELECT 1
      FROM public.availability_exceptions blocked
      WHERE blocked.therapist_id = candidate.therapist_id
        AND blocked.kind = 'blocked'
        AND (blocked.mode IS NULL OR blocked.mode = candidate.mode)
        AND tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments appointment
      JOIN public.services booked_service ON booked_service.id = appointment.service_id
      WHERE appointment.therapist_id = candidate.therapist_id
        AND appointment.archived_at IS NULL
        AND appointment.status IN ('hold', 'pending_payment', 'confirmed')
        AND (appointment.status <> 'hold' OR appointment.hold_expires_at > now())
        AND tstzrange(
          appointment.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          appointment.ends_at + make_interval(mins => booked_service.buffer_after_minutes),
          '[)'
        ) && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
  ORDER BY candidate.starts_at, candidate.therapist_id;
$$;

GRANT EXECUTE ON FUNCTION public.list_available_slots(uuid, date, date, public.session_mode)
  TO anon, authenticated;
