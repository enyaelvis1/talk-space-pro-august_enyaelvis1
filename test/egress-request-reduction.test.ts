import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createPublicReadCache } from "../src/lib/public-read-cache.ts";
import { claimAutomaticRouteRetry, routeRecoveryKey } from "../src/lib/route-recovery.ts";
import { startVisiblePolling } from "../src/lib/visible-polling.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("20 simultaneous public reads perform one load and expire after 60 seconds", async () => {
  let now = 0;
  let calls = 0;
  const cache = createPublicReadCache<string>(60_000, () => now);
  const load = async () => {
    calls++;
    return "published";
  };
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.get(load)));
  assert.deepEqual(new Set(values), new Set(["published"]));
  assert.equal(calls, 1);
  now = 59_999;
  await cache.get(load);
  assert.equal(calls, 1);
  now = 60_000;
  await cache.get(load);
  assert.equal(calls, 2);
});

test("failed public reads are not cached and the next request can recover", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error("quota unavailable");
  };
  const results = await Promise.allSettled([cache.get(fail), cache.get(fail)]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(cache.peek(), undefined);
  assert.equal(await cache.get(async () => "recovered"), "recovered");
});

test("public route recovery allows one automatic retry per error window", () => {
  const key = routeRecoveryKey("/", new Error("quota unavailable"));
  assert.equal(claimAutomaticRouteRetry(key, 0), true);
  assert.equal(claimAutomaticRouteRetry(key, 1), false);
  assert.equal(claimAutomaticRouteRetry(key, 30_001), true);
});

test("publishing during a pending read prevents old data repopulating the cache", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let resolveOld!: (value: string) => void;
  const old = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
  );
  await settle();
  cache.clear();
  assert.equal(await cache.get(async () => "new image"), "new image");
  resolveOld("old image");
  await old;
  assert.equal(cache.peek(), "new image");
  assert.equal(await cache.get(async () => "unexpected load"), "new image");
});

test("cache invalidation cannot let an old finalizer discard a newer pending request", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let resolveOld!: (value: string) => void;
  let resolveNew!: (value: string) => void;
  const old = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
  );
  await settle();
  cache.clear();
  const next = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveNew = resolve;
      }),
  );
  await settle();
  resolveOld("old");
  await old;
  assert.equal(
    cache.get(async () => "duplicate"),
    next,
  );
  resolveNew("new");
  await next;
});

test("background polling pauses when hidden, coalesces resume and stops on cleanup", async () => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let calls = 0;
  let finish!: () => void;
  const stop = startVisiblePolling(
    () => {
      calls++;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    30_000,
    {
      document: doc,
      setTimeout: (callback) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
    },
  );
  assert.equal(timers.size, 1);
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(timers.size, 0);
  assert.equal(calls, 0);
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  finish();
  await settle();
  assert.equal(timers.size, 1);
  const tick = [...timers.values()][0];
  tick();
  assert.equal(calls, 2);
  stop();
  finish();
  await settle();
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(timers.size, 0);
  assert.equal(calls, 2);
});

test("actual browser auth helper makes no Auth request for anonymous visits", async () => {
  const source = ts
    .transpileModule(read("src/lib/auth.ts"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace(/^import .*?;\s*$/gm, "");
  const prelude = `
    const getSupabaseBrowserClient = () => globalThis.__egressAuthClient;
    const isSupabaseConfigured = true;
    const hasProgressAccess = () => false;
    const redirect = (value) => value;
  `;
  const auth = await import(
    `data:text/javascript;base64,${Buffer.from(prelude + source).toString("base64")}`
  );
  const calls = { user: 0, logout: 0 };
  let session: unknown = null;
  const globals = globalThis as typeof globalThis & { __egressAuthClient?: unknown };
  globals.__egressAuthClient = {
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => {
        calls.user++;
        return { data: { user: { id: "user" } }, error: null };
      },
      signOut: async () => {
        calls.logout++;
      },
    },
  };
  try {
    for (let i = 0; i < 20; i++) assert.equal(await auth.getVerifiedBrowserSession(), null);
    assert.deepEqual(calls, { user: 0, logout: 0 });
    session = {
      expires_at: Date.now() / 1000 + 3600,
      user: { id: "user", last_sign_in_at: new Date().toISOString() },
    };
    assert.equal(await auth.getVerifiedBrowserSession(), session);
    assert.equal(calls.user, 1);
    session = { expires_at: Date.now() / 1000 - 10, user: { id: "user" } };
    assert.equal(await auth.getVerifiedBrowserSession(), null);
    assert.deepEqual(calls, { user: 1, logout: 1 });
  } finally {
    delete globals.__egressAuthClient;
  }
});

test("browser auth refresh is event and expiry driven instead of periodic polling", () => {
  const source = read("src/lib/browser-auth-state.ts");
  assert.doesNotMatch(source, /window\.setInterval/);
  assert.match(source, /BROWSER_ROLE_CACHE_MAX_AGE_MS = 60_000/);
  assert.match(source, /getBrowserRoles\(session, force\)/);
  assert.match(source, /now - roleCache\.checkedAt < BROWSER_ROLE_CACHE_MAX_AGE_MS/);
  assert.match(source, /onAuthStateChange/);
  assert.match(source, /TOKEN_REFRESHED/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /window\.setTimeout/);
});

test("protected server guards share request-scoped auth context", () => {
  const auth = read("src/lib/server-auth.ts");
  assert.match(auth, /new WeakMap<Request, Promise<RequestAuthContext \| null>>/);
  assert.match(auth, /roleChecks = new Map/);
  assert.match(auth, /contexts\.get\(request\)/);
  assert.match(auth, /TALKSPACE_AUTH_METRICS/);
  assert.match(auth, /X-Talkspace-Auth-User-Lookups/);
  assert.match(auth, /X-Talkspace-Auth-Role-Checks/);

  for (const path of [
    "src/lib/admin.functions.ts",
    "src/lib/payments.functions.ts",
    "src/lib/booking.functions.ts",
    "src/lib/google.functions.ts",
    "src/lib/email.functions.ts",
    "src/lib/therapist.functions.ts",
    "src/lib/availability.functions.ts",
    "src/lib/clients.functions.ts",
    "src/lib/progress.functions.ts",
  ]) {
    assert.match(read(path), /server-auth/);
  }
});

test("role-specific browser checks reuse an already verified session", () => {
  const auth = read("src/lib/auth.ts");
  const login = read("src/routes/login.tsx");
  assert.match(auth, /hasBrowserRoleForSession\(session, "admin"\)/);
  assert.doesNotMatch(
    auth.slice(auth.indexOf("export async function requireBrowserAdmin")),
    /hasBrowserRole\("admin"\)/,
  );
  assert.match(login, /hasBrowserRoleForSession\(verifiedSession, "admin"\)/);
  assert.match(login, /hasBrowserRoleForSession\(verifiedSession, "therapist"\)/);
  assert.doesNotMatch(login, /hasBrowserRole\(/);
});

test("homepage admin loader consolidates its initial settings reads", () => {
  const route = read("src/routes/_authenticated.admin.homepage.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminHomepageWorkspace\(\)/);
  assert.doesNotMatch(route, /Promise\.all\(\[\s*getAdminHomepage/);
  assert.match(admin, /export const getAdminHomepageWorkspace/);
  assert.match(admin, /\.in\("key", \["home_sections", "home_section_copy", "home_pricing"\]\)/);
});

test("Google admin loader consolidates settings and therapist connections", () => {
  const route = read("src/routes/_authenticated.admin.google.tsx");
  const google = read("src/lib/google.functions.ts");
  assert.match(route, /getGoogleAdminWorkspace\(\)/);
  assert.doesNotMatch(route, /Promise\.all\(\[\s*getGoogleAdmin/);
  assert.match(google, /export const getGoogleAdminWorkspace/);
  assert.match(google, /await requireAdmin\(\);[\s\S]*loadGoogleAdminSettings/);
});

test("settings loader consolidates site and footer reads", () => {
  const route = read("src/routes/_authenticated.admin.settings.tsx");
  const workspace = read("src/lib/admin-settings.functions.ts");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminSettingsWorkspace\(\)/);
  assert.doesNotMatch(route, /Promise\.all\(\[/);
  assert.match(workspace, /export const getAdminSettingsWorkspace/);
  assert.match(workspace, /requireRequestRole\("admin"\)/);
  assert.match(workspace, /import\("@\/lib\/email\.server"\)/);
  assert.match(workspace, /import\("@\/lib\/payments\.server"\)/);
  assert.match(workspace, /import\("@\/lib\/google\.server"\)/);
  assert.match(admin, /export const getAdminSiteSettingsWorkspace/);
  assert.match(admin, /\.in\("key", \["site_details", "footer_settings"\]\)/);
});

test("email admin loader consolidates its initial protected reads", () => {
  const route = read("src/routes/_authenticated.admin.emails.tsx");
  const email = read("src/lib/email.functions.ts");
  assert.match(route, /getEmailAdminWorkspace\(\)/);
  assert.match(email, /export const getEmailAdminWorkspace/);
  assert.match(email, /loadEmailAdminData\(\)/);
  assert.match(email, /loadEmailDeliveryLogs\(\)/);
  assert.match(email, /loadReminderSettings\(\)/);
});

test("admin dashboard consolidates today and upcoming appointment reads", () => {
  const route = read("src/routes/_authenticated.admin.index.tsx");
  const booking = read("src/lib/booking.functions.ts");
  assert.match(route, /getAdminAppointmentWorkspace\(\)/);
  assert.doesNotMatch(route, /listTodayAppointmentsForAdmin|listUpcomingAppointmentsForAdmin/);
  assert.match(booking, /export const getAdminAppointmentWorkspace/);
  assert.match(booking, /loadAdminAppointmentWindow\(bag, "today"\)/);
  assert.match(booking, /loadAdminAppointmentWindow\(bag, "upcoming"\)/);
});

test("admin dashboard consolidates summary and failure queue reads", () => {
  const route = read("src/routes/_authenticated.admin.index.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminOperationsWorkspace\(\)/);
  assert.doesNotMatch(route, /getAdminDashboardSummary|getAdminFailureQueues/);
  assert.match(admin, /export const getAdminOperationsWorkspace/);
  assert.match(admin, /loadAdminDashboardSummary\(bag\)/);
  assert.match(admin, /loadAdminFailureQueues\(bag\)/);
});

test("admin dashboard receives progress permission with the server payload", () => {
  const route = read("src/routes/_authenticated.admin.index.tsx");
  const progress = read("src/lib/progress.functions.ts");
  assert.match(route, /getAdminProgressWorkspace\(\)/);
  assert.doesNotMatch(route, /getVerifiedBrowserSession|hasProgressAccess/);
  assert.match(progress, /export const getAdminProgressWorkspace/);
  assert.match(progress, /canViewProgress: hasProgressAccess/);
});

test("admin services loader consolidates its initial service and therapist reads", () => {
  const route = read("src/routes/_authenticated.admin.services.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminServicesWorkspace()/);
  assert.doesNotMatch(route, /Promise\.all\(\[\s*listAdminServices\(\)/);
  assert.match(admin, /export const getAdminServicesWorkspace/);
  assert.match(admin, /loadAdminServices\(bag\)/);
  assert.match(admin, /loadAdminTherapists\(bag\)/);
});

test("admin forms loader consolidates templates and pending intake reads", () => {
  const route = read("src/routes/_authenticated.admin.forms.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminFormsWorkspace\(\)/);
  assert.doesNotMatch(route, /getAdminFormTemplates\(\)|listPendingIntakeSubmissions\(\)/);
  assert.match(admin, /export const getAdminFormsWorkspace/);
  assert.match(admin, /loadAdminFormTemplates\(bag\)/);
  assert.match(admin, /loadPendingIntakeSubmissions\(bag\)/);
});

test("content editor consolidates entry and category reads", () => {
  const route = read("src/routes/_authenticated.admin.content.$id.edit.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminContentEditWorkspace\(\{ data: \{ id \} \}\)/);
  assert.doesNotMatch(route, /Promise\.all\(\[/);
  assert.match(admin, /export const getAdminContentEditWorkspace/);
  assert.match(admin, /loadAdminContentEntry\(bag, data\.id\)/);
  assert.match(admin, /loadAdminCategories\(bag\)/);
});

test("audit loader consolidates audit and security reads with a fallback", () => {
  const route = read("src/routes/_authenticated.admin.audit.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /getAdminAuditWorkspace\(\)/);
  assert.doesNotMatch(route, /listAdminAuditLogs\(\)|listSecurityEvents\(\)/);
  assert.match(admin, /export const getAdminAuditWorkspace/);
  assert.match(admin, /loadAdminAuditLogs\(bag\)/);
  assert.match(admin, /loadSecurityEvents\(bag\)\.catch/);
});

test("client detail loader consolidates the record and assessment templates", () => {
  const route = read("src/routes/_authenticated.admin.clients.$clientId.tsx");
  const clients = read("src/lib/clients.functions.ts");
  assert.match(route, /getAdminClientDetailWorkspace/);
  assert.doesNotMatch(route, /Promise\.all\(\[/);
  assert.match(clients, /export const getAdminClientDetailWorkspace/);
  assert.match(clients, /loadAdminClientDetail\(client, data\.clientId\)/);
  assert.match(clients, /from\("site_settings"\)/);
});

test("client directory pagination and reminder batches are bounded", () => {
  const clients = read("src/lib/clients.functions.ts");
  const clientScreen = read("src/components/admin/AdminClients.tsx");
  const reminders = read("src/routes/api/public/hooks/send-reminders.ts");
  assert.match(clients, /const ADMIN_CLIENT_PAGE_SIZE = 100/);
  assert.match(clients, /\.range\(start, end\)/);
  assert.match(clients, /export const getAdminClientsPage/);
  assert.match(clientScreen, /getAdminClientsPage/);
  assert.match(clientScreen, /Load more clients/);
  assert.match(reminders, /\.limit\(100\)/);
});

test("payments loader consolidates settings, package setup, and payment reads", () => {
  const route = read("src/routes/_authenticated.admin.payments.tsx");
  const payments = read("src/lib/payments.functions.ts");
  assert.match(route, /getPaymentAdminWorkspace\(\)/);
  assert.doesNotMatch(route, /const \[setup, payments\] = await Promise\.all/);
  assert.match(payments, /export const getPaymentAdminWorkspace/);
  assert.match(payments, /const \[settings, packageServices, payments\] = await Promise\.all/);
  assert.match(payments, /async function loadPaymentsForAdmin/);
  assert.match(payments, /loadPaymentAdminData\(\)/);
  assert.match(payments, /loadPackageServicesForAdmin\(\)/);
});

test("admin media initial reads are paged and storage signing is bounded", () => {
  const route = read("src/routes/_authenticated.admin.media.tsx");
  const admin = read("src/lib/admin.functions.ts");
  assert.match(route, /listAdminMediaPage\(\{ data: \{ page: 1, pageSize: 100 \} \}\)/);
  assert.match(route, /Load more media/);
  assert.match(admin, /export const listAdminMediaPage/);
  assert.match(admin, /pageSize: z\.number\(\)\.int\(\)\.min\(20\)\.max\(100\)/);
  assert.match(admin, /\.range\(start, start \+ data\.pageSize - 1\)/);
});

test("authoritative private reads do not use the public read cache", () => {
  for (const path of [
    "src/lib/availability.functions.ts",
    "src/lib/booking.functions.ts",
    "src/lib/clients.functions.ts",
    "src/lib/payments.functions.ts",
    "src/lib/therapist.functions.ts",
  ]) {
    assert.doesNotMatch(read(path), /createPublicReadCache/);
  }
});

test("shell reuses root details and only public reads use the bounded cache", () => {
  for (const path of ["src/components/site/SiteHeader.tsx", "src/components/site/SiteFooter.tsx"]) {
    const source = read(path);
    assert.match(source, /from: "__root__"/);
    assert.doesNotMatch(source, /getPublicSiteDetails|getPublicFooterSettings/);
  }
  const root = read("src/routes/__root.tsx");
  const content = read("src/lib/content.functions.ts");
  assert.match(root, /loader: \(\) => getPublicShellData\(\)/);
  assert.match(content, /\.in\("key", \["site_details", "footer_settings"\]\)/);
  assert.match(content, /publicShellCache\.clear\(\)/);
  const admin = read("src/lib/admin.functions.ts");
  for (const name of ["updateAdminSiteDetails", "updateAdminFooterSettings"]) {
    const mutation = admin.slice(admin.indexOf(`export const ${name}`)).split("export const ")[1];
    assert.match(mutation, /if \(error\) throw error;\s*clearPublicSiteSettingsCache\(\)/);
  }
  for (const path of [
    "src/lib/auth.ts",
    "src/lib/booking.functions.ts",
    "src/lib/payments.functions.ts",
    "src/lib/therapist.functions.ts",
  ]) {
    assert.doesNotMatch(read(path), /createPublicReadCache/);
  }
});

test("public route error boundaries use bounded automatic recovery", () => {
  const root = read("src/routes/__root.tsx");
  const home = read("src/routes/index.tsx");
  assert.match(root, /claimAutomaticRouteRetry\(recoveryKey\)/);
  assert.match(root, /if \(!isPublic \|\| !willAutoRetry\) return/);
  assert.match(home, /claimAutomaticRouteRetry\("homepage"\)/);
  assert.match(home, /if \(!willAutoRetry\) return/);
});
