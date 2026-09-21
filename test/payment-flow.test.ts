import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { checkoutPaymentTotal, validateProviderPayment } from "../src/lib/payment-validation.ts";

const paymentMigration = await readFile(
  new URL(
    "../supabase/migrations/20260718064832_f2a2a7f6-3bd1-475b-b5e5-4725bfe847b5.sql",
    import.meta.url,
  ),
  "utf8",
);
const timelineMigration = await readFile(
  new URL("../supabase/migrations/20260723090000_payment_status_timeline.sql", import.meta.url),
  "utf8",
);
const appointmentHoldStateMigration = await readFile(
  new URL(
    "../supabase/migrations/20260729103000_reconcile_appointment_hold_state.sql",
    import.meta.url,
  ),
  "utf8",
);
const paymentReceiptStorageMigration = await readFile(
  new URL(
    "../supabase/migrations/20260718071105_02021654-7bb1-4b97-9f1a-49c9ca79cf26.sql",
    import.meta.url,
  ),
  "utf8",
);
const webhookRoute = await readFile(
  new URL("../src/routes/api/public/paystack-webhook.ts", import.meta.url),
  "utf8",
);
const recheckRoute = await readFile(
  new URL("../src/routes/api/public/hooks/recheck-payments.ts", import.meta.url),
  "utf8",
);
const pricingRoute = await readFile(new URL("../src/routes/pricing.tsx", import.meta.url), "utf8");
const bookingRoute = await readFile(new URL("../src/routes/book.tsx", import.meta.url), "utf8");
const purchaseRoute = await readFile(
  new URL("../src/routes/purchase.tsx", import.meta.url),
  "utf8",
);
const homeRoute = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const bookingFunctions = await readFile(
  new URL("../src/lib/booking.functions.ts", import.meta.url),
  "utf8",
);
const bookingFormTemplates = await readFile(
  new URL("../src/lib/form-templates.ts", import.meta.url),
  "utf8",
);
const contentFunctions = await readFile(
  new URL("../src/lib/content.functions.ts", import.meta.url),
  "utf8",
);
const paymentFunctions = await readFile(
  new URL("../src/lib/payments.functions.ts", import.meta.url),
  "utf8",
);
const sessionPackagesServer = await readFile(
  new URL("../src/lib/session-packages.server.ts", import.meta.url),
  "utf8",
);
const pageSeed = await readFile(
  new URL("../src/lib/page-seed-content.ts", import.meta.url),
  "utf8",
);
const inPersonPricingMigration = await readFile(
  new URL("../supabase/migrations/20260822100000_in_person_session_pricing.sql", import.meta.url),
  "utf8",
);
const packageInitialCreditMigration = await readFile(
  new URL(
    "../supabase/migrations/20260906172000_consume_initial_package_booking.sql",
    import.meta.url,
  ),
  "utf8",
);
const productionPackagePolicyHotfix = await readFile(
  new URL(
    "../supabase/migrations/20260906193000_production_package_policy_hotfix.sql",
    import.meta.url,
  ),
  "utf8",
);
const packageUsedSessionsAmbiguityHotfix = await readFile(
  new URL(
    "../supabase/migrations/20260906201500_fix_package_used_sessions_ambiguity.sql",
    import.meta.url,
  ),
  "utf8",
);
const packageModeLockMigration = await readFile(
  new URL("../supabase/migrations/20260908083000_lock_package_session_mode.sql", import.meta.url),
  "utf8",
);
const brandWordmarkMigration = await readFile(
  new URL(
    "../supabase/migrations/20260730120000_seed_brand_wordmark_settings.sql",
    import.meta.url,
  ),
  "utf8",
);
const paymentsAdminRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.payments.tsx", import.meta.url),
  "utf8",
);
const paidBookingReviewRetryMigration = await readFile(
  new URL("../supabase/migrations/20260917143000_retry_paid_booking_review.sql", import.meta.url),
  "utf8",
);
const bookingPurchaseReferenceMigration = await readFile(
  new URL(
    "../supabase/migrations/20260917150000_link_booking_purchase_reference.sql",
    import.meta.url,
  ),
  "utf8",
);

const validPayment = {
  expectedAmountKobo: 125000,
  expectedCurrency: "NGN",
  expectedReference: "TSP-ABC123",
  result: {
    amountKobo: 125000,
    currency: "NGN",
    providerReference: "TSP-ABC123",
  },
};

test("accepts an exact Paystack amount, currency, and reference", () => {
  assert.doesNotThrow(() => validateProviderPayment(validPayment));
});

test("successful payment sync creates or refreshes clients after payment", () => {
  assert.match(paymentFunctions, /syncClientRecordsForSuccessfulPayment/);
  assert.match(paymentFunctions, /record_source:[\s\S]*"payment_confirmation"/);
  assert.match(
    paymentFunctions,
    /findAuthUserIdByEmail[\s\S]*input\.client\.from\("clients"\)\.upsert/,
  );
  assert.doesNotMatch(
    bookingFunctions,
    /const requestSupabase = getConfiguredClient\(\);[\s\S]*requestSupabase\.client\.from\("clients"\)/,
  );
  assert.match(paymentFunctions, /\.eq\("status", "succeeded"\)/);
  assert.match(paymentFunctions, /payment_kind === "package_purchase"/);
});

test("payment sync reconciles existing clients by contact match and preserves legacy records while filling missing details", () => {
  assert.match(
    paymentFunctions,
    /findExistingClientForPaymentSync|matchExistingClientForPaymentSync/,
  );
  assert.match(paymentFunctions, /eq\("email", email\)|eq\("phone", phone\)/);
  assert.match(paymentFunctions, /existingText\("record_source"\) \?\? "payment_confirmation"/);
  assert.match(paymentFunctions, /full_name: finalFullName|phone: finalPhone|email: finalEmail/);
});

test("booking and manual package phone inputs use the shared contact policy", () => {
  assert.match(bookingFunctions, /import \{ clientPhoneSchema \} from "@\/lib\/client-profile"/);
  assert.match(bookingFunctions, /phone: clientPhoneSchema/);
  assert.match(paymentFunctions, /import \{ clientPhoneSchema \} from "@\/lib\/client-profile"/);
  assert.match(paymentFunctions, /clientPhone: z\.preprocess\(/);
  assert.match(paymentFunctions, /clientPhoneSchema\.optional\(\)/);
});

test("public package purchase flow initializes a package-only payment using the purchase-first RPC", () => {
  assert.match(paymentFunctions, /initPackagePurchasePayment/);
  assert.match(paymentFunctions, /record_package_purchase_initiated/);
  assert.match(paymentFunctions, /payment_kind.*package_purchase|package_purchase.*payment_kind/);
  assert.match(paymentFunctions, /purchasedSessions/);
});

test("purchase-first date and time remain optional without visible optional labels", () => {
  assert.match(purchaseRoute, /label="Preferred date"[\s\S]*label="Preferred time"/);
  assert.doesNotMatch(purchaseRoute, /Preferred date \(optional\)|Preferred time \(optional\)/);
  assert.match(paymentFunctions, /preferredDate: z\.string\(\)\.trim\(\)\.max\(20\)\.optional\(\)/);
  assert.match(paymentFunctions, /preferredTime: z\.string\(\)\.trim\(\)\.max\(80\)\.optional\(\)/);
});

test("preferred date and time are no longer required in the booking intake flow", () => {
  assert.match(bookingRoute, /preferredDate: z\s*\.string\(\)\s*\.trim\(\)\s*\.optional\(\)/);
  assert.match(bookingRoute, /preferredTime: z\.string\(\)\.trim\(\)\.optional\(\)/);
  assert.match(bookingFormTemplates, /fieldKey: "preferredDate"[\s\S]*required: false/);
  assert.match(bookingFormTemplates, /fieldKey: "preferredTime"[\s\S]*required: false/);
});

test("booking notes are optional while retaining the character limit", () => {
  assert.match(
    bookingRoute,
    /notes: z\.string\(\)\.trim\(\)\.max\(1000, "Notes must be under 1000 characters"\)\.optional\(\)/,
  );
  assert.match(bookingRoute, /required=\{notesField\?\.required \?\? false\}/);
  assert.match(bookingRoute, /Anything you'd like us to know\? \(Optional\)/);
  assert.match(bookingRoute, /displayedNotesLabel/);
  assert.match(bookingFormTemplates, /label: "Anything you'd like us to know\? \(Optional\)"/);
  assert.match(bookingRoute, /setSelectedSlots\(\[\]\);[\s\S]*form\.preferredDate/);
  assert.match(bookingRoute, /Boolean\(packageError\)[\s\S]*!isReadyToSubmit/);
  assert.match(
    bookingRoute,
    /setAvailableSlots\(slots\);[\s\S]*slots\.length === 0[\s\S]*setSelectedSlots\(\[\]\)/,
  );
  assert.match(bookingRoute, /Dialog open=\{Boolean\(bookingError\)\}/);
  assert.match(bookingRoute, /getActionErrorMessage/);
  assert.match(bookingRoute, /for \(const key of \["data", "cause", "error", "details"\]/);
  assert.match(bookingRoute, /Payment could not start/);
  assert.match(bookingFunctions, /bucket: "booking_hold"[\s\S]*windowSeconds: 15 \* 60/);
  assert.doesNotMatch(bookingRoute, /Please share a short note so we can match you well/);
});

test("rejects major-unit values where the API contract requires minor units", () => {
  assert.throws(() =>
    validateProviderPayment({
      ...validPayment,
      result: { ...validPayment.result, amountKobo: 1250, currency: "NGN" },
    }),
  );
  assert.throws(() =>
    validateProviderPayment({
      ...validPayment,
      expectedCurrency: "usd",
      expectedAmountKobo: 125000,
      result: { amountKobo: 1250, currency: "USD", providerReference: "TSP-ABC123" },
    }),
  );
});

test("does not accept a hundredfold underpayment and validates integer minor units", () => {
  for (const amountKobo of [199, 0, -19900, 19900.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () =>
        validateProviderPayment({
          ...validPayment,
          expectedAmountKobo: 19900,
          result: { ...validPayment.result, amountKobo },
        }),
      /amount does not match/,
    );
  }
  assert.doesNotThrow(() =>
    validateProviderPayment({
      ...validPayment,
      expectedAmountKobo: 19999,
      result: { ...validPayment.result, amountKobo: 19999 },
    }),
  );
});

test("checkout totals sum stored session amounts and reject mixed or invalid currencies/amounts", () => {
  assert.deepEqual(
    checkoutPaymentTotal([
      { amount_kobo: 19999, currency: "NGN" },
      { amount_kobo: "19999", currency: "ngn" },
    ]),
    { amountKobo: 39998, currency: "NGN" },
  );
  assert.throws(() => checkoutPaymentTotal([]));
  assert.throws(() =>
    checkoutPaymentTotal([
      { amount_kobo: 100, currency: "NGN" },
      { amount_kobo: 100, currency: "USD" },
    ]),
  );
  for (const amount_kobo of [0, -1, 1.1, NaN, Infinity])
    assert.throws(() => checkoutPaymentTotal([{ amount_kobo, currency: "NGN" }]));
});

test("rejects Paystack amount, currency, and reference mismatches", () => {
  assert.throws(
    () =>
      validateProviderPayment({
        ...validPayment,
        result: { ...validPayment.result, amountKobo: 1 },
      }),
    /amount does not match/,
  );
  assert.throws(
    () =>
      validateProviderPayment({
        ...validPayment,
        result: { ...validPayment.result, currency: "USD" },
      }),
    /currency does not match/,
  );
  assert.throws(
    () =>
      validateProviderPayment({
        ...validPayment,
        result: { ...validPayment.result, providerReference: "other" },
      }),
    /reference does not match/,
  );
});

test("multi-slot checkout groups up to ten holds under one payment reference", async () => {
  assert.match(bookingRoute, /selectedSlots/);
  assert.match(bookingRoute, /MAX_SESSIONS_PER_CHECKOUT = 10/);
  assert.match(bookingRoute, /How many sessions\?/);
  assert.match(bookingRoute, /aria-label="Add selected session"/);
  assert.match(bookingRoute, /aria-label="Reduce selected sessions"/);
  assert.match(bookingRoute, /holdSlots/);
  assert.match(bookingFunctions, /const holdSlotsInput/);
  assert.match(bookingFunctions, /\.min\(1\)\s*\.max\(10\)/);
  assert.match(
    paymentFunctions,
    /appointmentIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(10\)/,
  );
  assert.match(paymentFunctions, /manageTokens/);
  assert.match(paymentFunctions, /checkout_group_reference: reference/);
  assert.match(paymentFunctions, /syncGoogleForPaymentReference/);
  assert.match(paymentFunctions, /sendPaymentEmailsForReference/);
  assert.match(
    await readFile(
      new URL(
        "../supabase/migrations/20260909143000_multi_slot_checkout_groups.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    /checkout_group_reference/,
  );
});

test("payment flows keep provider and bank-transfer safeguards in place", () => {
  assert.match(paymentMigration, /mode TEXT NOT NULL DEFAULT 'test'/);
  assert.match(paymentMigration, /ON CONFLICT \(reference\) DO UPDATE/);
  assert.match(paymentMigration, /submit_bank_transfer/);
  assert.match(paymentMigration, /verify_bank_transfer/);
  assert.match(paymentReceiptStorageMigration, /payment_receipts_owner_write/);
  assert.match(appointmentHoldStateMigration, /normalize_appointment_hold_state/);
  assert.match(appointmentHoldStateMigration, /before insert or update of status, hold_expires_at/);
  assert.match(
    appointmentHoldStateMigration,
    /new\.hold_expires_at := now\(\) \+ interval '5 minutes'/,
  );
  assert.match(appointmentHoldStateMigration, /new\.hold_expires_at := null/);
  assert.match(webhookRoute, /x-paystack-signature/);
  assert.match(webhookRoute, /validateProviderPayment/);
  assert.match(recheckRoute, /verifyCronRequest/);
  assert.match(recheckRoute, /verified_via: "delayed_recheck"/);
  assert.match(timelineMigration, /payment_events/);
  assert.match(timelineMigration, /payments_status_timeline/);
});

test("pricing Paystack plans enter appointment or purchase-first payment flows", () => {
  assert.match(pricingRoute, /href: "\/book\?service=individual&mode=online"/);
  assert.match(pricingRoute, /href: "\/book\?service=couple&mode=online"/);
  assert.match(pricingRoute, /href: "\/purchase\?service=one_month_individual&mode=online"/);
  assert.match(pricingRoute, /href: "\/purchase\?service=one_month_couple&mode=online"/);
  assert.doesNotMatch(pricingRoute, /TS\.paystack/);
  assert.match(bookingRoute, /service\.code === search\.service/);
  assert.match(bookingRoute, /initPaystackPayment/);
  assert.match(homeRoute, /settings\.plans\.map/);
  assert.match(contentFunctions, /href: "\/book\?service=individual"/);
  assert.match(
    contentFunctions,
    /hrefMonthly: "\/purchase\?service=one_month_individual&mode=online"/,
  );
  assert.match(contentFunctions, /href: "\/book\?service=couple"/);
  assert.match(contentFunctions, /hrefMonthly: "\/purchase\?service=one_month_couple&mode=online"/);
  assert.doesNotMatch(homeRoute, /TS\.paystack/);
});

test("package booking links immediately present package-mode booking copy", () => {
  assert.match(
    bookingRoute,
    /validateSearch:[\s\S]*package: z\.string\(\)\.trim\(\)\.optional\(\)/,
  );
  assert.match(bookingRoute, /useState\(Boolean\(search\.package\)\)/);
  assert.match(bookingRoute, /Book from your package/);
  assert.match(bookingRoute, /Checking your private package link/);
  assert.match(bookingRoute, /Checking your package link/);
  assert.match(bookingRoute, /Package session/);
  assert.match(bookingRoute, /packageToken: search\.package/);
});

test("website package purchases consume the initial paid booking only", () => {
  assert.match(packageInitialCreditMigration, /where source_payment_id = payment\.id/);
  assert.match(packageInitialCreditMigration, /service_record\.sessions_per_package,\s*1,/);
  assert.match(packageInitialCreditMigration, /remaining_sessions := greatest/);
  assert.match(packageInitialCreditMigration, /pkg\.source_payment_id is not null/);
  assert.match(packageInitialCreditMigration, /pkg\.used_sessions = 0/);
  assert.match(packageInitialCreditMigration, /where appt\.package_id = pkg\.id/);
  assert.match(paymentFunctions, /createManualSessionPackage/);
  assert.match(sessionPackagesServer, /used_sessions: 0/);
  assert.match(sessionPackagesServer, /remainingSessions: Number\(data\.purchased_sessions/);
});

test("admins can issue non-expiring prepaid credits for any active service", () => {
  assert.match(paymentFunctions, /\.eq\("is_active", true\)/);
  assert.doesNotMatch(paymentFunctions, /\.gt\("sessions_per_package", 1\)/);
  assert.match(paymentFunctions, /sessionMode: z\.enum\(\["online", "in_person"\]\)/);
  assert.match(sessionPackagesServer, /sessionMode: "online" \| "in_person"/);
  assert.match(sessionPackagesServer, /session_mode: input\.sessionMode/);
  assert.match(sessionPackagesServer, /expires_at: input\.expiresAt \|\| null/);
});

test("manual package links use the requested session count and stable package reference", () => {
  assert.match(paymentFunctions, /const sessions = data\.purchasedSessions;/);
  assert.match(paymentFunctions, /packageReference: result\.packageReference/);
  assert.match(
    paymentFunctions,
    /select\("access_token, reference, purchased_sessions, used_sessions"\)/,
  );
  assert.match(sessionPackagesServer, /packageReference: data\.reference as string/);
});

test("package-link form starts at one session and estimates per-session pricing", async () => {
  const paymentsRoute = await readFile(
    new URL("../src/routes/_authenticated.admin.payments.tsx", import.meta.url),
    "utf8",
  );
  assert.match(paymentsRoute, /purchasedSessions: 1/);
  assert.match(
    paymentsRoute,
    /selectedPackageService\.priceNgn \/\s*\n?\s*Math\.max\(1, selectedPackageService\.sessionsPerPackage\)/,
  );
  assert.match(paymentsRoute, /Sessions in this package/);
});

test("admin package link form shows mode and no-expiry controls", async () => {
  const paymentsRoute = await readFile(
    new URL("../src/routes/_authenticated.admin.payments.tsx", import.meta.url),
    "utf8",
  );

  assert.match(paymentsRoute, /Credit service/);
  assert.match(paymentsRoute, /sessionMode: "online"/);
  assert.match(paymentsRoute, /Online only/);
  assert.match(paymentsRoute, /In-person only/);
  assert.match(paymentsRoute, /neverExpires: true/);
  assert.match(paymentsRoute, /No expiry/);
  assert.match(paymentsRoute, /Credit summary/);
  assert.match(paymentsRoute, /Estimated total/);
  assert.match(paymentsRoute, /expiresAt:[\s\S]*packageForm\.neverExpires/);
  assert.match(paymentsRoute, /const neverExpires = event\.currentTarget\.checked/);
});

test("admin dashboard counts unresolved and paid-review payments", async () => {
  const adminFunctions = await readFile(
    new URL("../src/lib/admin.functions.ts", import.meta.url),
    "utf8",
  );

  assert.match(adminFunctions, /\.in\("status", \["initiated", "awaiting_confirmation"\]\)/);
  assert.doesNotMatch(adminFunctions, /\.in\("status", \["initiated", "pending"/);
  assert.match(adminFunctions, /\.from\("payments"\)\.select\("metadata"\)/);
  assert.match(adminFunctions, /booking_review_required === true/);
  assert.match(adminFunctions, /pendingPayments\.count \?\? 0\) \+ paidBookingReviewCount/);
});

test("website package payments send one client email with the package link embedded", async () => {
  const paymentEmailServer = await readFile(
    new URL("../src/lib/payment-email.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(paymentEmailServer, /packageBookingUrl: packageInfo\?\.bookingUrl/);
  assert.match(paymentEmailServer, /packageRemainingSessions: packageInfo\?\.remainingSessions/);
  assert.doesNotMatch(
    paymentEmailServer,
    /sendTemplateEmail\("package_booking_link", appointment\.client_email/,
  );
  assert.match(paymentFunctions, /sendTemplateEmail\("package_booking_link", data\.clientEmail/);
});

test("production package SQL hotfix is standalone and unescaped", () => {
  assert.doesNotMatch(productionPackagePolicyHotfix, /\\_/);
  assert.match(productionPackagePolicyHotfix, /drop policy if exists site_settings_public_read/);
  assert.match(productionPackagePolicyHotfix, /create policy site_settings_public_read/);
  assert.match(productionPackagePolicyHotfix, /footer_settings/);
  assert.match(
    productionPackagePolicyHotfix,
    /create or replace function public\.activate_session_package_for_payment/,
  );
  assert.match(productionPackagePolicyHotfix, /end;\n\$\$;/);
  assert.match(productionPackagePolicyHotfix, /service_record\.sessions_per_package,\s*1,/);
});

test("package credit SQL qualifies session counters to avoid ambiguous output names", () => {
  assert.match(
    packageUsedSessionsAmbiguityHotfix,
    /create or replace function public\.consume_session_package_credit/,
  );
  assert.match(
    packageUsedSessionsAmbiguityHotfix,
    /create or replace function public\.activate_session_package_for_payment/,
  );
  assert.match(
    packageUsedSessionsAmbiguityHotfix,
    /public\.client_session_packages\.used_sessions \+ 1/,
  );
  assert.match(
    packageUsedSessionsAmbiguityHotfix,
    /public\.client_session_packages\.purchased_sessions/,
  );
  assert.match(packageUsedSessionsAmbiguityHotfix, /public\.client_session_packages\.status/);
  assert.doesNotMatch(packageUsedSessionsAmbiguityHotfix, /set used_sessions = used_sessions \+/);
  assert.doesNotMatch(packageUsedSessionsAmbiguityHotfix, /when used_sessions \+ 1/);
  assert.doesNotMatch(packageUsedSessionsAmbiguityHotfix, /when purchased_sessions <= 1/);
  assert.doesNotMatch(packageUsedSessionsAmbiguityHotfix, /else status/);
});

test("package booking links are locked to the paid session mode and balance", () => {
  assert.match(packageModeLockMigration, /add column if not exists session_mode/);
  assert.match(
    packageModeLockMigration,
    /drop function if exists public\.get_session_package_by_token\(text\)/,
  );
  assert.match(packageModeLockMigration, /pkg\.session_mode,\s*pkg\.purchased_sessions/);
  assert.match(packageModeLockMigration, /appt\.session_mode/);
  assert.match(packageModeLockMigration, /package_mode_mismatch/);
  assert.match(
    packageModeLockMigration,
    /public\.client_session_packages\.used_sessions\s*< public\.client_session_packages\.purchased_sessions/,
  );
  assert.match(bookingFunctions, /sessionMode: BookingSessionMode \| null/);
  assert.match(bookingFunctions, /row\.session_mode as BookingSessionMode \| null/);
  assert.match(bookingFunctions, /package_mode_mismatch/);
  assert.match(bookingRoute, /mode: pkg\.sessionMode \?\? current\.mode/);
  assert.match(bookingRoute, /disabled=\{Boolean\(packageAccess\?\.sessionMode\)\}/);
});

test("site settings seeds preserve admin-edited content and images", () => {
  assert.match(brandWordmarkMigration, /on conflict \(key\) do nothing/);
  assert.doesNotMatch(brandWordmarkMigration, /on conflict \(key\) do update/i);
  assert.doesNotMatch(brandWordmarkMigration, /jsonb_set/i);
});

test("in-person session pricing differs from online pricing in booking and payments", () => {
  for (const amount of ["₦85,000", "₦130,000", "₦323,000", "₦494,000"]) {
    assert.match(pricingRoute, new RegExp(amount));
    assert.match(pageSeed, new RegExp(amount));
    assert.match(inPersonPricingMigration, new RegExp(amount));
  }
  assert.match(bookingFunctions, /in_person_price_ngn/);
  assert.match(bookingFunctions, /isMissingInPersonPriceColumn/);
  assert.match(bookingFunctions, /fallbackInPersonPriceNgn/);
  assert.match(bookingRoute, /mode === "in_person" && service\.inPersonPriceNgn != null/);
  assert.match(bookingRoute, /mode: z\.enum\(\["online", "in_person"\]\)\.optional\(\)/);
  assert.match(bookingRoute, /mode: search\.mode \?\? emptyForm\.mode/);
  assert.match(pricingRoute, /href: "\/book\?service=individual&mode=in_person"/);
  assert.match(pricingRoute, /href: "\/book\?service=couple&mode=in_person"/);
  assert.match(pricingRoute, /href: "\/purchase\?service=one_month_individual&mode=in_person"/);
  assert.match(pricingRoute, /href: "\/purchase\?service=one_month_couple&mode=in_person"/);
  assert.match(paymentFunctions, /resolveServicePriceNgn/);
  assert.match(paymentFunctions, /services\(code, price_ngn, in_person_price_ngn/);
  assert.match(paymentFunctions, /isMissingInPersonPriceColumn/);
  assert.match(paymentFunctions, /services\(code, price_ngn/);
  assert.match(inPersonPricingMigration, /WHEN 'individual' THEN 85000/);
  assert.match(inPersonPricingMigration, /WHEN 'couple' THEN 130000/);
  assert.match(inPersonPricingMigration, /WHEN 'one_month_individual' THEN 323000/);
  assert.match(inPersonPricingMigration, /WHEN 'one_month_couple' THEN 494000/);
});

test("admin payments shows a Paystack secret status banner and reloads settings after secret saves", () => {
  assert.match(paymentsAdminRoute, /Paystack secret missing/);
  assert.match(paymentsAdminRoute, /Paystack is configured/);
  assert.match(paymentsAdminRoute, /reloadSettings/);
  assert.match(paymentsAdminRoute, /The encrypted secret is stored in Supabase/);
});

test("admin payments puts unresolved Paystack transactions in pending review", () => {
  assert.match(
    paymentsAdminRoute,
    /type PaymentTab = "pending" \| "confirmed" \| "failed" \| "all"/,
  );
  assert.match(paymentsAdminRoute, /useState<PaymentTab>\("pending"\)/);
  assert.match(paymentsAdminRoute, /p\.provider === "paystack"/);
  assert.match(paymentsAdminRoute, /p\.status === "initiated"/);
  assert.match(paymentsAdminRoute, /Confirmed \(\{confirmed\.length\}\)/);
  assert.match(paymentsAdminRoute, /Failed \(\{failed\.length\}\)/);
  assert.match(paymentsAdminRoute, /verifyPaystackPaymentForAdmin/);
  assert.match(paymentsAdminRoute, /Paystack payment confirmed/);
  assert.match(paymentsAdminRoute, /updatePaymentStatusForAdmin/);
  assert.match(paymentsAdminRoute, /paymentStatusLabels/);
  assert.match(paymentsAdminRoute, /paymentLifecycleLabel/);
  assert.match(paymentsAdminRoute, /Verified payment · booking review required/);
  assert.match(paymentsAdminRoute, /Pending payment review/);
  assert.match(paymentsAdminRoute, /Verified payment · booking confirmed/);
  assert.match(paymentsAdminRoute, /Not verified/);
  assert.match(paymentsAdminRoute, /Check Paystack/);
  assert.match(paymentFunctions, /verifyPaystackPaymentForAdmin/);
  assert.match(paymentFunctions, /admin_manual_status/);
  assert.match(paymentFunctions, /syncGoogleBeforePaymentEmail/);
  assert.match(paymentFunctions, /verified_via: "admin_recheck"/);
  assert.match(paymentFunctions, /validateProviderPayment/);
  assert.match(paymentsAdminRoute, /same test\/live Paystack account/);
});

test("admin payments can retry a paid bank-transfer booking left in review", () => {
  assert.match(paymentsAdminRoute, /row\.bookingReviewRequired/);
  assert.match(paymentsAdminRoute, /Retry booking/);
  assert.match(paymentsAdminRoute, /verifyBankTransferPayment/);
  assert.match(
    paidBookingReviewRetryMigration,
    /p\.status = 'succeeded'[\s\S]*booking_review_required/,
  );
  assert.match(paidBookingReviewRetryMigration, /status = 'confirmed'/);
  assert.match(paidBookingReviewRetryMigration, /booking_review_reason/);
  assert.match(paymentFunctions, /bookingConfirmed/);
  assert.match(paymentsAdminRoute, /must be rescheduled or refunded/);
});

test("paid review bookings can be recovered through admin rescheduling", async () => {
  const bookingFunctions = await readFile(
    new URL("../src/lib/booking.functions.ts", import.meta.url),
    "utf8",
  );
  const adminBookingsRoute = await readFile(
    new URL("../src/routes/_authenticated.admin.bookings.tsx", import.meta.url),
    "utf8",
  );
  const recoveryMigration = await readFile(
    new URL(
      "../supabase/migrations/20260917160000_reschedule_paid_booking_review.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(bookingFunctions, /paymentNeedsReview/);
  assert.match(adminBookingsRoute, /row\.status === "cancelled" && row\.paymentNeedsReview/);
  assert.match(recoveryMigration, /actor IN \('admin', 'staff'\)/);
  assert.match(recoveryMigration, /status = CASE WHEN paid_review THEN 'confirmed'/);
});

test("booking references resolve to package or grouped payment purchase identities", () => {
  assert.match(sessionPackagesServer, /select\("id, reference, client_email/);
  assert.match(bookingPurchaseReferenceMigration, /purchase_reference text/);
  assert.match(bookingPurchaseReferenceMigration, /pkg\.reference/);
  assert.match(bookingPurchaseReferenceMigration, /checkout_group_reference/);
  assert.match(bookingPurchaseReferenceMigration, /WHERE package_id IS NULL/);
  assert.match(bookingPurchaseReferenceMigration, /backfill/i);
});
