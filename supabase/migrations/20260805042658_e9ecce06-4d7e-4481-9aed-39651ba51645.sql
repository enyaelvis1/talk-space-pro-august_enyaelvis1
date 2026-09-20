CREATE OR REPLACE FUNCTION public.restore_content_revision(p_revision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE rev public.content_revisions%rowtype; snap jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  SELECT * INTO rev FROM public.content_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='not_found'; END IF;
  snap := rev.snapshot;
  IF rev.entity_type = 'faq' THEN
    INSERT INTO public.faqs (id, category, question, answer, is_published, display_order)
    VALUES (rev.entity_id, snap->>'category', snap->>'question', snap->>'answer',
      COALESCE((snap->>'is_published')::boolean, true), COALESCE((snap->>'display_order')::int, 0))
    ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, question=EXCLUDED.question, answer=EXCLUDED.answer,
      is_published=EXCLUDED.is_published, display_order=EXCLUDED.display_order, updated_at=now();
    RETURN to_jsonb((SELECT f FROM public.faqs f WHERE f.id = rev.entity_id));
  ELSIF rev.entity_type = 'testimonial' THEN
    INSERT INTO public.testimonials (id, author_name, author_role, quote, rating, avatar_url, is_published, display_order)
    VALUES (rev.entity_id, snap->>'author_name', snap->>'author_role', snap->>'quote',
      NULLIF(snap->>'rating','')::int, snap->>'avatar_url',
      COALESCE((snap->>'is_published')::boolean, true), COALESCE((snap->>'display_order')::int, 0))
    ON CONFLICT (id) DO UPDATE SET author_name=EXCLUDED.author_name, author_role=EXCLUDED.author_role,
      quote=EXCLUDED.quote, rating=EXCLUDED.rating, avatar_url=EXCLUDED.avatar_url,
      is_published=EXCLUDED.is_published, display_order=EXCLUDED.display_order, updated_at=now();
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
      source_status = COALESCE(snap->>'source_status', source_status),
      published_at = NULLIF(snap->>'published_at','')::timestamptz,
      metadata = COALESCE(snap->'metadata', metadata),
      updated_at = now()
    WHERE id = rev.entity_id;
    RETURN to_jsonb((SELECT c FROM public.content_entries c WHERE c.id = rev.entity_id));
  ELSE RAISE EXCEPTION USING errcode='P0001', message='unknown_entity';
  END IF;
END $function$;