
-- Extend content_revisions to cover content_entries
ALTER TABLE public.content_revisions DROP CONSTRAINT IF EXISTS content_revisions_entity_type_check;
ALTER TABLE public.content_revisions ADD CONSTRAINT content_revisions_entity_type_check
  CHECK (entity_type IN ('faq','testimonial','content_entry'));

DROP TRIGGER IF EXISTS trg_content_entries_revisions ON public.content_entries;
CREATE TRIGGER trg_content_entries_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.content_entries
  FOR EACH ROW EXECUTE FUNCTION public.record_content_revision('content_entry');

-- Extend restore function to handle content_entry
CREATE OR REPLACE FUNCTION public.restore_content_revision(p_revision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rev public.content_revisions%rowtype;
  snap jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  SELECT * INTO rev FROM public.content_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='not_found'; END IF;
  snap := rev.snapshot;

  IF rev.entity_type = 'faq' THEN
    INSERT INTO public.faqs (id, category, question, answer, is_published, display_order)
    VALUES (
      rev.entity_id, snap->>'category', snap->>'question', snap->>'answer',
      COALESCE((snap->>'is_published')::boolean, true),
      COALESCE((snap->>'display_order')::int, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category, question = EXCLUDED.question,
      answer = EXCLUDED.answer, is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order, updated_at = now();
    RETURN to_jsonb((SELECT f FROM public.faqs f WHERE f.id = rev.entity_id));
  ELSIF rev.entity_type = 'testimonial' THEN
    INSERT INTO public.testimonials (id, author_name, author_role, quote, rating, avatar_url, is_published, display_order)
    VALUES (
      rev.entity_id, snap->>'author_name', snap->>'author_role', snap->>'quote',
      NULLIF(snap->>'rating','')::int, snap->>'avatar_url',
      COALESCE((snap->>'is_published')::boolean, true),
      COALESCE((snap->>'display_order')::int, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      author_name = EXCLUDED.author_name, author_role = EXCLUDED.author_role,
      quote = EXCLUDED.quote, rating = EXCLUDED.rating,
      avatar_url = EXCLUDED.avatar_url, is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order, updated_at = now();
    RETURN to_jsonb((SELECT t FROM public.testimonials t WHERE t.id = rev.entity_id));
  ELSIF rev.entity_type = 'content_entry' THEN
    UPDATE public.content_entries SET
      title = COALESCE(snap->>'title', title),
      slug = COALESCE(snap->>'slug', slug),
      canonical_path = COALESCE(snap->>'canonical_path', canonical_path),
      author_name = snap->>'author_name',
      excerpt_html = snap->>'excerpt_html',
      body_html = snap->>'body_html',
      featured_media_path = snap->>'featured_media_path',
      status = COALESCE(snap->>'status', status),
      updated_at = now()
    WHERE id = rev.entity_id;
    RETURN to_jsonb((SELECT c FROM public.content_entries c WHERE c.id = rev.entity_id));
  ELSE
    RAISE EXCEPTION USING errcode='P0001', message='unknown_entity';
  END IF;
END;
$$;

-- Redirects table
CREATE TABLE IF NOT EXISTS public.redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL UNIQUE,
  to_path text NOT NULL,
  status_code int NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redirects_active_idx ON public.redirects (is_active, from_path);

GRANT SELECT ON public.redirects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redirects TO authenticated;
GRANT ALL ON public.redirects TO service_role;

ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS redirects_public_read ON public.redirects;
CREATE POLICY redirects_public_read ON public.redirects
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS redirects_admin_all ON public.redirects;
CREATE POLICY redirects_admin_all ON public.redirects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE OR REPLACE FUNCTION public.redirects_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_redirects_touch ON public.redirects;
CREATE TRIGGER trg_redirects_touch BEFORE UPDATE ON public.redirects
  FOR EACH ROW EXECUTE FUNCTION public.redirects_touch_updated_at();
