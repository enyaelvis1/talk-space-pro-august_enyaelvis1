
CREATE TABLE public.reminder_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reminder_24h_open_min_minutes integer NOT NULL DEFAULT 1380,
  reminder_24h_open_max_minutes integer NOT NULL DEFAULT 1470,
  reminder_1h_open_min_minutes integer NOT NULL DEFAULT 30,
  reminder_1h_open_max_minutes integer NOT NULL DEFAULT 90,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.reminder_settings TO authenticated;
GRANT ALL ON public.reminder_settings TO service_role;

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reminder settings"
  ON public.reminder_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reminder_settings_set_updated_at
  BEFORE UPDATE ON public.reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.reminder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
