ALTER TABLE public.content_media ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
CREATE INDEX IF NOT EXISTS content_media_tags_gin ON public.content_media USING gin (tags);