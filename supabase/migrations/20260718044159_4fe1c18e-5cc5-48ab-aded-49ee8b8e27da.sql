
-- Grant Data API access on every public table. Missing GRANTs blocked the backend UI
-- from deleting users (cascade paths) and from managing user roles.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END $$;

-- Public read-only tables (content site + service catalog)
GRANT SELECT ON public.content_entries TO anon;
GRANT SELECT ON public.content_entry_media TO anon;
GRANT SELECT ON public.content_media TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.therapists TO anon;
GRANT SELECT ON public.therapist_services TO anon;

-- Admins need to manage user roles from the app / backend UI.
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
