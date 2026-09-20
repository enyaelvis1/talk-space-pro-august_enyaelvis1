create or replace function public.hold_appointment(
  p_service_id uuid,
  p_therapist_id uuid,
  p_session_mode public.session_mode,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_notes text,
  p_manage_token_hash text,
  p_client_id uuid default null
)
returns table (
  id uuid,
  booking_reference text,
  hold_expires_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  service_record public.services%rowtype;
  appointment_id uuid;
  reference text;
  appointment_end timestamptz;
begin
  if p_client_id is not null and (auth.uid() is null or p_client_id <> auth.uid()) then
    raise exception using errcode = 'P0001', message = 'invalid_client';
  end if;
  if p_starts_at < now() or extract(minute from (p_starts_at at time zone 'Africa/Lagos'))::integer % 15 <> 0 then
    raise exception using errcode = 'P0001', message = 'invalid_slot';
  end if;
  select * into service_record from public.services where public.services.id = p_service_id and public.services.is_active;
  if not found then raise exception using errcode = 'P0001', message = 'service_unavailable'; end if;
  appointment_end := p_starts_at + make_interval(mins => service_record.duration_minutes);
  if not exists (
    select 1 from public.list_available_slots(p_service_id,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      (p_starts_at at time zone 'Africa/Lagos')::date, p_session_mode) available
    where available.therapist_id = p_therapist_id and available.starts_at = p_starts_at
      and available.ends_at = appointment_end and available.mode = p_session_mode
  ) then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;
  update public.appointments set status = 'cancelled', updated_at = now()
    where public.appointments.status = 'hold' and public.appointments.hold_expires_at <= now();
  reference := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into public.appointments (
    booking_reference, client_id, client_name, client_email, client_phone,
    therapist_id, service_id, session_mode, starts_at, ends_at, hold_expires_at, manage_token_hash, notes
  ) values (
    reference, p_client_id, trim(p_client_name), lower(trim(p_client_email)), trim(p_client_phone),
    p_therapist_id, p_service_id, p_session_mode, p_starts_at, appointment_end,
    now() + interval '5 minutes', lower(trim(p_manage_token_hash)), nullif(trim(p_notes), '')
  )
  returning public.appointments.id, public.appointments.booking_reference,
    public.appointments.hold_expires_at, public.appointments.starts_at, public.appointments.ends_at
  into appointment_id, reference, hold_expires_at, starts_at, ends_at;
  id := appointment_id; booking_reference := reference; return next;
exception when exclusion_violation then raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

-- Grants across public tables + user_roles PK + admin policies
drop policy if exists content_entries_sandbox_seed on public.content_entries;
drop policy if exists content_entries_sandbox_seed_update on public.content_entries;

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END $$;

GRANT SELECT ON public.content_entries TO anon;
GRANT SELECT ON public.content_entry_media TO anon;
GRANT SELECT ON public.content_media TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.therapists TO anon;
GRANT SELECT ON public.therapist_services TO anon;

DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='p') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND conname='user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
