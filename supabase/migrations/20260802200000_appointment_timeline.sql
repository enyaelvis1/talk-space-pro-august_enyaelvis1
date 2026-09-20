-- Record an immutable operational timeline for each appointment.
CREATE TABLE IF NOT EXISTS public.appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous_status public.appointment_status,
  new_status public.appointment_status,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_events_appointment_created_idx
  ON public.appointment_events(appointment_id, created_at DESC);

GRANT SELECT ON public.appointment_events TO authenticated;
GRANT ALL ON public.appointment_events TO service_role;

ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_events_authorized_read ON public.appointment_events;
CREATE POLICY appointment_events_authorized_read
  ON public.appointment_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR EXISTS (
      SELECT 1 FROM public.appointments appointment
      WHERE appointment.id = appointment_events.appointment_id
        AND appointment.client_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.log_appointment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_events (
      appointment_id, event_type, new_status, actor_id, metadata, created_at
    ) VALUES (
      NEW.id,
      'booking_created',
      NEW.status,
      auth.uid(),
      jsonb_build_object(
        'starts_at', NEW.starts_at,
        'ends_at', NEW.ends_at,
        'session_mode', NEW.session_mode,
        'therapist_id', NEW.therapist_id,
        'service_id', NEW.service_id
      ),
      NEW.created_at
    );
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.appointment_events (
      appointment_id, event_type, previous_status, new_status, actor_id, metadata
    ) VALUES (
      NEW.id,
      'status_changed',
      OLD.status,
      NEW.status,
      auth.uid(),
      jsonb_strip_nulls(jsonb_build_object('reason', NEW.cancel_reason))
    );
  END IF;

  IF OLD.starts_at IS DISTINCT FROM NEW.starts_at
    OR OLD.ends_at IS DISTINCT FROM NEW.ends_at
    OR OLD.therapist_id IS DISTINCT FROM NEW.therapist_id
    OR OLD.session_mode IS DISTINCT FROM NEW.session_mode THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      'booking_rescheduled',
      auth.uid(),
      jsonb_build_object(
        'previous_starts_at', OLD.starts_at,
        'starts_at', NEW.starts_at,
        'previous_ends_at', OLD.ends_at,
        'ends_at', NEW.ends_at,
        'previous_therapist_id', OLD.therapist_id,
        'therapist_id', NEW.therapist_id,
        'previous_session_mode', OLD.session_mode,
        'session_mode', NEW.session_mode
      )
    );
  END IF;

  IF OLD.google_synced_at IS DISTINCT FROM NEW.google_synced_at
    AND NEW.google_synced_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id,
      'google_synced',
      auth.uid(),
      jsonb_strip_nulls(jsonb_build_object(
        'event_id', NEW.google_event_id,
        'meet_created', NEW.google_meet_url IS NOT NULL
      )),
      NEW.google_synced_at
    );
  END IF;

  IF OLD.google_sync_error IS DISTINCT FROM NEW.google_sync_error
    AND NEW.google_sync_error IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      'google_sync_failed',
      auth.uid(),
      jsonb_build_object('error', NEW.google_sync_error)
    );
  END IF;

  IF OLD.reminder_24h_sent_at IS DISTINCT FROM NEW.reminder_24h_sent_at
    AND NEW.reminder_24h_sent_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id, 'reminder_sent', auth.uid(), jsonb_build_object('window', '24h'),
      NEW.reminder_24h_sent_at
    );
  END IF;

  IF OLD.reminder_1h_sent_at IS DISTINCT FROM NEW.reminder_1h_sent_at
    AND NEW.reminder_1h_sent_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id, 'reminder_sent', auth.uid(), jsonb_build_object('window', '1h'),
      NEW.reminder_1h_sent_at
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_operational_timeline ON public.appointments;
CREATE TRIGGER appointments_operational_timeline
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_appointment_event();

-- Existing appointments receive a baseline event without inventing historical actors.
INSERT INTO public.appointment_events (
  appointment_id, event_type, new_status, metadata, created_at
)
SELECT
  appointment.id,
  'booking_snapshot',
  appointment.status,
  jsonb_build_object(
    'starts_at', appointment.starts_at,
    'ends_at', appointment.ends_at,
    'session_mode', appointment.session_mode,
    'historical_backfill', true
  ),
  appointment.created_at
FROM public.appointments appointment
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointment_events event
  WHERE event.appointment_id = appointment.id
);

INSERT INTO public.appointment_events (appointment_id, event_type, metadata, created_at)
SELECT appointment.id, 'reminder_sent', jsonb_build_object('window', '24h'), appointment.reminder_24h_sent_at
FROM public.appointments appointment
WHERE appointment.reminder_24h_sent_at IS NOT NULL;

INSERT INTO public.appointment_events (appointment_id, event_type, metadata, created_at)
SELECT appointment.id, 'reminder_sent', jsonb_build_object('window', '1h'), appointment.reminder_1h_sent_at
FROM public.appointments appointment
WHERE appointment.reminder_1h_sent_at IS NOT NULL;

INSERT INTO public.appointment_events (appointment_id, event_type, metadata, created_at)
SELECT
  appointment.id,
  'google_synced',
  jsonb_strip_nulls(jsonb_build_object(
    'event_id', appointment.google_event_id,
    'meet_created', appointment.google_meet_url IS NOT NULL,
    'historical_backfill', true
  )),
  appointment.google_synced_at
FROM public.appointments appointment
WHERE appointment.google_synced_at IS NOT NULL;

INSERT INTO public.appointment_events (appointment_id, event_type, metadata, created_at)
SELECT
  appointment.id,
  'google_sync_failed',
  jsonb_build_object('error', appointment.google_sync_error, 'historical_backfill', true),
  appointment.updated_at
FROM public.appointments appointment
WHERE appointment.google_sync_error IS NOT NULL;

INSERT INTO public.appointment_events (
  appointment_id, event_type, previous_status, new_status, metadata, created_at
)
SELECT
  appointment.id,
  'status_changed',
  NULL,
  'cancelled'::public.appointment_status,
  jsonb_strip_nulls(jsonb_build_object(
    'reason', appointment.cancel_reason,
    'historical_backfill', true
  )),
  appointment.cancelled_at
FROM public.appointments appointment
WHERE appointment.cancelled_at IS NOT NULL;
