alter table public.email_settings
add column if not exists zoho_routing_enabled boolean not null default false;

comment on column public.email_settings.zoho_routing_enabled is
  'When enabled, contact form admin notices are delivered to contact_inbox, which must be a Zoho-owned mailbox.';
