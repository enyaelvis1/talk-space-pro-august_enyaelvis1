import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const bin = process.env.PG_TEST_BIN ?? "/usr/lib/postgresql/16/bin";
const migration = "supabase/migrations/20260913110000_reserve_only_committed_bookings.sql";

test(
  "payment commitment migration: isolated PostgreSQL behavior and concurrency",
  {
    skip: existsSync(join(bin, "initdb")) ? false : "Set PG_TEST_BIN to local PostgreSQL binaries",
    timeout: 60000,
  },
  async () => {
    // Own disposable cluster, never the application's configured database.
    const dir = mkdtempSync(join(tmpdir(), "talkspace-integrity-"));
    const data = join(dir, "data");
    const args = ["-h", dir, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
    const sql = (query: string) =>
      execFileSync(join(bin, "psql"), [...args, "-c", query], { encoding: "utf8" }).trim();
    let started = false;
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
      started = true;
      for (const file of ["test/fixtures/booking-integrity.sql", migration, migration]) {
        execFileSync(join(bin, "psql"), [...args, "-f", file], { stdio: "pipe" });
      }
      assert.match(sql("select value from site_settings"), /existing-custom-image.jpg/);
      assert.equal(
        sql(
          "select has_function_privilege('authenticated','public.mark_payment_status(text, public.payment_status, text, text, jsonb)','execute')",
        ),
        "f",
      );
      const t1 = sql("insert into therapists default values returning id").split("\n")[0];
      const t2 = sql("insert into therapists default values returning id").split("\n")[0];
      const s1 = sql("insert into services default values returning id").split("\n")[0];
      const s2 = sql("insert into services default values returning id").split("\n")[0];
      sql(`insert into therapist_services select t.id,s.id from therapists t cross join services s;
      insert into availability_rules (therapist_id,day_of_week,starts_at,ends_at,mode)
      select t.id,d,'08:00','20:00','online' from therapists t cross join generate_series(0,6) d`);
      const day = sql("select (current_date + 7)::text");
      const createDraft = (
        therapist: string,
        hour: string,
        reference: string,
        service = s1,
        group?: string,
      ) => {
        const id = sql(`insert into appointments (therapist_id,service_id,starts_at,ends_at)
        values ('${therapist}','${service}','${day} ${hour}+01','${day} ${hour}+01'::timestamptz + interval '1 hour') returning id`).split(
          "\n",
        )[0];
        sql(`insert into payments (appointment_id,reference,checkout_group_reference)
        values ('${id}','${reference}',${group ? `'${group}'` : "null"})`);
        return id;
      };
      const slots = (therapist: string, hour: string) =>
        sql(`select count(*) from list_available_slots('${s1}','${day}','${day}','online')
      where therapist_id='${therapist}' and starts_at='${day} ${hour}+01'`);
      const first = createDraft(t1, "09:00", "FIRST");
      createDraft(t1, "09:00", "SECOND");
      assert.equal(slots(t1, "09:00"), "1", "unpaid drafts must not reserve a slot");
      sql("select mark_payment_status('FIRST','succeeded')");
      assert.equal(slots(t1, "09:00"), "0");
      assert.equal(slots(t2, "09:00"), "1", "other therapist stays available");
      createDraft(t2, "09:00", "OTHER", s2);
      sql(
        "select mark_payment_status('OTHER','succeeded'); select mark_payment_status('SECOND','succeeded')",
      );
      assert.equal(
        sql(
          "select status || ':' || (metadata->>'booking_review_required') from payments where reference='SECOND'",
        ),
        "succeeded:true",
      );
      assert.equal(
        sql(
          "select count(*) from activate_session_package_for_payment((select id from payments where reference='SECOND'))",
        ),
        "0",
      );
      assert.equal(
        sql(
          "select remaining_sessions from activate_session_package_for_payment((select id from payments where reference='FIRST'))",
        ),
        "3",
      );
      sql(
        "select mark_payment_status('FIRST','failed'); select mark_payment_status('FIRST','succeeded')",
      );
      assert.equal(sql("select status from payments where reference='FIRST'"), "succeeded");
      assert.equal(
        sql(
          "select used_sessions from client_session_packages where source_payment_id=(select id from payments where reference='FIRST')",
        ),
        "1",
      );
      createDraft(t1, "11:00", "GROUP", s1, "GROUP");
      createDraft(t1, "09:00", "GROUP-2", s1, "GROUP");
      sql("select mark_payment_status('GROUP-2','succeeded')");
      assert.equal(
        sql(
          "select count(*) from payments where checkout_group_reference='GROUP' and status='succeeded' and metadata->>'booking_review_required'='true'",
        ),
        "2",
      );
      assert.equal(
        slots(t1, "11:00"),
        "1",
        "a partially conflicting checkout confirms none of its drafts",
      );
      createDraft(t1, "13:00", "RACE-A");
      createDraft(t1, "13:00", "RACE-B");
      const run = promisify(execFile);
      await Promise.all(
        ["RACE-A", "RACE-B"].map((ref) =>
          run(join(bin, "psql"), [
            ...args,
            "-c",
            `select mark_payment_status('${ref}','succeeded')`,
          ]),
        ),
      );
      assert.equal(
        sql("select count(*) from payments where reference like 'RACE-%' and status='succeeded'"),
        "2",
      );
      assert.equal(
        sql(
          "select count(*) from payments where reference like 'RACE-%' and metadata->>'booking_review_required'='true'",
        ),
        "1",
      );
      assert.equal(
        sql(
          `select count(*) from appointments where therapist_id='${t1}' and starts_at='${day} 13:00+01' and status='confirmed'`,
        ),
        "1",
      );
      sql(`update appointments set starts_at='${day} 15:00+01',ends_at='${day} 16:00+01',status='confirmed'
      where id=(select appointment_id from payments where reference='SECOND')`);
      assert.equal(
        sql(
          "select coalesce(metadata->>'booking_review_required','false') from payments where reference='SECOND'",
        ),
        "false",
      );
      sql(`update appointments set archived_at=now() where id='${first}'`);
      assert.equal(slots(t1, "09:00"), "1");
    } finally {
      if (started)
        execFileSync(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], {
          stdio: "pipe",
        });
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
