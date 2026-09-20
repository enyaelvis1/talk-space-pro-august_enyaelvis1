
-- Admin-write policies for services catalogue
DROP POLICY IF EXISTS services_admin_all ON public.services;
CREATE POLICY services_admin_all ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS therapist_services_admin_all ON public.therapist_services;
CREATE POLICY therapist_services_admin_all ON public.therapist_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
