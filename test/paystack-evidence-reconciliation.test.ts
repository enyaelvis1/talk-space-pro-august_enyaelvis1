import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSignals,
  reconcilePaystackEvidence,
  stableHash,
} from "../scripts/reconcile-paystack-evidence.mjs";

test("reconciliation classifies application-linked and provider-only references without exposing identifiers", () => {
  const report = reconcilePaystackEvidence({
    providerRows: [
      {
        reference: "TSP-LINKED",
        amount: "104.06",
        email: "client@example.test",
        ip_address: "203.0.113.10",
      },
      {
        reference: "DIRECT-ONLY",
        amount: "104.06",
        email: "other@example.test",
        ip_address: "203.0.113.10",
      },
      {
        reference: "DIRECT-ONLY-2",
        amount: "104.06",
        email: "third@example.test",
        ip_address: "203.0.113.10",
      },
    ],
    applicationRows: [{ provider_reference: "TSP-LINKED" }],
  });

  assert.deepEqual(report.classifications, {
    application_linked: 1,
    provider_only: 2,
    missing_reference: 0,
  });
  assert.deepEqual(report.repeated_amounts, [{ value: "104.06", count: 3 }]);
  assert.deepEqual(report.repeated_ip_hashes, [{ value: stableHash("203.0.113.10"), count: 3 }]);
  assert.equal(JSON.stringify(report).includes("client@example.test"), false);
  assert.equal(JSON.stringify(report).includes("TSP-LINKED"), false);
});

test("reconciliation records missing references without treating them as application payments", () => {
  const report = reconcilePaystackEvidence({
    providerRows: [{ amount: "100.00", customer_email: "masked@example.test" }],
    applicationRows: [],
  });

  assert.deepEqual(report.classifications, {
    application_linked: 0,
    provider_only: 0,
    missing_reference: 1,
  });
  assert.equal(report.rows[0].reference_hash, null);
});

test("offline detection flags low-value and provider-only bursts using hashed identities", () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({
    classification: "provider_only",
    amount: "104.06",
    status: "success",
    timestamp: `2026-10-12T04:0${index}:00Z`,
    email_hash: stableHash(`client-${index}@example.test`),
    ip_hash: stableHash("203.0.113.20"),
  }));

  const signals = detectSignals(rows, { lowValueCount: 3, identityCount: 3 });

  assert.ok(signals.some((signal) => signal.type === "low_value_success_burst"));
  assert.ok(signals.some((signal) => signal.type === "provider_only_burst"));
  assert.ok(signals.some((signal) => signal.type === "ip_activity_burst"));
  assert.equal(JSON.stringify(signals).includes("203.0.113.20"), false);
});
