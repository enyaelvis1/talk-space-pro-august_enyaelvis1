import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { notificationSuppressionReason } from "../src/lib/notification-policy.ts";

const never = async () => {
  throw new Error("Unexpected database lookup");
};
const sessionTemplates = [
  "booking_admin_notice",
  "booking_confirmation",
  "therapist_booking_notice",
  "booking_reminder_24h",
  "booking_reminder_1h",
  "reschedule_notice",
];

test("uncommitted, missing, archived and terminal bookings cannot send session notifications", async () => {
  for (const template of sessionTemplates) {
    for (const status of ["hold", "pending_payment", "cancelled", "completed", "no_show"]) {
      assert.equal(
        await notificationSuppressionReason(
          template,
          { reference: "TS-1", status: "confirmed" },
          async () => ({ status, archived_at: null }),
          never,
        ),
        "booking_not_committed",
      );
    }
    assert.equal(
      await notificationSuppressionReason(template, {}, never, never),
      "booking_not_committed",
    );
    assert.equal(
      await notificationSuppressionReason(template, { reference: "TS-1" }, async () => null, never),
      "booking_not_committed",
    );
    assert.equal(
      await notificationSuppressionReason(
        template,
        { reference: "TS-1" },
        async () => ({ status: "confirmed", archived_at: "2026-09-13" }),
        never,
      ),
      "booking_not_committed",
    );
  }
});

test("confirmed sessions remain eligible and current database state overrides old retry payloads", async () => {
  for (const template of sessionTemplates) {
    assert.equal(
      await notificationSuppressionReason(
        template,
        { reference: "TS-1", status: "hold" },
        async () => ({ status: "confirmed", archived_at: null }),
        never,
      ),
      null,
    );
  }
  await assert.rejects(
    notificationSuppressionReason("booking_admin_notice", { reference: "TS-1" }, never, never),
  );
});

test("booking form reminders and legacy unscoped retries stay blocked until approval", async () => {
  assert.equal(
    await notificationSuppressionReason(
      "form_reminder",
      { intakeSubmissionId: "one" },
      never,
      async () => ({ source: "booking", completion_state: "draft" }),
    ),
    "booking_reminders_awaiting_approval",
  );
  assert.equal(
    await notificationSuppressionReason(
      "form_reminder",
      { resumeUrl: "https://example.com/book" },
      never,
      never,
    ),
    "unscoped_form_reminder",
  );
  assert.equal(
    await notificationSuppressionReason(
      "form_reminder",
      { intakeSubmissionId: "missing" },
      never,
      async () => null,
    ),
    "unscoped_form_reminder",
  );
});

test("scoped contact form reminders are preserved but stop after completion", async () => {
  for (const state of ["draft", "in_progress", "completed"]) {
    assert.equal(
      await notificationSuppressionReason(
        "form_reminder",
        { intakeSubmissionId: "contact" },
        never,
        async () => ({ source: "contact", completion_state: state }),
      ),
      state === "completed" ? "form_already_completed" : null,
    );
  }
});

test("payment receipts, contact messages and account mail do not add booking queries", async () => {
  for (const template of [
    "payment_success",
    "payment_failed",
    "bank_transfer_received",
    "package_booking_link",
    "contact_ack",
    "contact_admin_notice",
    "password_reset",
  ]) {
    assert.equal(await notificationSuppressionReason(template, {}, never, never), null);
  }
});

test("single and group holds avoid notice work; manual and cron paths retain their guards", () => {
  const booking = readFileSync("src/lib/booking.functions.ts", "utf8");
  assert.match(
    booking,
    /if \(!packageCredit\) return;\s*if \(packageCredit\) await fireGoogleSync/,
  );
  const group = booking.slice(
    booking.indexOf("export const holdSlots ="),
    booking.indexOf("const tokenSchema"),
  );
  assert.doesNotMatch(group, /fireAdminBookingNotice|fireEmail|loadAppointmentContext/);
  assert.match(
    booking,
    /row.status !== "confirmed"[\s\S]*Reminders can only be sent for confirmed bookings/,
  );
  const intake = readFileSync("src/lib/email.functions.ts", "utf8");
  assert.match(
    intake,
    /submission.source === "booking"[\s\S]*Incomplete-booking reminders are disabled/,
  );
  assert.match(intake, /intakeSubmissionId: submission.id/);
  const cron = readFileSync("src/routes/api/public/hooks/send-reminders.ts", "utf8");
  assert.match(cron, /\.eq\("status", "confirmed"\)\s*\.is\("archived_at", null\)/);
  const sender = readFileSync("src/lib/email.server.ts", "utf8");
  assert.ok(
    sender.indexOf("const suppressed = await notificationSuppressionReason") <
      sender.indexOf(
        "const settings = await loadEmailSettings();",
        sender.indexOf("export async function sendTemplateEmail"),
      ),
  );
  assert.match(sender, /return sendTemplateEmail\(envelope.templateKey/);
  const admin = readFileSync("src/lib/admin.functions.ts", "utf8");
  assert.match(admin, /\.in\("status", \["sent", "failed", "skipped"\]\)/);
});
