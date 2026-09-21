-- Prevent concurrent or retried lifecycle actions from sending duplicate
-- client notices. Claims expire for retry after a transient worker failure.
CREATE TABLE IF NOT EXISTS public.appointment_notification_claims (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  notification_key text NOT NULL,
  recipient_role text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (appointment_id, notification_key, recipient_role)
);

CREATE INDEX IF NOT EXISTS appointment_notification_claims_pending_idx
  ON public.appointment_notification_claims (claimed_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.appointment_notification_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appointment_notification_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.appointment_notification_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_appointment_notification(
  p_appointment_id uuid,
  p_notification_key text,
  p_recipient_role text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.appointment_notification_claims (
    appointment_id, notification_key, recipient_role
  ) VALUES (
    p_appointment_id, left(trim(p_notification_key), 100), left(trim(p_recipient_role), 50)
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    RETURN true;
  END IF;

  UPDATE public.appointment_notification_claims
  SET claimed_at = now()
  WHERE appointment_id = p_appointment_id
    AND notification_key = left(trim(p_notification_key), 100)
    AND recipient_role = left(trim(p_recipient_role), 50)
    AND sent_at IS NULL
    AND claimed_at < now() - interval '10 minutes';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_appointment_notification(
  p_appointment_id uuid,
  p_notification_key text,
  p_recipient_role text,
  p_sent boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sent THEN
    UPDATE public.appointment_notification_claims
    SET sent_at = now()
    WHERE appointment_id = p_appointment_id
      AND notification_key = left(trim(p_notification_key), 100)
      AND recipient_role = left(trim(p_recipient_role), 50)
      AND sent_at IS NULL;
  ELSE
    DELETE FROM public.appointment_notification_claims
    WHERE appointment_id = p_appointment_id
      AND notification_key = left(trim(p_notification_key), 100)
      AND recipient_role = left(trim(p_recipient_role), 50)
      AND sent_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_appointment_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_appointment_notification(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_appointment_notification(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_appointment_notification(uuid, text, text, boolean) TO service_role;
