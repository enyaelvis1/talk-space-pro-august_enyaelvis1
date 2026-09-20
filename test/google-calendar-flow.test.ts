import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const googleServer = await readFile(
  new URL("../src/lib/google.server.ts", import.meta.url),
  "utf8",
);
const googleFunctions = await readFile(
  new URL("../src/lib/google.functions.ts", import.meta.url),
  "utf8",
);
const googleAdminRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.google.tsx", import.meta.url),
  "utf8",
);
const googleCallbackRoute = await readFile(
  new URL("../src/routes/api/public/google/callback.ts", import.meta.url),
  "utf8",
);
const googlePushRoute = await readFile(
  new URL("../src/routes/api/public/google/push.ts", import.meta.url),
  "utf8",
);

test("Google OAuth helpers keep offline consent and signed-state checks in place", () => {
  assert.match(googleServer, /access_type:\s*"offline"/);
  assert.match(googleServer, /prompt:\s*"consent"/);
  assert.match(googleServer, /include_granted_scopes:\s*"true"/);
  assert.match(googleAdminRoute, /OAuth client/);
  assert.match(googleAdminRoute, /Connect Google/);
  assert.match(googleAdminRoute, /saveSettings/);
  assert.match(googleAdminRoute, /setGoogleClientSecretFn/);
  assert.match(googleServer, /function stateKey\(\): Buffer/);
  assert.match(
    googleServer,
    /verifyGoogleState\(state: string\): \{ therapistId: string \} \| null/,
  );
  assert.match(googleServer, /if \(Number\(expiry\) < Date\.now\(\)\) return null;/);
  assert.match(googleServer, /verifyPushToken\(therapistId: string, token: string\): boolean/);
});

test("Google token and calendar API failures are surfaced or swallowed safely", () => {
  assert.match(googleServer, /if \(!res\.ok\) throw new Error\(`Google token exchange failed/);
  assert.match(googleServer, /class GoogleTokenRefreshError extends Error/);
  assert.match(googleServer, /parseGoogleTokenError\(text\)/);
  assert.match(googleServer, /err\.googleError === "invalid_grant"/);
  assert.match(googleServer, /markGoogleConnectionNeedsReconnect\(therapistId, message\)/);
  assert.match(googleServer, /access_token_ciphertext: null/);
  assert.match(googleServer, /refresh_token_ciphertext: null/);
  assert.match(googleServer, /if \(!res\.ok && res\.status !== 404 && res\.status !== 410\)/);
  assert.match(googleServer, /if \(!res\.ok\) throw new Error\(`Google createEvent failed/);
  assert.match(googleServer, /Google freeBusy failed/);
  assert.match(googleServer, /ACCESS_TOKEN_SCOPE_INSUFFICIENT/);
  assert.match(googleServer, /markGoogleConnectionNeedsReconnect\(therapistId, message\)/);
  assert.match(googleServer, /normalizeGoogleScopes/);
  assert.match(googleServer, /if \(!res\.ok && res\.status !== 404 && res\.status !== 410\)/);
  assert.match(googleFunctions, /syncAppointmentToGoogle\(appointmentId: string\): Promise<void>/);
  assert.match(googleFunctions, /if \(status === "confirmed"\)/);
  assert.match(googleFunctions, /if \(appt\.google_event_id\)/);
  assert.match(googleFunctions, /await createEventWithMeet\(/);
  assert.match(googleFunctions, /await patchEvent\(/);
  assert.match(googleFunctions, /await patchEvent\([\s\S]*?google_sync_error: null/);
  assert.match(googleFunctions, /await deleteEvent\(/);
  assert.match(googleFunctions, /google_meet_url/);
  assert.match(googleFunctions, /google_synced_at/);
  assert.match(googleFunctions, /google_sync_error/);
});

test("Admin Google page asks for reconnect when a saved token grant is no longer usable", () => {
  assert.match(googleAdminRoute, /Reconnect required/);
  assert.match(googleAdminRoute, /Previously connected/);
  assert.match(googleAdminRoute, /needsReconnect \? "Reconnect Google" : "Connect Google"/);
  assert.match(googleAdminRoute, /await reload\(\)/);
});

test("Calendar sync routes keep the callback and webhook recovery paths intact", () => {
  assert.match(googleFunctions, /retryAppointmentSync/);
  assert.match(googleFunctions, /google_sync_error/);
  assert.match(googleFunctions, /syncTherapistBusyBlocks\(data\.therapistId\)/);
  assert.match(googleCallbackRoute, /syncTherapistBusyBlocks/);
  assert.match(googleCallbackRoute, /watchCalendar/);
  assert.match(googlePushRoute, /verifyPushToken/);
  assert.match(googlePushRoute, /syncTherapistBusyBlocks/);
});
