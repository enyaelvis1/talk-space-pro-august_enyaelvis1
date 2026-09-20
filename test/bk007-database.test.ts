import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// Opt-in: creates and drops only a uniquely named, disposable local database.
const container = process.env.BK007_TEST_POSTGRES_CONTAINER;
test(
  "BK-007 lifecycle and slot cleanup execute correctly in PostgreSQL",
  { skip: !container },
  () => {
    const name = `bk007_test_${process.pid}_${Date.now()}`;
    const docker = (args: string[], input?: string) =>
      execFileSync("docker", ["exec", ...(input ? ["-i"] : []), container!, ...args], {
        input,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    docker(["createdb", "-U", "postgres", name]);
    try {
      const files = [
        "test/fixtures/bk007-schema.sql",
        "supabase/migrations/20260810145500_manage_token_expiry_revocation.sql",
        "supabase/migrations/20260729103000_reconcile_appointment_hold_state.sql",
        "supabase/migrations/20260909143000_multi_slot_checkout_groups.sql",
        "supabase/migrations/20260913120000_incomplete_booking_token_lifecycle.sql",
        "test/fixtures/bk007-assertions.sql",
      ];
      const output = docker(
        ["psql", "-U", "postgres", "-d", name, "-v", "ON_ERROR_STOP=1"],
        files.map((path) => readFileSync(path, "utf8")).join("\n"),
      );
      assert.ok(output.includes("check_true"));
    } finally {
      docker(["dropdb", "-U", "postgres", name]);
    }
  },
);
