import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const bin = process.env.PG_TEST_BIN ?? "/usr/lib/postgresql/16/bin";
const fix = "supabase/migrations/20261007100000_fix_paid_booking_expiry_review.sql";

test(
  "paid checkout expiry: real trigger order, delayed approval, conflicts and retries",
  {
    skip: existsSync(join(bin, "initdb")) ? false : "Set PG_TEST_BIN to local PostgreSQL binaries",
    timeout: 60000,
  },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "talkspace-paid-expiry-"));
    const dataDir = join(dir, "data");
    const args = ["-h", dir, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
    const sql = (query: string) =>
      execFileSync(join(bin, "psql"), [...args, "-c", query], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    const apply = (path: string) =>
      execFileSync(join(bin, "psql"), [...args, "-f", path], { stdio: "pipe" });
    let started = false;
    try {
      execFileSync(join(bin, "initdb"), ["-D", dataDir, "-A", "trust", "--no-locale"], {
        stdio: "pipe",
      });
      execFileSync(
        join(bin, "pg_ctl"),
        [
          "-D",
          dataDir,
          "-l",
          join(dir, "postgres.log"),
          "-o",
          `-F -k ${dir} -c listen_addresses=''`,
          "-w",
          "start",
        ],
        { stdio: "pipe" },
      );
      started = true;
      for (const path of [
        "test/fixtures/booking-integrity.sql",
        "test/fixtures/paid-booking-expiry.sql",
        "supabase/migrations/20260913110000_reserve_only_committed_bookings.sql",
        "supabase/migrations/20260913120000_incomplete_booking_token_lifecycle.sql",
        "supabase/migrations/20260917143000_retry_paid_booking_review.sql",
        "supabase/migrations/20260921200000_idempotent_reschedule_retry.sql",
        "supabase/migrations/20260924120000_client_feedback_booking_payment_guards.sql",
        "supabase/migrations/20260924130000_exclude_archived_bookings_from_slots.sql",
      ])
        apply(path);
      const t = sql("insert into therapists default values returning id").split("\n")[0];
      const other = sql("insert into therapists default values returning id").split("\n")[0];
      const s = sql("insert into services default values returning id").split("\n")[0];
      sql(`insert into therapist_services select id,'${s}' from therapists;
      insert into availability_rules(therapist_id,day_of_week,starts_at,ends_at,mode)
      select id,d,'08:00','20:00','online' from therapists cross join generate_series(0,6) d`);
      const day = sql("select (current_date+7)::text");
      const draft = (
        ref: string,
        hour: string,
        therapist = t,
        provider = "paystack",
        group?: string,
      ) => {
        const id = sql(`insert into appointments(therapist_id,service_id,starts_at,ends_at)
        values('${therapist}','${s}','${day} ${hour}+01','${day} ${hour}+01'::timestamptz+interval '1 hour') returning id`).split(
          "\n",
        )[0];
        sql(`insert into payments(appointment_id,reference,provider,checkout_group_reference,status)
        values('${id}','${ref}','${provider}',${group ? `'${group}'` : "null"},'${provider === "bank_transfer" ? "awaiting_confirmation" : "initiated"}')`);
        return id;
      };
      const age = (id: string) =>
        sql(
          `update appointments set created_at=now()-interval '10 minutes',manage_token_expires_at=now()-interval '5 minutes' where id='${id}'`,
        );
      const commit = (ref: string) => sql(`select mark_payment_status('${ref}','succeeded')`);
      const state = (id: string) => sql(`select status from appointments where id='${id}'`);
      const slot = (therapist: string, hour: string) =>
        sql(
          `select count(*) from list_available_slots('${s}','${day}','${day}','online') where therapist_id='${therapist}' and starts_at='${day} ${hour}+01'`,
        );
      const review = (ref: string) =>
        sql(
          `select coalesce(metadata->>'booking_review_required','false') from payments where reference='${ref}'`,
        );

      // Reproduce the exact old defect, not just a simulated UI message.
      const legacy = draft("TEST-LEGACY", "09:00");
      age(legacy);
      commit("TEST-LEGACY");
      assert.equal(state(legacy), "cancelled");
      assert.equal(
        sql(`select manage_token_revocation_reason from appointments where id='${legacy}'`),
        "checkout_expired",
      );
      assert.equal(
        review("TEST-LEGACY"),
        "false",
        "old RPC silently reported paid without review metadata",
      );

      apply(fix);
      apply(fix); // Application and metadata repair must be replay-safe.
      assert.equal(
        review("TEST-LEGACY"),
        "true",
        "legacy unarchived cancellations become reschedulable",
      );
      commit("TEST-LEGACY");
      assert.equal(state(legacy), "confirmed");
      assert.equal(review("TEST-LEGACY"), "false");
      assert.equal(
        sql(
          `select appointment_manage_token_is_active(a) from appointments a where id='${legacy}'`,
        ),
        "t",
      );
      const stable = sql(
        "select verified_at||':'||updated_at from payments where reference='TEST-LEGACY'",
      );
      const token = sql(`select manage_token_hash from appointments where id='${legacy}'`);
      commit("TEST-LEGACY");
      sql("select mark_payment_status('TEST-LEGACY','failed')");
      assert.equal(
        sql("select verified_at||':'||updated_at from payments where reference='TEST-LEGACY'"),
        stable,
      );
      assert.equal(sql(`select manage_token_hash from appointments where id='${legacy}'`), token);
      assert.equal(sql("select status from payments where reference='TEST-LEGACY'"), "succeeded");

      const delayed = draft("TEST-DELAYED", "10:00");
      age(delayed);
      commit("TEST-DELAYED");
      assert.equal(state(delayed), "confirmed", "deadline cannot silently cancel verified money");

      const bank = draft("TEST-BANK", "11:00", t, "bank_transfer");
      sql(`update appointments set status='pending_payment' where id='${bank}'`);
      age(bank);
      sql("select expire_stale_holds()");
      assert.equal(
        state(bank),
        "pending_payment",
        "submitted transfer must survive admin review delay",
      );
      assert.equal(slot(t, "11:00"), "1", "transfer awaiting approval does not reserve a slot");
      commit("TEST-BANK");
      assert.equal(state(bank), "confirmed");
      assert.equal(slot(t, "11:00"), "0");
      const rejected = draft("TEST-REJECT", "12:00", t, "bank_transfer");
      sql("select mark_payment_status('TEST-REJECT','failed')");
      age(rejected);
      sql("select expire_stale_holds()");
      assert.equal(state(rejected), "cancelled");
      assert.equal(slot(t, "12:00"), "1");

      const expired = draft("TEST-EXPIRED", "12:00");
      age(expired);
      sql("select expire_stale_holds()");
      assert.equal(state(expired), "cancelled");
      commit("TEST-EXPIRED");
      assert.equal(
        state(expired),
        "confirmed",
        "verified late callback revalidates an auto-expired future slot",
      );

      const intentional = draft("TEST-CANCEL", "13:00");
      sql(
        `update appointments set status='cancelled',cancelled_at=now(),cancelled_by=gen_random_uuid(),cancel_reason='synthetic admin cancellation' where id='${intentional}'`,
      );
      commit("TEST-CANCEL");
      assert.equal(state(intentional), "cancelled");
      assert.equal(review("TEST-CANCEL"), "true");
      sql("select mark_payment_status('TEST-CANCEL','failed')");
      assert.equal(
        sql("select status from payments where reference='TEST-CANCEL'"),
        "succeeded",
        "review must not allow a succeeded payment to become failed",
      );
      sql(`set test.actor_id='00000000-0000-0000-0000-000000000001';
      select * from reschedule_appointment('${intentional}','${day} 16:00+01')`);
      assert.equal(state(intentional), "confirmed", "admin rescheduling resolves the paid review");
      assert.equal(review("TEST-CANCEL"), "false");
      assert.equal(
        sql(
          `select appointment_manage_token_is_active(a) from appointments a where id='${intentional}'`,
        ),
        "t",
        "rescheduled paid cancellation receives a usable fresh manage token",
      );

      const archived = draft("TEST-ARCHIVE", "13:00");
      sql(`update appointments set archived_at=now() where id='${archived}'`);
      commit("TEST-ARCHIVE");
      assert.equal(state(archived), "hold");
      assert.equal(review("TEST-ARCHIVE"), "true", "archive does not imply fulfilment or refund");

      const group1 = draft("TEST-GROUP", "14:00", t, "paystack", "TEST-GROUP");
      const group2 = draft("TEST-GROUP-2", "11:00", t, "paystack", "TEST-GROUP");
      commit("TEST-GROUP");
      assert.equal(state(group1), "hold", "a group conflict must roll back every commitment");
      assert.equal(state(group2), "hold");
      assert.equal(review("TEST-GROUP"), "true");
      assert.equal(slot(t, "14:00"), "1");
      sql(
        `update appointments set status='cancelled',cancelled_at=now(),archived_at=now() where id='${bank}'`,
      );
      commit("TEST-GROUP");
      assert.equal(state(group1), "confirmed");
      assert.equal(state(group2), "confirmed");
      assert.equal(review("TEST-GROUP"), "false");
      assert.equal(review("TEST-GROUP-2"), "false");

      const race1 = draft("TEST-RACE-A", "15:00");
      const race2 = draft("TEST-RACE-B", "15:00");
      const otherId = draft("TEST-OTHER", "15:00", other);
      const run = promisify(execFile);
      await Promise.all(
        ["TEST-RACE-A", "TEST-RACE-B", "TEST-OTHER"].map((ref) =>
          run(join(bin, "psql"), [
            ...args,
            "-c",
            `select mark_payment_status('${ref}','succeeded')`,
          ]),
        ),
      );
      assert.equal(
        sql(
          `select count(*) from appointments where id in ('${race1}','${race2}') and status='confirmed'`,
        ),
        "1",
      );
      assert.equal(state(otherId), "confirmed");
      assert.equal(
        sql(
          "select count(*) from payments where reference like 'TEST-RACE-%' and metadata->>'booking_review_required'='true'",
        ),
        "1",
      );
      assert.equal(
        sql(
          "select has_function_privilege('authenticated','public.mark_payment_status(text,public.payment_status,text,text,jsonb)','execute')",
        ),
        "f",
      );
      assert.throws(
        () => sql("set role authenticated; select mark_payment_status('TEST-LEGACY','succeeded')"),
        /permission denied/,
      );
      assert.match(sql("select value from site_settings"), /existing-custom-image.jpg/);
    } finally {
      if (started)
        execFileSync(join(bin, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "-w", "stop"], {
          stdio: "pipe",
        });
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
