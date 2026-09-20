-- Duplicate reminders, payments, Google OAuth, and payment review snapshot.
-- Earlier focused migrations already create and repair these objects.

grant all on public.reminder_settings to service_role;
grant all on public.payment_settings to service_role;
grant all on public.payments to service_role;
grant all on public.payment_reviews to service_role;
grant all on public.google_oauth_settings to service_role;
grant all on public.therapist_google_connections to service_role;
