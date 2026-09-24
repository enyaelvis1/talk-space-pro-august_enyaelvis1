# Talk Space — Disposable Staging UAT Accounts

UAT plan date: 24 September 2026
Applies to: staging/develop only
Related audit: `docs/TALKSPACE_CURRENT_WORK_AUDIT.md`
Related issue register: `docs/TALKSPACE_CLIENT_FEEDBACK_ISSUE_REGISTER.md`

## Safety gate

- [ ] Confirm the target URL and Supabase project are staging/develop, not production.
- [ ] Confirm no production database, storage bucket, provider account, or live notification destination is configured.
- [ ] Use only synthetic names, addresses, phone numbers, dates, and email addresses under `@talkspace.test` or an approved email-capture sink.
- [ ] Use Paystack sandbox/test references only. Do not enter real card or bank details and do not make a live charge.
- [ ] Use a staging email sink or provider dry-run mode. Do not send email, SMS, or WhatsApp messages to live users.
- [ ] Do not run migrations, modify production data, force-push, or reuse a real person’s credentials.
- [ ] Record only redacted account IDs, role, test reference, timestamp, and result. Never record passwords, tokens, cookies, invite links, payment secrets, or `.env` values.

## Current account-provisioning support

| Account | Current supported path | Current limitation | UAT decision |
| --- | --- | --- | --- |
| Super/Admin | Existing staging admin, or staging Supabase Auth plus controlled `user_roles` assignment | No visible admin-panel workflow creates or promotes a new admin | Provision through the staging control plane; remove/deactivate after UAT |
| Therapist | Admin `/admin/therapists` creates a profile and **Invite login** creates/links the Auth account and therapist role | Invitation delivery needs a staging email sink/provider setup | Use the admin invitation flow; never a live mailbox |
| Client | `/login` sign-up creates the default client role; admin client creation/import and `scripts/seed-demo-clients.mjs` can create/link client records | The seed helper requires a server-only key and is not a browser action | Prefer sign-up for one client; use the helper only on an approved isolated staging project |
| Optional second therapist | Same therapist profile and invitation path | Google connection requires a safe test account or provider sandbox | Create only for multi-therapist/concurrency coverage |
| Optional second client | Same sign-up or demo-client helper path | No special UI is required | Create only for concurrency/package-balance coverage |

No account was created for this audit. No seed script, migration, Supabase operation, email, Paystack request, or live notification was run.

## Disposable account matrix

Use a unique run suffix such as `20260924-a`; never reuse production-looking addresses or real personal information.

### UAT-ACC-001 — Super/Admin

- **Purpose:** Exercise bookings, payments, clients, CMS, email templates, bank transfers, Google Reviews, sitemap, settings, audit, and permission gates.
- **Synthetic identity:** `uat-admin-20260924-a@talkspace.test`, name `UAT Administrator A`.
- **Expected role/permission:** `admin`; access to `/admin`; no production data; destructive/payment actions retain authorization and sensitive-action gates.
- **Test data:** Synthetic address/phone, one fake client, one fake therapist, future WAT slots, sandbox payment references, and provider dry-run records only.
- **Features:** Admin dashboard/current operations, client assignment, booking create/edit/archive/restore/delete where supported, payment review and sandbox Paystack verification, bank-transfer review, CMS settings, email preview/toggle, Google Reviews refresh, sitemap/robots, and audit log.
- **Evidence:** Redacted role check, route screenshots, request/status results, audit-log action IDs, synthetic booking/payment references, and provider dry-run output.
- **Cleanup/deactivation:** Disable/delete the staging Auth user, remove its role and synthetic records, revoke provider connections, clear staging storage objects, and confirm no live notification was delivered.

### UAT-ACC-002 — Therapist

- **Purpose:** Test therapist calendar connection, dashboard, booking visibility, WAT rendering, Meet-link state, and access restrictions.
- **Synthetic identity:** `uat-therapist-20260924-a@talkspace.test`, name `UAT Therapist A`.
- **Expected role/permission:** `therapist`; linked to one active therapist profile; own therapist routes/appointments only; no admin/CMS/payment-management access.
- **Test data:** Synthetic profile, services, recurring availability, one urgent online booking, one in-person booking, and a mocked or approved staging Google calendar connection.
- **Features:** Login, today/upcoming dashboard, WAT conversion, therapist-specific bookings, calendar connect/disconnect/sync, Meet pending/error/retry state, and cross-therapist access denial.
- **Evidence:** Redacted role response, dashboard screenshots, appointment IDs, sync status/error, and no-access screenshots.
- **Cleanup/deactivation:** Disconnect/revoke the staging Google connection, disable/delete the Auth user, unlink/delete the synthetic profile and availability, then remove test bookings.

### UAT-ACC-003 — Client

- **Purpose:** Test registered-client autofill, booking, package purchase, incomplete booking token, sandbox Paystack, and bank-transfer flows.
- **Synthetic identity:** `uat-client-20260924-a@talkspace.test`, name `UAT Client A`, phone `+234 800 000 0091`.
- **Expected role/permission:** `client`; own account, bookings, and package/payment summaries only; no admin, staff, therapist, or other-client data.
- **Test data:** Synthetic profile, online and in-person services, future WAT slot, sandbox Paystack reference, fake bank-transfer reference, and an expired/incomplete booking token.
- **Features:** Sign-up/sign-in, booking prefill/edit, mode pricing, package balance, pending-payment expiry, sandbox payment callback/verification, bank-transfer submission, manage link, reschedule/cancel policy, and RLS isolation.
- **Evidence:** Redacted session state, prefill screenshots, booking references, sandbox payment reference/status, and permission-denial results.
- **Cleanup/deactivation:** Cancel/archive synthetic bookings as appropriate, remove test payments/packages/intake rows, delete the client/Auth user, and revoke test sessions.

### UAT-ACC-004 — Optional second therapist

- **Purpose:** Prove two therapists may be booked at the same instant without calendar interference while one therapist cannot receive a duplicate slot.
- **Synthetic identity:** `uat-therapist-20260924-b@talkspace.test`, name `UAT Therapist B`.
- **Expected role/permission:** `therapist`; linked to a different active profile with separate availability/calendar state.
- **Test data:** Same WAT date/time and service as UAT-ACC-002, with distinct therapist IDs and synthetic bookings.
- **Features:** Public slot response, admin availability, concurrent booking, therapist dashboards, Google event separation, and duplicate-slot rejection.
- **Evidence:** Therapist IDs, slot keys, booking IDs, concurrency result, and separate calendar sync evidence without provider secrets.
- **Cleanup/deactivation:** Disconnect provider state, remove synthetic slots/bookings/profile/role/Auth user.

### UAT-ACC-005 — Optional second client

- **Purpose:** Test concurrent booking attempts and package-balance isolation.
- **Synthetic identity:** `uat-client-20260924-b@talkspace.test`, name `UAT Client B`, phone `+234 800 000 0092`.
- **Expected role/permission:** `client`; own records only.
- **Test data:** Same target slot/service as UAT-ACC-003, plus an isolated package with a known session balance.
- **Features:** Concurrent booking race, hold expiry, package credit consumption, duplicate-submit behavior, and cross-client isolation.
- **Evidence:** Both booking attempts, final slot owner, package balance before/after, and redacted authorization results.
- **Cleanup/deactivation:** Release/cancel holds, remove package/payments/bookings, delete the client/Auth user, and revoke sessions.

## UAT execution checklist

- [ ] Provision UAT-ACC-001 through the staging control plane and record only a redacted user ID and role.
- [ ] Provision UAT-ACC-002 from the admin therapist invitation flow, using an email sink or dry-run provider.
- [ ] Provision UAT-ACC-003 through sign-up; verify the automatic client role and linked client profile.
- [ ] Decide whether optional UAT-ACC-004 and UAT-ACC-005 are needed; create them only for concurrency/calendar scenarios.
- [ ] Run the audit issue-register UAT cases with WAT timestamps and synthetic references.
- [ ] Capture evidence without secrets, invite links, tokens, personal data, or `.env` values.
- [ ] Complete cleanup/deactivation for every account and record the cleanup timestamp and operator.
- [ ] Recheck staging Auth users, `user_roles`, clients, therapist links, appointments, payments, storage, email logs, and provider connections for leftover UAT data.

## Future helper/seed work — documentation only

The repository already contains `scripts/seed-demo-clients.mjs` and `npm run db:seed:clients`, which use a server-only Supabase key to create five synthetic client users and client rows. It is suitable only for an isolated staging project after credentials, cleanup, and test-data ownership are approved. `scripts/seed-demo-bookings.mjs` can add synthetic booking/payment rows, but its Paystack records are local demo records and must not be sent to provider verification endpoints.

There is no equivalent checked-in helper for creating an admin and therapist role set. If repeatable provisioning is needed, create a separate staging-only helper with explicit environment/project guards, idempotent upserts, cleanup, and no default passwords. Do not implement or run that helper as part of this documentation follow-up, and do not use a migration for account provisioning.
