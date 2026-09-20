-- Correct the booking dropdown duration for Psychotherapy Assessment.
-- The service catalogue remains admin-editable from /admin/services.

UPDATE public.services
SET
  duration_minutes = 60,
  updated_at = now()
WHERE code = 'psychotherapy'
  AND name = 'Psychotherapy Assessment'
  AND duration_minutes <> 60;
