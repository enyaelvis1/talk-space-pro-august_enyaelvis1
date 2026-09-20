CREATE TABLE public.email_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  reason text,
  provider_id text,
  error text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_delivery_logs TO authenticated;
GRANT ALL ON public.email_delivery_logs TO service_role;

ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON public.email_delivery_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX email_delivery_logs_created_at_idx ON public.email_delivery_logs (created_at DESC);
CREATE INDEX email_delivery_logs_recipient_idx ON public.email_delivery_logs (recipient);
CREATE INDEX email_delivery_logs_template_key_idx ON public.email_delivery_logs (template_key);