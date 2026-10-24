import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deliverClaimedReminder,
  reminderDeliveryOutcome,
  reminderRecipientPending,
} from "../src/lib/reminder-delivery.ts";
import type { SendResult } from "../src/lib/email.server.ts";

const sent: SendResult = { sent: true, providerId: "mock-provider", logId: "mock-log" };
const skipped = (reason: string): SendResult => ({ sent: false, reason, logId: "mock-log" });

test("a delivered client reminder does not suppress a failed partner retry", () => {
  const stamp = "2026-10-24T12:00:00.000Z";
  assert.equal(reminderRecipientPending("client", stamp), false);
  assert.equal(reminderRecipientPending("partner", stamp), true);
  assert.equal(reminderRecipientPending("client", null), true);
});

function fixture() {
  const claims = new Set<string>();
  const sentClaims = new Set<string>();
  const stamps: string[] = [];
  const sends: string[] = [];
  const finalizes: boolean[] = [];
  let result: SendResult = sent;
  let sendError: Error | null = null;
  let stampError = false;
  async function deliver(recipient: "client" | "partner" = "client") {
    return deliverClaimedReminder({
      recipient,
      claim: async () => {
        if (claims.has(recipient) || sentClaims.has(recipient)) return false;
        claims.add(recipient);
        return true;
      },
      send: async () => {
        sends.push(recipient);
        if (sendError) throw sendError;
        return result;
      },
      finalize: async (ok) => {
        finalizes.push(ok);
        claims.delete(recipient);
        if (ok) sentClaims.add(recipient);
      },
      stampClient: async (stamp) => {
        if (stampError) throw new Error("stamp failed");
        stamps.push(stamp);
      },
      now: () => "2026-10-24T12:00:00.000Z",
    });
  }
  return {
    deliver,
    stamps,
    sends,
    finalizes,
    setResult: (r: SendResult) => {
      result = r;
    },
    setError: (e: Error | null) => {
      sendError = e;
    },
    failStamp: () => {
      stampError = true;
    },
  };
}

test("mocked old predicate reproduces the timestamp inconsistency", () => {
  const oldStamps = (sent: boolean, reason?: string) =>
    (!sent || reason === "emails_disabled" || reason === "template_disabled") &&
    (sent || reason === "emails_disabled" || reason === "template_disabled");
  assert.equal(oldStamps(true), false);
  assert.equal(oldStamps(false, "emails_disabled"), true);
});
test("a sent primary reminder stamps once and a repeated claim never resends", async () => {
  const f = fixture();
  assert.equal((await f.deliver()).sent, true);
  assert.deepEqual(f.stamps, ["2026-10-24T12:00:00.000Z"]);
  assert.equal(reminderDeliveryOutcome(await f.deliver()), "skipped");
  assert.deepEqual(f.sends, ["client"]);
});
test("partner claims remain independent and never stamp the primary client", async () => {
  const f = fixture();
  await f.deliver("partner");
  assert.deepEqual(f.stamps, []);
  await f.deliver("client");
  assert.deepEqual(f.sends, ["partner", "client"]);
  assert.equal(f.stamps.length, 1);
  await f.deliver("partner");
  assert.equal(f.sends.length, 2);
});
test("skipped, suppressed and failed delivery are not marked sent and remain retryable", async () => {
  for (const [reason, outcome] of [
    ["emails_disabled", "skipped"],
    ["template_disabled", "skipped"],
    ["booking_not_committed", "suppressed"],
    ["provider_failure", "failed"],
  ]) {
    const f = fixture();
    f.setResult(skipped(reason));
    assert.equal(reminderDeliveryOutcome(await f.deliver()), outcome);
    assert.deepEqual(f.stamps, []);
    assert.deepEqual(f.finalizes, [false]);
    f.setResult(sent);
    await f.deliver();
    assert.equal(f.stamps.length, 1);
  }
});
test("a thrown provider error releases the claim without stamping", async () => {
  const f = fixture();
  f.setError(new Error("mock outage"));
  await assert.rejects(f.deliver(), /mock outage/);
  assert.deepEqual(f.stamps, []);
  assert.deepEqual(f.finalizes, [false]);
  f.setError(null);
  await f.deliver();
  assert.equal(f.stamps.length, 1);
});
test("timestamp failure surfaces without releasing an already sent claim", async () => {
  const f = fixture();
  f.failStamp();
  await assert.rejects(f.deliver(), /stamp failed/);
  await f.deliver();
  assert.deepEqual(f.sends, ["client"]);
  assert.deepEqual(f.finalizes, [true]);
});
test("production route wires isolated helper to recipient-specific claims and checks update errors", () => {
  const route = readFileSync(
    new URL("../src/routes/api/public/hooks/send-reminders.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /return deliverClaimedReminder\(/);
  assert.match(route, /reminderRecipientPending\(recipient, clientSentAt\)/);
  assert.match(route, /outcome: reminderDeliveryOutcome\(result\)/);
  assert.doesNotMatch(route, /!row\.reminder_(?:24h|1h)_sent_at && minutesUntil/);
  assert.match(route, /p_recipient_role: recipient/);
  assert.match(route, /\$\{key\}:partner/);
  assert.match(route, /if \(result\.error\) throw result\.error/);
  assert.doesNotMatch(route, /resultReason === "emails_disabled"/);
});
