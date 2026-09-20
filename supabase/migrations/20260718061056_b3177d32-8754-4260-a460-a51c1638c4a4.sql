-- Email settings (single row)
CREATE TABLE public.email_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  provider text NOT NULL DEFAULT 'resend',
  api_key_ciphertext text,
  api_key_last4 text,
  sender_domain text,
  from_name text,
  from_email text,
  reply_to text,
  contact_inbox text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT email_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email settings" ON public.email_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_settings_set_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Per-template settings
CREATE TABLE public.email_template_settings (
  template_key text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  subject_override text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_template_settings TO authenticated;
GRANT ALL ON public.email_template_settings TO service_role;
ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates" ON public.email_template_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_template_settings_set_updated_at
  BEFORE UPDATE ON public.email_template_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_template_settings (template_key, display_name, description) VALUES
  ('booking_confirmation', 'Booking confirmation', 'Sent to the client when a session is confirmed.'),
  ('booking_reminder_24h', 'Reminder — 24 hours before', 'Sent to the client 24 hours before their session.'),
  ('booking_reminder_1h',  'Reminder — 1 hour before',  'Sent to the client 1 hour before their session.'),
  ('reschedule_notice',    'Reschedule notice',          'Sent when a session is moved to a new time.'),
  ('cancellation_notice',  'Cancellation notice',        'Sent when a session is cancelled.'),
  ('contact_ack',          'Contact form — acknowledgement', 'Sent to the person who filled the contact form.'),
  ('contact_admin_notice', 'Contact form — admin notice',    'Sent to the care team inbox when a new message arrives.'),
  ('password_reset',       'Password reset',            'Sent when a user requests a password reset.')
ON CONFLICT (template_key) DO NOTHING;

-- Contact submissions
CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact_page',
  ip_hash text,
  ack_sent_at timestamptz,
  admin_notified_at timestamptz,
  delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read contact submissions" ON public.contact_submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update contact submissions" ON public.contact_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX contact_submissions_created_at_idx ON public.contact_submissions (created_at DESC);
