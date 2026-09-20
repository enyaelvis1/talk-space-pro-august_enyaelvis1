-- Backfill WordPress-imported post featured images from the media join table.
-- Some imported posts had content_entry_media.role = 'featured' populated while
-- content_entries.featured_media_path stayed null, causing the public cards to
-- fall through to decorative images in the Elementor body HTML.

with featured_media as (
  select distinct on (cem.content_entry_id)
    cem.content_entry_id,
    cm.storage_path
  from public.content_entry_media cem
  join public.content_media cm on cm.id = cem.media_id
  where cem.role = 'featured'
    and cm.deleted_at is null
    and cm.storage_path !~* 'talk[-_\s]?space[-_\s]?1[-_\s]?1'
    and cm.storage_path !~* 'talk[-_\s]?space[-_\s]?logo'
  order by cem.content_entry_id, cem.sort_order asc, cm.created_at asc
)
update public.content_entries ce
set featured_media_path = featured_media.storage_path
from featured_media
where ce.id = featured_media.content_entry_id
  and ce.kind = 'post'
  and coalesce(ce.featured_media_path, '') = '';
