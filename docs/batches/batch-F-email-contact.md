# Batch F — Email + Contact

**Sections:** 15 (Email via Resend), 16 (Contact form → Zoho)

## Scope

- Resend integration with verified domain (`talkspace.ng`).
- Transactional templates: booking confirmed, reminder (24h/1h), reschedule, cancellation, password reset.
- Contact form posts to server fn → Zoho Mail SMTP (or Zoho Desk API) + database log.
- WhatsApp click-to-chat already wired; add Instagram/Facebook/LinkedIn/YouTube to footer.

## Acceptance

- All transactional emails deliver to Gmail/Outlook inbox, not spam.
- Contact form submissions appear in Zoho within 60s.
