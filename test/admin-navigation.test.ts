import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const sidebar = await readFile(
  new URL("../src/components/progress/AdminSidebar.tsx", import.meta.url),
  "utf8",
);
const adminRoot = await readFile(
  new URL("../src/routes/_authenticated.admin.tsx", import.meta.url),
  "utf8",
);
const dashboard = await readFile(
  new URL("../src/routes/_authenticated.admin.index.tsx", import.meta.url),
  "utf8",
);
const clients = await readFile(
  new URL("../src/routes/_authenticated.admin.clients.index.tsx", import.meta.url),
  "utf8",
);
const adminOverview = await readFile(
  new URL("../src/components/progress/AdminOverview.tsx", import.meta.url),
  "utf8",
);
const adminFunctions = await readFile(
  new URL("../src/lib/admin.functions.ts", import.meta.url),
  "utf8",
);
const bookings = await readFile(
  new URL("../src/routes/_authenticated.admin.bookings.tsx", import.meta.url),
  "utf8",
);
const messages = await readFile(
  new URL("../src/routes/_authenticated.admin.messages.tsx", import.meta.url),
  "utf8",
);
const newBooking = await readFile(
  new URL("../src/routes/_authenticated.admin.bookings.new.tsx", import.meta.url),
  "utf8",
);
const adminBookingMigration = await readFile(
  new URL("../supabase/migrations/20260918100000_admin_create_booking.sql", import.meta.url),
  "utf8",
);
const bookingFunctions = await readFile(
  new URL("../src/lib/booking.functions.ts", import.meta.url),
  "utf8",
);
const dateInput = await readFile(
  new URL("../src/components/ui/date-input.tsx", import.meta.url),
  "utf8",
);
const settings = await readFile(
  new URL("../src/routes/_authenticated.admin.settings.tsx", import.meta.url),
  "utf8",
);
const homepageAdmin = await readFile(
  new URL("../src/routes/_authenticated.admin.homepage.tsx", import.meta.url),
  "utf8",
);
const homepage = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const siteFooter = await readFile(
  new URL("../src/components/site/SiteFooter.tsx", import.meta.url),
  "utf8",
);
const contentFunctions = await readFile(
  new URL("../src/lib/content.functions.ts", import.meta.url),
  "utf8",
);
const footerSettingsMigration = await readFile(
  new URL("../supabase/migrations/20260906052000_public_footer_settings.sql", import.meta.url),
  "utf8",
);
const completeFooterSettingsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260914100000_seed_complete_footer_settings.sql",
    import.meta.url,
  ),
  "utf8",
);
const homePricingSettingsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260906065000_public_home_pricing_settings.sql",
    import.meta.url,
  ),
  "utf8",
);
const redirects = await readFile(
  new URL("../src/routes/_authenticated.admin.redirects.tsx", import.meta.url),
  "utf8",
);
const forms = await readFile(
  new URL("../src/routes/_authenticated.admin.forms.tsx", import.meta.url),
  "utf8",
);
const therapists = await readFile(
  new URL("../src/routes/_authenticated.admin.therapists.tsx", import.meta.url),
  "utf8",
);
const adminServices = await readFile(
  new URL("../src/routes/_authenticated.admin.services.tsx", import.meta.url),
  "utf8",
);
const assessmentDurationMigration = await readFile(
  new URL(
    "../supabase/migrations/20260822101000_psychotherapy_assessment_duration.sql",
    import.meta.url,
  ),
  "utf8",
);
const progress = await readFile(
  new URL("../src/routes/_authenticated.admin.progress.tsx", import.meta.url),
  "utf8",
);
const appointmentTimelineMigration = await readFile(
  new URL("../supabase/migrations/20260802200000_appointment_timeline.sql", import.meta.url),
  "utf8",
);
const auth = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const browserAuth = await readFile(
  new URL("../src/lib/browser-auth-state.ts", import.meta.url),
  "utf8",
);

const adminRoutes = [
  "index",
  "bookings",
  "messages",
  "emails",
  "payments",
  "google",
  "pages",
  "hero",
  "homepage",
  "carousel",
  "journal",
  "media",
  "testimonials",
  "google-reviews",
  "faqs",
  "forms",
  "redirects",
  "services",
  "therapists",
  "settings",
  "migration",
  "audit",
  "clients.index",
  "availability",
];

const protectedAdminChildRoutes = [
  "availability",
  "clients.index",
  "clients.$clientId",
  "emails",
  "journal",
  "media",
  "messages",
  "pages",
  "payments",
  "services",
  "therapists",
];

test("admin sidebar has a route for each primary CMS and operations tab", async () => {
  for (const route of adminRoutes) {
    await access(new URL(`../src/routes/_authenticated.admin.${route}.tsx`, import.meta.url));
  }
  assert.match(
    sidebar,
    /filter\(\(item\) => item\.to !== "\/admin\/progress" \|\| canViewProgress\)/,
  );
  assert.match(sidebar, /Log out/);
  assert.match(sidebar, /signOut/);
});

test("admin dashboard and client records retain their permission guards", () => {
  assert.doesNotMatch(dashboard, /hasBrowserRole\("admin"\)/);
  assert.match(dashboard, /getVerifiedBrowserSession\(\)/);
  assert.doesNotMatch(progress, /getVerifiedBrowserSession\(\)/);
  assert.match(sidebar, /useBrowserAuthState/);
  assert.match(browserAuth, /hasBrowserRoleForSession/);
  assert.match(browserAuth, /window\.setInterval\(refreshWhenVisible, 60_000\)/);
  assert.doesNotMatch(sidebar, /window\.setInterval/);
  assert.match(dashboard, /pendingComponent: AdminOverviewSkeleton/);
  assert.match(dashboard, /pendingMs: 0/);
  assert.match(adminOverview, /Operations shortcuts/);
  assert.match(adminOverview, /\/admin\/bookings/);
  assert.match(adminOverview, /\/admin\/payments/);
  assert.match(adminOverview, /\/admin\/clients/);
  assert.match(clients, /getAdminClients\(\)/);
  assert.doesNotMatch(clients, /hasBrowserRole\("admin"\)/);
});

test("admin parent route owns permission checks without child role polling", async () => {
  assert.match(adminRoot, /requireBrowserAdmin/);
  assert.match(sidebar, /useBrowserAuthState/);
  for (const route of protectedAdminChildRoutes) {
    const source = await readFile(
      new URL(`../src/routes/_authenticated.admin.${route}.tsx`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /hasBrowserRole\("admin"\)/, route);
  }
});

test("contact messages have a dedicated protected admin workspace", () => {
  assert.match(sidebar, /to: "\/admin\/messages", label: "Messages"/);
  assert.match(messages, /listContactSubmissions/);
  assert.match(messages, /deleteContactSubmission/);
  assert.match(messages, /Contact messages/);
  assert.doesNotMatch(messages, /hasBrowserRole\("admin"\)/);
  assert.match(adminOverview, /Contact messages awaiting acknowledgement/);
});

test("admins can create bookings with availability and payment safeguards", () => {
  assert.match(adminOverview, /Contact messages awaiting acknowledgement/);
  assert.match(sidebar, /to: "\/admin\/bookings", label: "Upcoming bookings"/);
  assert.match(bookings, /to="\/admin\/bookings\/new"/);
  assert.match(newBooking, /getAdminBookingFormData/);
  assert.match(newBooking, /listAvailableSlots/);
  assert.match(newBooking, /createAdminBooking/);
  assert.match(newBooking, /Package credit/);
  assert.match(newBooking, /Payment state/);
  assert.match(adminBookingMigration, /has_role\(auth\.uid\(\), 'admin'\)/);
  assert.match(adminBookingMigration, /list_available_slots/);
  assert.match(adminBookingMigration, /payment_required/);
  assert.match(adminBookingMigration, /package_inactive/);
  assert.match(adminBookingMigration, /appointments_guard_commitment|status = 'confirmed'/);
});

test("browser auth helpers reject stale cached sessions after inactivity", () => {
  assert.match(auth, /export async function getVerifiedBrowserSession/);
  assert.match(auth, /supabase\.auth\.getUser\(\)/);
  assert.match(auth, /if \(!session\) return null;/);
  assert.match(
    auth,
    /if \(isSessionExpired\(session\)\) \{\s*try \{\s*await supabase\.auth\.signOut/s,
  );
  assert.match(auth, /if \(isSessionExpired\(session\)\) \{/);
  assert.match(auth, /if \(userError && !userData\.user\) \{\s*return session;/s);
  assert.match(auth, /const session = await getVerifiedBrowserSession\(\)/);
  assert.match(auth, /if \(await getVerifiedBrowserSession\(\)\) return/);
  assert.match(auth, /export async function hasBrowserRoleForSession/);
});

test("mobile admin navigation identifies content and operations routes", () => {
  assert.match(sidebar, /function adminNavigationLabel\(pathname: string\)/);
  assert.match(
    sidebar,
    /const allItems = \[\.\.\.primaryNavigation, \.\.\.contentNavigation, \.\.\.operationsNavigation\]/,
  );
  assert.match(sidebar, /aria-label="Open admin navigation"/);
  assert.match(sidebar, /lg:hidden print:hidden/);
  assert.match(sidebar, /<Sheet open=\{mobileOpen\} onOpenChange=\{setMobileOpen\}>/);
  assert.match(sidebar, /onNavigate=\{\(\) => setMobileOpen\(false\)\}/);
  assert.match(sidebar, /Admin console/);
  assert.match(sidebar, /\/admin\/forms/);
});

test("admin mobile shell preserves loading, empty, and form states", () => {
  assert.match(sidebar, /function AdminLoadingOverlay\(\)/);
  assert.match(sidebar, /aria-live="polite"/);
  assert.match(sidebar, /aria-busy="true"/);
  assert.match(sidebar, /pathname\.startsWith\("\/admin\/bookings"\)/);
  assert.match(sidebar, /pathname\.startsWith\("\/admin\/availability"\)/);

  assert.match(redirects, /AdminWorkspaceShell/);
  assert.match(redirects, /<main id="main"/);
  assert.match(redirects, /overflow-x-auto/);
  assert.match(redirects, /min-w-\[44rem\]/);
  assert.match(redirects, /No redirects yet/);
  assert.match(redirects, /<Dialog open=\{open\}/);
  assert.match(redirects, /<Input/);
  assert.match(redirects, /<Textarea/);
  assert.match(redirects, /<Select/);
  assert.match(redirects, /<Switch/);
  assert.match(redirects, /Loader2/);

  assert.match(forms, /AdminWorkspaceShell/);
  assert.match(forms, /No pending intake submissions/);
  assert.match(forms, /Save templates/);
  assert.match(forms, /<Textarea|<Input/);
  assert.match(forms, /Add question/);
  assert.match(forms, /Remove \$\{field\.label\}/);
  assert.match(forms, /Field type/);
  assert.match(forms, /Options/);
  assert.match(forms, /One option per line/);
  assert.match(forms, /updateField\(templateIndex, fieldIndex, \{ fieldKey: value \}\)/);
});

test("admin therapist route avoids Radix chunks that can break split-route loading", () => {
  assert.doesNotMatch(therapists, /@\/components\/ui\/select/);
  assert.doesNotMatch(therapists, /@\/components\/ui\/switch/);
  assert.match(therapists, /function NativeSwitch/);
  assert.match(therapists, /role="switch"/);
  assert.match(therapists, /<select/);
});

test("admin services controls the public booking service dropdown", () => {
  assert.match(adminServices, /This controls the booking service dropdown/);
  assert.match(adminServices, /Choose a service/);
  assert.match(adminServices, /New service/);
  assert.match(adminServices, /Edit service/);
  assert.match(adminServices, /Active \(visible in booking\)/);
  assert.match(adminServices, /Delete "\$\{row\.name\}"/);
  assert.match(adminServices, /Duration \(min\)/);
  assert.match(adminServices, /online and in-person price fields control the amount/);
  assert.match(adminServices, /parseNairaInput/);
  assert.match(adminServices, /inputMode="numeric"/);
  assert.match(adminServices, /85,000/);
  assert.match(adminServices, /Display order/);
  assert.match(adminServices, /Assigned therapists/);
  assert.match(adminFunctions, /getTrustedServiceWriteClient/);
  assert.match(adminFunctions, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(adminFunctions, /await requireAdmin\(\)/);
  assert.match(adminFunctions, /syncTherapistAssignments\(writeClient/);
  assert.match(bookingFunctions, /\.from\("services"\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(bookingFunctions, /\.order\("display_order"\)/);
  assert.match(assessmentDurationMigration, /code = 'psychotherapy'/);
  assert.match(assessmentDurationMigration, /duration_minutes = 60/);
});

test("admin dashboard exposes unresolved notification and Meet queues", () => {
  assert.match(dashboard, /getAdminFailureQueues/);
  assert.match(adminFunctions, /email_delivery_logs/);
  assert.match(adminFunctions, /retriedParents/);
  assert.match(adminFunctions, /google_sync_error/);
  assert.match(adminOverview, /Delivery failure queues/);
  assert.match(adminOverview, /Failed notifications/);
  assert.match(adminOverview, /Failed Meet syncs/);
  assert.match(adminOverview, /\/admin\/emails/);
  assert.match(adminOverview, /\/admin\/google/);
});

test("progress route enforces owner access before loading its dashboard", () => {
  assert.match(progress, /requireBrowserProgressAccess/);
  assert.match(progress, /getRestrictedProgressSnapshot/);
  assert.doesNotMatch(progress, /setAuthorized|hasBrowserRole\("admin"\)/);
});

test("booking operations exposes a consolidated appointment timeline", () => {
  assert.match(bookings, /listAppointmentsForAdmin/);
  assert.match(bookings, /getAdminAppointmentTimeline/);
  assert.match(bookings, /Appointment timeline/);
  assert.match(bookingFunctions, /appointment_events/);
  assert.match(bookingFunctions, /payment_events/);
  assert.match(bookingFunctions, /intake_submissions/);
  assert.match(
    appointmentTimelineMigration,
    /CREATE TABLE IF NOT EXISTS public\.appointment_events/,
  );
  assert.match(appointmentTimelineMigration, /appointments_operational_timeline/);
  assert.match(appointmentTimelineMigration, /google_sync_failed/);
  assert.match(appointmentTimelineMigration, /reminder_sent/);
});

test("booking operations supports visible admin rescheduling and Meet status checks", () => {
  assert.match(bookings, /Edit booking/);
  assert.match(bookings, /Archive booking/);
  assert.match(bookings, /renderArchiveButton/);
  assert.match(bookings, /archiveAppointmentForAdmin/);
  assert.match(bookings, /Temporary holds/);
  assert.match(bookings, /Clear temporary test bookings/);
  assert.match(bookings, /temporary\/test booking \$\{row\.bookingReference\}/);
  assert.match(bookings, /Temporary booking deleted/);
  assert.match(bookings, /renderDeleteButton/);
  assert.match(bookings, /DELETE TEST BOOKINGS/);
  assert.match(bookings, /deleteTemporaryAppointmentsForAdmin/);
  assert.match(bookings, /listAvailableSlots/);
  assert.match(bookings, /rescheduleAppointment/);
  assert.match(bookings, /DateInput/);
  assert.match(bookings, /Meet link ready/);
  assert.match(bookings, /Meet after payment/);
  assert.match(bookings, /Meet sync failed/);
  assert.match(bookingFunctions, /service_id/);
  assert.match(bookingFunctions, /therapist_id/);
  assert.match(bookingFunctions, /google_meet_url/);
});

test("shared date input uses a typed field with an explicit calendar popover", () => {
  assert.match(dateInput, /type="text"/);
  assert.match(dateInput, /inputMode="numeric"/);
  assert.match(dateInput, /dd\/mm\/yyyy/);
  assert.match(dateInput, /PopoverTrigger/);
  assert.match(dateInput, /captionLayout="dropdown"/);
  assert.doesNotMatch(dateInput, /type="date"/);
  assert.doesNotMatch(dateInput, /showPicker/);
});

test("settings hub reports live site and integration readiness", () => {
  assert.match(settings, /Promise\.all/);
  assert.match(settings, /getEmailAdminData/);
  assert.match(settings, /getPaymentAdminData/);
  assert.match(settings, /getGoogleAdminSettings/);
  assert.match(settings, /Site and integration health/);
  assert.match(settings, /Needs setup/);
});

test("admins can edit footer content from workspace settings", () => {
  assert.match(settings, /getAdminFooterSettings/);
  assert.match(settings, /updateAdminFooterSettings/);
  assert.match(settings, /Footer settings/);
  assert.match(settings, /Footer navigation/);
  assert.match(settings, /Office locations/);
  assert.match(settings, /Add office/);
  assert.match(settings, /Crisis button link/);
  assert.match(settings, /showSocialLinks/);
  assert.match(adminFunctions, /footerSettingsSchema/);
  assert.match(adminFunctions, /key: "footer_settings"/);
  assert.match(adminFunctions, /DEFAULT_FOOTER_SETTINGS/);
  assert.match(contentFunctions, /getPublicFooterSettings/);
  assert.match(contentFunctions, /parseFooterSettings/);
  assert.match(siteFooter, /useMatch\([\s\S]*loaderData/);
  assert.match(siteFooter, /shell\?\.footer/);
  assert.match(siteFooter, /footer\.sections\.map/);
  assert.match(siteFooter, /footerOffices\.map/);
  assert.match(siteFooter, /formatFooterText/);
  assert.match(footerSettingsMigration, /'footer_settings'/);
  assert.match(completeFooterSettingsMigration, /'Abuja \(FCT\)'/);
  assert.match(completeFooterSettingsMigration, /'Lagos'/);
  assert.match(
    completeFooterSettingsMigration,
    /excluded\.value \|\| public\.site_settings\.value/,
  );
});

test("admins can edit homepage pricing teaser cards", () => {
  assert.match(homepageAdmin, /getAdminHomePricingSettings/);
  assert.match(homepageAdmin, /updateAdminHomePricingSettings/);
  assert.match(homepageAdmin, /Homepage pricing cards/);
  assert.match(homepageAdmin, /Full pricing link label/);
  assert.match(homepageAdmin, /Default selected tab/);
  assert.match(homepageAdmin, /Feature bullets/);
  assert.match(homepageAdmin, /Highlight card/);
  assert.match(adminFunctions, /homePricingSettingsSchema/);
  assert.match(adminFunctions, /key: "home_pricing"/);
  assert.match(contentFunctions, /DEFAULT_HOME_PRICING_SETTINGS/);
  assert.match(contentFunctions, /normalizeHomePricingSettings/);
  assert.match(contentFunctions, /homePricing: normalizeHomePricingSettings/);
  assert.match(homepage, /settings\.plans\.map/);
  assert.match(homepage, /settings\.singleTabLabel/);
  assert.match(homepage, /settings\.monthlyTabLabel/);
  assert.match(homepage, /settings\.note/);
  assert.match(homePricingSettingsMigration, /'home_pricing'/);
  assert.match(homePricingSettingsMigration, /'home_section_copy'/);
  assert.match(homePricingSettingsMigration, /'footer_settings'/);
});

test("admin audit log records actor, action, reason, target, and timestamp", async () => {
  const auditRoute = await readFile(
    new URL("../src/routes/_authenticated.admin.audit.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../supabase/migrations/20260802213000_admin_audit_log.sql", import.meta.url),
    "utf8",
  );
  assert.match(sidebar, /\/admin\/audit/);
  assert.match(auditRoute, /listAdminAuditLogs/);
  assert.match(auditRoute, /Audit log/);
  assert.match(migration, /actor_email/);
  assert.match(migration, /action text NOT NULL/);
  assert.match(migration, /reason text NOT NULL/);
  assert.match(migration, /changed_fields text\[\]/);
  assert.match(migration, /created_at timestamptz NOT NULL/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE/);
});

test("content migration review records explicit audited owner decisions", async () => {
  const route = await readFile(
    new URL("../src/routes/_authenticated.admin.migration.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../supabase/migrations/20260802223000_migration_content_reviews.sql", import.meta.url),
    "utf8",
  );
  assert.match(sidebar, /\/admin\/migration/);
  assert.match(route, /listMigrationContentReviews/);
  assert.match(route, /updateMigrationContentReview/);
  assert.match(route, /Publication does not imply migration approval/);
  assert.match(migration, /decision IN \('pending', 'approved', 'excluded', 'needs_revision'\)/);
  assert.match(migration, /reviewed_by_email/);
  assert.match(migration, /review_reason/);
  assert.match(migration, /migration_content_reviews_admin_update/);
  assert.match(migration, /capture_admin_audit_log/);
});
