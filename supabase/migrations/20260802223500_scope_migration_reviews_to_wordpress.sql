-- Keep the legacy migration queue limited to records imported from WordPress.
DELETE FROM public.migration_content_reviews review
USING public.content_entries entry
WHERE review.content_entry_id = entry.id
  AND coalesce(entry.metadata ->> 'source', '') <> 'wordpress-rest-api';

