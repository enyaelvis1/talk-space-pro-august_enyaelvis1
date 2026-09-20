ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS appointments_reminder_due_idx
  ON public.appointments (starts_at)
  WHERE status = 'confirmed'
    AND (reminder_24h_sent_at IS NULL OR reminder_1h_sent_at IS NULL);
