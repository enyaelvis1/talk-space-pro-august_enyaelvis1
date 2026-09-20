alter table public.services
  add column if not exists buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  add column if not exists buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  add column if not exists minimum_lead_time_minutes integer not null default 0 check (minimum_lead_time_minutes >= 0);

comment on column public.services.buffer_before_minutes is 'Minutes reserved before a service appointment when calculating availability.';
comment on column public.services.buffer_after_minutes is 'Minutes reserved after a service appointment when calculating availability.';
comment on column public.services.minimum_lead_time_minutes is 'Minimum notice required before a client can book this service.';
