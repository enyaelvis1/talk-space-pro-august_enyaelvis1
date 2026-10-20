import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public therapist and payment-review surfaces do not expose client details", () => {
  const publicContent = read("src/lib/content.functions.ts");
  const paymentRoute = read("src/routes/_authenticated.admin.payments.tsx");
  assert.match(publicContent, /getPublicTherapists/);
  assert.doesNotMatch(publicContent, /client_email|client_phone|appointments\(/);
  assert.match(paymentRoute, /Hidden from payment review/);
  assert.doesNotMatch(paymentRoute, /reviewing\.client(Name|Email|Phone)/);
});

test("therapist dashboard exposes client name but not private client contact fields", () => {
  const therapistFunctions = read("src/lib/therapist.functions.ts");
  const therapistRoute = read("src/routes/_authenticated.therapist.tsx");
  assert.match(therapistFunctions, /clientName: string/);
  assert.match(therapistFunctions, /client_name/);
  assert.match(therapistRoute, /appointment\.clientName/);
  assert.doesNotMatch(therapistFunctions, /client_email|client_phone|client_notes|intake/);
  assert.match(therapistFunctions, /Cache-Control.*private, no-store/);
});

test("service copy keeps the consultation and teen-session durations consistent", () => {
  const services = read("src/routes/services.tsx");
  const servicePage = read("src/routes/services.$slug.tsx");
  const pricing = read("src/routes/pricing.tsx");
  const catalog = read("src/lib/service-catalog.ts");
  const seed = read("src/lib/page-seed-content.ts");
  const home = read("src/routes/index.tsx");
  assert.doesNotMatch(`${services}\n${seed}`, /Free 15-minute intro call/);
  assert.match(`${services}\n${seed}\n${home}\n${servicePage}\n${pricing}`, /60-minute/);
  assert.doesNotMatch(`${services}\n${seed}`, /50-minute|75-minute/);
  assert.match(`${services}\n${seed}`, /Paid 15-minute Clarity Call/);
  assert.match(catalog, /individual:.*durationMinutes: 60/s);
  assert.match(catalog, /couple:.*durationMinutes: 90/s);
  assert.match(catalog, /teenChild:.*durationMinutes: 60/s);
});

test("public FAQ, therapist, service and location pages expose resilient SEO/content contracts", () => {
  const faqs = read("src/routes/faqs.tsx");
  const therapists = read("src/routes/therapists.tsx");
  const services = read("src/routes/services.$slug.tsx");
  const locations = read("src/routes/locations.$city.tsx");
  assert.match(faqs, /Promise\.allSettled/);
  assert.match(faqs, /role="status"/);
  assert.match(therapists, /Promise\.allSettled/);
  assert.match(therapists, /request a therapist match/);
  assert.match(services, /servicePageJsonLd/);
  assert.match(services, /privacy-policy/);
  assert.match(locations, /locationPageJsonLd/);
  assert.match(locations, /Confirm availability/);
});

test("couple booking contract includes optional partner notification details", () => {
  const booking = read("src/lib/booking.functions.ts");
  const form = read("src/routes/book.tsx");
  const migration = read("supabase/migrations/20261019120000_partner_booking_notifications.sql");
  assert.match(booking, /hold_appointment_with_partner/);
  assert.match(form, /Invite your partner/);
  assert.match(migration, /partner_email/);
  assert.match(booking, /recipientRole: "partner"/);
  assert.match(booking, /Use a different email for your partner/);
  assert.match(form, /Their details are stored on this\s+booking only/);
  assert.match(booking, /firePartnerLifecycleNotice/);
  assert.match(read("src/lib/payment-email.server.ts"), /payment_partner_email_claimed_at/);
  assert.match(
    read("supabase/migrations/20261019123000_partner_payment_notification_claim.sql"),
    /payment_partner_email_claimed_at/,
  );
});
