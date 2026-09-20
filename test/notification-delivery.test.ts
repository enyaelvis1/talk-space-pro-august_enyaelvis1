import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

test(
  "real email sender suppresses incomplete notices and retries before contacting provider",
  { timeout: 30000 },
  async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "ni001-email-"));
    const key = Symbol.for("ni001.test.database");
    const globals = globalThis as unknown as Record<symbol, unknown>;
    const logs: Record<string, unknown>[] = [];
    const queries: string[] = [];
    let status = "hold";
    let encryptedRetry = "";
    const oldKey = process.env.EMAIL_SETTINGS_ENC_KEY;
    process.env.EMAIL_SETTINGS_ENC_KEY = "ni001-disposable-test-key";
    globals[key] = {
      from(table: string) {
        queries.push(table);
        let inserted: Record<string, unknown> | undefined;
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          insert(row: Record<string, unknown>) {
            inserted = row;
            logs.push(row);
            return query;
          },
          update() {
            return query;
          },
          async single() {
            assert.ok(inserted);
            return { data: { id: `log-${logs.length}` }, error: null };
          },
          async maybeSingle() {
            if (table === "appointments")
              return { data: { status, archived_at: null }, error: null };
            if (table === "intake_submissions")
              return { data: { source: "booking", completion_state: "draft" }, error: null };
            if (table === "email_delivery_logs")
              return {
                data: {
                  id: "old-failure",
                  status: "failed",
                  retry_count: 0,
                  retry_payload_ciphertext: encryptedRetry,
                },
                error: null,
              };
            // Eligible mail reaches settings; intentionally disable real delivery.
            if (table === "email_settings") return { data: { is_enabled: false }, error: null };
            throw new Error(`Unexpected query: ${table}`);
          },
        };
        return query;
      },
    };
    const server = await createServer({
      configFile: false,
      cacheDir,
      envFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false },
      resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
      plugins: [
        {
          name: "ni001-isolated-database",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("/integrations/supabase/client.server")) return "\0ni001-db";
          },
          load(id) {
            if (id === "\0ni001-db")
              return 'export const supabaseAdmin = globalThis[Symbol.for("ni001.test.database")];';
          },
        },
      ],
    });
    try {
      const sender = await server.ssrLoadModule("/src/lib/email.server.ts");
      const blocked = await sender.sendTemplateEmail("booking_admin_notice", "staff@example.test", {
        reference: "TEST-1",
        status: "confirmed",
      });
      assert.equal(blocked.reason, "booking_not_committed");
      assert.equal(logs[0].status, "skipped");
      assert.deepEqual(queries, ["appointments", "email_delivery_logs"]);
      encryptedRetry = sender.encryptApiKey(
        JSON.stringify({
          kind: "template",
          templateKey: "booking_admin_notice",
          recipient: "staff@example.test",
          data: { reference: "TEST-1", status: "confirmed" },
        }),
      );
      const retry = await sender.retryLoggedEmail("old-failure", { trigger: "automatic" });
      assert.equal(retry.reason, "booking_not_committed");
      assert.equal(logs.at(-1)?.retried_from, "old-failure");
      assert.equal(logs.at(-1)?.next_retry_at, null);
      assert.equal(queries.includes("email_settings"), false);
      const form = await sender.sendTemplateEmail("form_reminder", "client@example.test", {
        intakeSubmissionId: "test-intake",
      });
      assert.equal(form.reason, "booking_reminders_awaiting_approval");
      status = "confirmed";
      const eligible = await sender.sendTemplateEmail(
        "booking_admin_notice",
        "staff@example.test",
        { reference: "TEST-1" },
      );
      assert.equal(eligible.reason, "emails_disabled");
      assert.equal(queries.includes("email_settings"), true);
    } finally {
      await server.close();
      delete globals[key];
      if (oldKey === undefined) delete process.env.EMAIL_SETTINGS_ENC_KEY;
      else process.env.EMAIL_SETTINGS_ENC_KEY = oldKey;
      rmSync(cacheDir, { recursive: true, force: true });
    }
  },
);
