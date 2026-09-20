
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_role text,
  quote text NOT NULL,
  rating smallint,
  avatar_url text,
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT SELECT ON public.testimonials TO anon;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY testimonials_public_read ON public.testimonials FOR SELECT
  USING (is_published = true);
CREATE POLICY testimonials_admin_all ON public.testimonials FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE INDEX testimonials_order_idx ON public.testimonials(display_order);
CREATE TRIGGER trg_testimonials_updated BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'General',
  question text NOT NULL,
  answer text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT SELECT ON public.faqs TO anon;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY faqs_public_read ON public.faqs FOR SELECT
  USING (is_published = true);
CREATE POLICY faqs_admin_all ON public.faqs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE INDEX faqs_category_order_idx ON public.faqs(category, display_order);
CREATE TRIGGER trg_faqs_updated BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.faqs (category, question, answer, display_order) VALUES
('Getting started','How do I book a first session?','Use the Book a session button anywhere on the site, or message us on WhatsApp. You''ll share a few details, and a care coordinator will confirm your therapist and slot within one working day.',10),
('Getting started','How do I know which therapist is right for me?','A care coordinator reviews every request and matches you with a therapist whose training and style suit your needs. You can request a change at any point.',20),
('Getting started','Can I try a session before committing to a plan?','Yes, most clients start with a single session. You are never asked to commit to a plan up front.',30),
('How sessions work','Do you offer online sessions?','Yes. Most therapists offer secure video sessions. You''ll receive a private link once your session is confirmed. In-person sessions are available at our Lagos rooms.',10),
('How sessions work','How long is a session?','Individual sessions are 50 minutes. Couples and family sessions are 75 minutes. Group sessions are 90 minutes.',20),
('How sessions work','Can I message my therapist between sessions?','Yes, if you''re on a plan. Messages are for brief between-session support, not real-time crisis contact.',30),
('Privacy & confidentiality','Is what I share really confidential?','Yes. Sessions are private and protected by professional ethics. We only share information with your explicit consent, or where required by law (for example, imminent risk to life).',10),
('Privacy & confidentiality','How is my data protected?','We use encrypted video, encrypted storage and role-based access. See our privacy policy for the full detail.',20),
('Fees & access','What if I can''t afford full session fees?','We keep a limited number of sliding-scale slots for students, unemployed clients and low-income households. Mention this in your booking notes.',10),
('Fees & access','Do you accept HMOs?','We are integrating with several Nigerian HMOs and can invoice for out-of-network reimbursement. Ask and we will send a coverage note.',20),
('Fees & access','What is your cancellation policy?','You can reschedule up to 24 hours before your session at no charge. Later changes may be billed at 50% of the session fee.',30);
