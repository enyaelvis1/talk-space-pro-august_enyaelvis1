ALTER TABLE public.content_media
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS content_media_deleted_at_idx
  ON public.content_media (deleted_at)
  WHERE deleted_at IS NOT NULL;