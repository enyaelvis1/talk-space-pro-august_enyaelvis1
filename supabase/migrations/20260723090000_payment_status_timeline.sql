-- Keep a tamper-resistant status timeline for both provider payments and bank transfers.
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  previous_status public.payment_status,
  new_status public.payment_status NOT NULL,
  provider_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_payment_idx
  ON public.payment_events(payment_id, created_at DESC);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_events_staff_read ON public.payment_events;
CREATE POLICY payment_events_staff_read ON public.payment_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.appointments a ON a.id = p.appointment_id
      WHERE p.id = payment_events.payment_id AND a.client_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.log_payment_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payment_events (
      payment_id, event_type, previous_status, new_status,
      provider_reference, metadata
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'payment_created' ELSE 'status_changed' END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      NEW.provider_reference,
      jsonb_build_object('provider', NEW.provider, 'reference', NEW.reference)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_status_timeline ON public.payments;
CREATE TRIGGER payments_status_timeline
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_payment_status_event();
