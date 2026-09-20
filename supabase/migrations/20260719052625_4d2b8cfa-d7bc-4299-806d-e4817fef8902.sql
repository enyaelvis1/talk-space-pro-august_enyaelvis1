-- Duplicate appointment-management and email setup snapshot.
-- Earlier July 18 migrations already apply these schema/RPC changes. Keep the
-- harmless admin seed and service-role grants.

insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where email = 'admin@talkspace.com'
on conflict (user_id, role) do nothing;

grant all on public.appointments to service_role;
grant all on public.email_settings to service_role;
grant all on public.email_template_settings to service_role;
grant all on public.email_delivery_logs to service_role;
grant all on public.reminder_settings to service_role;
