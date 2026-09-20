-- Add 15-minute buffer after appointments to prevent scheduling conflicts
UPDATE public.services
SET buffer_after_minutes = 15
WHERE buffer_after_minutes = 0
  AND is_active = true;

-- Add index to improve query performance on buffer columns
CREATE INDEX IF NOT EXISTS idx_services_buffer_after_minutes 
ON public.services(buffer_after_minutes) 
WHERE is_active = true;
