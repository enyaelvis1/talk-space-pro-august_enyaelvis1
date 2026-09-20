
CREATE TABLE IF NOT EXISTS public.content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('faq','testimonial')),
  entity_id uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('create','update','delete')),
  snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_revisions_entity_idx
  ON public.content_revisions (entity_type, entity_id, created_at DESC);

GRANT SELECT ON public.content_revisions TO authenticated;
GRANT ALL ON public.content_revisions TO service_role;

ALTER TABLE public.content_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_revisions_staff_read ON public.content_revisions;
CREATE POLICY content_revisions_staff_read ON public.content_revisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

-- Trigger function: snapshot faqs / testimonials on every write
CREATE OR REPLACE FUNCTION public.record_content_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text;
  v_change text;
  v_snapshot jsonb;
  v_entity_id uuid;
  v_email text;
BEGIN
  v_entity := TG_ARGV[0];
  IF TG_OP = 'DELETE' THEN
    v_change := 'delete';
    v_snapshot := to_jsonb(OLD);
    v_entity_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_change := 'create';
    v_snapshot := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSE
    v_change := 'update';
    v_snapshot := to_jsonb(NEW);
    v_entity_id := NEW.id;
    IF v_snapshot = to_jsonb(OLD) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.content_revisions
    (entity_type, entity_id, change_type, snapshot, changed_by, changed_by_email)
  VALUES (v_entity, v_entity_id, v_change, v_snapshot, auth.uid(), v_email);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faqs_revisions ON public.faqs;
CREATE TRIGGER trg_faqs_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.record_content_revision('faq');

DROP TRIGGER IF EXISTS trg_testimonials_revisions ON public.testimonials;
CREATE TRIGGER trg_testimonials_revisions
  AFTER INSERT OR UPDATE OR DELETE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.record_content_revision('testimonial');

-- Restore function: revert an entity to a prior revision snapshot
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
      rev.entity_id,
      snap->>'category',
      snap->>'question',
      snap->>'answer',
      COALESCE((snap->>'is_published')::boolean, true),
      COALESCE((snap->>'display_order')::int, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      question = EXCLUDED.question,
      answer = EXCLUDED.answer,
      is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order,
      updated_at = now();
    RETURN to_jsonb((SELECT f FROM public.faqs f WHERE f.id = rev.entity_id));
  ELSIF rev.entity_type = 'testimonial' THEN
    INSERT INTO public.testimonials (id, author_name, author_role, quote, rating, avatar_url, is_published, display_order)
    VALUES (
      rev.entity_id,
      snap->>'author_name',
      snap->>'author_role',
      snap->>'quote',
      NULLIF(snap->>'rating','')::int,
      snap->>'avatar_url',
      COALESCE((snap->>'is_published')::boolean, true),
      COALESCE((snap->>'display_order')::int, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      author_name = EXCLUDED.author_name,
      author_role = EXCLUDED.author_role,
      quote = EXCLUDED.quote,
      rating = EXCLUDED.rating,
      avatar_url = EXCLUDED.avatar_url,
      is_published = EXCLUDED.is_published,
      display_order = EXCLUDED.display_order,
      updated_at = now();
    RETURN to_jsonb((SELECT t FROM public.testimonials t WHERE t.id = rev.entity_id));
  ELSE
    RAISE EXCEPTION USING errcode='P0001', message='unknown_entity';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_content_revision(uuid) TO authenticated;
