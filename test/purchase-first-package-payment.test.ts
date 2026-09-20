import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const bin = process.env.PG_TEST_BIN ?? "/usr/lib/postgresql/16/bin";
const migrationPath = "supabase/migrations/20260913150000_purchase_first_package_payment.sql";
const sessionModeMigrationPath =
  "supabase/migrations/20260914101500_preserve_package_purchase_session_mode.sql";

test(
  "purchase-first package payment migration allows non-appointment package payments",
  {
    skip: existsSync(join(bin, "initdb")) ? false : "Set PG_TEST_BIN to local PostgreSQL binaries",
    timeout: 60000,
  },
  () => {
    assert.ok(existsSync(migrationPath), `Missing migration: ${migrationPath}`);
    assert.ok(
      existsSync(sessionModeMigrationPath),
      `Missing migration: ${sessionModeMigrationPath}`,
    );

    const dir = mkdtempSync(join(tmpdir(), "talkspace-package-purchase-"));
    const data = join(dir, "data");
    const args = ["-h", dir, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
    const sql = (query: string) =>
      execFileSync(join(bin, "psql"), [...args, "-c", query], { encoding: "utf8" }).trim();

    try {
      execFileSync(join(bin, "initdb"), ["-D", data, "-A", "trust", "--no-locale"], {
        stdio: "pipe",
      });
      execFileSync(
        join(bin, "pg_ctl"),
        [
          "-D",
          data,
          "-l",
          join(dir, "postgres.log"),
          "-o",
          `-F -k ${dir} -c listen_addresses=''`,
          "-w",
          "start",
        ],
        { stdio: "pipe" },
      );

      sql(`
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role service_role; exception when duplicate_object then null; end $$;
        create schema if not exists auth;
        create or replace function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid; $$;
        do $$ begin create type public.payment_status as enum ('initiated', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'refunded'); exception when duplicate_object then null; end $$;
        create extension if not exists pgcrypto;
        create table appointments (
          id uuid primary key default gen_random_uuid(),
          created_at timestamptz not null default now()
        );
        create table payments (
          id uuid primary key default gen_random_uuid(),
          appointment_id uuid references public.appointments(id) on delete cascade,
          provider text not null default 'paystack',
          reference text not null unique,
          provider_reference text,
          amount_kobo bigint not null check (amount_kobo >= 0),
          currency text not null default 'NGN' check (currency = 'NGN'),
          status text not null default 'initiated',
          metadata jsonb not null default '{}'::jsonb,
          verified_by uuid,
          verified_at timestamptz,
          failed_reason text,
          created_by uuid,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create table services (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          sessions_per_package integer not null default 1
        );
        create type public.session_mode as enum ('online', 'in_person');
        create type public.session_package_status as enum ('active', 'exhausted', 'expired', 'void');
        create table public.client_session_packages (
          id uuid primary key default gen_random_uuid(),
          client_id uuid,
          client_name text,
          client_email text,
          client_phone text,
          service_id uuid references public.services(id),
          session_mode public.session_mode,
          source_payment_id uuid unique references public.payments(id) on delete set null,
          purchased_sessions integer not null default 1 check (purchased_sessions > 0),
          used_sessions integer not null default 0 check (used_sessions >= 0),
          status public.session_package_status not null default 'active',
          access_token_hash text,
          access_token text,
          expires_at timestamptz,
          created_by uuid,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          check (used_sessions <= purchased_sessions)
        );
      `);

      execFileSync(join(bin, "psql"), [...args, "-f", migrationPath], { stdio: "pipe" });
      execFileSync(join(bin, "psql"), [...args, "-f", sessionModeMigrationPath], {
        stdio: "pipe",
      });

      assert.equal(
        sql(
          "select is_nullable from information_schema.columns where table_name = 'payments' and column_name = 'appointment_id'",
        ),
        "YES",
      );
      assert.match(
        sql(
          "select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'payment_kind'",
        ),
        /appointment,package_purchase/,
      );
      assert.equal(
        sql(
          "select has_function_privilege('authenticated', 'public.record_package_purchase_initiated(public.payment_provider,text,bigint,uuid,uuid,text,text,text,jsonb)', 'execute')",
        ),
        "f",
      );
      assert.equal(
        sql(
          "select has_function_privilege('service_role', 'public.record_package_purchase_initiated(public.payment_provider,text,bigint,uuid,uuid,text,text,text,jsonb)', 'execute')",
        ),
        "t",
      );
      const appointmentId = sql("insert into appointments default values returning id").split(
        "\n",
      )[0];

      assert.equal(
        sql(
          "insert into payments (appointment_id, payment_kind, provider, reference, amount_kobo) values (null, 'package_purchase', 'paystack', 'PKG-1', 25000) returning 1",
        ).split("\n")[0],
        "1",
      );
      assert.equal(
        sql(
          `insert into payments (appointment_id, payment_kind, provider, reference, amount_kobo) values ('${appointmentId}', 'appointment', 'paystack', 'APT-1', 25000) returning 1`,
        ).split("\n")[0],
        "1",
      );
      const serviceId = sql(
        "insert into services (name, sessions_per_package) values ('Therapy', 4) returning id",
      ).split("\n")[0];
      assert.equal(
        sql(`insert into payments (appointment_id, payment_kind, provider, reference, amount_kobo, metadata)
          values (null, 'package_purchase', 'paystack', 'PKG-2', 25000,
            '{"service_id":"${serviceId}","client_id":"00000000-0000-0000-0000-000000000001","client_name":"Jane","client_email":"jane@example.com","client_phone":"+2348000000000","purchased_sessions":4,"session_mode":"online"}'::jsonb)
          returning 1`).split("\n")[0],
        "1",
      );
      assert.equal(sql("select status from payments where reference = 'PKG-2'"), "initiated");
      assert.equal(
        sql("select payment_kind from payments where reference = 'PKG-2'"),
        "package_purchase",
      );
      assert.equal(
        sql("select appointment_id is null from payments where reference = 'PKG-2'"),
        "t",
      );
      assert.equal(
        sql(
          "select (public.mark_payment_status('PKG-2', 'succeeded'::public.payment_status)).status",
        ),
        "succeeded",
      );
      assert.equal(sql("select status from payments where reference = 'PKG-2'"), "succeeded");
      assert.equal(
        sql(
          "select count(*) from client_session_packages where source_payment_id=(select id from payments where reference='PKG-2')",
        ),
        "1",
      );
      assert.equal(
        sql(
          "select purchased_sessions from client_session_packages where source_payment_id=(select id from payments where reference='PKG-2')",
        ),
        "4",
      );
      assert.equal(
        sql(
          "select session_mode from client_session_packages where source_payment_id=(select id from payments where reference='PKG-2')",
        ),
        "online",
      );

      assert.equal(
        sql(`insert into payments (appointment_id, payment_kind, provider, reference, amount_kobo, metadata)
          values (null, 'package_purchase', 'paystack', 'PKG-3', 35000,
            '{"service_id":"${serviceId}","client_id":"00000000-0000-0000-0000-000000000002","client_name":"Alex","client_email":"alex@example.com","client_phone":"+2348000000001","purchased_sessions":5}'::jsonb)
          returning 1`).split("\n")[0],
        "1",
      );
      assert.equal(
        sql(
          "select (public.mark_payment_status('PKG-3', 'succeeded'::public.payment_status)).status",
        ),
        "succeeded",
      );
      assert.equal(
        sql(
          "select count(*) from client_session_packages where source_payment_id in (select id from payments where reference in ('PKG-2','PKG-3'))",
        ),
        "2",
      );
      assert.equal(
        sql(
          "select sum(purchased_sessions)::text from client_session_packages where source_payment_id in (select id from payments where reference in ('PKG-2','PKG-3'))",
        ),
        "9",
      );
    } finally {
      execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], {
        stdio: "pipe",
      });
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
