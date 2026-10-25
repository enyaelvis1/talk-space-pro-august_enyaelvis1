import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { googleConnectionHealth } from "../src/lib/google-connection-health.ts";

const now = Date.parse("2026-10-24T12:00:00Z");
const valid = {
  connected: true,
  watchExpiresAt: "2026-10-27T12:00:00Z",
  lastSyncError: null,
  failingAppointmentCount: 0,
};

test("valid watches are healthy; expired or exact-expiry watches never are", () => {
  assert.equal(googleConnectionHealth(valid, now).state, "healthy");
  for (const watchExpiresAt of ["2026-10-23T12:00:00Z", "2026-10-24T12:00:00Z"]) {
    assert.equal(googleConnectionHealth({ ...valid, watchExpiresAt }, now).state, "expired");
  }
});
test("missing, malformed and near-expiry watches need renewal", () => {
  for (const watchExpiresAt of [null, "invalid", "2026-10-25T12:00:00Z"]) {
    const health = googleConnectionHealth({ ...valid, watchExpiresAt }, now);
    assert.equal(health.state, "renewal_needed");
    assert.notEqual(health.label, "Healthy");
  }
});
test("disconnection and recorded failures are distinguished from expiry", () => {
  assert.equal(googleConnectionHealth({ ...valid, connected: false }, now).state, "disconnected");
  assert.equal(
    googleConnectionHealth({ ...valid, lastSyncError: "sync_failed" }, now).state,
    "failed",
  );
  assert.equal(
    googleConnectionHealth({ ...valid, failingAppointmentCount: 1 }, now).state,
    "failed",
  );
});
test("admin badges use expiry-aware health without starting a Google watch", () => {
  const route = readFileSync(
    new URL("../src/routes/_authenticated.admin.google.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /const health = googleConnectionHealth\(c, healthNow\)/);
  assert.match(route, /window\.clearInterval\(timer\)/);
  assert.match(route, /document\.removeEventListener\("visibilitychange", tick\)/);
  assert.match(route, /health\.label/);
  assert.match(route, /health\.guidance/);
  assert.doesNotMatch(route, /startTherapistWatch/);
});
