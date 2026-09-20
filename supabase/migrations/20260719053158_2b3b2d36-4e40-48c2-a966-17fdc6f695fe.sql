UPDATE public.content_entries
SET canonical_path = CASE kind
  WHEN 'page' THEN '/content/pages/' || slug
  WHEN 'post' THEN '/content/posts/' || slug
  WHEN 'category' THEN '/content/categories/' || slug
END,
featured_media_path = NULL,
metadata = metadata - 'source_api';