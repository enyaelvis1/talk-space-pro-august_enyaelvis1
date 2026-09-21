


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'staff',
    'client'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'hold',
    'pending_payment',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."availability_exception_kind" AS ENUM (
    'blocked',
    'added'
);


ALTER TYPE "public"."availability_exception_kind" OWNER TO "postgres";


CREATE TYPE "public"."content_entry_kind" AS ENUM (
    'page',
    'post',
    'category'
);


ALTER TYPE "public"."content_entry_kind" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'paystack',
    'bank_transfer'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'initiated',
    'awaiting_confirmation',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."session_mode" AS ENUM (
    'online',
    'in_person',
    'phone'
);


ALTER TYPE "public"."session_mode" OWNER TO "postgres";


CREATE TYPE "public"."session_package_status" AS ENUM (
    'active',
    'exhausted',
    'expired',
    'void'
);


ALTER TYPE "public"."session_package_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") RETURNS TABLE("package_id" "uuid", "client_email" "text", "purchased_sessions" integer, "used_sessions" integer, "remaining_sessions" integer, "access_token" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  payment public.payments%rowtype;
  appt public.appointments%rowtype;
  service_record public.services%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token text;
begin
  select * into payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'payment_not_found';
  end if;

  if payment.status <> 'succeeded' then
    return;
  end if;

  select * into appt
  from public.appointments
  where id = payment.appointment_id
  for update;
  if not found then
    return;
  end if;

  select * into service_record
  from public.services
  where id = appt.service_id;
  if not found or service_record.sessions_per_package <= 1 then
    return;
  end if;

  select * into pkg
  from public.client_session_packages
  where source_payment_id = payment.id
  for update;

  if not found then
    raw_token := encode(gen_random_bytes(32), 'hex');
    insert into public.client_session_packages (
      client_id,
      client_name,
      client_email,
      client_phone,
      service_id,
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) values (
      appt.client_id,
      appt.client_name,
      appt.client_email,
      appt.client_phone,
      appt.service_id,
      payment.id,
      service_record.sessions_per_package,
      0,
      'active',
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      now() + interval '6 months',
      auth.uid()
    )
    returning * into pkg;
  end if;

  if appt.package_id is null and pkg.used_sessions < pkg.purchased_sessions then
    update public.client_session_packages
    set used_sessions = used_sessions + 1,
        status = case
          when used_sessions + 1 >= purchased_sessions
            then 'exhausted'::public.session_package_status
          else status
        end,
        updated_at = now()
    where id = pkg.id
    returning * into pkg;

    update public.appointments
    set package_id = pkg.id,
        updated_at = now()
    where id = appt.id;
  end if;

  package_id := pkg.id;
  client_email := pkg.client_email;
  purchased_sessions := pkg.purchased_sessions;
  used_sessions := pkg.used_sessions;
  remaining_sessions := greatest(pkg.purchased_sessions - pkg.used_sessions, 0);
  access_token := pkg.access_token;
  return next;
end;
$$;


ALTER FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_appointment_manage_token_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  expiry_base timestamptz;
begin
  expiry_base := greatest(coalesce(new.ends_at, new.starts_at), now());

  if tg_op = 'INSERT' then
    if new.manage_token_expires_at is null then
      new.manage_token_expires_at := expiry_base + interval '30 days';
    end if;
  elsif new.manage_token_hash is distinct from old.manage_token_hash
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
  then
    if new.manage_token_expires_at is null
       or (tg_op = 'UPDATE' and new.manage_token_hash is distinct from old.manage_token_hash)
    then
      new.manage_token_expires_at := expiry_base + interval '30 days';
    end if;
  end if;

  if new.status in ('completed', 'no_show') and new.manage_token_revoked_at is null then
    new.manage_token_revoked_at := now();
    new.manage_token_revocation_reason := coalesce(
      new.manage_token_revocation_reason,
      'status_' || new.status::text
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."apply_appointment_manage_token_lifecycle"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_reference" "text" NOT NULL,
    "client_id" "uuid",
    "client_name" "text" NOT NULL,
    "client_email" "text" NOT NULL,
    "client_phone" "text" NOT NULL,
    "therapist_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "session_mode" "public"."session_mode" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'hold'::"public"."appointment_status" NOT NULL,
    "hold_expires_at" timestamp with time zone,
    "manage_token_hash" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancel_reason" "text",
    "rescheduled_from_starts_at" timestamp with time zone,
    "reminder_24h_sent_at" timestamp with time zone,
    "reminder_1h_sent_at" timestamp with time zone,
    "manage_token" "text",
    "paid_amount_kobo" bigint,
    "payment_reference" "text",
    "google_event_id" "text",
    "google_meet_url" "text",
    "google_sync_error" "text",
    "google_synced_at" timestamp with time zone,
    "manage_token_expires_at" timestamp with time zone,
    "manage_token_revoked_at" timestamp with time zone,
    "manage_token_revoked_by" "uuid",
    "manage_token_revocation_reason" "text",
    "package_id" "uuid",
    CONSTRAINT "appointments_check" CHECK (("starts_at" < "ends_at")),
    CONSTRAINT "appointments_check1" CHECK ((("status" <> 'hold'::"public"."appointment_status") OR ("hold_expires_at" IS NOT NULL))),
    CONSTRAINT "appointments_check2" CHECK ((("status" = 'hold'::"public"."appointment_status") OR ("hold_expires_at" IS NULL))),
    CONSTRAINT "appointments_client_email_check" CHECK ((("length"(TRIM(BOTH FROM "client_email")) >= 3) AND ("length"(TRIM(BOTH FROM "client_email")) <= 255))),
    CONSTRAINT "appointments_client_name_check" CHECK ((("length"(TRIM(BOTH FROM "client_name")) >= 2) AND ("length"(TRIM(BOTH FROM "client_name")) <= 100))),
    CONSTRAINT "appointments_client_phone_check" CHECK ((("length"(TRIM(BOTH FROM "client_phone")) >= 7) AND ("length"(TRIM(BOTH FROM "client_phone")) <= 20))),
    CONSTRAINT "appointments_manage_token_hash_check" CHECK (("manage_token_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "appointments_notes_check" CHECK ((("notes" IS NULL) OR ("length"(TRIM(BOTH FROM "notes")) <= 1000)))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when auth.uid() is not null and public.has_role(auth.uid(), 'admin') then 'admin'
    when auth.uid() is not null and public.has_role(auth.uid(), 'staff') then 'staff'
    when auth.uid() is not null and p_appointment.client_id = auth.uid() then 'client_owner'
    when p_manage_token_hash is not null
      and lower(trim(p_manage_token_hash)) = p_appointment.manage_token_hash
      and public.appointment_manage_token_is_active(p_appointment)
      then 'manage_token'
    else null
  end;
$$;


ALTER FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_appointment.manage_token_hash is not null
     and p_appointment.manage_token_revoked_at is null
     and (
       p_appointment.manage_token_expires_at is null
       or p_appointment.manage_token_expires_at > now()
     )
     and p_appointment.status not in ('cancelled', 'completed', 'no_show');
$$;


ALTER FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_manage_token_hash" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "status" "public"."appointment_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  appt public.appointments%rowtype;
  actor text;
begin
  select * into appt from public.appointments where public.appointments.id = p_appointment_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'not_found'; end if;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  if actor is null then raise exception using errcode = 'P0001', message = 'forbidden'; end if;

  if appt.status in ('cancelled','completed','no_show') then
    raise exception using errcode = 'P0001', message = 'invalid_state';
  end if;

  if actor in ('client_owner','manage_token') and appt.starts_at < now() + interval '24 hours'
     and appt.status <> 'hold' then
    raise exception using errcode = 'P0001', message = 'too_late';
  end if;

  update public.appointments set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = nullif(trim(p_reason), ''),
    hold_expires_at = null,
    manage_token = null,
    manage_token_revoked_at = coalesce(manage_token_revoked_at, now()),
    manage_token_revoked_by = coalesce(manage_token_revoked_by, auth.uid()),
    manage_token_revocation_reason = coalesce(
      manage_token_revocation_reason,
      'status_cancelled'
    ),
    updated_at = now()
  where public.appointments.id = appt.id
  returning public.appointments.id, public.appointments.status
  into id, status;
  return next;
end;
$$;


ALTER FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text", "p_manage_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_admin_audit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email_snapshot text;
  actor_kind_value text := 'system';
  row_data jsonb;
  previous_data jsonb;
  changed text[] := '{}';
  target_value text;
  reason_value text;
  operation text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    previous_data := to_jsonb(OLD);
    SELECT coalesce(array_agg(keys.key ORDER BY keys.key), '{}') INTO changed
    FROM (
      SELECT key FROM jsonb_object_keys(row_data) key
      WHERE row_data -> key IS DISTINCT FROM previous_data -> key
    ) keys;
  ELSIF TG_OP = 'INSERT' THEN
    changed := ARRAY(SELECT jsonb_object_keys(row_data) ORDER BY 1);
  END IF;

  IF actor IS NOT NULL THEN
    SELECT email INTO actor_email_snapshot FROM auth.users WHERE id = actor;
    IF public.has_role(actor, 'admin') THEN actor_kind_value := 'admin';
    ELSIF public.has_role(actor, 'staff') THEN actor_kind_value := 'staff';
    END IF;
  END IF;

  target_value := coalesce(
    row_data ->> 'id', row_data ->> 'key', row_data ->> 'appointment_id',
    row_data ->> 'therapist_id', row_data ->> 'template_key'
  );
  reason_value := coalesce(
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(row_data ->> 'review_reason', ''),
    nullif(row_data ->> 'cancel_reason', ''),
    nullif(row_data ->> 'failed_reason', ''),
    nullif(row_data ->> 'note', ''),
    format('%s %s completed', replace(TG_TABLE_NAME, '_', ' '), operation)
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, actor_kind, action, target_type,
    target_id, reason, changed_fields
  ) VALUES (
    actor, actor_email_snapshot, actor_kind_value, TG_TABLE_NAME || '.' || operation,
    TG_TABLE_NAME, target_value, left(reason_value, 500), changed
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_admin_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS TABLE("allowed" boolean, "remaining" integer, "retry_after_seconds" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  INSERT INTO public.security_rate_limits AS s (bucket, identifier, window_started_at, hit_count, updated_at)
  VALUES (p_bucket, p_identifier, now(), 1, now())
  ON CONFLICT (bucket, identifier) DO UPDATE
    SET hit_count = CASE
          WHEN s.window_started_at < now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE s.hit_count + 1
        END,
        window_started_at = CASE
          WHEN s.window_started_at < now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE s.window_started_at
        END,
        updated_at = now()
  RETURNING s.window_started_at, s.hit_count INTO v_window_start, v_count;

  RETURN QUERY SELECT
    v_count <= p_limit,
    GREATEST(p_limit - v_count, 0),
    GREATEST(
      CEIL(EXTRACT(EPOCH FROM (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer,
      0
    );
END $$;


ALTER FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") RETURNS TABLE("package_id" "uuid", "purchased_sessions" integer, "used_sessions" integer, "remaining_sessions" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  appt public.appointments%rowtype;
  pkg public.client_session_packages%rowtype;
begin
  select * into appt
  from public.appointments
  where public.appointments.id = p_appointment_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_not_found';
  end if;

  select * into pkg
  from public.client_session_packages
  where access_token_hash = lower(trim(p_access_token_hash))
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'package_not_found';
  end if;

  if not public.session_package_is_active(pkg) then
    raise exception using errcode = 'P0001', message = 'package_inactive';
  end if;

  if appt.service_id <> pkg.service_id then
    raise exception using errcode = 'P0001', message = 'package_service_mismatch';
  end if;

  if lower(appt.client_email) <> lower(pkg.client_email) then
    raise exception using errcode = 'P0001', message = 'package_client_mismatch';
  end if;

  if appt.package_id is not null then
    raise exception using errcode = 'P0001', message = 'appointment_already_packaged';
  end if;

  update public.client_session_packages
  set used_sessions = used_sessions + 1,
      status = case
        when used_sessions + 1 >= purchased_sessions
          then 'exhausted'::public.session_package_status
        else status
      end,
      updated_at = now()
  where id = pkg.id
  returning * into pkg;

  update public.appointments
  set package_id = pkg.id,
      status = 'confirmed'::public.appointment_status,
      hold_expires_at = null,
      paid_amount_kobo = coalesce(paid_amount_kobo, 0),
      payment_reference = coalesce(payment_reference, 'PACKAGE-' || upper(substr(pkg.id::text, 1, 8))),
      updated_at = now()
  where id = appt.id;

  package_id := pkg.id;
  purchased_sessions := pkg.purchased_sessions;
  used_sessions := pkg.used_sessions;
  remaining_sessions := greatest(pkg.purchased_sessions - pkg.used_sessions, 0);
  return next;
end;
$$;


ALTER FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_holds"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare affected integer;
begin
  update public.appointments set
    status = 'cancelled',
    updated_at = now(),
    hold_expires_at = null,
    manage_token = null,
    manage_token_revoked_at = coalesce(manage_token_revoked_at, now()),
    manage_token_revocation_reason = coalesce(
      manage_token_revocation_reason,
      'hold_expired'
    )
  where status = 'hold'
    and hold_expires_at is not null
    and hold_expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;


ALTER FUNCTION "public"."expire_stale_holds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") RETURNS TABLE("id" "uuid", "booking_reference" "text", "status" "public"."appointment_status", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "session_mode" "public"."session_mode", "client_name" "text", "client_email" "text", "client_phone" "text", "service_id" "uuid", "therapist_id" "uuid", "hold_expires_at" timestamp with time zone, "cancelled_at" timestamp with time zone, "package_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.id, a.booking_reference, a.status, a.starts_at, a.ends_at, a.session_mode,
    a.client_name, a.client_email, a.client_phone, a.service_id, a.therapist_id,
    a.hold_expires_at, a.cancelled_at, a.package_id
  from public.appointments a
  where a.manage_token_hash = lower(trim(p_manage_token_hash))
    and public.appointment_manage_token_is_active(a)
  limit 1;
$$;


ALTER FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") RETURNS TABLE("id" "uuid", "client_name" "text", "client_email" "text", "client_phone" "text", "service_id" "uuid", "service_name" "text", "purchased_sessions" integer, "used_sessions" integer, "remaining_sessions" integer, "status" "public"."session_package_status", "expires_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    pkg.id,
    pkg.client_name,
    pkg.client_email,
    pkg.client_phone,
    pkg.service_id,
    svc.name as service_name,
    pkg.purchased_sessions,
    pkg.used_sessions,
    greatest(pkg.purchased_sessions - pkg.used_sessions, 0) as remaining_sessions,
    case
      when pkg.status = 'active'
       and (pkg.expires_at is not null and pkg.expires_at <= now())
        then 'expired'::public.session_package_status
      when pkg.status = 'active'
       and pkg.used_sessions >= pkg.purchased_sessions
        then 'exhausted'::public.session_package_status
      else pkg.status
    end as status,
    pkg.expires_at
  from public.client_session_packages pkg
  join public.services svc on svc.id = pkg.service_id
  where pkg.access_token_hash = lower(trim(p_access_token_hash))
  limit 1;
$$;


ALTER FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id, role) do nothing;

  insert into public.clients (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hold_appointment"("p_service_id" "uuid", "p_therapist_id" "uuid", "p_session_mode" "public"."session_mode", "p_starts_at" timestamp with time zone, "p_client_name" "text", "p_client_email" "text", "p_client_phone" "text", "p_notes" "text", "p_manage_token_hash" "text", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "booking_reference" "text", "hold_expires_at" timestamp with time zone, "starts_at" timestamp with time zone, "ends_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  service_record public.services%rowtype;
  appointment_id uuid;
  reference text;
  appointment_end timestamptz;
begin
  if p_client_id is not null and (auth.uid() is null or p_client_id <> auth.uid()) then
    raise exception using errcode = 'P0001', message = 'invalid_client';
  end if;

  if p_starts_at < now()
     or extract(minute from (p_starts_at at time zone 'Africa/Lagos'))::integer % 15 <> 0
  then
    raise exception using errcode = 'P0001', message = 'invalid_slot';
  end if;

  select * into service_record
  from public.services
  where public.services.id = p_service_id
    and public.services.is_active;

  if not found then
    raise exception using errcode = 'P0001', message = 'service_unavailable';
  end if;

  appointment_end := p_starts_at + make_interval(mins => service_record.duration_minutes);

  if not exists (
    select 1
    from public.list_available_slots(
      p_service_id,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      (p_starts_at at time zone 'Africa/Lagos')::date,
      p_session_mode
    ) available
    where available.therapist_id = p_therapist_id
      and available.starts_at = p_starts_at
      and available.ends_at = appointment_end
      and available.mode = p_session_mode
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  update public.appointments
  set status = 'cancelled',
      hold_expires_at = null,
      updated_at = now()
  where public.appointments.status = 'hold'
    and public.appointments.hold_expires_at <= now();

  reference := 'TS-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into public.appointments (
    booking_reference,
    client_id,
    client_name,
    client_email,
    client_phone,
    therapist_id,
    service_id,
    session_mode,
    starts_at,
    ends_at,
    status,
    hold_expires_at,
    manage_token_hash,
    notes
  )
  values (
    reference,
    p_client_id,
    trim(p_client_name),
    lower(trim(p_client_email)),
    trim(p_client_phone),
    p_therapist_id,
    p_service_id,
    p_session_mode,
    p_starts_at,
    appointment_end,
    'hold',
    now() + interval '5 minutes',
    lower(trim(p_manage_token_hash)),
    nullif(trim(p_notes), '')
  )
  returning public.appointments.id,
            public.appointments.booking_reference,
            public.appointments.hold_expires_at,
            public.appointments.starts_at,
            public.appointments.ends_at
    into appointment_id, reference, hold_expires_at, starts_at, ends_at;

  id := appointment_id;
  booking_reference := reference;
  return next;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;


ALTER FUNCTION "public"."hold_appointment"("p_service_id" "uuid", "p_therapist_id" "uuid", "p_session_mode" "public"."session_mode", "p_starts_at" timestamp with time zone, "p_client_name" "text", "p_client_email" "text", "p_client_phone" "text", "p_notes" "text", "p_manage_token_hash" "text", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_available_slots"("p_service_id" "uuid", "p_from" "date", "p_to" "date", "p_mode" "public"."session_mode" DEFAULT NULL::"public"."session_mode") RETURNS TABLE("therapist_id" "uuid", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "mode" "public"."session_mode")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  with selected_service as (
    select *
    from public.services
    where public.services.id = p_service_id
      and public.services.is_active
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
    where p_from <= p_to
  ),
  recurring_windows as (
    select
      rule.therapist_id,
      ((days.day::timestamp + rule.starts_at) at time zone rule.timezone) as window_start,
      ((days.day::timestamp + rule.ends_at) at time zone rule.timezone) as window_end,
      rule.mode
    from public.availability_rules rule
    join public.therapist_services assignment
      on assignment.therapist_id = rule.therapist_id
     and assignment.service_id = p_service_id
    join public.therapists therapist
      on therapist.id = rule.therapist_id
     and therapist.is_active
    cross join days
    where rule.is_active
      and extract(dow from days.day) = rule.day_of_week
      and (p_mode is null or rule.mode = p_mode)
  ),
  added_windows as (
    select
      exception.therapist_id,
      exception.starts_at as window_start,
      exception.ends_at as window_end,
      coalesce(exception.mode, p_mode, 'online'::public.session_mode) as mode
    from public.availability_exceptions exception
    join public.therapist_services assignment
      on assignment.therapist_id = exception.therapist_id
     and assignment.service_id = p_service_id
    join public.therapists therapist
      on therapist.id = exception.therapist_id
     and therapist.is_active
    where exception.kind = 'added'
      and timezone('Africa/Lagos', exception.starts_at)::date between p_from and p_to
      and (p_mode is null or exception.mode is null or exception.mode = p_mode)
  ),
  windows as (
    select * from recurring_windows
    union all
    select * from added_windows
  ),
  candidate_slots as (
    select
      windows.therapist_id,
      slot.starts_at,
      slot.starts_at + make_interval(mins => selected_service.duration_minutes) as ends_at,
      windows.mode,
      selected_service.buffer_before_minutes,
      selected_service.buffer_after_minutes,
      selected_service.minimum_lead_time_minutes
    from windows
    cross join selected_service
    cross join lateral generate_series(
      windows.window_start,
      windows.window_end - make_interval(mins => selected_service.duration_minutes),
      interval '15 minutes'
    ) as slot(starts_at)
  )
  select
    candidate.therapist_id,
    candidate.starts_at,
    candidate.ends_at,
    candidate.mode
  from candidate_slots candidate
  where candidate.starts_at >= now() + make_interval(mins => candidate.minimum_lead_time_minutes)
    and not exists (
      select 1
      from public.availability_exceptions blocked
      where blocked.therapist_id = candidate.therapist_id
        and blocked.kind = 'blocked'
        and (blocked.mode is null or blocked.mode = candidate.mode)
        and tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
    and not exists (
      select 1
      from public.appointments appointment
      join public.services booked_service on booked_service.id = appointment.service_id
      where appointment.therapist_id = candidate.therapist_id
        and appointment.status in ('hold', 'pending_payment', 'confirmed')
        and (appointment.status <> 'hold' or appointment.hold_expires_at > now())
        and tstzrange(
          appointment.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
          appointment.ends_at + make_interval(mins => booked_service.buffer_after_minutes),
          '[)'
        ) && tstzrange(
          candidate.starts_at - make_interval(mins => candidate.buffer_before_minutes),
          candidate.ends_at + make_interval(mins => candidate.buffer_after_minutes),
          '[)'
        )
    )
  order by candidate.starts_at, candidate.therapist_id;
$$;


ALTER FUNCTION "public"."list_available_slots"("p_service_id" "uuid", "p_from" "date", "p_to" "date", "p_mode" "public"."session_mode") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_appointment_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_events (
      appointment_id, event_type, new_status, actor_id, metadata, created_at
    ) VALUES (
      NEW.id,
      'booking_created',
      NEW.status,
      auth.uid(),
      jsonb_build_object(
        'starts_at', NEW.starts_at,
        'ends_at', NEW.ends_at,
        'session_mode', NEW.session_mode,
        'therapist_id', NEW.therapist_id,
        'service_id', NEW.service_id
      ),
      NEW.created_at
    );
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.appointment_events (
      appointment_id, event_type, previous_status, new_status, actor_id, metadata
    ) VALUES (
      NEW.id,
      'status_changed',
      OLD.status,
      NEW.status,
      auth.uid(),
      jsonb_strip_nulls(jsonb_build_object('reason', NEW.cancel_reason))
    );
  END IF;

  IF OLD.starts_at IS DISTINCT FROM NEW.starts_at
    OR OLD.ends_at IS DISTINCT FROM NEW.ends_at
    OR OLD.therapist_id IS DISTINCT FROM NEW.therapist_id
    OR OLD.session_mode IS DISTINCT FROM NEW.session_mode THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      'booking_rescheduled',
      auth.uid(),
      jsonb_build_object(
        'previous_starts_at', OLD.starts_at,
        'starts_at', NEW.starts_at,
        'previous_ends_at', OLD.ends_at,
        'ends_at', NEW.ends_at,
        'previous_therapist_id', OLD.therapist_id,
        'therapist_id', NEW.therapist_id,
        'previous_session_mode', OLD.session_mode,
        'session_mode', NEW.session_mode
      )
    );
  END IF;

  IF OLD.google_synced_at IS DISTINCT FROM NEW.google_synced_at
    AND NEW.google_synced_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id,
      'google_synced',
      auth.uid(),
      jsonb_strip_nulls(jsonb_build_object(
        'event_id', NEW.google_event_id,
        'meet_created', NEW.google_meet_url IS NOT NULL
      )),
      NEW.google_synced_at
    );
  END IF;

  IF OLD.google_sync_error IS DISTINCT FROM NEW.google_sync_error
    AND NEW.google_sync_error IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      'google_sync_failed',
      auth.uid(),
      jsonb_build_object('error', NEW.google_sync_error)
    );
  END IF;

  IF OLD.reminder_24h_sent_at IS DISTINCT FROM NEW.reminder_24h_sent_at
    AND NEW.reminder_24h_sent_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id, 'reminder_sent', auth.uid(), jsonb_build_object('window', '24h'),
      NEW.reminder_24h_sent_at
    );
  END IF;

  IF OLD.reminder_1h_sent_at IS DISTINCT FROM NEW.reminder_1h_sent_at
    AND NEW.reminder_1h_sent_at IS NOT NULL THEN
    INSERT INTO public.appointment_events (appointment_id, event_type, actor_id, metadata, created_at)
    VALUES (
      NEW.id, 'reminder_sent', auth.uid(), jsonb_build_object('window', '1h'),
      NEW.reminder_1h_sent_at
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_appointment_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_payment_status_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payment_events (
      payment_id, event_type, previous_status, new_status,
      provider_reference, metadata
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'payment_created' ELSE 'status_changed' END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      NEW.provider_reference,
      jsonb_build_object('provider', NEW.provider, 'reference', NEW.reference)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_payment_status_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_section_audit"("p_entry_id" "uuid", "p_ops" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count int := 0;
  v_op jsonb;
  v_action text;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin'::app_role) then
    raise exception 'Not authorized to record section audit entries';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    v_action := 'section.' || coalesce(nullif(v_op->>'op', ''), 'update');
    insert into public.admin_audit_logs (
      actor_id, actor_email, actor_kind, action, target_type, target_id, reason, changed_fields
    ) values (
      v_uid,
      v_email,
      'admin',
      v_action,
      'content_section',
      p_entry_id::text,
      coalesce(nullif(v_op->>'reason', ''), 'Section change'),
      coalesce(
        (select array_agg(f) from jsonb_array_elements_text(coalesce(v_op->'fields', '[]'::jsonb)) as t(f)),
        '{}'::text[]
      )
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."log_section_audit"("p_entry_id" "uuid", "p_ops" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.security_events (event_type, identifier, route, severity, details)
  VALUES (p_event_type, p_identifier, p_route, COALESCE(p_severity, 'warning'), COALESCE(p_details, '{}'::jsonb));
END $$;


ALTER FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") RETURNS TABLE("id" "uuid", "status" "public"."appointment_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  appt public.appointments%rowtype;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden';
  END IF;
  IF p_new_status NOT IN ('completed','no_show') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_status';
  END IF;

  SELECT * INTO appt FROM public.appointments WHERE public.appointments.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found'; END IF;
  IF appt.status NOT IN ('confirmed','pending_payment') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  UPDATE public.appointments SET status = p_new_status, updated_at = now(), hold_expires_at = NULL
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id, public.appointments.status
  INTO id, status;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "provider" "public"."payment_provider" NOT NULL,
    "reference" "text" NOT NULL,
    "provider_reference" "text",
    "amount_kobo" bigint NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'initiated'::"public"."payment_status" NOT NULL,
    "authorization_url" "text",
    "receipt_path" "text",
    "transfer_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "failed_reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_success_email_claimed_at" timestamp with time zone,
    "payment_failed_email_claimed_at" timestamp with time zone,
    "bank_transfer_received_email_claimed_at" timestamp with time zone,
    CONSTRAINT "payments_amount_kobo_check" CHECK (("amount_kobo" >= 0)),
    CONSTRAINT "payments_currency_check" CHECK (("currency" = 'NGN'::"text"))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_status"("p_reference" "text", "p_new_status" "public"."payment_status", "p_provider_reference" "text" DEFAULT NULL::"text", "p_failed_reason" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE p public.payments;
BEGIN
  UPDATE public.payments
    SET status = p_new_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        failed_reason = coalesce(p_failed_reason, failed_reason),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        verified_by = CASE WHEN p_new_status IN ('succeeded','refunded') THEN auth.uid() ELSE verified_by END,
        verified_at = CASE WHEN p_new_status IN ('succeeded','refunded') THEN now() ELSE verified_at END,
        updated_at = now()
  WHERE reference = p_reference
  RETURNING * INTO p;

  IF p.id IS NULL THEN
    RAISE EXCEPTION USING errcode='P0001', message='payment_not_found';
  END IF;

  IF p_new_status = 'succeeded' THEN
    UPDATE public.appointments
      SET status = 'confirmed'::public.appointment_status,
          paid_amount_kobo = p.amount_kobo,
          payment_reference = p.reference,
          hold_expires_at = NULL,
          updated_at = now()
      WHERE id = p.appointment_id
        AND status IN ('hold','pending_payment','confirmed');
  ELSIF p_new_status IN ('failed','cancelled') THEN
    UPDATE public.appointments SET updated_at = now() WHERE id = p.appointment_id;
  END IF;

  RETURN p;
END $$;


ALTER FUNCTION "public"."mark_payment_status"("p_reference" "text", "p_new_status" "public"."payment_status", "p_provider_reference" "text", "p_failed_reason" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_appointment_hold_state"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  if new.status = 'hold' then
    if new.hold_expires_at is null then
      if tg_op = 'INSERT' or old.status is distinct from new.status or old.hold_expires_at is distinct from new.hold_expires_at then
        new.hold_expires_at := now() + interval '5 minutes';
      end if;
    end if;
  else
    new.hold_expires_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."normalize_appointment_hold_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_scheduled_content"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE affected integer; unaffected integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'staff') THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  UPDATE public.content_entries
     SET source_status = 'publish',
         published_at = COALESCE(published_at, scheduled_publish_at, now()),
         scheduled_publish_at = NULL
   WHERE scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now()
     AND archived_at IS NULL AND source_status <> 'publish'
     AND (scheduled_unpublish_at IS NULL OR scheduled_unpublish_at > now());
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.content_entries
     SET source_status = 'draft',
         scheduled_unpublish_at = NULL
   WHERE scheduled_unpublish_at IS NOT NULL AND scheduled_unpublish_at <= now()
     AND source_status = 'publish';
  GET DIAGNOSTICS unaffected = ROW_COUNT;

  RETURN affected + unaffected;
END $$;


ALTER FUNCTION "public"."publish_scheduled_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_rate_limits"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.security_rate_limits WHERE updated_at < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;


ALTER FUNCTION "public"."purge_expired_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_content_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_entity text;
  v_change text;
  v_snapshot jsonb;
  v_entity_id uuid;
  v_email text;
BEGIN
  v_entity := TG_ARGV[0];
  IF TG_OP = 'DELETE' THEN
    v_change := 'delete';
    v_snapshot := to_jsonb(OLD);
    v_entity_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_change := 'create';
    v_snapshot := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSE
    v_change := 'update';
    v_snapshot := to_jsonb(NEW);
    v_entity_id := NEW.id;
    IF v_snapshot = to_jsonb(OLD) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.content_revisions
    (entity_type, entity_id, change_type, snapshot, changed_by, changed_by_email)
  VALUES (v_entity, v_entity_id, v_change, v_snapshot, auth.uid(), v_email);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_content_revision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_payment_initiated"("p_appointment_id" "uuid", "p_provider" "public"."payment_provider", "p_reference" "text", "p_amount_kobo" bigint, "p_authorization_url" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE p public.payments;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION USING errcode='P0001', message='invalid_amount';
  END IF;

  INSERT INTO public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    authorization_url, metadata, created_by
  ) VALUES (
    p_appointment_id, p_provider, p_reference, p_amount_kobo,
    CASE WHEN p_provider = 'bank_transfer' THEN 'awaiting_confirmation'::public.payment_status
         ELSE 'initiated'::public.payment_status END,
    p_authorization_url, coalesce(p_metadata, '{}'::jsonb), auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET authorization_url = EXCLUDED.authorization_url,
        metadata = public.payments.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING * INTO p;

  UPDATE public.appointments
    SET status = CASE WHEN status = 'hold' THEN 'pending_payment'::public.appointment_status ELSE status END,
        hold_expires_at = CASE WHEN status = 'hold' THEN NULL ELSE hold_expires_at END,
        payment_reference = p.reference,
        updated_at = now()
  WHERE id = p_appointment_id;

  RETURN p;
END $$;


ALTER FUNCTION "public"."record_payment_initiated"("p_appointment_id" "uuid", "p_provider" "public"."payment_provider", "p_reference" "text", "p_amount_kobo" bigint, "p_authorization_url" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redirects_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."redirects_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text" DEFAULT NULL::"text", "p_new_therapist_id" "uuid" DEFAULT NULL::"uuid", "p_new_session_mode" "public"."session_mode" DEFAULT NULL::"public"."session_mode") RETURNS TABLE("id" "uuid", "booking_reference" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "status" "public"."appointment_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  appt public.appointments%rowtype;
  actor text;
  target_therapist uuid;
  target_mode session_mode;
  service_duration integer;
  new_ends timestamptz;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE public.appointments.id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'not_found'; END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN RAISE EXCEPTION USING errcode = 'P0001', message = 'forbidden'; END IF;

  IF appt.status NOT IN ('hold','pending_payment','confirmed') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_state';
  END IF;

  IF actor IN ('client_owner','manage_token') AND appt.starts_at < now() + interval '24 hours' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'too_late';
  END IF;

  target_therapist := coalesce(p_new_therapist_id, appt.therapist_id);
  target_mode := coalesce(p_new_session_mode, appt.session_mode);

  SELECT duration_minutes INTO service_duration FROM public.services WHERE public.services.id = appt.service_id;
  new_ends := p_new_starts_at + make_interval(mins => service_duration);

  IF p_new_starts_at < now() OR extract(minute from (p_new_starts_at at time zone 'Africa/Lagos'))::int % 15 <> 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'invalid_slot';
  END IF;

  -- Free the current slot first so the exclusion constraint check for the new slot ignores it
  UPDATE public.appointments SET status = 'cancelled', updated_at = now()
    WHERE public.appointments.id = appt.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.list_available_slots(appt.service_id,
      (p_new_starts_at at time zone 'Africa/Lagos')::date,
      (p_new_starts_at at time zone 'Africa/Lagos')::date, target_mode) av
    WHERE av.therapist_id = target_therapist AND av.starts_at = p_new_starts_at
      AND av.ends_at = new_ends AND av.mode = target_mode
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
  END IF;

  UPDATE public.appointments SET
    status = appt.status,
    starts_at = p_new_starts_at,
    ends_at = new_ends,
    therapist_id = target_therapist,
    session_mode = target_mode,
    rescheduled_from_starts_at = coalesce(appt.rescheduled_from_starts_at, appt.starts_at),
    hold_expires_at = CASE WHEN appt.status = 'hold' THEN now() + interval '5 minutes' ELSE NULL END,
    updated_at = now()
  WHERE public.appointments.id = appt.id
  RETURNING public.appointments.id, public.appointments.booking_reference,
    public.appointments.starts_at, public.appointments.ends_at, public.appointments.status
  INTO id, booking_reference, starts_at, ends_at, status;
  RETURN NEXT;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'slot_unavailable';
END;
$$;


ALTER FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text", "p_new_therapist_id" "uuid", "p_new_session_mode" "public"."session_mode") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_content_revision"("p_revision_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE rev public.content_revisions%rowtype; snap jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;
  SELECT * INTO rev FROM public.content_revisions WHERE id = p_revision_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='not_found'; END IF;
  snap := rev.snapshot;
  IF rev.entity_type = 'faq' THEN
    INSERT INTO public.faqs (id, category, question, answer, is_published, display_order)
    VALUES (rev.entity_id, snap->>'category', snap->>'question', snap->>'answer',
      COALESCE((snap->>'is_published')::boolean, true), COALESCE((snap->>'display_order')::int, 0))
    ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, question=EXCLUDED.question, answer=EXCLUDED.answer,
      is_published=EXCLUDED.is_published, display_order=EXCLUDED.display_order, updated_at=now();
    RETURN to_jsonb((SELECT f FROM public.faqs f WHERE f.id = rev.entity_id));
  ELSIF rev.entity_type = 'testimonial' THEN
    INSERT INTO public.testimonials (id, author_name, author_role, quote, rating, avatar_url, is_published, display_order)
    VALUES (rev.entity_id, snap->>'author_name', snap->>'author_role', snap->>'quote',
      NULLIF(snap->>'rating','')::int, snap->>'avatar_url',
      COALESCE((snap->>'is_published')::boolean, true), COALESCE((snap->>'display_order')::int, 0))
    ON CONFLICT (id) DO UPDATE SET author_name=EXCLUDED.author_name, author_role=EXCLUDED.author_role,
      quote=EXCLUDED.quote, rating=EXCLUDED.rating, avatar_url=EXCLUDED.avatar_url,
      is_published=EXCLUDED.is_published, display_order=EXCLUDED.display_order, updated_at=now();
    RETURN to_jsonb((SELECT t FROM public.testimonials t WHERE t.id = rev.entity_id));
  ELSIF rev.entity_type = 'content_entry' THEN
    UPDATE public.content_entries SET
      title = COALESCE(snap->>'title', title),
      slug = COALESCE(snap->>'slug', slug),
      canonical_path = COALESCE(snap->>'canonical_path', canonical_path),
      author_name = snap->>'author_name',
      excerpt_html = snap->>'excerpt_html',
      body_html = snap->>'body_html',
      featured_media_path = snap->>'featured_media_path',
      source_status = COALESCE(snap->>'source_status', source_status),
      published_at = NULLIF(snap->>'published_at','')::timestamptz,
      metadata = COALESCE(snap->'metadata', metadata),
      updated_at = now()
    WHERE id = rev.entity_id;
    RETURN to_jsonb((SELECT c FROM public.content_entries c WHERE c.id = rev.entity_id));
  ELSE RAISE EXCEPTION USING errcode='P0001', message='unknown_entity';
  END IF;
END $$;


ALTER FUNCTION "public"."restore_content_revision"("p_revision_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "manage_token_revoked_at" timestamp with time zone, "manage_token_revocation_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  update public.appointments as a set
    manage_token = null,
    manage_token_revoked_at = coalesce(a.manage_token_revoked_at, now()),
    manage_token_revoked_by = auth.uid(),
    manage_token_revocation_reason = coalesce(
      nullif(trim(p_reason), ''),
      a.manage_token_revocation_reason,
      'manual_admin_revoke'
    ),
    updated_at = now()
  where a.id = p_appointment_id
  returning a.id,
            a.manage_token_revoked_at,
            a.manage_token_revocation_reason
  into id, manage_token_revoked_at, manage_token_revocation_reason;

  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  return next;
end;
$$;


ALTER FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_session_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "client_name" "text" NOT NULL,
    "client_email" "text" NOT NULL,
    "client_phone" "text",
    "service_id" "uuid" NOT NULL,
    "source_payment_id" "uuid",
    "purchased_sessions" integer NOT NULL,
    "used_sessions" integer DEFAULT 0 NOT NULL,
    "status" "public"."session_package_status" DEFAULT 'active'::"public"."session_package_status" NOT NULL,
    "access_token_hash" "text" NOT NULL,
    "access_token" "text",
    "expires_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_session_packages_access_token_hash_check" CHECK (("access_token_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "client_session_packages_check" CHECK (("used_sessions" <= "purchased_sessions")),
    CONSTRAINT "client_session_packages_client_email_check" CHECK ((("length"(TRIM(BOTH FROM "client_email")) >= 3) AND ("length"(TRIM(BOTH FROM "client_email")) <= 255))),
    CONSTRAINT "client_session_packages_client_name_check" CHECK ((("length"(TRIM(BOTH FROM "client_name")) >= 2) AND ("length"(TRIM(BOTH FROM "client_name")) <= 100))),
    CONSTRAINT "client_session_packages_client_phone_check" CHECK ((("client_phone" IS NULL) OR (("length"(TRIM(BOTH FROM "client_phone")) >= 7) AND ("length"(TRIM(BOTH FROM "client_phone")) <= 20)))),
    CONSTRAINT "client_session_packages_notes_check" CHECK ((("notes" IS NULL) OR ("length"(TRIM(BOTH FROM "notes")) <= 1000))),
    CONSTRAINT "client_session_packages_purchased_sessions_check" CHECK (("purchased_sessions" > 0)),
    CONSTRAINT "client_session_packages_used_sessions_check" CHECK (("used_sessions" >= 0))
);


ALTER TABLE "public"."client_session_packages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_package.status = 'active'
     and p_package.used_sessions < p_package.purchased_sessions
     and (p_package.expires_at is null or p_package.expires_at > now());
$$;


ALTER FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_bank_transfer"("p_appointment_id" "uuid", "p_reference" "text", "p_amount_kobo" bigint, "p_transfer_note" "text" DEFAULT NULL::"text", "p_receipt_path" "text" DEFAULT NULL::"text", "p_manage_token_hash" "text" DEFAULT NULL::"text") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  appt public.appointments%rowtype;
  actor TEXT;
  p public.payments;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='not_found'; END IF;

  actor := public.appointment_actor(appt, p_manage_token_hash);
  IF actor IS NULL THEN RAISE EXCEPTION USING errcode='P0001', message='forbidden'; END IF;

  INSERT INTO public.payments (
    appointment_id, provider, reference, amount_kobo, status,
    transfer_note, receipt_path, metadata, created_by
  ) VALUES (
    p_appointment_id, 'bank_transfer', p_reference, p_amount_kobo,
    'awaiting_confirmation', nullif(trim(p_transfer_note), ''), p_receipt_path,
    jsonb_build_object('submitted_via', actor), auth.uid()
  )
  ON CONFLICT (reference) DO UPDATE
    SET transfer_note = coalesce(EXCLUDED.transfer_note, public.payments.transfer_note),
        receipt_path = coalesce(EXCLUDED.receipt_path, public.payments.receipt_path),
        status = 'awaiting_confirmation',
        updated_at = now()
  RETURNING * INTO p;

  UPDATE public.appointments
    SET status = CASE WHEN status = 'hold' THEN 'pending_payment'::public.appointment_status ELSE status END,
        hold_expires_at = CASE WHEN status = 'hold' THEN NULL ELSE hold_expires_at END,
        payment_reference = p.reference,
        updated_at = now()
  WHERE id = p_appointment_id;

  RETURN p;
END $$;


ALTER FUNCTION "public"."submit_bank_transfer"("p_appointment_id" "uuid", "p_reference" "text", "p_amount_kobo" bigint, "p_transfer_note" "text", "p_receipt_path" "text", "p_manage_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_bank_transfer"("p_payment_id" "uuid", "p_approve" boolean, "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  p public.payments;
  prev_status public.payment_status;
  new_status public.payment_status;
  reviewer_email text;
  reviewer_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN
    RAISE EXCEPTION USING errcode='P0001', message='forbidden';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING errcode='P0001', message='payment_not_found'; END IF;
  IF p.provider <> 'bank_transfer' THEN
    RAISE EXCEPTION USING errcode='P0001', message='not_bank_transfer';
  END IF;

  prev_status := p.status;
  new_status := CASE WHEN p_approve THEN 'succeeded'::public.payment_status ELSE 'failed'::public.payment_status END;

  p := public.mark_payment_status(
    p.reference,
    new_status,
    NULL,
    CASE WHEN p_approve THEN NULL ELSE coalesce(p_note, 'rejected_by_staff') END,
    jsonb_build_object('verifier_note', coalesce(p_note, ''))
  );

  SELECT email INTO reviewer_email FROM auth.users WHERE id = auth.uid();
  SELECT full_name INTO reviewer_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.payment_reviews (
    payment_id, action, previous_status, new_status, note,
    reviewer_id, reviewer_email, reviewer_name
  ) VALUES (
    p_payment_id,
    CASE WHEN p_approve THEN 'approve' ELSE 'reject' END,
    prev_status,
    new_status,
    NULLIF(trim(coalesce(p_note, '')), ''),
    auth.uid(),
    reviewer_email,
    reviewer_name
  );

  RETURN p;
END $$;


ALTER FUNCTION "public"."verify_bank_transfer"("p_payment_id" "uuid", "p_approve" boolean, "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "actor_kind" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text",
    "reason" "text" NOT NULL,
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_logs_actor_kind_check" CHECK (("actor_kind" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_status" "public"."appointment_status",
    "new_status" "public"."appointment_status",
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appointment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "therapist_id" "uuid" NOT NULL,
    "kind" "public"."availability_exception_kind" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "mode" "public"."session_mode",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "external_ref" "text",
    CONSTRAINT "availability_exceptions_check" CHECK (("starts_at" < "ends_at"))
);


ALTER TABLE "public"."availability_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "therapist_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "starts_at" time without time zone NOT NULL,
    "ends_at" time without time zone NOT NULL,
    "mode" "public"."session_mode" DEFAULT 'online'::"public"."session_mode" NOT NULL,
    "timezone" "text" DEFAULT 'Africa/Lagos'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "availability_rules_check" CHECK (("starts_at" < "ends_at")),
    CONSTRAINT "availability_rules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."availability_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_notes_body_check" CHECK (("length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."client_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "date_of_birth" "date",
    "preferred_mode" "public"."session_mode",
    "assigned_therapist_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text" NOT NULL,
    "source" "text" DEFAULT 'contact_page'::"text" NOT NULL,
    "ip_hash" "text",
    "ack_sent_at" timestamp with time zone,
    "admin_notified_at" timestamp with time zone,
    "delivery_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."content_entry_kind" NOT NULL,
    "source_id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "canonical_path" "text" NOT NULL,
    "title" "text" NOT NULL,
    "excerpt_html" "text",
    "body_html" "text",
    "source_status" "text" DEFAULT 'publish'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "source_modified_at" timestamp with time zone,
    "author_name" "text",
    "featured_media_path" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_publish_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "scheduled_unpublish_at" timestamp with time zone
);


ALTER TABLE "public"."content_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_entry_media" (
    "content_entry_id" "uuid" NOT NULL,
    "media_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_entry_media_role_check" CHECK (("role" = ANY (ARRAY['body'::"text", 'excerpt'::"text", 'featured'::"text"]))),
    CONSTRAINT "content_entry_media_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."content_entry_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_hash" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "source_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "byte_size" bigint NOT NULL,
    "sha256" "text" NOT NULL,
    "alt_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "content_media_byte_size_check" CHECK (("byte_size" >= 0))
);


ALTER TABLE "public"."content_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "change_type" "text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "changed_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_revisions_change_type_check" CHECK (("change_type" = ANY (ARRAY['create'::"text", 'update'::"text", 'delete'::"text"]))),
    CONSTRAINT "content_revisions_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['faq'::"text", 'testimonial'::"text", 'content_entry'::"text"])))
);


ALTER TABLE "public"."content_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_delivery_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text",
    "recipient" "text" NOT NULL,
    "subject" "text",
    "status" "text" NOT NULL,
    "reason" "text",
    "provider_id" "text",
    "error" "text",
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retry_payload_ciphertext" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "retried_from" "uuid",
    "retry_trigger" "text" DEFAULT 'initial'::"text" NOT NULL,
    "retry_actor_id" "uuid",
    CONSTRAINT "email_delivery_logs_retry_count_check" CHECK ((("retry_count" >= 0) AND ("retry_count" <= 5))),
    CONSTRAINT "email_delivery_logs_retry_trigger_check" CHECK (("retry_trigger" = ANY (ARRAY['initial'::"text", 'automatic'::"text", 'manual'::"text"]))),
    CONSTRAINT "email_delivery_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."email_delivery_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_delivery_logs" IS 'Server-mediated email log. Retry payload ciphertext is service-role only.';



CREATE TABLE IF NOT EXISTS "public"."email_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "provider" "text" DEFAULT 'resend'::"text" NOT NULL,
    "api_key_ciphertext" "text",
    "api_key_last4" "text",
    "sender_domain" "text",
    "from_name" "text",
    "from_email" "text",
    "reply_to" "text",
    "contact_inbox" "text",
    "is_enabled" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "zoho_routing_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "email_settings_singleton" CHECK (("id" = 1))
);


ALTER TABLE "public"."email_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_settings" IS 'Server-mediated settings table. Encrypted API keys are readable only with the service role.';



COMMENT ON COLUMN "public"."email_settings"."zoho_routing_enabled" IS 'When enabled, contact form admin notices are delivered to contact_inbox, which must be a Zoho-owned mailbox.';



CREATE TABLE IF NOT EXISTS "public"."email_template_settings" (
    "template_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "is_enabled" boolean DEFAULT true NOT NULL,
    "subject_override" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_template_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" DEFAULT 'General'::"text" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_oauth_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "client_id" "text",
    "client_secret_ciphertext" "text",
    "redirect_path" "text" DEFAULT '/api/public/google/callback'::"text" NOT NULL,
    "scopes" "text" DEFAULT 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'::"text" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_oauth_settings_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."google_oauth_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."google_oauth_settings" IS 'Server-mediated Google OAuth settings. Client secret ciphertext is service-role only.';



CREATE TABLE IF NOT EXISTS "public"."intake_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "template_key" "text" NOT NULL,
    "client_id" "uuid",
    "appointment_id" "uuid",
    "contact_submission_id" "uuid",
    "subject_name" "text",
    "subject_email" "text",
    "payload" "jsonb" NOT NULL,
    "consent_acknowledged_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completion_state" "text" DEFAULT 'completed'::"text" NOT NULL,
    "template_version" integer DEFAULT 1 NOT NULL,
    "reminder_sent_at" timestamp with time zone,
    "reminder_sent_by" "uuid",
    CONSTRAINT "intake_submissions_completion_state_check" CHECK (("completion_state" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'completed'::"text"]))),
    CONSTRAINT "intake_submissions_source_check" CHECK (("source" = ANY (ARRAY['booking'::"text", 'contact'::"text", 'assessment'::"text"]))),
    CONSTRAINT "intake_submissions_subject_email_check" CHECK ((("subject_email" IS NULL) OR (("length"(TRIM(BOTH FROM "subject_email")) >= 3) AND ("length"(TRIM(BOTH FROM "subject_email")) <= 255)))),
    CONSTRAINT "intake_submissions_template_version_positive" CHECK (("template_version" > 0))
);


ALTER TABLE "public"."intake_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_content_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_entry_id" "uuid" NOT NULL,
    "source_kind" "public"."content_entry_kind" NOT NULL,
    "source_id" bigint NOT NULL,
    "source_url" "text" NOT NULL,
    "title" "text" NOT NULL,
    "proposed_path" "text",
    "decision" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_by_email" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "migration_content_reviews_check" CHECK (((("decision" = 'pending'::"text") AND ("reviewed_at" IS NULL)) OR (("decision" <> 'pending'::"text") AND ("reviewed_at" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "review_reason")) >= 3)))),
    CONSTRAINT "migration_content_reviews_decision_check" CHECK (("decision" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'excluded'::"text", 'needs_revision'::"text"])))
);


ALTER TABLE "public"."migration_content_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_status" "public"."payment_status",
    "new_status" "public"."payment_status" NOT NULL,
    "provider_reference" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "previous_status" "public"."payment_status",
    "new_status" "public"."payment_status" NOT NULL,
    "note" "text",
    "reviewer_id" "uuid",
    "reviewer_email" "text",
    "reviewer_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_reviews_action_check" CHECK (("action" = ANY (ARRAY['approve'::"text", 'reject'::"text"])))
);


ALTER TABLE "public"."payment_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "mode" "text" DEFAULT 'test'::"text" NOT NULL,
    "paystack_public_key" "text",
    "paystack_secret_ciphertext" "text",
    "paystack_secret_last4" "text",
    "paystack_webhook_secret_ciphertext" "text",
    "is_paystack_enabled" boolean DEFAULT false NOT NULL,
    "is_bank_transfer_enabled" boolean DEFAULT true NOT NULL,
    "bank_name" "text",
    "bank_account_name" "text",
    "bank_account_number" "text",
    "bank_instructions" "text",
    "callback_path" "text" DEFAULT '/book/payment-callback'::"text" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_settings_id_check" CHECK (("id" = 1)),
    CONSTRAINT "payment_settings_mode_check" CHECK (("mode" = ANY (ARRAY['test'::"text", 'live'::"text"])))
);


ALTER TABLE "public"."payment_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_settings" IS 'Server-mediated payment settings. Paystack secrets stay encrypted and service-role only.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."redirects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_path" "text" NOT NULL,
    "to_path" "text" NOT NULL,
    "status_code" integer DEFAULT 301 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "redirects_status_code_check" CHECK (("status_code" = ANY (ARRAY[301, 302, 307, 308])))
);


ALTER TABLE "public"."redirects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminder_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "reminder_24h_open_min_minutes" integer DEFAULT 1380 NOT NULL,
    "reminder_24h_open_max_minutes" integer DEFAULT 1470 NOT NULL,
    "reminder_1h_open_min_minutes" integer DEFAULT 30 NOT NULL,
    "reminder_1h_open_max_minutes" integer DEFAULT 90 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "reminder_settings_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."reminder_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "identifier" "text",
    "route" "text",
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_rate_limits" (
    "bucket" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hit_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_minutes" integer NOT NULL,
    "sessions_per_package" integer DEFAULT 1 NOT NULL,
    "price_ngn" numeric(12,2),
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "buffer_before_minutes" integer DEFAULT 0 NOT NULL,
    "buffer_after_minutes" integer DEFAULT 0 NOT NULL,
    "minimum_lead_time_minutes" integer DEFAULT 0 NOT NULL,
    "in_person_price_ngn" numeric(12,2),
    CONSTRAINT "services_buffer_after_minutes_check" CHECK (("buffer_after_minutes" >= 0)),
    CONSTRAINT "services_buffer_before_minutes_check" CHECK (("buffer_before_minutes" >= 0)),
    CONSTRAINT "services_currency_check" CHECK (("currency" = 'NGN'::"text")),
    CONSTRAINT "services_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "services_in_person_price_ngn_check" CHECK ((("in_person_price_ngn" IS NULL) OR ("in_person_price_ngn" >= (0)::numeric))),
    CONSTRAINT "services_minimum_lead_time_minutes_check" CHECK (("minimum_lead_time_minutes" >= 0)),
    CONSTRAINT "services_price_ngn_check" CHECK ((("price_ngn" IS NULL) OR ("price_ngn" >= (0)::numeric))),
    CONSTRAINT "services_sessions_per_package_check" CHECK (("sessions_per_package" > 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."services"."buffer_before_minutes" IS 'Minutes reserved before a service appointment when calculating availability.';



COMMENT ON COLUMN "public"."services"."buffer_after_minutes" IS 'Minutes reserved after a service appointment when calculating availability.';



COMMENT ON COLUMN "public"."services"."minimum_lead_time_minutes" IS 'Minimum notice required before a client can book this service.';



COMMENT ON COLUMN "public"."services"."in_person_price_ngn" IS 'Physical / in-person session price in NGN. Falls back to price_ngn when null.';



CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_name" "text" NOT NULL,
    "author_role" "text",
    "quote" "text" NOT NULL,
    "rating" smallint,
    "avatar_url" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."therapist_google_connections" (
    "therapist_id" "uuid" NOT NULL,
    "google_email" "text",
    "access_token_ciphertext" "text",
    "refresh_token_ciphertext" "text",
    "token_expires_at" timestamp with time zone,
    "calendar_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_error" "text",
    "sync_channel_id" "text",
    "sync_resource_id" "text",
    "sync_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."therapist_google_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."therapist_google_connections" IS 'Server-mediated Google token store. Token ciphertext columns are service-role only.';



CREATE TABLE IF NOT EXISTS "public"."therapist_services" (
    "therapist_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."therapist_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."therapists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "slug" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role_title" "text" NOT NULL,
    "credentials" "text",
    "bio" "text",
    "location" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "modalities" "public"."session_mode"[] DEFAULT '{}'::"public"."session_mode"[] NOT NULL,
    "image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."therapists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'client'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_events"
    ADD CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_active_slot_exclusion" EXCLUDE USING "gist" ("therapist_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE (("status" = ANY (ARRAY['hold'::"public"."appointment_status", 'pending_payment'::"public"."appointment_status", 'confirmed'::"public"."appointment_status"])));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_booking_reference_key" UNIQUE ("booking_reference");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_access_token_hash_key" UNIQUE ("access_token_hash");



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_source_payment_id_key" UNIQUE ("source_payment_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_entries"
    ADD CONSTRAINT "content_entries_kind_slug_key" UNIQUE ("kind", "slug");



ALTER TABLE ONLY "public"."content_entries"
    ADD CONSTRAINT "content_entries_kind_source_id_key" UNIQUE ("kind", "source_id");



ALTER TABLE ONLY "public"."content_entries"
    ADD CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_entry_media"
    ADD CONSTRAINT "content_entry_media_pkey" PRIMARY KEY ("content_entry_id", "media_id", "role");



ALTER TABLE ONLY "public"."content_media"
    ADD CONSTRAINT "content_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_media"
    ADD CONSTRAINT "content_media_source_hash_key" UNIQUE ("source_hash");



ALTER TABLE ONLY "public"."content_media"
    ADD CONSTRAINT "content_media_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."content_revisions"
    ADD CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_delivery_logs"
    ADD CONSTRAINT "email_delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_settings"
    ADD CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_template_settings"
    ADD CONSTRAINT "email_template_settings_pkey" PRIMARY KEY ("template_key");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_oauth_settings"
    ADD CONSTRAINT "google_oauth_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_submissions"
    ADD CONSTRAINT "intake_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_content_reviews"
    ADD CONSTRAINT "migration_content_reviews_content_entry_id_key" UNIQUE ("content_entry_id");



ALTER TABLE ONLY "public"."migration_content_reviews"
    ADD CONSTRAINT "migration_content_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_reviews"
    ADD CONSTRAINT "payment_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redirects"
    ADD CONSTRAINT "redirects_from_path_key" UNIQUE ("from_path");



ALTER TABLE ONLY "public"."redirects"
    ADD CONSTRAINT "redirects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limits"
    ADD CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("bucket", "identifier");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."therapist_google_connections"
    ADD CONSTRAINT "therapist_google_connections_pkey" PRIMARY KEY ("therapist_id");



ALTER TABLE ONLY "public"."therapist_services"
    ADD CONSTRAINT "therapist_services_pkey" PRIMARY KEY ("therapist_id", "service_id");



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "admin_audit_logs_actor_idx" ON "public"."admin_audit_logs" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "admin_audit_logs_created_idx" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_logs_target_idx" ON "public"."admin_audit_logs" USING "btree" ("target_type", "target_id", "created_at" DESC);



CREATE INDEX "appointment_events_appointment_created_idx" ON "public"."appointment_events" USING "btree" ("appointment_id", "created_at" DESC);



CREATE INDEX "appointments_client_created_idx" ON "public"."appointments" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "appointments_manage_token_active_idx" ON "public"."appointments" USING "btree" ("manage_token_hash", "manage_token_expires_at") WHERE ("manage_token_revoked_at" IS NULL);



CREATE INDEX "appointments_manage_token_hash_idx" ON "public"."appointments" USING "btree" ("manage_token_hash");



CREATE INDEX "appointments_package_idx" ON "public"."appointments" USING "btree" ("package_id", "starts_at" DESC);



CREATE INDEX "appointments_reminder_due_idx" ON "public"."appointments" USING "btree" ("starts_at") WHERE (("status" = 'confirmed'::"public"."appointment_status") AND (("reminder_24h_sent_at" IS NULL) OR ("reminder_1h_sent_at" IS NULL)));



CREATE INDEX "appointments_status_created_idx" ON "public"."appointments" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "availability_exceptions_source_idx" ON "public"."availability_exceptions" USING "btree" ("therapist_id", "source");



CREATE INDEX "availability_exceptions_therapist_time_idx" ON "public"."availability_exceptions" USING "btree" ("therapist_id", "starts_at", "ends_at");



CREATE INDEX "availability_rules_therapist_day_idx" ON "public"."availability_rules" USING "btree" ("therapist_id", "day_of_week") WHERE "is_active";



CREATE INDEX "client_notes_client_created_idx" ON "public"."client_notes" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "client_session_packages_client_email_idx" ON "public"."client_session_packages" USING "btree" ("lower"("client_email"), "created_at" DESC);



CREATE INDEX "client_session_packages_service_idx" ON "public"."client_session_packages" USING "btree" ("service_id", "status");



CREATE INDEX "client_session_packages_token_idx" ON "public"."client_session_packages" USING "btree" ("access_token_hash") WHERE ("status" = 'active'::"public"."session_package_status");



CREATE INDEX "clients_assigned_therapist_idx" ON "public"."clients" USING "btree" ("assigned_therapist_id") WHERE ("assigned_therapist_id" IS NOT NULL);



CREATE INDEX "contact_submissions_created_at_idx" ON "public"."contact_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "content_entries_archived_at_idx" ON "public"."content_entries" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "content_entries_kind_status_idx" ON "public"."content_entries" USING "btree" ("kind", "source_status", "published_at" DESC);



CREATE INDEX "content_entries_scheduled_publish_at_idx" ON "public"."content_entries" USING "btree" ("scheduled_publish_at") WHERE ("scheduled_publish_at" IS NOT NULL);



CREATE INDEX "content_entries_slug_idx" ON "public"."content_entries" USING "btree" ("slug");



CREATE INDEX "content_entry_media_media_idx" ON "public"."content_entry_media" USING "btree" ("media_id");



CREATE INDEX "content_media_deleted_at_idx" ON "public"."content_media" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "content_media_sha256_idx" ON "public"."content_media" USING "btree" ("sha256");



CREATE INDEX "content_media_tags_gin" ON "public"."content_media" USING "gin" ("tags");



CREATE INDEX "content_revisions_entity_idx" ON "public"."content_revisions" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "email_delivery_logs_created_at_idx" ON "public"."email_delivery_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "email_delivery_logs_due_retry_idx" ON "public"."email_delivery_logs" USING "btree" ("next_retry_at") WHERE (("status" = 'failed'::"text") AND ("next_retry_at" IS NOT NULL));



CREATE INDEX "email_delivery_logs_recipient_idx" ON "public"."email_delivery_logs" USING "btree" ("recipient");



CREATE INDEX "email_delivery_logs_retried_from_idx" ON "public"."email_delivery_logs" USING "btree" ("retried_from");



CREATE INDEX "email_delivery_logs_template_key_idx" ON "public"."email_delivery_logs" USING "btree" ("template_key");



CREATE INDEX "faqs_category_order_idx" ON "public"."faqs" USING "btree" ("category", "display_order");



CREATE INDEX "idx_services_buffer_after_minutes" ON "public"."services" USING "btree" ("buffer_after_minutes") WHERE ("is_active" = true);



CREATE INDEX "intake_submissions_appointment_idx" ON "public"."intake_submissions" USING "btree" ("appointment_id");



CREATE INDEX "intake_submissions_client_created_idx" ON "public"."intake_submissions" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "intake_submissions_contact_submission_idx" ON "public"."intake_submissions" USING "btree" ("contact_submission_id");



CREATE INDEX "intake_submissions_pending_reminder_idx" ON "public"."intake_submissions" USING "btree" ("updated_at" DESC) WHERE ("completion_state" = ANY (ARRAY['draft'::"text", 'in_progress'::"text"]));



CREATE INDEX "intake_submissions_template_key_idx" ON "public"."intake_submissions" USING "btree" ("template_key");



CREATE INDEX "migration_content_reviews_decision_idx" ON "public"."migration_content_reviews" USING "btree" ("decision", "source_kind", "updated_at" DESC);



CREATE INDEX "payment_events_payment_idx" ON "public"."payment_events" USING "btree" ("payment_id", "created_at" DESC);



CREATE INDEX "payment_reviews_payment_idx" ON "public"."payment_reviews" USING "btree" ("payment_id", "created_at" DESC);



CREATE INDEX "payments_appointment_idx" ON "public"."payments" USING "btree" ("appointment_id", "created_at" DESC);



CREATE INDEX "payments_provider_ref_idx" ON "public"."payments" USING "btree" ("provider", "provider_reference");



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "redirects_active_idx" ON "public"."redirects" USING "btree" ("is_active", "from_path");



CREATE INDEX "security_events_created_at_idx" ON "public"."security_events" USING "btree" ("created_at" DESC);



CREATE INDEX "testimonials_order_idx" ON "public"."testimonials" USING "btree" ("display_order");



CREATE INDEX "therapists_display_order_idx" ON "public"."therapists" USING "btree" ("display_order", "full_name");



CREATE OR REPLACE TRIGGER "appointments_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "appointments_manage_token_lifecycle" BEFORE INSERT OR UPDATE OF "status", "starts_at", "ends_at", "manage_token_hash", "manage_token_expires_at" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."apply_appointment_manage_token_lifecycle"();



CREATE OR REPLACE TRIGGER "appointments_normalize_hold_state" BEFORE INSERT OR UPDATE OF "status", "hold_expires_at" ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_appointment_hold_state"();



CREATE OR REPLACE TRIGGER "appointments_operational_timeline" AFTER INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."log_appointment_event"();



CREATE OR REPLACE TRIGGER "appointments_set_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "availability_exceptions_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."availability_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "availability_exceptions_set_updated_at" BEFORE UPDATE ON "public"."availability_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "availability_rules_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."availability_rules" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "availability_rules_set_updated_at" BEFORE UPDATE ON "public"."availability_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "client_notes_set_updated_at" BEFORE UPDATE ON "public"."client_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "client_session_packages_set_updated_at" BEFORE UPDATE ON "public"."client_session_packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "clients_set_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "contact_submissions_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."contact_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "content_entries_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."content_entries" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "content_entries_set_updated_at" BEFORE UPDATE ON "public"."content_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "content_media_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."content_media" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "content_media_set_updated_at" BEFORE UPDATE ON "public"."content_media" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "email_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."email_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "email_settings_set_updated_at" BEFORE UPDATE ON "public"."email_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "email_template_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."email_template_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "email_template_settings_set_updated_at" BEFORE UPDATE ON "public"."email_template_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "faqs_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "google_oauth_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."google_oauth_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "google_oauth_settings_set_updated_at" BEFORE UPDATE ON "public"."google_oauth_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "intake_submissions_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."intake_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "intake_submissions_set_updated_at" BEFORE UPDATE ON "public"."intake_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "migration_content_reviews_capture_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."migration_content_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "migration_content_reviews_set_updated_at" BEFORE UPDATE ON "public"."migration_content_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payment_reviews_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "payment_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "payment_settings_set_updated_at" BEFORE UPDATE ON "public"."payment_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_status_timeline" AFTER INSERT OR UPDATE OF "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_payment_status_event"();



CREATE OR REPLACE TRIGGER "redirects_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."redirects" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "reminder_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."reminder_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "reminder_settings_set_updated_at" BEFORE UPDATE ON "public"."reminder_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "services_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "services_set_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "site_settings_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "site_settings_set_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "testimonials_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "tgc_set_updated_at" BEFORE UPDATE ON "public"."therapist_google_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "therapist_google_connections_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."therapist_google_connections" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "therapist_services_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."therapist_services" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "therapists_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."therapists" FOR EACH ROW EXECUTE FUNCTION "public"."capture_admin_audit_log"();



CREATE OR REPLACE TRIGGER "therapists_set_updated_at" BEFORE UPDATE ON "public"."therapists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_content_entries_revisions" AFTER INSERT OR DELETE OR UPDATE ON "public"."content_entries" FOR EACH ROW EXECUTE FUNCTION "public"."record_content_revision"('content_entry');



CREATE OR REPLACE TRIGGER "trg_faqs_revisions" AFTER INSERT OR DELETE OR UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."record_content_revision"('faq');



CREATE OR REPLACE TRIGGER "trg_faqs_updated" BEFORE UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_redirects_touch" BEFORE UPDATE ON "public"."redirects" FOR EACH ROW EXECUTE FUNCTION "public"."redirects_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_testimonials_revisions" AFTER INSERT OR DELETE OR UPDATE ON "public"."testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."record_content_revision"('testimonial');



CREATE OR REPLACE TRIGGER "trg_testimonials_updated" BEFORE UPDATE ON "public"."testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."appointment_events"
    ADD CONSTRAINT "appointment_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_manage_token_revoked_by_fkey" FOREIGN KEY ("manage_token_revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."client_session_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."client_session_packages"
    ADD CONSTRAINT "client_session_packages_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_assigned_therapist_id_fkey" FOREIGN KEY ("assigned_therapist_id") REFERENCES "public"."therapists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_entries"
    ADD CONSTRAINT "content_entries_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_entry_media"
    ADD CONSTRAINT "content_entry_media_content_entry_id_fkey" FOREIGN KEY ("content_entry_id") REFERENCES "public"."content_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_entry_media"
    ADD CONSTRAINT "content_entry_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."content_media"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_revisions"
    ADD CONSTRAINT "content_revisions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_delivery_logs"
    ADD CONSTRAINT "email_delivery_logs_retried_from_fkey" FOREIGN KEY ("retried_from") REFERENCES "public"."email_delivery_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_delivery_logs"
    ADD CONSTRAINT "email_delivery_logs_retry_actor_id_fkey" FOREIGN KEY ("retry_actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_submissions"
    ADD CONSTRAINT "intake_submissions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_submissions"
    ADD CONSTRAINT "intake_submissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_submissions"
    ADD CONSTRAINT "intake_submissions_contact_submission_id_fkey" FOREIGN KEY ("contact_submission_id") REFERENCES "public"."contact_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intake_submissions"
    ADD CONSTRAINT "intake_submissions_reminder_sent_by_fkey" FOREIGN KEY ("reminder_sent_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."migration_content_reviews"
    ADD CONSTRAINT "migration_content_reviews_content_entry_id_fkey" FOREIGN KEY ("content_entry_id") REFERENCES "public"."content_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."migration_content_reviews"
    ADD CONSTRAINT "migration_content_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_reviews"
    ADD CONSTRAINT "payment_reviews_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_reviews"
    ADD CONSTRAINT "payment_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_settings"
    ADD CONSTRAINT "payment_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."redirects"
    ADD CONSTRAINT "redirects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."therapist_google_connections"
    ADD CONSTRAINT "therapist_google_connections_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."therapist_services"
    ADD CONSTRAINT "therapist_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."therapist_services"
    ADD CONSTRAINT "therapist_services_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view email logs" ON "public"."email_delivery_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view security events" ON "public"."security_events" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage email settings" ON "public"."email_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage email templates" ON "public"."email_template_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage reminder settings" ON "public"."reminder_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins manage user roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins read contact submissions" ON "public"."contact_submissions" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins update contact submissions" ON "public"."contact_submissions" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'admin'::"public"."app_role")));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_audit_logs_admin_read" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."appointment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_events_authorized_read" ON "public"."appointment_events" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."appointments" "appointment"
  WHERE (("appointment"."id" = "appointment_events"."appointment_id") AND ("appointment"."client_id" = "auth"."uid"()))))));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_client_read_own" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



ALTER TABLE "public"."availability_exceptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "availability_exceptions_admin_all" ON "public"."availability_exceptions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "availability_exceptions_admin_delete" ON "public"."availability_exceptions" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "availability_exceptions_admin_insert" ON "public"."availability_exceptions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "availability_exceptions_admin_read" ON "public"."availability_exceptions" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "availability_exceptions_public_read" ON "public"."availability_exceptions" FOR SELECT TO "authenticated", "anon" USING ((("ends_at" >= "now"()) AND (EXISTS ( SELECT 1
   FROM "public"."therapists" "therapist"
  WHERE (("therapist"."id" = "availability_exceptions"."therapist_id") AND "therapist"."is_active")))));



ALTER TABLE "public"."availability_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "availability_rules_admin_all" ON "public"."availability_rules" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "availability_rules_public_read" ON "public"."availability_rules" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND (EXISTS ( SELECT 1
   FROM "public"."therapists" "therapist"
  WHERE (("therapist"."id" = "availability_rules"."therapist_id") AND "therapist"."is_active")))));



ALTER TABLE "public"."client_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_notes_staff_delete" ON "public"."client_notes" FOR DELETE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."clients" "client"
     JOIN "public"."therapists" "therapist" ON (("therapist"."id" = "client"."assigned_therapist_id")))
  WHERE (("client"."id" = "client_notes"."client_id") AND ("therapist"."user_id" = "auth"."uid"())))))));



CREATE POLICY "client_notes_staff_insert" ON "public"."client_notes" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."clients" "client"
     JOIN "public"."therapists" "therapist" ON (("therapist"."id" = "client"."assigned_therapist_id")))
  WHERE (("client"."id" = "client_notes"."client_id") AND ("therapist"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "client_notes_staff_read" ON "public"."client_notes" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."clients" "client"
     JOIN "public"."therapists" "therapist" ON (("therapist"."id" = "client"."assigned_therapist_id")))
  WHERE (("client"."id" = "client_notes"."client_id") AND ("therapist"."user_id" = "auth"."uid"())))))));



CREATE POLICY "client_notes_staff_update" ON "public"."client_notes" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM ("public"."clients" "client"
     JOIN "public"."therapists" "therapist" ON (("therapist"."id" = "client"."assigned_therapist_id")))
  WHERE (("client"."id" = "client_notes"."client_id") AND ("therapist"."user_id" = "auth"."uid"()))))))) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."client_session_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_session_packages_client_read_own" ON "public"."client_session_packages" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "client_session_packages_staff_read" ON "public"."client_session_packages" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_read_own_or_assigned" ON "public"."clients" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."therapists" "therapist"
  WHERE (("therapist"."id" = "clients"."assigned_therapist_id") AND ("therapist"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_entries_admin_write" ON "public"."content_entries" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "content_entries_public_read" ON "public"."content_entries" FOR SELECT TO "authenticated", "anon" USING (("source_status" = 'publish'::"text"));



ALTER TABLE "public"."content_entry_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_entry_media_admin_write" ON "public"."content_entry_media" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "content_entry_media_public_read" ON "public"."content_entry_media" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."content_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_media_admin_write" ON "public"."content_media" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "content_media_public_read" ON "public"."content_media" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."content_revisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_revisions_staff_read" ON "public"."content_revisions" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



ALTER TABLE "public"."email_delivery_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_template_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faqs_admin_all" ON "public"."faqs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "faqs_public_read" ON "public"."faqs" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."google_oauth_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "google_oauth_settings_admin" ON "public"."google_oauth_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."intake_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intake_submissions_admin_read" ON "public"."intake_submissions" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "intake_submissions_client_read_own" ON "public"."intake_submissions" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."appointments" "appointment"
  WHERE (("appointment"."id" = "intake_submissions"."appointment_id") AND ("appointment"."client_id" = "auth"."uid"()))))));



ALTER TABLE "public"."migration_content_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "migration_content_reviews_admin_insert" ON "public"."migration_content_reviews" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "migration_content_reviews_admin_read" ON "public"."migration_content_reviews" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "migration_content_reviews_admin_update" ON "public"."migration_content_reviews" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_staff_read" ON "public"."payment_events" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."payments" "p"
     JOIN "public"."appointments" "a" ON (("a"."id" = "p"."appointment_id")))
  WHERE (("p"."id" = "payment_events"."payment_id") AND ("a"."client_id" = "auth"."uid"()))))));



ALTER TABLE "public"."payment_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_reviews_admin_staff_read" ON "public"."payment_reviews" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



ALTER TABLE "public"."payment_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_settings_admin_all" ON "public"."payment_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_client_read_own" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "payments"."appointment_id") AND ("a"."client_id" = "auth"."uid"())))));



CREATE POLICY "payments_staff_read" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "payments_staff_write" ON "public"."payments" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."redirects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "redirects_admin_all" ON "public"."redirects" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "redirects_public_read" ON "public"."redirects" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



ALTER TABLE "public"."reminder_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_admin_all" ON "public"."services" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "services_public_read" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING ("is_active");



ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_settings_admin_write" ON "public"."site_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "site_settings_public_read" ON "public"."site_settings" FOR SELECT TO "authenticated", "anon" USING (("key" = ANY (ARRAY['home_hero'::"text", 'home_specialties'::"text", 'home_specialty_cards'::"text", 'home_sections'::"text", 'home_section_copy'::"text", 'google_reviews'::"text", 'site_details'::"text", 'form_templates'::"text"])));



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "testimonials_admin_all" ON "public"."testimonials" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "testimonials_public_read" ON "public"."testimonials" FOR SELECT USING (("is_published" = true));



CREATE POLICY "tgc_admin_all" ON "public"."therapist_google_connections" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "tgc_staff_read" ON "public"."therapist_google_connections" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role"));



ALTER TABLE "public"."therapist_google_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."therapist_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "therapist_services_admin_all" ON "public"."therapist_services" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "therapist_services_public_read" ON "public"."therapist_services" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."therapists" "therapist"
     JOIN "public"."services" "service" ON (("service"."id" = "therapist_services"."service_id")))
  WHERE (("therapist"."id" = "therapist_services"."therapist_id") AND "therapist"."is_active" AND "service"."is_active"))));



ALTER TABLE "public"."therapists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "therapists_admin_all" ON "public"."therapists" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "therapists_public_read" ON "public"."therapists" FOR SELECT TO "authenticated", "anon" USING ("is_active");



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT ALL ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";


































































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_session_package_for_payment"("p_payment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_appointment_manage_token_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_appointment_manage_token_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_appointment_manage_token_lifecycle"() TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."appointment_actor"("p_appointment" "public"."appointments", "p_manage_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") TO "anon";
GRANT ALL ON FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") TO "authenticated";
GRANT ALL ON FUNCTION "public"."appointment_manage_token_is_active"("p_appointment" "public"."appointments") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text", "p_manage_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text", "p_manage_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text", "p_manage_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_appointment"("p_appointment_id" "uuid", "p_reason" "text", "p_manage_token_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_admin_audit_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_admin_audit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_admin_audit_log"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_rate_limit"("p_bucket" "text", "p_identifier" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_session_package_credit"("p_appointment_id" "uuid", "p_access_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_stale_holds"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_holds"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_stale_holds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_stale_holds"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_appointment_by_manage_token"("p_manage_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_package_by_token"("p_access_token_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hold_appointment"("p_service_id" "uuid", "p_therapist_id" "uuid", "p_session_mode" "public"."session_mode", "p_starts_at" timestamp with time zone, "p_client_name" "text", "p_client_email" "text", "p_client_phone" "text", "p_notes" "text", "p_manage_token_hash" "text", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hold_appointment"("p_service_id" "uuid", "p_therapist_id" "uuid", "p_session_mode" "public"."session_mode", "p_starts_at" timestamp with time zone, "p_client_name" "text", "p_client_email" "text", "p_client_phone" "text", "p_notes" "text", "p_manage_token_hash" "text", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hold_appointment"("p_service_id" "uuid", "p_therapist_id" "uuid", "p_session_mode" "public"."session_mode", "p_starts_at" timestamp with time zone, "p_client_name" "text", "p_client_email" "text", "p_client_phone" "text", "p_notes" "text", "p_manage_token_hash" "text", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_available_slots"("p_service_id" "uuid", "p_from" "date", "p_to" "date", "p_mode" "public"."session_mode") TO "anon";
GRANT ALL ON FUNCTION "public"."list_available_slots"("p_service_id" "uuid", "p_from" "date", "p_to" "date", "p_mode" "public"."session_mode") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_available_slots"("p_service_id" "uuid", "p_from" "date", "p_to" "date", "p_mode" "public"."session_mode") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_appointment_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_appointment_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_appointment_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_payment_status_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_payment_status_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_payment_status_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_section_audit"("p_entry_id" "uuid", "p_ops" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_section_audit"("p_entry_id" "uuid", "p_ops" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_section_audit"("p_entry_id" "uuid", "p_ops" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_security_event"("p_event_type" "text", "p_identifier" "text", "p_route" "text", "p_severity" "text", "p_details" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_appointment_status"("p_appointment_id" "uuid", "p_new_status" "public"."appointment_status") TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_payment_status"("p_reference" "text", "p_new_status" "public"."payment_status", "p_provider_reference" "text", "p_failed_reason" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_payment_status"("p_reference" "text", "p_new_status" "public"."payment_status", "p_provider_reference" "text", "p_failed_reason" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_status"("p_reference" "text", "p_new_status" "public"."payment_status", "p_provider_reference" "text", "p_failed_reason" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_appointment_hold_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_appointment_hold_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_appointment_hold_state"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_scheduled_content"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_scheduled_content"() TO "anon";
GRANT ALL ON FUNCTION "public"."publish_scheduled_content"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_scheduled_content"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_expired_rate_limits"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_expired_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_content_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_content_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_content_revision"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_payment_initiated"("p_appointment_id" "uuid", "p_provider" "public"."payment_provider", "p_reference" "text", "p_amount_kobo" bigint, "p_authorization_url" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_payment_initiated"("p_appointment_id" "uuid", "p_provider" "public"."payment_provider", "p_reference" "text", "p_amount_kobo" bigint, "p_authorization_url" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_payment_initiated"("p_appointment_id" "uuid", "p_provider" "public"."payment_provider", "p_reference" "text", "p_amount_kobo" bigint, "p_authorization_url" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."redirects_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."redirects_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."redirects_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text", "p_new_therapist_id" "uuid", "p_new_session_mode" "public"."session_mode") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text", "p_new_therapist_id" "uuid", "p_new_session_mode" "public"."session_mode") TO "anon";
GRANT ALL ON FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text", "p_new_therapist_id" "uuid", "p_new_session_mode" "public"."session_mode") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reschedule_appointment"("p_appointment_id" "uuid", "p_new_starts_at" timestamp with time zone, "p_manage_token_hash" "text", "p_new_therapist_id" "uuid", "p_new_session_mode" "public"."session_mode") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_content_revision"("p_revision_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_content_revision"("p_revision_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_content_revision"("p_revision_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_appointment_manage_token"("p_appointment_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON TABLE "public"."client_session_packages" TO "anon";
GRANT ALL ON TABLE "public"."client_session_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."client_session_packages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") TO "anon";
GRANT ALL ON FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_package_is_active"("p_package" "public"."client_session_packages") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_bank_transfer"("p_appointment_id" "uuid", "p_reference" "text", "p_amount_kobo" bigint, "p_transfer_note" "text", "p_receipt_path" "text", "p_manage_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_bank_transfer"("p_appointment_id" "uuid", "p_reference" "text", "p_amount_kobo" bigint, "p_transfer_note" "text", "p_receipt_path" "text", "p_manage_token_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_bank_transfer"("p_appointment_id" "uuid", "p_reference" "text", "p_amount_kobo" bigint, "p_transfer_note" "text", "p_receipt_path" "text", "p_manage_token_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_bank_transfer"("p_payment_id" "uuid", "p_approve" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_bank_transfer"("p_payment_id" "uuid", "p_approve" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_bank_transfer"("p_payment_id" "uuid", "p_approve" boolean, "p_note" "text") TO "service_role";
























GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_events" TO "anon";
GRANT ALL ON TABLE "public"."appointment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_events" TO "service_role";



GRANT ALL ON TABLE "public"."availability_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."availability_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."availability_rules" TO "anon";
GRANT ALL ON TABLE "public"."availability_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_rules" TO "service_role";



GRANT ALL ON TABLE "public"."client_notes" TO "anon";
GRANT ALL ON TABLE "public"."client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."contact_submissions" TO "anon";
GRANT ALL ON TABLE "public"."contact_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."content_entries" TO "anon";
GRANT ALL ON TABLE "public"."content_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."content_entries" TO "service_role";



GRANT ALL ON TABLE "public"."content_entry_media" TO "anon";
GRANT ALL ON TABLE "public"."content_entry_media" TO "authenticated";
GRANT ALL ON TABLE "public"."content_entry_media" TO "service_role";



GRANT ALL ON TABLE "public"."content_media" TO "anon";
GRANT ALL ON TABLE "public"."content_media" TO "authenticated";
GRANT ALL ON TABLE "public"."content_media" TO "service_role";



GRANT ALL ON TABLE "public"."content_revisions" TO "anon";
GRANT ALL ON TABLE "public"."content_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."content_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."email_delivery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."email_settings" TO "service_role";



GRANT ALL ON TABLE "public"."email_template_settings" TO "anon";
GRANT ALL ON TABLE "public"."email_template_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."email_template_settings" TO "service_role";



GRANT ALL ON TABLE "public"."faqs" TO "anon";
GRANT ALL ON TABLE "public"."faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."faqs" TO "service_role";



GRANT ALL ON TABLE "public"."google_oauth_settings" TO "service_role";



GRANT ALL ON TABLE "public"."intake_submissions" TO "anon";
GRANT ALL ON TABLE "public"."intake_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."migration_content_reviews" TO "anon";
GRANT ALL ON TABLE "public"."migration_content_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_content_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."payment_reviews" TO "anon";
GRANT ALL ON TABLE "public"."payment_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."payment_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."redirects" TO "anon";
GRANT ALL ON TABLE "public"."redirects" TO "authenticated";
GRANT ALL ON TABLE "public"."redirects" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_settings" TO "anon";
GRANT ALL ON TABLE "public"."reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_settings" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."security_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."security_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."security_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."therapist_google_connections" TO "service_role";



GRANT ALL ON TABLE "public"."therapist_services" TO "anon";
GRANT ALL ON TABLE "public"."therapist_services" TO "authenticated";
GRANT ALL ON TABLE "public"."therapist_services" TO "service_role";



GRANT ALL ON TABLE "public"."therapists" TO "anon";
GRANT ALL ON TABLE "public"."therapists" TO "authenticated";
GRANT ALL ON TABLE "public"."therapists" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































