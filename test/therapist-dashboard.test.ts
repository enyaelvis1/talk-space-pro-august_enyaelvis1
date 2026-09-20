import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260909200000_add_therapist_role.sql", "utf8");
const functions = readFileSync("src/lib/therapist.functions.ts", "utf8");
const route = readFileSync("src/routes/_authenticated.therapist.tsx", "utf8");
const callback = readFileSync("src/routes/api/public/google/callback.ts", "utf8");
const auth = readFileSync("src/lib/auth.ts", "utf8");
const server = readFileSync("src/lib/supabase-server.ts", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const adminFunctions = readFileSync("src/lib/admin.functions.ts", "utf8");
const adminTherapistsRoute = readFileSync("src/routes/_authenticated.admin.therapists.tsx", "utf8");
const siteHeader = readFileSync("src/components/site/SiteHeader.tsx", "utf8");
const accountRoute = readFileSync("src/routes/_authenticated.account.tsx", "utf8");
const loginRoute = readFileSync("src/routes/login.tsx", "utf8");
const resetPasswordRoute = readFileSync("src/routes/reset-password.tsx", "utf8");

function exportBody(source: string, name: string) {
  const start = source.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} export exists`);
  const next = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("therapist dashboard adds a dedicated therapist role", () => {
  assert.match(migration, /alter type public\.app_role add value if not exists 'therapist'/);
  assert.match(types, /app_role: "admin" \| "staff" \| "client" \| "therapist"/);
  assert.match(types, /app_role: \["admin", "staff", "client", "therapist"\]/);
  assert.match(auth, /export type AppRole = "admin" \| "staff" \| "client" \| "therapist"/);
});

test("therapist dashboard is protected and scoped to the linked therapist profile", () => {
  assert.match(server, /pathname\.startsWith\("\/therapist"\)/);
  assert.match(route, /createFileRoute\("\/_authenticated\/therapist"\)/);
  assert.match(route, /getTherapistDashboard/);

  const dashboardBody = exportBody(functions, "getTherapistDashboard");
  assert.match(dashboardBody, /requireTherapist\(\)/);
  assert.match(functions, /_role: "therapist"/);
  assert.match(functions, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(functions, /!therapist\.is_active/);
  assert.match(functions, /\.eq\("therapist_id", ctx\.therapistId\)/);
  assert.match(functions, /\.is\("archived_at", null\)/);
  assert.match(functions, /\.eq\("status", "confirmed"\)/);
  assert.match(functions, /client_email/);
  assert.match(functions, /client_phone/);
  assert.match(functions, /notes/);
});

test("hidden public therapist profiles can still use linked dashboard access", () => {
  assert.match(adminTherapistsRoute, /Show publicly/);
  assert.match(adminTherapistsRoute, /Hidden/);
  assert.match(functions, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(functions, /\.select\("id, full_name, role_title, image_url, is_active"\)/);
  assert.doesNotMatch(functions, /No active therapist profile is linked to this account/);
});

test("therapist Google connect starts from the signed-in therapist only", () => {
  const connectBody = exportBody(functions, "startTherapistGoogleConnect");
  assert.match(connectBody, /requireTherapist\(\)/);
  assert.match(connectBody, /signGoogleState\(ctx\.therapistId\)/);
  assert.match(connectBody, /buildGoogleAuthUrl/);
  assert.match(route, /startTherapistGoogleConnect/);
  assert.match(route, /Connect Google/);
  assert.match(callback, /return to Talk Space/);
});

test("therapists can disconnect only their own Google connection", () => {
  const disconnectBody = exportBody(functions, "disconnectTherapistGoogle");
  assert.match(disconnectBody, /requireTherapist\(\)/);
  assert.match(disconnectBody, /\.eq\("therapist_id", ctx\.therapistId\)/);
  assert.match(disconnectBody, /stopWatchCalendar/);
  assert.match(route, /disconnectTherapistGoogle/);
  assert.match(route, /Disconnect your Google Calendar/);
});

test("admins can invite and link therapist dashboard accounts", () => {
  const linkBody = exportBody(adminFunctions, "linkTherapistLogin");
  assert.match(linkBody, /inviteOrFindTherapistUser/);
  assert.match(adminFunctions, /\/reset-password\?invite=therapist&redirect=%2Ftherapist/);
  assert.match(linkBody, /\.from\("therapists"\)/);
  assert.match(linkBody, /user_id: userId/);
  assert.match(linkBody, /\.from\("user_roles"\)/);
  assert.match(linkBody, /role: "therapist"/);
  assert.match(adminTherapistsRoute, /linkTherapistLogin/);
  assert.match(adminTherapistsRoute, /Invite login|Login linked/);
});

test("admins can resend a fresh invitation to an existing therapist account", () => {
  const resendBody = exportBody(adminFunctions, "resendTherapistInvitation");
  assert.match(resendBody, /getUserById/);
  assert.match(resendBody, /type: "recovery"/);
  assert.match(resendBody, /therapist_account_invitation/);
  assert.match(resendBody, /Could not create a new therapist invitation link/);
  assert.match(adminTherapistsRoute, /resendTherapistInvitation/);
  assert.match(adminTherapistsRoute, /Resend invitation/);
});

test("new therapist invitations land on one-time password setup", () => {
  assert.match(adminFunctions, /auth\.admin\.generateLink/);
  assert.match(adminFunctions, /invite=therapist/);
  assert.match(resetPasswordRoute, /setInvite\(params\.get\("invite"\) === "therapist"\)/);
  assert.match(resetPasswordRoute, /Create your therapist login/);
  assert.match(resetPasswordRoute, /Create login/);
  assert.match(resetPasswordRoute, /getSafeRedirect/);
  assert.match(resetPasswordRoute, /navigate\(\{ to: redirectTo as never, replace: true \}\)/);
});

test("therapist users get a first-class dashboard link after sign-in", () => {
  assert.match(siteHeader, /hasBrowserRole\("therapist"\)/);
  assert.match(siteHeader, /accountHref = isTherapist \? "\/therapist" : "\/account"/);
  assert.match(siteHeader, /accountLabel = isTherapist \? "Dashboard" : "Account"/);
  assert.match(siteHeader, /to="\/therapist"/);
  assert.match(siteHeader, /\bTherapist\b/);
});

test("therapist users are kept out of the client account experience", () => {
  assert.match(accountRoute, /hasBrowserRole\("therapist"\)/);
  assert.match(accountRoute, /ROLE_CHECK_TIMEOUT_MS/);
  assert.match(accountRoute, /withTimeout\(hasBrowserRole\("therapist"\), false\)/);
  assert.match(accountRoute, /window\.location\.replace\("\/therapist"\)/);
  assert.match(accountRoute, /checkingDestination/);
  assert.match(loginRoute, /hasBrowserRole\("therapist"\)/);
  assert.match(loginRoute, /destination = "\/therapist"/);
});

test("therapist dashboard keeps access failures in the therapist workspace", () => {
  assert.match(route, /return \{ ok: true as const, data: await getTherapistDashboard\(\) \}/);
  assert.match(route, /return \{\s*ok: false as const,/);
  assert.match(route, /TherapistDashboardUnavailable/);
  assert.doesNotMatch(route, /href: "\/account\?error=forbidden"/);
});

test("therapist dashboard exposes calendar and meeting-link actions", () => {
  assert.match(route, /Calendar connection/);
  assert.match(route, /Real-time Google availability is unavailable/);
  assert.match(route, /Copy link/);
  assert.match(route, /navigator\.clipboard\.writeText/);
  assert.match(route, /Meet link pending/);
});
