# Larger product remaining checklist

This is the execution backlog extracted from the unfinished and partial items in
[`IMPLEMENTATION_CHECKLIST.md`](IMPLEMENTATION_CHECKLIST.md). The focused CMS backlog is tracked separately in
[`REMAINING_IMPLEMENTATION_CHECKLIST.md`](REMAINING_IMPLEMENTATION_CHECKLIST.md).

Status markers: `[ ]` not started · `[~]` in progress · `[p]` partial · `[x]` complete · `[!]` blocked.

Current source status: **124/200 fully complete**, **7 partial**, **69 not started**.

## 1. Product decisions and repository foundation

- [ ] Approve terminology and the remaining product sections.
      _Notes: Draft canonical terminology and section map recorded in `docs/PRODUCT_TERMINOLOGY_AND_SECTIONS.md` for review._
- [ ] Confirm inclusions, exclusions, staff roles, services, prices, and booking rules.
      _Notes: Current operating scope and booking rules drafted in `docs/PRODUCT_SCOPE_AND_BOOKING_RULES.md` from the existing public pages, admin CMS, booking flow, and legal copy._
- [ ] Confirm providers, cost ownership, retention owners, and success measures.
- [x] Protect the repository and document the Node, package manager, TypeScript, and lockfile baseline.
      _Notes: `package.json` now declares the Node 22 baseline and `docs/REPOSITORY_BASELINE.md` records the npm/TypeScript/lockfile policy._
- [x] Configure linting, formatting, pre-commit checks, CI, secret scanning, and dependency scanning.
      _Notes: `scripts/pre-commit.mjs`, `.githooks/pre-commit`, `.github/workflows/ci.yml`, `.github/workflows/security.yml`, and `.github/dependabot.yml` now cover staged-file formatting, local hook setup, CI, secret scanning, and dependency auditing._
- [x] Add PR/issue templates and a changelog/release process.
      _Notes: `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/*`, and `docs/RELEASE_PROCESS.md` are now in place._

## 2. Brand and responsive design

- [x] Document component states and interaction states.
      _Notes: `docs/COMPONENT_STATES.md` captures the shared state matrix for buttons, inputs,
      cards, navigation, loading, empty, error, and selected states, and `docs/DESIGN_SYSTEM.md`
      now links to it as the canonical reference._
- [x] Approve the responsive design direction across mobile, tablet, and desktop.
      _Notes: Verified on the live app at 390×844, 820×1180, and 1280×900. Screenshots: `docs/qa/responsive-design/home-mobile.png`, `docs/qa/responsive-design/home-tablet.png`, and `docs/qa/responsive-design/home-desktop.png`. The home layout stays readable and balanced across breakpoints, with the header collapsing cleanly on mobile/tablet and the public dock remaining accessible._

## 3. Authentication and permissions

- [x] Complete the managed-auth audit and permission review.
      _Notes: Verified on the live app with temporary QA admin/client accounts. Admin sign-in reaches `/admin`, client sign-in reaches `/account`, `/admin` rejects the client with the restricted account notice, and `/admin/progress` rejects the QA admin account with the forbidden progress notice._
- [x] Complete password-reset verification.
      _Notes: Verified the live reset-request screen, recovery-mode password update, and post-reset sign-in on the app using a Supabase-generated recovery link for a temporary QA account. The route also shows the built-in reset-request throttle state, so repeated requests fail safely instead of spamming the mailbox._
- [x] Add MFA readiness and step-up protection for sensitive actions.

## 4. Client management and payments

- [x] Complete payment and form summaries in client records.
- [p] Complete Paystack sandbox end-to-end verification.

## 5. Forms and secure intake

- [x] Inventory existing Google Forms and decide which are retained.
      _Notes: The inventory in `docs/FORMS_INVENTORY_AND_RETENTION.md` now confirms that all intake forms are handled in-app and the admin view is the only review surface; no Google Forms workflow is retained._
- [x] Create versioned form templates.
      _Notes: Template registry and versioning rules drafted in `docs/FORM_TEMPLATES_AND_VERSIONING.md`. Secure intake rows now persist `template_key` and `template_version` so staff can review the exact rendered version later._
- [x] Add an admin question editor.
      _Notes: Forms editor added at `/admin/forms`, the public booking/contact pages now read the saved template registry, and versioned templates resolve to the latest matching base key._
- [p] Add secure client intake storage and access controls.
  _Notes: A protected `intake_submissions` ledger now stores booking, contact, and assessment snapshots, and admins can review them from the client detail page._
- [x] Add approved assessment forms.
      _Notes: Approved internal assessment templates added to the registry and surfaced in `/admin/forms`._
- [x] Add save/resume support.
      _Notes: Booking and contact intake now autosave browser drafts and restore them on return, with explicit clear-draft controls and cleanup after submission._
- [x] Add completion-state tracking.
      _Notes: Public booking and contact forms now show a live readiness state, and intake submissions record an explicit completion_state alongside completed_at._
- [x] Add consent acknowledgement and auditability.

## 6. Google Calendar and meetings

- [x] Configure Google OAuth.
      _Notes: Admin Google settings UI and server helpers now store the OAuth client ID, encrypted secret, redirect URI, and scopes._
- [x] Connect therapist calendars.
      _Notes: Admin connect flow opens Google consent, returns through `/api/public/google/callback`, and persists therapist tokens plus initial busy sync/watch state._
- [x] Implement the calendar adapter.
      _Notes: `src/lib/google.server.ts` wraps Google auth, refresh, event, free/busy, and watch APIs; `src/lib/google.functions.ts` exposes the appointment sync adapter._
- [x] Create Google Meet links for confirmed appointments.
      _Notes: Confirmed appointments create Calendar events with Meet links via `createEventWithMeet`, and the meet URL is stored on the appointment row._
- [x] Sync reschedules and cancellations.
      _Notes: Confirmed appointments patch the existing Google event through `patchEvent` when times change; cancelled, completed, and no-show appointments delete the event and clear the stored Google refs._
- [x] Add retry and synchronisation state tracking.
      _Notes: Admin retry, connection health, push callbacks, and appointment sync state are all tracked in-app._
- [x] Add failure-path tests.
      _Notes: Added source-level coverage in `test/google-calendar-flow.test.ts` for OAuth state handling, token exchange failures, and calendar sync recovery paths._

## 7. Email and notifications

- [ ] Confirm Zoho recipients and ownership.
- [p] Verify the sending domain.
- [x] Complete the Resend adapter.
      _Notes: `sendRawEmail` and `sendTemplateEmail` both route through Resend, encrypt the API key, and write delivery logs for sent/failed/skipped outcomes._
- [x] Finalise confirmation, form-reminder, appointment-reminder, and payment templates.
      _Notes: Commit `4ee365e` completes dedicated Paystack success/failure and bank-transfer-received templates and connects them to every payment confirmation path with duplicate-delivery protection. The existing booking, reminder, cancellation, reschedule, contact, form-reminder, and password-reset families remain editable in `/admin/emails`._
- [x] Add delivery, retry, and resend monitoring.
      _Notes: Commits `4ee365e` and `4301852` add encrypted retry envelopes, bounded 5/15/60-minute retry eligibility, plan-compatible daily processing, a `CRON_SECRET`-protected endpoint for optional higher-frequency scheduling, and an admin Resend action with retry-chain, trigger, and actor metadata. Automated checks: `npm test` (43/43), `npm run lint` (0 errors; 6 baseline warnings), `npm run build`, migration dry-run/push, and app HTTP checks. Manual app check: force a provider failure, restore the Resend key, resend from `/admin/emails`, and confirm the linked delivery succeeds. External dependencies: verified Resend sender domain and `CRON_SECRET`; near-real-time retries require a higher-frequency scheduler or upgraded Vercel cron plan._

## 8. Contact and WhatsApp

- [x] Complete the contact form workflow.
      _Notes: The public contact page uses a versioned in-app template, restores drafts, requires consent, and submits to `submitContactMessage`._
- [x] Route contact submissions to Zoho.
      _Notes: Commit `280b7bb` adds an explicit Zoho Mail routing control and validated recipient in `/admin/emails`; the enquiry remains available in admin while the notification is delivered to the Zoho mailbox with routing context. Migration `20260802183000_contact_zoho_routing.sql` is applied. Production enablement still depends on confirming the mailbox owner under the separate Email item._
- [x] Add spam and rate protection.
      _Notes: The contact server fn uses a honeypot plus an IP-based rate limit of 5 submissions/hour._
- [x] Store and manage enquiries in the admin.
      _Notes: Every submission is written to `contact_submissions` and mirrored into `intake_submissions`; admin emails shows the enquiry log and delete action._
- [x] Confirm the WhatsApp number and prefilled message.
      _Notes: Talk Space phone/WhatsApp constants are centralized in `src/lib/talkspace.ts` and reused across the site; `WHATSAPP_HREF` includes the prefilled outreach message for click-to-chat._
- [x] Verify the experience on desktop and mobile.
      _Notes: Commit `280b7bb` verifies `/contact` at 390×844 and 1280×900 and confirms the encoded WhatsApp click-to-chat target. Screenshots are stored in `docs/qa/contact/`. Automated checks: `npm test` (43/43), `npm run lint` (0 errors; 6 baseline warnings), and `npm run build`. Manual app check: open `/contact` on phone and desktop, check the cards and form, then activate WhatsApp and verify the number/prefilled message without sending._
- [x] Publish response guidance for administrators.
      _Notes: Commit `6d1a11d` publishes the full operational standard in `docs/ADMIN_RESPONSE_GUIDANCE.md` and places the triage, response-time, escalation, and privacy guidance in `/admin/emails`. Automated checks: `npm test` (45/45), `npm run lint` (0 errors; 6 baseline warnings), and `npm run build`. Manual app check: review the guidance in `/admin/emails` at mobile and desktop widths._

## 9. Admin operations and auditability

- [x] Complete the operational overview.
- [x] Add today/upcoming operational views.
- [x] Add pending-form and pending-transfer queues.
- [x] Add failed notification and failed Meet queues.
      _Notes: Commit `6d1a11d` adds unresolved email-delivery and Google Calendar/Meet queues to `/admin`, with bounded data reads, retry-chain resolution, counts, error context, and links to `/admin/emails` and `/admin/google`. Manual app check: verify both populated and empty states in the admin dashboard; provider-failure simulation remains restricted to a safe non-production environment._
- [x] Add a complete appointment timeline.
      _Notes: Commit `5cbc8f7` adds immutable appointment-event capture and a consolidated on-demand timeline in `/admin/bookings`, including appointment states, reschedules, payments, intake completion, reminders, and Google Calendar/Meet outcomes. Migration `20260802200000_appointment_timeline.sql` is applied and existing appointments are backfilled._
- [x] Consolidate integration and site settings.
      _Notes: Commit `5cbc8f7` makes `/admin/settings` the central configuration and health hub for public site details, email/Zoho, payments, Google Calendar/Meet, availability, reminders, and sensitive-action security. Live readiness sources load in parallel and link to dedicated editors._
- [x] Add an audit log with actor, action, reason, and timestamp.
      _Notes: Commit `989de11` adds an immutable, admin-readable audit table and `/admin/audit`. Database triggers capture actor/system identity, action, target, non-sensitive reason, changed field names, and timestamp across operational, integration, and CMS tables without duplicating secrets or client payload values. Migration `20260802213000_admin_audit_log.sql` is applied and trigger behavior was verified remotely._

## 10. Migration and legacy content

- [x] Export the remaining WordPress content and media inventory.
      _Notes: Commit `989de11` adds a reproducible read-only WordPress REST inventory exporter plus dated Markdown/JSON artifacts. The 2 August export contains 100 content records and 179 publicly returned media records; WordPress reports 182 media records, leaving three inaccessible/unreturned records explicitly flagged for content-owner review._
- [x] Inventory all legacy URLs.
      _Notes: The read-only `npm run content:urls -- YYYY-MM-DD` exporter produced a dated Markdown/JSON/CSV inventory of 458 normalized sitemap, content, attachment-page, and media-asset URLs. Current checks distinguish 229 reachable URLs, 228 WordPress-rate-limited responses, and one confirmed non-success response instead of treating throttling as broken content._
- [p] Select approved content for migration.
  _Notes: Migrations `20260802223000` and `20260802223500` seed exactly the 100 WordPress records into an admin-only review queue. `/admin/migration` records explicit approved, excluded, needs-revision, or pending decisions with a destination, reason, reviewer, timestamp, and audit event. Completion requires the content owner to review all pending records in the app._
- [ ] Migrate approved core content.
- [ ] Optimise migrated media and correct content errors.
- [ ] Complete and verify the redirect map.
- [ ] Obtain content-owner approval before removing obsolete content.

## 11. SEO, performance, accessibility, and security

- [x] Complete Core Web Vitals work.
      _Notes: Deployed mobile evidence records Lighthouse performance 94, LCP 2.47 s, TBT 12.5 ms and CLS 0.0001 in `docs/qa/performance/home-core-web-vitals.json`._
- [x] Complete keyboard and screen-reader verification.
      _Notes: Seven principal public routes pass the automated keyboard, landmark, accessible-name, Chrome accessibility-tree and axe WCAG 2.2 AA checks with no serious or critical violations; see `docs/qa/accessibility/public-accessibility-audit.json`._
- [p] Complete Lighthouse and axe verification.
- [ ] Configure CSP and HSTS.
- [ ] Complete CSRF/CORS review and rate limits.
- [ ] Verify private storage and protect tokens/secrets.
- [ ] Add security and audit logging.
- [ ] Add token expiry and revocation controls.
- [ ] Complete the threat and security review.

## 12. Automated QA and release testing

- [ ] Add unit coverage for availability and booking states.
- [ ] Add permission and token tests.
- [ ] Add Paystack edge-case tests and bank-transfer review tests.
- [ ] Add form-version tests.
- [ ] Add critical Playwright coverage.
- [ ] Complete cross-browser and mobile testing.
- [ ] Obtain staging QA sign-off.

## 13. Deployment and launch

- [ ] Create and document development, staging, and production environments.
- [ ] Configure DNS, CDN, SSL, Vercel settings, and production secrets.
- [ ] Verify storage policies and background jobs/retries.
- [ ] Configure error monitoring and uptime monitoring.
- [ ] Document rollback and emergency access.
- [ ] Load approved production data and content.
- [ ] Verify domain redirects and SSL.
- [ ] Run production smoke tests.
- [ ] Verify production Paystack, Google, Resend, and Zoho integrations.
- [ ] Train two administrators.
- [ ] Deliver source code and operating documentation.
- [ ] Obtain acceptance and begin the maintenance period.

## 14. Post-launch maintenance

- [ ] Monitor the first production bookings.
- [ ] Review webhook errors, reminders, and calendar synchronisation.
- [ ] Fix launch-scope defects.
- [ ] Apply security patches.
- [ ] Review staff access.
- [ ] Complete the post-launch review.
- [ ] Record future change requests.

## Working rule

Start at section 1 and move downward. After each item, record the implementation commit, automated
checks, manual test steps, owner, and any external dependency before marking it complete.
