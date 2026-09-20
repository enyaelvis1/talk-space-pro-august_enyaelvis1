import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import test from "node:test";

const container =
  process.env.BK008_TEST_POSTGRES_CONTAINER ?? process.env.BK007_TEST_POSTGRES_CONTAINER;
const execAsync = promisify(execFile);

test("BK-008 schema and RPC source preserve therapist-specific slot identity", () => {
  const foundation = readFileSync(
    "supabase/migrations/20260715200000_booking_foundation.sql",
    "utf8",
  );
  assert.match(foundation, /exclude using gist\s*\(\s*therapist_id with =,/);
  const current = readFileSync(
    "supabase/migrations/20260913120000_incomplete_booking_token_lifecycle.sql",
    "utf8",
  );
  assert.match(current, /appointment.therapist_id = candidate.therapist_id/);
  const hold = readFileSync(
    "supabase/migrations/20260729160000_fix_booking_hold_insert_state.sql",
    "utf8",
  );
  assert.match(hold, /available.therapist_id = p_therapist_id/);
  const admin = readFileSync("src/routes/_authenticated.admin.bookings.tsx", "utf8");
  assert.match(admin, /editSlots.find\(\(slot\) => slotKey\(slot\) === editSlot\)/);
  assert.match(admin, /newTherapistId: selectedSlot.therapistId/);
  assert.doesNotMatch(admin, /editSlot === slot.startsAt/);
  const manage = readFileSync("src/routes/manage.$reference.tsx", "utf8");
  assert.match(
    manage,
    /s\.filter\(\(slot(?::\s*AvailableSlot)?\)\s*=>\s*slot\.therapistId === appointment\.therapistId\)/,
  );
});

test(
  "BK-008 real booking/payment RPCs and competing requests isolate therapists",
  { skip: !container, timeout: 30000 },
  async () => {
    const name = `bk008_test_${process.pid}_${Date.now()}`;
    const docker = (args: string[], input?: string) =>
      execFileSync("docker", ["exec", ...(input ? ["-i"] : []), container!, ...args], {
        input,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    const sql = (query: string) =>
      docker(["psql", "-U", "postgres", "-d", name, "-v", "ON_ERROR_STOP=1", "-At"], query);
    docker(["createdb", "-U", "postgres", name]);
    try {
      sql(
        [
          "test/fixtures/bk007-schema.sql",
          "supabase/migrations/20260810145500_manage_token_expiry_revocation.sql",
          "supabase/migrations/20260729103000_reconcile_appointment_hold_state.sql",
          "supabase/migrations/20260729160000_fix_booking_hold_insert_state.sql",
          "supabase/migrations/20260909143000_multi_slot_checkout_groups.sql",
          "supabase/migrations/20260913120000_incomplete_booking_token_lifecycle.sql",
          "supabase/migrations/20260902113000_align_booking_change_window.sql",
          "test/fixtures/bk008-assertions.sql",
        ]
          .map((path) => readFileSync(path, "utf8"))
          .join("\n"),
      );

      const compete = (therapist: string, time: string) =>
        execAsync("docker", [
          "exec",
          container!,
          "psql",
          "-U",
          "postgres",
          "-d",
          name,
          "-v",
          "ON_ERROR_STOP=1",
          "-At",
          "-c",
          `begin; select public.test_hold('11111111-1111-4111-8111-111111111111','${therapist}','2035-01-01 ${time}Z'); select pg_sleep(0.3); commit;`,
        ]);
      // Separate connections overlap their transactions; only therapist identity differs.
      const distinct = await Promise.allSettled([
        compete("22222222-2222-4222-8222-222222222221", "15:00"),
        compete("22222222-2222-4222-8222-222222222222", "15:00"),
      ]);
      assert.equal(
        distinct.filter((r) => r.status === "fulfilled").length,
        2,
        JSON.stringify(distinct),
      );
      const same = await Promise.allSettled([
        compete("22222222-2222-4222-8222-222222222221", "17:00"),
        compete("22222222-2222-4222-8222-222222222221", "17:00"),
      ]);
      assert.equal(same.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(same));
      const rejected = same.find((r) => r.status === "rejected") as PromiseRejectedResult;
      assert.match(String(rejected.reason.stderr), /slot_unavailable/);
      assert.equal(
        sql(
          "select count(*) from public.appointments where starts_at='2035-01-01 15:00Z' and status='hold';",
        ).trim(),
        "2",
      );
      assert.equal(
        sql(
          "select count(*) from public.appointments where starts_at='2035-01-01 17:00Z' and status='hold';",
        ).trim(),
        "1",
      );
    } finally {
      docker(["dropdb", "-U", "postgres", name]);
    }
  },
);
