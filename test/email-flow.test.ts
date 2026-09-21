import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emailServer = await readFile(new URL("../src/lib/email.server.ts", import.meta.url), "utf8");
const emailTemplates = await readFile(
  new URL("../src/lib/email-templates.server.ts", import.meta.url),
  "utf8",
);
const emailFunctions = await readFile(
  new URL("../src/lib/email.functions.ts", import.meta.url),
  "utf8",
);
const contactFunctions = await readFile(
  new URL("../src/lib/contact.functions.ts", import.meta.url),
  "utf8",
);
const bookingFunctions = await readFile(
  new URL("../src/lib/booking.functions.ts", import.meta.url),
  "utf8",
);
const remindersRoute = await readFile(
  new URL("../src/routes/api/public/hooks/send-reminders.ts", import.meta.url),
  "utf8",
);
const retryRoute = await readFile(
  new URL("../src/routes/api/public/hooks/retry-emails.ts", import.meta.url),
  "utf8",
);
const paymentRecheckRoute = await readFile(
  new URL("../src/routes/api/public/hooks/recheck-payments.ts", import.meta.url),
  "utf8",
);
const paymentEmail = await readFile(
  new URL("../src/lib/payment-email.server.ts", import.meta.url),
  "utf8",
);
const therapistEmail = await readFile(
  new URL("../src/lib/therapist-email.server.ts", import.meta.url),
  "utf8",
);
const adminFunctions = await readFile(
  new URL("../src/lib/admin.functions.ts", import.meta.url),
  "utf8",
);
const paymentsFunctions = await readFile(
  new URL("../src/lib/payments.functions.ts", import.meta.url),
  "utf8",
);
const adminEmailsRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.emails.tsx", import.meta.url),
  "utf8",
);
const adminBookingsRoute = await readFile(
  new URL("../src/routes/_authenticated.admin.bookings.tsx", import.meta.url),
  "utf8",
);
const paystackWebhookRoute = await readFile(
  new URL("../src/routes/api/public/paystack-webhook.ts", import.meta.url),
  "utf8",
);

test("email adapter is wired to Resend and records delivery logs", () => {
  assert.match(emailServer, /fetch\("https:\/\/api\.resend\.com\/emails"/);
  assert.match(emailServer, /authorization:\s*`Bearer \${params\.apiKey}`/);
  assert.match(emailServer, /reply_to:\s*params\.replyTo \|\| undefined/);
  assert.match(emailServer, /recordLog\(\{/);
  assert.match(emailServer, /email_delivery_logs/);
  assert.match(emailFunctions, /getEmailAdminData/);
  assert.match(emailFunctions, /updateEmailSettings/);
  assert.match(emailFunctions, /setEmailApiKey/);
  assert.match(emailFunctions, /listEmailDeliveryLogs/);
  assert.match(emailFunctions, /deleteEmailDeliveryLog/);
});

test("transactional email templates cover confirmations, reminders, contact, and password reset", () => {
  assert.match(emailTemplates, /booking_confirmation/);
  assert.match(emailTemplates, /therapist_booking_notice/);
  assert.match(emailTemplates, /therapist_account_invitation/);
  assert.match(emailTemplates, /booking_reminder_24h/);
  assert.match(emailTemplates, /booking_reminder_1h/);
  assert.match(emailTemplates, /reschedule_notice/);
  assert.match(emailTemplates, /cancellation_notice/);
  assert.match(emailTemplates, /contact_ack/);
  assert.match(emailTemplates, /contact_admin_notice/);
  assert.match(emailTemplates, /form_reminder/);
  assert.match(emailTemplates, /payment_success/);
  assert.match(emailTemplates, /payment_failed/);
  assert.match(emailTemplates, /bank_transfer_received/);
  assert.match(emailTemplates, /password_reset/);
  assert.match(adminEmailsRoute, /Preview/);
  assert.match(adminEmailsRoute, /Send/);
  assert.match(adminEmailsRoute, /Delivery log/);
});

test("session emails separate online links from in-person locations", () => {
  assert.match(emailTemplates, /if \(pick\(data, "mode"\) !== "online"\) return ""/);
  assert.match(emailTemplates, /Physical session location/);
  assert.match(emailTemplates, /TS\.addresses\[0\]/);
  assert.match(emailTemplates, /TS\.addresses\[1\]/);
});

test("client booking emails include first-time assessment links", () => {
  assert.match(emailTemplates, /FIRST_TIME_ASSESSMENTS/);
  assert.match(emailTemplates, /FIRST_TIME_ASSESSMENT_EMAIL/);
  assert.match(emailTemplates, /firstTimeAssessmentBlock/);
  assert.match(emailTemplates, /Forward your 1st assessment result/);
  assert.match(
    emailTemplates,
    /firstTimeAssessmentBlock\(\),\s*"Your Talk Space session is booked/,
  );
  assert.match(
    emailTemplates,
    /firstTimeAssessmentBlock\(\),\s*pick\(data, "bookingNeedsReview"\) === "yes"\s*\? "[^"]+"\s*: "Your payment and booking are confirmed/,
  );
  assert.match(
    emailTemplates,
    /firstTimeAssessmentBlock\(\),\s*"Your bank transfer is awaiting review/,
  );
  assert.match(
    emailTemplates,
    /firstTimeAssessmentBlock\(\),\s*"Your Talk Space package booking link is ready/,
  );
});

test("admins can send a tracked reminder for an unfinished intake form", () => {
  assert.match(emailFunctions, /sendIntakeFormReminder/);
  assert.match(emailFunctions, /completion_state/);
  assert.match(emailFunctions, /form_reminder/);
  assert.match(emailFunctions, /reminder_sent_at/);
  assert.match(adminEmailsRoute, /Delivery log/);
});

test("contact submissions store admin-visible records and email notifications", () => {
  assert.match(contactFunctions, /contact_submissions/);
  assert.match(contactFunctions, /intake_submissions/);
  assert.match(contactFunctions, /contact_ack/);
  assert.match(contactFunctions, /contact_admin_notice/);
  assert.match(contactFunctions, /delivery_error/);
  assert.match(contactFunctions, /contactInbox \|\| settings\.fromEmail/);
  assert.match(contactFunctions, /ack_sent_at/);
  assert.match(contactFunctions, /admin_notified_at/);
});

test("booking reminders and payment confirmations share the same email pipeline", () => {
  assert.match(bookingFunctions, /booking_reminder_24h/);
  assert.match(bookingFunctions, /booking_reminder_1h/);
  assert.match(bookingFunctions, /reschedule_notice/);
  assert.match(bookingFunctions, /cancellation_notice/);
  assert.match(bookingFunctions, /booking_confirmation/);
  assert.match(remindersRoute, /booking_reminder_24h/);
  assert.match(remindersRoute, /booking_reminder_1h/);
  assert.match(remindersRoute, /reminder_24h_open_min_minutes/);
  assert.match(remindersRoute, /reminder_1h_open_min_minutes/);
});

test("admins can resend a confirmed booking confirmation with the current meeting link", () => {
  assert.match(bookingFunctions, /export const resendBookingConfirmation/);
  assert.match(bookingFunctions, /row\.status !== "confirmed"/);
  assert.match(bookingFunctions, /await fireGoogleSync\(row\.id as string\)/);
  assert.match(bookingFunctions, /sendTemplateEmail\("booking_confirmation"/);
  assert.match(bookingFunctions, /meetingLink: row\.google_meet_url \?\? ""/);
  assert.match(bookingFunctions, /buildActiveManageUrl/);
  assert.match(adminBookingsRoute, /resendBookingConfirmation/);
  assert.match(adminBookingsRoute, /Resend confirmation/);
});

test("client booking confirmation is sent only after package credit commitment", () => {
  assert.equal([...bookingFunctions.matchAll(/fireEmail\("booking_confirmation"/g)].length, 2);
  assert.match(
    bookingFunctions,
    /if \(packageCredit\) \{\s*await fireEmail\("booking_confirmation"/,
  );
  assert.ok(
    bookingFunctions.indexOf("if (packageCredit) await fireGoogleSync(held.id);") <
      bookingFunctions.indexOf('await fireEmail("booking_confirmation"'),
  );
  assert.doesNotMatch(bookingFunctions, /serviceName:\s*""/);
  assert.doesNotMatch(bookingFunctions, /therapistName:\s*""/);
});

test("online booking emails can include stored Google Meet links", () => {
  assert.match(emailTemplates, /onlineMeetingBlock/);
  assert.match(emailTemplates, /Join online session/);
  assert.match(emailTemplates, /meetingLink/);
  assert.match(bookingFunctions, /google_meet_url/);
  assert.match(bookingFunctions, /meetingLink:\s*ctx\.google_meet_url \?\? ""/);
  assert.match(paymentEmail, /google_meet_url/);
  assert.match(paymentEmail, /meetingLink:\s*appointment\.google_meet_url \?\? ""/);
  assert.match(remindersRoute, /google_meet_url/);
  assert.match(remindersRoute, /meetingLink:\s*row\.google_meet_url \?\? ""/);
});

test("successful payment confirmations sync Google before sending the client email", () => {
  assert.match(paymentsFunctions, /async function syncGoogleBeforePaymentEmail/);
  assert.match(paymentsFunctions, /async function syncGoogleForPaymentReference/);
  assert.match(
    paymentsFunctions,
    /if \(newStatus === "succeeded"\) \{\s*await syncClientRecordsForSuccessfulPayment\(data.reference\);\s*await syncGoogleForPaymentReference\(data.reference\);/,
  );
  assert.match(paymentRecheckRoute, /syncAppointmentToGoogle/);
  assert.ok(
    paymentRecheckRoute.indexOf("await syncAppointmentToGoogle") <
      paymentRecheckRoute.indexOf("await sendPaymentEmail"),
  );
});

test("all successful payment reconciliation paths share client and internal notifications", () => {
  assert.match(paymentsFunctions, /export async function sendPaymentEmailsForReference/);
  assert.match(paymentsFunctions, /booking_admin_notice/);
  assert.match(paymentsFunctions, /sendTherapistBookingEmail/);
  assert.match(paymentsFunctions, /Paid and confirmed/);
  assert.match(paymentsFunctions, /checkout_group_reference/);
  assert.match(paystackWebhookRoute, /sendPaymentEmailsForReference/);
  assert.match(paymentRecheckRoute, /sendPaymentEmailsForReference/);
});

test("paid bookings resolve the linked therapist login and send an idempotent therapist notice", () => {
  assert.match(bookingFunctions, /sendTherapistBookingEmail/);
  assert.match(emailTemplates, /A paid Talk Space session has been assigned to you/);
  assert.match(therapistEmail, /therapist_booking_notice/);
  assert.match(therapistEmail, /getUserById/);
  assert.match(therapistEmail, /therapist_notification_claimed_at/);
});

test("lifecycle notices use atomic appointment claims and release failed claims", () => {
  assert.match(bookingFunctions, /claim_appointment_notification/);
  assert.match(bookingFunctions, /finalize_appointment_notification/);
  assert.match(bookingFunctions, /notificationKey: "reschedule_notice"/);
  assert.match(bookingFunctions, /notificationKey: "cancellation_notice"/);
});

test("new therapist accounts use the branded Resend invitation template", () => {
  assert.match(adminFunctions, /auth\.admin\.generateLink/);
  assert.doesNotMatch(adminFunctions, /auth\.admin\.inviteUserByEmail/);
  assert.match(adminFunctions, /therapist_account_invitation/);
  assert.match(emailTemplates, /Accept invitation/);
});

test("payment outcomes use dedicated email templates", () => {
  assert.match(paymentEmail, /payment_success/);
  assert.match(paymentEmail, /payment_failed/);
  assert.match(paymentEmail, /bank_transfer_received/);
  assert.match(paymentEmail, /payment_success_email_claimed_at/);
  assert.match(paymentEmail, /\.is\(claimColumn, null\)/);
  assert.match(paymentEmail, /already_notified/);
  assert.match(bookingFunctions, /booking_confirmation/);
});

test("failed provider deliveries have encrypted bounded retries and admin resend", () => {
  assert.match(emailServer, /retry_payload_ciphertext/);
  assert.match(emailServer, /encryptRetryEnvelope/);
  assert.match(emailServer, /MAX_AUTOMATIC_RETRIES = 3/);
  assert.match(emailServer, /processDueEmailRetries/);
  assert.match(emailServer, /\.not\("next_retry_at", "is", null\)/);
  assert.match(emailFunctions, /retryEmailDeliveryLog/);
  assert.match(retryRoute, /verifyCronRequest/);
  assert.match(retryRoute, /processDueEmailRetries/);
  assert.match(paymentRecheckRoute, /processDueEmailRetries/);
  assert.match(paymentRecheckRoute, /GET: \(\{ request \}\) => recheckPayments\(request\)/);
  assert.match(adminEmailsRoute, /Resend/);
});
