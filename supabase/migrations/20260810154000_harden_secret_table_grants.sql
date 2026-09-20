-- Secret-bearing tables are mediated by server functions that use the service
-- role after admin authorization. The browser Supabase client does not need
-- direct table grants to encrypted credentials or retry payloads.

revoke all on table public.email_settings from anon, authenticated;
revoke all on table public.payment_settings from anon, authenticated;
revoke all on table public.google_oauth_settings from anon, authenticated;
revoke all on table public.therapist_google_connections from anon, authenticated;
revoke all on table public.email_delivery_logs from anon, authenticated;

grant all on table public.email_settings to service_role;
grant all on table public.payment_settings to service_role;
grant all on table public.google_oauth_settings to service_role;
grant all on table public.therapist_google_connections to service_role;
grant all on table public.email_delivery_logs to service_role;

comment on table public.email_settings is
  'Server-mediated settings table. Encrypted API keys are readable only with the service role.';
comment on table public.payment_settings is
  'Server-mediated payment settings. Paystack secrets stay encrypted and service-role only.';
comment on table public.google_oauth_settings is
  'Server-mediated Google OAuth settings. Client secret ciphertext is service-role only.';
comment on table public.therapist_google_connections is
  'Server-mediated Google token store. Token ciphertext columns are service-role only.';
comment on table public.email_delivery_logs is
  'Server-mediated email log. Retry payload ciphertext is service-role only.';
