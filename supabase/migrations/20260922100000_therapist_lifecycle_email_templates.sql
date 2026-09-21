-- Give therapists explicit lifecycle notices when an assigned session moves or
-- is released. Delivery remains claim-protected in the server email helper.
INSERT INTO public.email_template_settings (
  template_key,
  display_name,
  description,
  is_enabled
)
VALUES
  (
    'therapist_reschedule_notice',
    'Therapist — reschedule notice',
    'Sent once when an assigned session is moved to a new time.',
    true
  ),
  (
    'therapist_cancellation_notice',
    'Therapist — cancellation notice',
    'Sent once when an assigned session is cancelled or released.',
    true
  )
ON CONFLICT (template_key) DO NOTHING;
