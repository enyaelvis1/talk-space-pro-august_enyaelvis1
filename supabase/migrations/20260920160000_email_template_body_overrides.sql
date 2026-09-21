ALTER TABLE public.email_template_settings
  ADD COLUMN IF NOT EXISTS body_override text;
