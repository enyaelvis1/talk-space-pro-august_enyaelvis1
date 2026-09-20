-- Duplicate CMS/admin bundle snapshot.
-- Earlier focused migrations already apply media tags, content scheduling,
-- testimonials, FAQs, revisions, and redirects.

grant all on public.content_media to service_role;
grant all on public.content_entries to service_role;
grant all on public.testimonials to service_role;
grant all on public.faqs to service_role;
grant all on public.content_revisions to service_role;
grant all on public.redirects to service_role;
