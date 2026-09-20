# 29. Implementation Checklist

**Product:** Talk Space Counselling Services  
**Document version:** 1.0  
**Last updated:** 2 August 2026 (progress reconciled with the tracked task markers)
**Working platform promise:** _Confidential. Professional. Accessible._  
**Status:** Scope-aligned implementation baseline

> Execution checklist for the agreed Talk Space scope. 200 items tracked.

---

## Status legend

- `[ ]` Not Started
- `[~]` In Progress
- `[p]` Partial
- `[x]` Done
- `[!]` Blocked

**Progress:** `133 / 200 complete` — `67% direct completion`; `68% weighted completion` (7 partial tasks contribute 50% each)

> Design QA gate: every milestone with a visual surface must pass the
> checklist in [`DESIGN_QA_CHECKLIST.md`](DESIGN_QA_CHECKLIST.md) and attach
> the required screenshots (mobile / tablet / desktop) before merge.

## 01. Documentation and scope — 0/8

- [ ] **Approve terminology**  
      _Notes:_
- [ ] **Approve Sections 01–28**  
      _Notes:_
- [ ] **Confirm inclusions/exclusions**  
      _Notes:_
- [ ] **Confirm staff roles**  
      _Notes:_
- [ ] **Confirm services/prices/rules**  
      _Notes:_
- [ ] **Confirm providers/cost ownership**  
      _Notes:_
- [ ] **Confirm retention/policy owners**  
      _Notes:_
- [ ] **Confirm success measures**  
      _Notes:_

## 02. Repository foundation — 0/8

- [ ] **Create/protect repository**  
      _Notes:_
- [ ] **Configure pnpm/Node/TypeScript/lockfile**  
      _Notes:_
- [ ] **Configure lint/format/pre-commit**  
      _Notes:_
- [ ] **Create env schema/example**  
      _Notes:_
- [ ] **Create CI**  
      _Notes:_
- [ ] **Configure secret/dependency scanning**  
      _Notes:_
- [ ] **Create PR/issue templates**  
      _Notes:_
- [ ] **Create changelog/release process**  
      _Notes:_

## 03. Brand/design — 6/8

- [x] **Obtain logo/favicon** — pending client visual approval
      _Notes: Favicon set generated from the provided src/assets/ts-logo.png; includes ICO, 16/32px, Apple Touch, and 192/512px maskable PNGs in public/._
- [x] **Finalise colours**  
      _Notes: Semantic tokens in src/styles.css (brand-deep/mint/blue)._
- [x] **Implement typography**  
      _Notes: Inter + JetBrains Mono loaded via __root.tsx link tag._
- [x] **Implement spacing/radius/motion**  
      _Notes: Tailwind v4 theme + shadcn defaults._
- [x] **Create social image**
      _Notes: 1200×630 public/og-image.jpg generated from the provided logo and counselling imagery; exposed as https://talkspace.ng/og-image.jpg._
- [x] **Configure accessible primitives**  
      _Notes: shadcn/ui (Radix) primitives across site._
- [ ] **Document component states**  
      _Notes:_
- [ ] **Approve responsive direction**  
      _Notes: Needs client sign-off._

## 04. Public shell — 6/8

- [x] **Build header/booking CTA**  
      _Notes: src/components/site/SiteHeader.tsx with Book a session button._
- [x] **Build mobile navigation**  
      _Notes: Sheet overlay with route-change close + scroll lock._
- [x] **Build footer**  
      _Notes: src/components/site/SiteFooter.tsx._
- [x] **Implement breadcrumbs/titles**
      _Notes: SiteBreadcrumbs is wired into every public non-home route, with route-specific titles and blog post overrides._
- [x] **Implement skip/focus**  
      _Notes: "Skip to content" link in SiteHeader._
- [x] **Add WhatsApp CTA**  
      _Notes: +2348155551599 wired in desktop icon + mobile sheet._
- [x] **Create 404/errors**  
      _Notes: NotFoundComponent + ErrorComponent in __root.tsx._
- [x] **Verify links/redirects**
      _Notes: Internal links remain typed TanStack routes; legacy talkspace.ng paths now return 301 via src/lib/legacy-redirects.ts and src/server.ts._

## 05. Public pages — 8/8

- [x] **Build Home**  
      _Notes: Hero, services, pricing toggle, video, FAQ, CTA._
- [x] **Build Services**  
      _Notes: src/routes/services.tsx with imagery + feature bullets._
- [x] **Build Therapists**  
      _Notes: Directory of 3 therapists with portraits._
- [x] **Build Pricing**  
      _Notes: Plans + billing FAQ._
- [x] **Build About**  
      _Notes: Story + values grid._
- [x] **Build Blog**  
      _Notes: Journal preview layout._
- [x] **Build Contact/FAQ**  
      _Notes: Contact cards (WhatsApp/email/phone) + FAQs page._
- [x] **Build approved legal/emergency pages**  
      _Notes: privacy, terms, cancellation, emergency-support._

## 06. CMS — 6/8

- [x] **Secure CMS access**
      _Notes: /admin/\* routes are gated by requireBrowserAdmin plus fail-closed server middleware; admin dashboards for Pages, Journal, Media, Services, Therapists and Settings are live._
- [x] **Page/block editor**
      _Notes: Full editor at /admin/content/$id/edit — TipTap rich text body (headings, lists, quote, code, link, image, HR), plus title/slug/author/excerpt/featured-media sidebar. Reachable via the pencil icon on /admin/pages and /admin/journal rows._
- [x] **Blog/categories**
      _Notes: 84 posts, 7 categories and 9 pages render from content_entries; /admin/journal supports search, inline edit, status toggle and bulk publish/unpublish/delete._
- [x] **Media library**
      _Notes: /admin/media provides a preview grid with tag filters, alt-text/tag editing, replace-upload, bulk tag/replace, and 30-minute soft-delete trash with an undo toast (purgeTrashedMedia handles retention)._
- [x] **Services/pricing**
      _Notes: /admin/services provides full CRUD for the service catalogue: pricing, duration, buffers, lead time, package sessions, display order, activation toggle, and therapist assignments feeding directly into the booking flow._
- [x] **Therapists/testimonials/FAQs**
      _Notes: /admin/therapists provides full profile editor, availability rules and activation; /admin/testimonials manages ratings, ordering, publish/unpublish with revision history; /admin/faqs manages categorised entries with reorder, publish and revision history._
- [x] **Draft/preview/publish/archive**
      _Notes: setContentStatus and bulkSetContentStatus handle publish/unpublish; scheduleContentPublish + publish_scheduled_content() RPC support future-dated publishing (cron endpoint at /api/public/hooks/publish-scheduled); setContentArchived hides entries from the public site; admin lists show scheduled/archived states via LifecycleMenu._
- [x] **Revisions/scheduling/redirects**
      _Notes: content_revisions trigger snapshots every insert/update/delete for FAQs, testimonials AND content_entries; restore_content_revision RPC + RevisionHistoryButton (History) on FAQ, testimonial, and content editor screens. /admin/redirects manages a redirects table (from/to/status/active/notes); server.ts consults an in-memory-cached fetch to the redirects table on every request and issues a 301/302/307/308 before the SSR handler runs, with legacy static redirects still applied as a fallback._

## 07. Authentication — 5/8

- [p] **Managed auth**
  _Notes: Supabase email/password client and SSR integration are implemented; the linked project is configured, while provider settings remain deployment setup._
- [x] **Create two roles**
      _Notes: `app_role` (`admin`, `staff`, `client`) and `user_roles` are defined and applied in the linked Supabase project._
- [x] **Route protection**
      _Notes: `/account` and `/admin` use fail-closed server request middleware plus browser route guards; admin access checks `has_role()`._
- [x] **Secure cookies**
      _Notes: Supabase PKCE sessions use `@supabase/ssr` cookies with server-side session verification._
- [x] **Password reset**
      _Notes: Reset request and update-password screens are implemented, and the live app flow was verified end to end with a Supabase recovery link for a temporary QA account. The request screen, recovery mode, password update, and post-reset sign-in all work in the browser; email-provider deliverability remains a deployment check._
- [x] **MFA readiness**  
      _Notes: Added a reusable admin step-up gate with password reconfirmation, surfaced current AAL/readiness in admin settings, and wired the secure-action dialog into sensitive admin flows._
- [x] **Step-up actions**  
      _Notes: Payments, services, therapists, and site settings now require a fresh password reconfirmation before sensitive changes or deletes are committed._
- [x] **Auth/permission audit**
      _Notes: RLS policies, role function restrictions and protected route paths are defined and migrated; live browser verification now confirms admin and client access behave correctly, including the progress-owner-only gate on `/admin/progress`._

## 08. Availability — 8/8

- [x] **Service schema**
      _Notes: `services` is seeded with the current Talk Space catalogue and package pricing fields._
- [x] **Therapist assignment**
      _Notes: Therapists link to services through `therapist_services`; clients support an assigned therapist._
- [x] **Modes/locations**
      _Notes: `session_mode` and therapist location fields support online, in-person, and phone care._
- [x] **Duration/price**
      _Notes: Service duration, package count, currency, and NGN price are stored with validation._
- [x] **Weekly rules**
      _Notes: `availability_rules` stores recurring weekday windows in the Africa/Lagos timezone by default._
- [x] **Exceptions**
      _Notes: `availability_exceptions` supports blocked and added time windows._
- [x] **Buffers/lead time**
      _Notes: `services` stores before/after buffer minutes and minimum lead-time minutes with safe zero defaults; booking slot calculation will consume these fields._
- [x] **Availability tests**
      _Notes: Slot input validation and slot-calculation conflict guards are covered by automated tests._

## 09. Booking — 8/8

- [x] **First-time path**
      _Notes: /book takes contact + service + mode + date + slot, creates a five-minute server-validated hold, immediately fires a booking confirmation email with the manage link, then proceeds to the Paystack / bank-transfer payment step; successful payment marks the appointment `confirmed` and fires the confirmation email again with service + therapist details._
- [x] **Returning path**
      _Notes: /book loader calls getBookingPrefill() to prefill full name/email/phone from the signed-in client + profile record and links the appointment to `client_id`; an anonymous visitor sees a "Sign in so this session is linked to your record" affordance and can still book as guest._
- [x] **Secure tokens**
      _Notes: 32-byte manage tokens are generated in holdSlot server fn; only the SHA-256 hash is stored in `appointments.manage_token_hash` and the plaintext token is persisted server-side (background job) so transactional emails can embed the manage link. Manage endpoints validate the hash before returning any data._
- [x] **Transactional slot reservation**
      _Notes: `hold_appointment()` re-validates the slot against `list_available_slots`, uses a tstzrange exclusion constraint to reject overlapping hold/pending_payment/confirmed rows, and releases expired holds inline; `/api/public/hooks/send-reminders` also runs `expire_stale_holds()`._
- [x] **Appointment state machine**
      _Notes: Enum covers `hold → pending_payment → confirmed → completed | cancelled | no_show`; `record_payment_initiated` promotes hold → pending_payment, `mark_payment_status('succeeded')` → confirmed, `reschedule_appointment` preserves state, `cancel_appointment` → cancelled, `mark_appointment_status` handles completed / no_show under staff/admin gate._
- [x] **Summary/validation**
      _Notes: Client-side Zod validates every field; server re-validates via `hold_appointment`; PaymentStep shows a live hold countdown (`HoldCountdown`) so users can see the 5-minute TTL running down, and expiry disables the confirm action._
- [x] **Reschedule request**
      _Notes: `reschedule_appointment` RPC enforces ≥24h policy for client_owner/manage_token actors, re-checks slot availability, and preserves the original starts_at as `rescheduled_from_starts_at`. Reachable from /account/appointments (signed-in) and /manage/$reference (email link) with therapist and mode overrides._
- [x] **Cancel/no-show/complete**
      _Notes: `cancel_appointment` allows cancellation with a reason under the same 24h policy; `mark_appointment_status` (staff/admin only) marks `completed`/`no_show`; UI wired at /account/appointments, /manage/$reference, and admin bookings view; cancellation email templates fire on both paths._

## 10. Client management — 8/8

- [x] **Client schema**
      _Notes: `clients` is linked one-to-one with `auth.users`; `client_notes` is staff/admin-only._
- [x] **Capture contact/DOB**
      _Notes: Client records include phone, date of birth, preferred mode, and assigned therapist fields._
- [x] **Search/filter**
      _Notes: Protected `/admin/clients` directory with name, phone, therapist and preferred-mode search/filtering; responsive results and empty states are implemented in `src/components/admin/AdminClients.tsx`._
- [x] **Client detail**
      _Notes: Protected `/admin/clients/:clientId` detail view shows client profile data, care preferences, assigned therapist, activity timestamps, and staff-only notes with loading and permission states._
- [x] **Appointment history**
      _Notes: Admin client detail loads linked appointments with service, therapist, schedule, mode, status, and notes._
- [x] **Payment/form summaries**
      _Notes: Admin client detail now loads linked payment summaries and contact/intake-style form submissions, with matching records surfaced in the client detail view and CSV export._
- [x] **Administrative updates**
      _Notes: Admins can update client name, phone, date of birth, preferred mode, and assignment through a protected server function._
- [x] **Permissioned export**
      _Notes: Admin-only CSV export includes client, appointment, and payment records without exposing manage tokens or secrets._

## 11. Forms — 8/8

- [x] **Inventory Google Forms**  
      _Notes: The inventory in `docs/FORMS_INVENTORY_AND_RETENTION.md` now confirms that all intake forms are handled in-app and the admin view is the only review surface; no Google Forms workflow is retained._
- [x] **Versioned templates**  
      _Notes: Working template registry and versioning rules drafted in `docs/FORM_TEMPLATES_AND_VERSIONING.md`. Secure intake rows now persist `template_key` and `template_version` so staff can review the exact rendered version later._
- [x] **Question editor**
      _Notes: Forms editor added at `/admin/forms`, the public booking/contact pages now read the saved template registry, and versioned templates resolve to the latest matching base key._
- [x] **Secure intake**
      _Notes: Secure intake snapshots now write to `intake_submissions` from the booking, contact, and approved assessment flows, and admins can review them from the client detail page._
- [x] **Approved assessments**
      _Notes: Approved internal assessment templates added to the registry and surfaced in `/admin/forms`._
- [x] **Save/resume**
      _Notes: Booking and contact intake now autosave browser drafts and restore them on return, with explicit clear-draft controls and cleanup after submission._
- [x] **Completion state**
      _Notes: Public booking and contact forms now show a live readiness state, and intake submissions record an explicit completion_state alongside completed_at._
- [x] **Consent acknowledgement**  
      _Notes: Booking and contact intake now require an explicit privacy-policy acknowledgement, and admins can review the captured consent snapshot and timestamp in client detail._

## 12. Paystack — 7/8

- [x] **Test/live config**
      _Notes: Admin payment settings support test/live mode, public key, encrypted secret, webhook secret, and enablement flags._
- [x] **Server initialisation**
      _Notes: Server-side Paystack initialization records the payment ledger entry before redirecting to checkout._
- [x] **Webhook signature**
      _Notes: The webhook requires and timing-safely verifies `x-paystack-signature` before processing._
- [x] **Idempotent confirmation**
      _Notes: Payment references are unique and ledger initialization/updating is conflict-safe; terminal success is not reprocessed by the callback._
- [x] **Amount/currency/reference validation**
      _Notes: Provider verification must match the ledger amount, NGN currency, and booking reference before status mutation._
- [x] **Status/timeline**
      _Notes: Payment status changes are recorded in `payment_events` and exposed alongside the payment ledger._
- [x] **Delayed recheck**
      _Notes: A `CRON_SECRET`-protected recheck route runs daily for unresolved Paystack payments; higher-frequency schedules require a Vercel plan that supports them._
- [p] **Sandbox E2E**
  _Notes: Automated safeguards are covered; a real Paystack sandbox transaction still requires configured sandbox credentials and a test card._

## 13. Bank transfer — 8/8

- [x] **Account details**
      _Notes: Admin-configured bank name, account name, account number, and instructions are shown when bank transfer is enabled._
- [x] **Reference instructions**
      _Notes: Each transfer receives a unique `TSB-...` reference and checkout displays it for reconciliation._
- [x] **Transfer submission**
      _Notes: Submissions use the authenticated/manage-token-protected `submit_bank_transfer` RPC and remain awaiting confirmation._
- [x] **Private receipt upload**
      _Notes: Receipts are limited to approved image/PDF types, 5 MB, and stored in the private `payment-receipts` bucket._
- [x] **Review queue**
      _Notes: Admin payments shows awaiting-confirmation transfers with receipt links and client notes._
- [x] **Verify/reject**
      _Notes: Admin verification calls the protected RPC and moves the payment to succeeded or failed._
- [x] **Audit actor/reason**
      _Notes: Approval/rejection stores reviewer identity, prior/new status, timestamp, and reviewer note._
- [x] **Connect confirmation**
      _Notes: Approved transfers send booking confirmation and attempt Google appointment synchronization._

## 14. Google — 8/8

- [x] **OAuth config**  
      _Notes: Admin Google settings UI and server helpers now store the OAuth client ID, encrypted secret, redirect URI, and scopes._
- [x] **Connect calendar**  
      _Notes: Admin connect flow opens Google consent, returns through `/api/public/google/callback`, and persists therapist tokens plus initial busy sync/watch state._
- [x] **Calendar adapter**  
      _Notes: `src/lib/google.server.ts` wraps Google auth, refresh, event, free/busy, and watch APIs; `src/lib/google.functions.ts` exposes the appointment sync adapter._
- [x] **Create Meet**  
      _Notes: Confirmed appointments create Calendar events with Meet links via `createEventWithMeet`, and the meet URL is stored on the appointment row._
- [x] **Update reschedule**  
      _Notes: Confirmed appointments patch the existing Google event through `patchEvent` when times change._
- [x] **Update cancellation**  
      _Notes: Cancelled, completed, and no-show appointments delete the Google event and clear the stored Google refs._
- [x] **Retry/sync state**  
      _Notes: Admin retry, connection health, push callbacks, and appointment sync state are all tracked in-app._
- [x] **Failure tests**  
      _Notes: Added source-level failure-path coverage for OAuth state handling, token exchange, calendar API error handling, and push/callback sync recovery in `test/google-calendar-flow.test.ts`._

## 15. Email — 6/8

- [ ] **Confirm Zoho recipients**  
      _Notes: External recipient ownership still needs product-owner confirmation before we can route contact mail through Zoho instead of the configured inbox address._
- [p] **Verify sending domain**  
  _Notes: The admin stores and surfaces the sender domain, but the external Resend verification step still needs deployment-side confirmation._
- [x] **Resend adapter**  
      _Notes: `sendRawEmail` and `sendTemplateEmail` both route through Resend, encrypt the API key, and write delivery logs for sent/failed/skipped outcomes._
- [x] **Confirmation template**  
      _Notes: Booking confirmation content exists in `email-templates.server.ts` and is used after successful payment and booking creation._
- [x] **Form reminder**
      _Notes: Commit `c8f2a94` adds an editable `form_reminder` email template and a tracked Send reminder action to the pending-form queue at `/admin/forms`. The server resolves the recipient and safe same-site continuation URL from the stored pending submission, rejects completed forms, and records successful sends. Automated checks: `npm test`, `npm run lint`, and `npm run build`. Manual app check: apply migration `20260802113000_form_reminder_email_template.sql`, open `/admin/forms`, send a reminder from a booking/contact draft, verify the success timestamp and delivery-log entry, then confirm completed records are absent from the queue. Owner: Talk Space admin/engineering. External dependency: enabled Resend settings and a verified sender domain._
- [x] **Appointment reminder**  
      _Notes: The 24h/1h reminder templates and the `/api/public/hooks/send-reminders` job are implemented and tied to the reminder settings window._
- [x] **Payment templates**
      _Notes: Commit `4ee365e` adds editable success, failure, and bank-transfer-received templates, wires them to Paystack callback/webhook/reconciliation and bank-transfer review outcomes, and atomically claims each payment notification to prevent duplicate customer emails._
- [x] **Delivery/retry/resend**
      _Notes: Commits `4ee365e` and `4301852` encrypt retry payloads, make failed deliveries eligible after 5, 15, and 60 minutes, process them through the plan-compatible daily maintenance cron, expose a protected endpoint for an optional higher-frequency scheduler, and add an admin Resend action with retry history and actor tracking. Automated checks: `npm test` (43/43), `npm run lint` (0 errors; 6 baseline Fast Refresh warnings), `npm run build`, Supabase migration dry-run/push, and app HTTP checks (`/` 200; unauthorised retry hook 401). Manual app check: preview all three payment templates in `/admin/emails`, use a sandbox booking to verify the payment outcome log, temporarily use an invalid Resend key to create a failed row, restore the key, then click Resend and verify a linked sent row. Owner: Talk Space admin/engineering. External dependencies: enabled Resend settings, verified sender domain, and `CRON_SECRET`; near-real-time automatic retries require a higher-frequency scheduler or an upgraded Vercel cron plan._

## 16. Contact/WhatsApp — 8/8

- [x] **Contact form**  
      _Notes: The public contact page uses a versioned in-app template, restores drafts, requires consent, and submits to `submitContactMessage`._
- [x] **Route to Zoho**
      _Notes: Commit `280b7bb` adds an explicit Zoho Mail routing switch and validated recipient field in `/admin/emails`. Contact submissions remain stored in the admin, while `contact_admin_notice` is delivered to the confirmed Zoho-owned mailbox and tagged with `zoho_mail` routing context. Migration `20260802183000_contact_zoho_routing.sql` was applied remotely. The mailbox owner/address must still be confirmed under the separate Email checklist item before enabling production routing._
- [x] **Spam/rate protection**  
      _Notes: The contact server fn uses a honeypot plus an IP-based rate limit of 5 submissions/hour._
- [x] **Store enquiry**  
      _Notes: Every submission is written to `contact_submissions` and mirrored into `intake_submissions`; admin emails shows the enquiry log and delete action._
- [x] **WhatsApp number**  
      _Notes: Talk Space phone/WhatsApp constants are centralized in `src/lib/talkspace.ts` and reused across the site._
- [x] **Prefilled message**  
      _Notes: `WHATSAPP_HREF` includes the prefilled outreach message for click-to-chat._
- [x] **Desktop/mobile test**
      _Notes: Commit `280b7bb` verifies the live local app at 390×844 and 1280×900, including responsive navigation, readable contact cards, and the encoded WhatsApp click-to-chat URL. Evidence: `docs/qa/contact/contact-mobile.png` and `docs/qa/contact/contact-desktop.png`. Automated checks: `npm test` (43/43), `npm run lint` (0 errors; 6 baseline warnings), and `npm run build`. Manual app check: open `/contact` on a phone and desktop, activate WhatsApp, and confirm the number and prefilled booking message before sending. Owner: Talk Space admin/engineering. External dependency: WhatsApp must be installed or WhatsApp Web available for the final handoff check._
- [x] **Response guidance**
      _Notes: Commit `6d1a11d` publishes the response and privacy standard in `docs/ADMIN_RESPONSE_GUIDANCE.md` and surfaces the triage priorities directly in `/admin/emails`. Urgent safety concerns are escalated immediately, operationally urgent enquiries are targeted for the same business day, and routine enquiries are targeted within one working day. Automated checks: `npm test` (45/45), `npm run lint` (0 errors; 6 baseline Fast Refresh warnings), and `npm run build`. Manual app check: open `/admin/emails`, locate Administrator response guidance, and verify the urgent, same-day, routine, and privacy instructions are readable on mobile and desktop._

## 17. Admin operations — 8/8

- [x] **Overview**  
      _Notes:_
- [x] **Today/upcoming**  
      _Notes:_
- [x] **Pending forms**  
      _Notes:_
- [x] **Pending transfers**
      _Notes: Reconciled with the existing implementation: the dashboard reads the pending bank-transfer count through `getAdminDashboardSummary`, and `/admin/payments` provides the review queue with approve/reject actions._
- [x] **Failed notification/Meet queue**
      _Notes: Commit `6d1a11d` adds bounded unresolved email and Google Calendar/Meet failure queues to the admin dashboard. Successful notification retries remove their failed parent from the queue, and each queue links to its operational review screen. Automated checks: `npm test` (45/45), `npm run lint` (0 errors; 6 baseline warnings), and `npm run build`. Manual app check: open `/admin`; verify both queue cards and their empty states, then create a safe provider failure in a non-production environment and confirm its row and review link appear._
- [x] **Appointment timeline**
      _Notes: Commit `5cbc8f7` expands `/admin/bookings` into a bounded recent/upcoming operations view and adds an on-demand timeline combining immutable appointment events, payment events or historical snapshots, intake completion, reminders, and Google Calendar/Meet results. Migration `20260802200000_appointment_timeline.sql` is applied remotely and backfills existing appointments. Automated checks: `npm test` (48/48), `npm run lint` (0 errors; 6 baseline Fast Refresh warnings), `npm run build`, migration dry-run/push, and REST verification of the backfilled event table. Manual app check: open `/admin/bookings`, select Timeline for a booking, and verify chronologically ordered booking, form, payment, reminder, and Google events._
- [x] **Integration/settings**
      _Notes: Commit `5cbc8f7` consolidates public-site, Resend/Zoho, Paystack/bank-transfer, Google Calendar/Meet, availability, reminders, and security controls in `/admin/settings`. The hub loads independent status sources in parallel, reports ready/setup-needed states, and links to each dedicated configuration screen. Manual app check: open `/admin/settings`, compare each readiness badge with its linked configuration screen, and verify the site detail editor still saves after password step-up._
- [x] **Audit log**
      _Notes: Commit `989de11` adds the immutable `admin_audit_logs` table, database triggers for operational/content records, and `/admin/audit`. Each row captures the admin/staff/system actor, action, target, non-sensitive reason, changed field names, and Lagos-readable timestamp without copying secret or client payload values. Migration `20260802213000_admin_audit_log.sql` is applied remotely and a safe site-settings write verified the trigger. Automated checks: `npm test` (51/51), `npm run lint` (0 errors; 6 baseline Fast Refresh warnings), and `npm run build`. Manual app check: update a harmless site detail as an admin, open `/admin/audit`, and verify the actor email, action, reason, target, changed fields, and timestamp._

## 18. Migration — 2/8

- [x] **Export WordPress**
      _Notes: Commit `989de11` adds the read-only `npm run content:inventory -- YYYY-MM-DD` exporter and the 2 August 2026 inventory under `docs/migration/`. The export records 9 pages, 84 posts, 7 categories, and 179 media records returned by the public API, while flagging that WordPress reports 182 media records and does not return three publicly. It also identifies 11 content records without featured media and 72 media records without alt text. Manual check: open `docs/migration/WORDPRESS_INVENTORY_2026-08-02.md`, follow its JSON link, and rerun the command to compare the current source without importing or deleting anything._
- [x] **Inventory URLs**
      _Notes: The dated legacy inventory merges the live WordPress page, post, and category sitemaps with all REST content, media attachment, and direct media asset URLs. It records 458 normalized unique URLs in Markdown, JSON, and CSV, including HTTP status/final destination and a distinct rate-limited state so HTTP 429 responses are not mislabeled as broken. Refresh with `npm run content:urls -- YYYY-MM-DD`._
- [p] **Select approved content**
  _Notes: `/admin/migration` now provides a database-backed review queue for the 100 WordPress records, with pending, approved, excluded, and needs-revision decisions, proposed paths, required reasons, reviewer identity, timestamp, RLS, and immutable audit capture. Technical workflow is complete; this item remains partial until a content owner records decisions for every legacy entry._
- [ ] **Migrate core content**  
      _Notes:_
- [ ] **Optimise media**  
      _Notes:_
- [ ] **Correct errors**  
      _Notes:_
- [ ] **Redirect map**  
      _Notes:_
- [ ] **Obtain approval**  
      _Notes:_

## 19. SEO/performance/a11y — 7/8

- [x] **Metadata/canonical**
      _Notes: Absolute canonical and Open Graph URLs are defined for every public route; blog posts suppress inherited list metadata._
- [x] **Sitemap/robots**
      _Notes: Server routes emit absolute sitemap entries (including blog posts) and robots.txt references https://talkspace.ng/sitemap.xml._
- [x] **Structured data**
      _Notes: Organization, LocalBusiness, Article and FAQPage JSON-LD are emitted on their required routes._
- [x] **Images/fonts**
      _Notes: Shared OptimizedImage adds explicit dimensions, responsive Supabase transforms, priority control and AVIF sources where available. Render-blocking remote fonts were removed in favour of resilient system font stacks._
- [x] **Core Web Vitals**
      _Notes: The deployed mobile audit in `docs/qa/performance/home-core-web-vitals.json` passes the gate with Lighthouse performance 94, LCP 2.47 s, TBT 12.5 ms and CLS 0.0001. Public homepage data is consolidated, site appearance is server-rendered before first paint, and the compact viewport avoids loading a remote hero image in the critical viewport._
- [x] **Reduced motion/focus**
      _Notes: Existing global reduced-motion and visible focus styles were verified during Batch B review._
- [x] **Keyboard/screen reader**
      _Notes: The deployed Chromium/axe and accessibility-tree audit covers `/`, `/services`, `/therapists`, `/pricing`, `/blog`, `/contact`, and `/faqs`; skip-link, tab order, keyboard activation, landmarks and accessible names pass with no serious or critical violations. Evidence is in `docs/qa/accessibility/public-accessibility-audit.json`._
- [p] **Lighthouse/axe**
  _Notes: Build and route smoke checks pass; mobile Lighthouse and axe results remain pending._

## 20. Security/privacy — 4/8

- [x] **CSP/HSTS**
      _Notes: `src/lib/security-headers.ts` sets CSP, HSTS (2 years, preload), nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy and COOP on every response through `src/server.ts`._
- [x] **CSRF/CORS**
      _Notes: State-changing traffic runs through TanStack server functions (same-origin, no wildcard CORS headers anywhere). CSP `form-action` is limited to self + Paystack checkout, `frame-ancestors none` blocks framing. Every `/api/public/hooks/*` job now authenticates with a shared cron secret (`src/lib/cron-auth.ts`, constant-time compare, fails closed with 503 when unset); Paystack and Google webhooks verify signatures/channel tokens._
- [x] **Rate limits**
      _Notes: Database-backed fixed-window limiter (`consume_rate_limit` + `security_rate_limits`, helper `src/lib/rate-limit.server.ts`) applied to contact submissions (8/hour), booking holds (10/hour) and manage-token lookups (20/15min), keyed by hashed IP. Blocks are recorded as security events._
- [ ] **Private storage**  
      _Notes:_
- [ ] **Protect tokens/secrets**  
      _Notes:_
- [x] **Security/audit logging**
      _Notes: Admin actions log to `admin_audit_logs`; blocked/suspicious public requests log to `security_events` (hashed device identifier, route, severity) and are surfaced in a "Security events" panel on `/admin/audit`._
- [ ] **Token expiry/revocation**  
      _Notes:_
- [ ] **Threat/security review**  
      _Notes:_

## 21. Testing/QA — 0/8

- [ ] **Unit availability/states**  
      _Notes:_
- [ ] **Permission/token tests**  
      _Notes:_
- [ ] **Paystack edge cases**  
      _Notes:_
- [ ] **Bank review tests**  
      _Notes:_
- [ ] **Form version tests**  
      _Notes:_
- [ ] **Critical Playwright**  
      _Notes:_
- [ ] **Cross-browser/mobile**  
      _Notes:_
- [ ] **Staging QA sign-off**  
      _Notes:_

## 22. Deployment — 0/8

- [ ] **Create environments**  
      _Notes:_
- [ ] **DNS/CDN/SSL**  
      _Notes:_
- [ ] **Vercel/secrets**  
      _Notes:_
- [x] **Migrations/backups**
      _Notes: 53 migrations applied to the linked Supabase project (auth foundation, services, therapists, availability rules/exceptions, appointments with tstzrange exclusion, hold/reschedule/cancel/mark RPCs, content_entries + content_media + storage bucket, contact_submissions, email_settings + templates, payments ledger + payment-receipts bucket, Google OAuth, redirects, revisions, seeded FAQs/services/therapists). `.env` and `supabase/config.toml` are populated and match the linked project. Scheduled DB backup cadence still to be confirmed._
- [ ] **Storage policies**  
      _Notes:_
- [ ] **Jobs/retries**  
      _Notes:_
- [ ] **Errors/uptime**  
      _Notes:_
- [ ] **Rollback/emergency access**  
      _Notes:_

## 23. Launch/handover — 0/8

- [ ] **Production data/content**  
      _Notes:_
- [ ] **Domain redirects/SSL**  
      _Notes:_
- [ ] **Smoke tests**  
      _Notes:_
- [ ] **Production Paystack**  
      _Notes:_
- [ ] **Google/Resend/Zoho**  
      _Notes:_
- [ ] **Train two admins**  
      _Notes:_
- [ ] **Deliver source/docs**  
      _Notes:_
- [ ] **Acceptance/maintenance start**  
      _Notes:_

## 24. Maintenance — 0/8

- [ ] **Monitor first bookings**  
      _Notes:_
- [ ] **Review webhook errors**  
      _Notes:_
- [ ] **Review reminders/calendar**  
      _Notes:_
- [ ] **Fix scope defects**  
      _Notes:_
- [ ] **Security patches**  
      _Notes:_
- [ ] **Review staff access**  
      _Notes:_
- [ ] **Post-launch review**  
      _Notes:_
- [ ] **Record future change requests**  
      _Notes:_

## 25. Calenira-inspired design refresh — 5/8

> Reference: https://calenira.com/ — warm minimalist wellness aesthetic (cream/beige surfaces, terracotta accents, fully-rounded pill buttons, section pill badges, soft botanical shadows, floating action dock). Keep Talk Space brand tokens (`brand-deep`, `brand-mint`, `brand-blue`) and the current logo; blend Calenira composition and warmth on top.

## 26. Admin CMS and website management — 26/37

See [docs/ADMIN_CMS_CHECKLIST.md](ADMIN_CMS_CHECKLIST.md) for the detailed implementation checklist covering dashboard recovery, editable pages and posts, media/logo management, Google Reviews, retiring legacy pages, and appearance controls.

## 27. Remaining implementation plan — 7/11 complete, 1 in progress

See [docs/REMAINING_IMPLEMENTATION_CHECKLIST.md](REMAINING_IMPLEMENTATION_CHECKLIST.md). Items 1–7
are complete; browser verification, the public design refresh, Google Business Profile API sync,
and release readiness remain.

The larger product backlog extracted from the remaining items is tracked in
[docs/LARGER_PRODUCT_REMAINING_CHECKLIST.md](LARGER_PRODUCT_REMAINING_CHECKLIST.md).

- [x] **Adopt warm surface palette**
      _Notes: `src/styles.css` extended with `--surface-cream`, `--surface-peach`, `--accent-terracotta`, `--accent-terracotta-soft` layered over existing brand tokens._
- [x] **Serif display + sans body typography**
      _Notes: Fraunces loaded via `<link>` in `src/routes/__root.tsx`; exposed as `--font-display` and applied through `.display-1` and `font-display` heading utilities. Body copy unchanged._
- [x] **Section badge and heading pattern**
      _Notes: `src/components/site/SectionBadge.tsx` added (terracotta / mint / blue tones). Applied on Home hero + specialties and About hero/values/story. Pending: Services, Therapists, Pricing, Blog, Contact._
- [x] **Pill buttons, cards and soft shadows**
      _Notes: `buttonVariants` extended with `terracotta` + `pillOutline` variants and `pill` / `pillLg` sizes; `shadow-soft-warm` utility added in `src/styles.css`. Cards on About lifted to 3xl radii + soft shadow._
- [p] **Redesign public hero + Home sections**
  _Notes: Hero rebuilt (centered Fraunces headline, italic terracotta accent, dual pill CTAs, botanical-shadow image on cream). Specialties eyebrow swapped to `SectionBadge`. Pending: "How it works" 4-step flow, testimonials carousel with circular avatars, FAQ accordion pill rows, "A Simple Step Forward" contact card._
- [p] **Public inner pages composition**
  _Notes: About recomposed (cream sections, terracotta CTAs, badges, soft-warm shadows). Pending: Services, Therapists, Pricing, Blog, Contact._
- [x] **Floating action dock**
      _Notes: `src/components/site/FloatingActionDock.tsx` mounted from `__root.tsx`. Calendar / Email / WhatsApp pill; hidden on `/admin`, `/account`, `/login`, `/reset-password`, `/book`; respects `print:hidden` and global `prefers-reduced-motion` rules._
- [ ] **Refresh visuals and social image**
      _Notes: `public/og-image.jpg` not yet regenerated in the warm palette; hero/section imagery still uses existing photos. Verify AVIF variants + `OptimizedImage` usage across public routes after new imagery lands._

## Updating the checklist

1. Update the marker.
2. Add files, tests, date and pending work in Notes.
3. Update totals.
4. Update related architecture documents.
5. Record blockers, owner and unblock condition.
6. Treat new scope as a written change request.
