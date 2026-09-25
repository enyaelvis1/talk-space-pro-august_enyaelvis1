// Server-only email template renderer. Simple HTML string builders keep
// dependency surface small and are easy to tweak from the admin console
// (subject overrides live in email_template_settings).

import { FIRST_TIME_ASSESSMENT_EMAIL, FIRST_TIME_ASSESSMENTS } from "@/lib/first-time-assessments";
import { TS } from "@/lib/talkspace";

export type EmailTemplateKey =
  | "booking_confirmation"
  | "booking_admin_notice"
  | "therapist_booking_notice"
  | "therapist_reschedule_notice"
  | "therapist_cancellation_notice"
  | "therapist_account_invitation"
  | "booking_reminder_24h"
  | "booking_reminder_1h"
  | "reschedule_notice"
  | "cancellation_notice"
  | "contact_ack"
  | "contact_admin_notice"
  | "form_reminder"
  | "payment_success"
  | "payment_booking_review"
  | "payment_failed"
  | "bank_transfer_received"
  | "package_booking_link"
  | "password_reset";

type Data = Record<string, unknown>;

type Rendered = { subject: string; html: string };

const THERAPIST_NOTIFICATION_TEMPLATE_KEYS = new Set<EmailTemplateKey>([
  "therapist_booking_notice",
  "therapist_reschedule_notice",
  "therapist_cancellation_notice",
]);

const BRAND = {
  name: "Talk Space Counselling Services",
  deep: "#2F312C",
  mint: "#A4A58F",
  mintSoft: "#F6F2E9",
  text: "#2F312C",
  muted: "#6E715E",
  border: "#D8D2C6",
  bg: "#F6F2E9",
};

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Lagos",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMoney(amountKobo: string, currency = "NGN"): string {
  const amount = Number(amountKobo) / 100;
  if (!Number.isFinite(amount)) return `${currency} ${amountKobo}`;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount);
}

function shell(inner: string, previewText = ""): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${esc(BRAND.name)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(previewText)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
    <tr><td style="background:${BRAND.deep};padding:20px 28px;color:#fff;">
      <div style="font-size:14px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85;">Talk Space</div>
      <div style="font-size:18px;font-weight:600;margin-top:2px;">Counselling Services</div>
    </td></tr>
    <tr><td style="padding:28px;">${inner}</td></tr>
    <tr><td style="padding:20px 28px;background:${BRAND.mintSoft};color:${BRAND.muted};font-size:12px;line-height:1.6;border-top:1px solid ${BRAND.border};">
      You're receiving this email because you interacted with ${esc(BRAND.name)}.<br/>
      If you weren't expecting it, reply to let us know.
    </td></tr>
  </table>
  <p style="color:${BRAND.muted};font-size:11px;margin:16px 0 0;">© ${new Date().getFullYear()} ${esc(BRAND.name)}. All rights reserved.</p>
</td></tr>
</table>
</body></html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${BRAND.deep};">${esc(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${BRAND.text};">${text}</p>`;
}

function detailList(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;margin:8px 0 20px;">${rows
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : BRAND.mintSoft};"><td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};width:40%;">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;color:${BRAND.text};">${v}</td></tr>`,
    )
    .join("")}</table>`;
}

function cta(label: string, href: string): string {
  return `<p style="margin:20px 0 0;"><a href="${esc(href)}" style="display:inline-block;background:${BRAND.deep};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">${esc(label)}</a></p>`;
}

function firstTimeAssessmentBlock(): string {
  return `<div style="margin:20px 0 0;padding:16px;border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.mintSoft};">
    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:8px;">First-time clients</div>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${BRAND.text};">Please complete these assessments before your first session:</p>
    <ol style="margin:0 0 12px 20px;padding:0;color:${BRAND.text};font-size:14px;line-height:1.7;">
      ${FIRST_TIME_ASSESSMENTS.map(
        (assessment) =>
          `<li><a href="${esc(assessment.href)}" style="color:${BRAND.deep};font-weight:600;">${esc(assessment.title)}</a></li>`,
      ).join("")}
    </ol>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">Forward your 1st assessment result to <a href="mailto:${esc(FIRST_TIME_ASSESSMENT_EMAIL)}" style="color:${BRAND.deep};font-weight:600;">${esc(FIRST_TIME_ASSESSMENT_EMAIL)}</a>.</p>
  </div>`;
}

function onlineMeetingBlock(data: Data): string {
  if (pick(data, "mode") !== "online") return "";
  const meetingLink = pick(data, "meetingLink").trim();
  if (!meetingLink) {
    return `<div style="margin:20px 0 0;padding:16px;border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.mintSoft};">
      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:8px;">Online session link</div>
      ${p("Your Google Meet link is still being prepared. We will update your booking before the session starts.")}
    </div>`;
  }
  return `<div style="margin:20px 0 0;padding:16px;border:1px solid ${BRAND.border};border-radius:12px;background:#fff;">
    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:8px;">Online session link</div>
    ${p(
      `Join your online session with Google Meet: <a href="${esc(meetingLink)}" style="color:${BRAND.deep};font-weight:600;">${esc(meetingLink)}</a>`,
    )}
    ${cta("Join online session", meetingLink)}
  </div>`;
}

function physicalLocationBlock(data: Data): string {
  if (pick(data, "mode") !== "in_person") return "";
  const configuredAddress = pick(data, "physicalSessionAddress").trim();
  const location = pick(data, "location").trim();
  const normalized = location.toLowerCase();
  const address = normalized.includes("abuja")
    ? TS.addresses[0]
    : normalized.includes("lagos")
      ? TS.addresses[1]
      : null;
  const lines =
    configuredAddress || (address ? `${address.lines.join(", ")}, ${address.city}` : location);
  return `<div style="margin:20px 0 0;padding:16px;border:1px solid ${BRAND.border};border-radius:12px;background:#fff;">
    <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;margin-bottom:8px;">Physical session location</div>
    ${p(esc(lines || "Our care team will confirm the room address before your session."))}
  </div>`;
}

const EMAIL_BODY_PLACEHOLDERS = new Set([
  "clientName",
  "clientEmail",
  "clientPhone",
  "reference",
  "bookingReference",
  "paymentReference",
  "serviceName",
  "therapistName",
  "startsAt",
  "mode",
  "meetingLink",
  "location",
  "manageUrl",
  "adminUrl",
  "amountKobo",
  "currency",
  "paymentMethod",
  "status",
  "paymentStatus",
  "formName",
  "resumeUrl",
  "reason",
  "packageBookingUrl",
  "packageRemainingSessions",
]);

function pick(data: Data, key: string, fallback = ""): string {
  const v = data[key];
  return v === undefined || v === null ? fallback : String(v);
}

export function renderEmailTemplate(
  key: EmailTemplateKey,
  data: Data,
  bodyOverride?: string | null,
): Rendered {
  if (THERAPIST_NOTIFICATION_TEMPLATE_KEYS.has(key)) {
    data = { ...data };
    delete data.clientEmail;
    delete data.clientPhone;
  }
  if (bodyOverride?.trim()) {
    const fallback = renderEmailTemplate(key, data);
    const html = bodyOverride
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => {
        const safe = esc(paragraph).replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name) =>
          EMAIL_BODY_PLACEHOLDERS.has(name) ? esc(pick(data, name)) : "",
        );
        return p(safe.replace(/\n/g, "<br/>"));
      })
      .join("");
    return { subject: fallback.subject, html: shell(html, fallback.subject) };
  }
  switch (key) {
    case "booking_confirmation": {
      const rows: Array<[string, string]> = [
        ["Reference", esc(pick(data, "reference"))],
        ["Service", esc(pick(data, "serviceName"))],
        ["Therapist", esc(pick(data, "therapistName", "To be assigned"))],
        ["When", esc(formatDateTime(pick(data, "startsAt")))],
        ["Mode", esc(pick(data, "mode") === "in_person" ? "In person" : "Online")],
      ];
      return {
        subject: `Your Talk Space session is booked (${pick(data, "reference")})`,
        html: shell(
          heading(`Hi ${esc(pick(data, "clientName", "there"))},`) +
            p("Your session is booked. Here are the details:") +
            detailList(rows) +
            onlineMeetingBlock(data) +
            physicalLocationBlock(data) +
            (pick(data, "manageUrl") ? cta("Manage this booking", pick(data, "manageUrl")) : "") +
            p(
              "If anything changes, please reschedule or cancel at least 48 hours before your session by email, WhatsApp, phone call, or your booking link. Changes requested below 48 hours are not accepted and the session fee will be forfeited.",
            ) +
            firstTimeAssessmentBlock(),
          "Your Talk Space session is booked.",
        ),
      };
    }
    case "booking_admin_notice": {
      const adminUrl = pick(data, "adminUrl");
      return {
        subject: `New booking: ${pick(data, "reference", "Talk Space session")}`,
        html: shell(
          heading("New session booking") +
            p("A client has booked a Talk Space session. Review the details below:") +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["Client", esc(pick(data, "clientName"))],
              ["Client email", esc(pick(data, "clientEmail"))],
              ["Client phone", esc(pick(data, "clientPhone", "—"))],
              ["Service", esc(pick(data, "serviceName", "To be confirmed"))],
              ["Therapist", esc(pick(data, "therapistName", "To be assigned"))],
              ["When", esc(formatDateTime(pick(data, "startsAt")))],
              ["Mode", esc(pick(data, "mode") === "in_person" ? "In person" : "Online")],
              ["Status", esc(pick(data, "status", "held"))],
              ["Payment", esc(pick(data, "paymentStatus", "Pending payment/confirmation"))],
            ]) +
            (pick(data, "notes")
              ? p(
                  `<strong>Client note:</strong><br/>${esc(pick(data, "notes")).replace(/\n/g, "<br/>")}`,
                )
              : "") +
            (adminUrl ? cta("Open admin bookings", adminUrl) : ""),
          "A new Talk Space booking was created.",
        ),
      };
    }
    case "therapist_booking_notice": {
      return {
        subject: `New session assigned: ${pick(data, "reference", "Talk Space session")}`,
        html: shell(
          heading(`Hi ${esc(pick(data, "therapistName", "there"))},`) +
            p(
              "A paid Talk Space session has been assigned to you. Please review the details below:",
            ) +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["Client", esc(pick(data, "clientName"))],
              ["Service", esc(pick(data, "serviceName", "Session"))],
              ["When", esc(formatDateTime(pick(data, "startsAt")))],
              ["Mode", esc(pick(data, "mode") === "in_person" ? "In person" : "Online")],
            ]) +
            onlineMeetingBlock(data) +
            physicalLocationBlock(data),
          "A paid Talk Space session has been assigned to you.",
        ),
      };
    }
    case "therapist_reschedule_notice": {
      return {
        subject: `Session rescheduled: ${pick(data, "reference", "Talk Space session")}`,
        html: shell(
          heading(`Hi ${esc(pick(data, "therapistName", "there"))},`) +
            p("A Talk Space session assigned to you has been rescheduled.") +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["Client", esc(pick(data, "clientName"))],
              ["Service", esc(pick(data, "serviceName", "Session"))],
              ["New time", esc(formatDateTime(pick(data, "startsAt")))],
              ["Mode", esc(pick(data, "mode") === "in_person" ? "In person" : "Online")],
            ]) +
            onlineMeetingBlock(data) +
            physicalLocationBlock(data),
          "A Talk Space session assigned to you was rescheduled.",
        ),
      };
    }
    case "therapist_cancellation_notice": {
      return {
        subject: `Session cancelled: ${pick(data, "reference", "Talk Space session")}`,
        html: shell(
          heading(`Hi ${esc(pick(data, "therapistName", "there"))},`) +
            p(
              "A Talk Space session assigned to you has been cancelled and the time is no longer held.",
            ) +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["Client", esc(pick(data, "clientName"))],
              ["Was scheduled for", esc(formatDateTime(pick(data, "startsAt")))],
              ["Reason", esc(pick(data, "reason", "Not provided"))],
            ]),
          "A Talk Space session assigned to you was cancelled.",
        ),
      };
    }
    case "therapist_account_invitation": {
      return {
        subject: "Your Talk Space therapist account invitation",
        html: shell(
          heading(`Hi ${esc(pick(data, "therapistName", "there"))},`) +
            p("You have been invited to join Talk Space as a therapist.") +
            p(
              "Use the secure invitation link below to set your password and access your therapist dashboard.",
            ) +
            cta("Accept invitation", pick(data, "invitationUrl")) +
            p(
              "If you were not expecting this invitation, please contact the Talk Space care team.",
            ),
          "Your Talk Space therapist account invitation is ready.",
        ),
      };
    }
    case "booking_reminder_24h":
    case "booking_reminder_1h": {
      const when = key === "booking_reminder_24h" ? "tomorrow" : "in about an hour";
      return {
        subject: `Reminder: your Talk Space session ${when}`,
        html: shell(
          heading(`Hi ${esc(pick(data, "clientName", "there"))},`) +
            p(`This is a friendly reminder that your session is ${when}.`) +
            detailList([
              ["Service", esc(pick(data, "serviceName"))],
              ["When", esc(formatDateTime(pick(data, "startsAt")))],
              ["Mode", esc(pick(data, "mode") === "in_person" ? "In person" : "Online")],
            ]) +
            onlineMeetingBlock(data) +
            physicalLocationBlock(data) +
            (pick(data, "manageUrl") ? cta("View booking", pick(data, "manageUrl")) : ""),
          `Talk Space session ${when}.`,
        ),
      };
    }
    case "reschedule_notice": {
      return {
        subject: `Your Talk Space session was rescheduled`,
        html: shell(
          heading(`Hi ${esc(pick(data, "clientName", "there"))},`) +
            p("Your session time has been updated.") +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["New time", esc(formatDateTime(pick(data, "startsAt")))],
              ["Service", esc(pick(data, "serviceName"))],
            ]) +
            onlineMeetingBlock(data) +
            physicalLocationBlock(data) +
            (pick(data, "manageUrl") ? cta("View booking", pick(data, "manageUrl")) : ""),
          "Your Talk Space session was rescheduled.",
        ),
      };
    }
    case "cancellation_notice": {
      return {
        subject: `Your Talk Space session was cancelled`,
        html: shell(
          heading(`Hi ${esc(pick(data, "clientName", "there"))},`) +
            p(
              "Your session has been cancelled. If this wasn't you, please reply to this email or contact our care team.",
            ) +
            detailList([
              ["Reference", esc(pick(data, "reference"))],
              ["Was scheduled for", esc(formatDateTime(pick(data, "startsAt")))],
            ]),
          "Your Talk Space session was cancelled.",
        ),
      };
    }
    case "contact_ack": {
      return {
        subject: `We received your message`,
        html: shell(
          heading(`Thanks for reaching out, ${esc(pick(data, "clientName", "there"))}.`) +
            p("Our care team will get back to you within one working day.") +
            p(
              `<strong>Your message:</strong><br/>${esc(pick(data, "message")).replace(/\n/g, "<br/>")}`,
            ),
          "We received your message.",
        ),
      };
    }
    case "contact_admin_notice": {
      return {
        subject: `New contact submission from ${pick(data, "clientName", "website")}`,
        html: shell(
          heading("New contact submission") +
            detailList([
              ["Name", esc(pick(data, "clientName"))],
              ["Email", esc(pick(data, "email"))],
              ["Phone", esc(pick(data, "phone", "—"))],
              ["Source", esc(pick(data, "source", "contact_page"))],
            ]) +
            p(
              `<strong>Message:</strong><br/>${esc(pick(data, "message")).replace(/\n/g, "<br/>")}`,
            ),
          "A new contact form submission arrived.",
        ),
      };
    }
    case "form_reminder": {
      const formName = pick(data, "formName", "requested form");
      return {
        subject: `Reminder: complete your ${formName}`,
        html: shell(
          heading(`Hi ${esc(pick(data, "clientName", "there"))},`) +
            p(
              `Your <strong>${esc(formName)}</strong> has not been completed yet. You can continue whenever you're ready using the secure link below.`,
            ) +
            (pick(data, "resumeUrl") ? cta("Continue your form", pick(data, "resumeUrl")) : "") +
            p(
              "If you have already completed the form or need help, reply to this email and our care team will assist you.",
            ),
          `Your ${formName} is waiting for you.`,
        ),
      };
    }
    case "payment_success": {
      const meetingPending = pick(data, "mode") === "online" && !pick(data, "meetingLink").trim();
      return {
        subject: `Payment confirmed (${pick(data, "paymentReference")})`,
        html: shell(
          heading(`Payment confirmed, ${esc(pick(data, "clientName", "there"))}.`) +
            p(
              pick(data, "bookingNeedsReview") === "yes"
                ? "We received your payment, but your booking needs review. Do not pay again. Reply with your payment reference so our team can arrange rescheduling or a refund review."
                : meetingPending
                  ? "We received your payment and your Talk Space session is confirmed. Your Google Meet link is still being prepared and will be added to your booking."
                  : "We received your payment and your Talk Space session is confirmed.",
            ) +
            detailList([
              ["Payment reference", esc(pick(data, "paymentReference"))],
              ["Booking reference", esc(pick(data, "bookingReference"))],
              [
                "Booking amount",
                esc(formatMoney(pick(data, "amountKobo"), pick(data, "currency", "NGN"))),
              ],
              ...(pick(data, "checkoutPaidKobo")
                ? ([
                    [
                      "Total paid for checkout",
                      esc(
                        formatMoney(pick(data, "checkoutPaidKobo"), pick(data, "currency", "NGN")),
                      ),
                    ],
                    [
                      "Checkout fees added",
                      esc(
                        formatMoney(pick(data, "checkoutFeeKobo"), pick(data, "currency", "NGN")),
                      ),
                    ],
                  ] as [string, string][])
                : []),
              ["Payment method", esc(pick(data, "paymentMethod", "Online payment"))],
              ["Service", esc(pick(data, "serviceName"))],
              ["Session time", esc(formatDateTime(pick(data, "startsAt")))],
            ]) +
            (pick(data, "bookingNeedsReview") === "yes"
              ? ""
              : onlineMeetingBlock(data) +
                physicalLocationBlock(data) +
                (pick(data, "manageUrl")
                  ? cta("Manage your booking", pick(data, "manageUrl"))
                  : "")) +
            (pick(data, "packageBookingUrl")
              ? p(
                  `Your package has ${esc(pick(data, "packageRemainingSessions"))} remaining session(s).`,
                ) + cta("Book another package session", pick(data, "packageBookingUrl"))
              : "") +
            firstTimeAssessmentBlock(),
          pick(data, "bookingNeedsReview") === "yes"
            ? "Payment received; booking needs review."
            : "Your payment and booking are confirmed.",
        ),
      };
    }
    case "payment_booking_review": {
      return {
        subject: `Payment received; booking under review (${pick(data, "paymentReference")})`,
        html: shell(
          heading("Payment received. Your booking needs review.") +
            p(
              "Your payment was received, but the requested appointment could not be confirmed. Our team will contact you to arrange another available time or review a refund. Please do not pay again.",
            ) +
            detailList([
              ["Payment reference", esc(pick(data, "paymentReference"))],
              ["Booking reference", esc(pick(data, "bookingReference"))],
              ["Amount", esc(formatMoney(pick(data, "amountKobo"), pick(data, "currency", "NGN")))],
            ]),
          "Payment received. Awaiting rescheduling or refund review.",
        ),
      };
    }
    case "payment_failed": {
      return {
        subject: `Payment was not completed (${pick(data, "paymentReference")})`,
        html: shell(
          heading(`Your payment was not completed`) +
            p(
              `Hi ${esc(pick(data, "clientName", "there"))}, we could not confirm your payment for booking <strong>${esc(pick(data, "bookingReference"))}</strong>.`,
            ) +
            detailList([
              ["Payment reference", esc(pick(data, "paymentReference"))],
              ["Amount", esc(formatMoney(pick(data, "amountKobo"), pick(data, "currency", "NGN")))],
            ]) +
            (pick(data, "manageUrl") ? cta("Try payment again", pick(data, "manageUrl")) : "") +
            p("If money was deducted, reply to this email before trying again."),
          "Your Talk Space payment needs attention.",
        ),
      };
    }
    case "bank_transfer_received": {
      return {
        subject: `Bank transfer submitted (${pick(data, "paymentReference")})`,
        html: shell(
          heading(`Transfer details received, ${esc(pick(data, "clientName", "there"))}.`) +
            p("Our team will review the transfer and email you again when it is confirmed.") +
            detailList([
              ["Payment reference", esc(pick(data, "paymentReference"))],
              ["Booking reference", esc(pick(data, "bookingReference"))],
              ["Amount", esc(formatMoney(pick(data, "amountKobo"), pick(data, "currency", "NGN")))],
            ]) +
            (pick(data, "manageUrl") ? cta("View your booking", pick(data, "manageUrl")) : "") +
            firstTimeAssessmentBlock(),
          "Your bank transfer is awaiting review.",
        ),
      };
    }
    case "package_booking_link": {
      return {
        subject: `Your Talk Space package booking link`,
        html: shell(
          heading(`Your package is ready, ${esc(pick(data, "clientName", "there"))}.`) +
            p(
              "Use this private link whenever you want to schedule a remaining session from your package.",
            ) +
            detailList([
              ["Package reference", esc(pick(data, "packageReference"))],
              ["Service", esc(pick(data, "serviceName"))],
              ["Sessions purchased", esc(pick(data, "purchasedSessions"))],
              ["Sessions remaining", esc(pick(data, "remainingSessions"))],
              ["Expires", esc(formatDateTime(pick(data, "expiresAt")) || "No expiry set")],
            ]) +
            (pick(data, "packageBookingUrl")
              ? cta("Book a package session", pick(data, "packageBookingUrl"))
              : "") +
            p(
              "Keep this link private. Anyone with the link can schedule from your package balance.",
            ) +
            firstTimeAssessmentBlock(),
          "Your Talk Space package booking link is ready.",
        ),
      };
    }
    case "password_reset": {
      return {
        subject: `Reset your Talk Space password`,
        html: shell(
          heading("Reset your password") +
            p(
              `Hi ${esc(pick(data, "clientName", "there"))}, use the link below to choose a new password.`,
            ) +
            (pick(data, "resetUrl") ? cta("Choose a new password", pick(data, "resetUrl")) : "") +
            p("If you didn't request this, you can safely ignore this email."),
          "Reset your Talk Space password.",
        ),
      };
    }
  }
}
