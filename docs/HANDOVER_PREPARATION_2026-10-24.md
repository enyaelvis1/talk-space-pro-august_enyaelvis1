# Talk Space — Final remediation and handover preparation

Prepared 24 October 2026. Three independent feature PRs target develop. No
production deployment, migration, CMS approval, provider operation, role change
or branch-protection mutation is authorized by this preparation.

## 1. Remediation and release boundary

| Issue                        | Implementation / boundary                                                                                                                    | Acceptance still required                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 duration                 | Held: live Home/Book 50 versus Pricing/fallback/scope doc 60. Working scope is not signed contractual approval.                              | D05: approve 50/60 or explicit per-plan rule, then align service/CMS/slots/admin/templates. No duration changed.                                     |
| R02 unsupported USD promise  | Copy feature corrects fallbacks and known legacy saved-CMS sentence at read time; NGN initialization untouched.                              | Isolated saved/published/draft/body/FAQ tests; owner reviews independent custom claims. Stored CMS cleanup requires normal owner-controlled editing. |
| R03 Calendar health          | Operations feature distinguishes healthy/expired/disconnected/failed/renewal-needed; operator guidance states Sync busy does not renew push. | Isolated expiry/failure fixtures. No live subscription created/renewed; Calendar owner decides manual renewal.                                       |
| R04 tracker                  | Correct source link, snapshot-generation labels, stale heading-count stripping and section-27 design assignment. Raw markers unchanged.      | 200 records, same keys/statuses, one milestone per task; design 8 records. User approves proposed closures separately.                               |
| R05 reminder timestamps      | Operations feature stamps successful primary delivery only; skip/suppression/failure not sent; partner and claim isolation retained.         | Mocked sent/skip/suppress/fail/replay/write-error tests plus accepted historical provider delivery evidence. No new scheduler or catch-up policy.    |
| R06 dashboard error fallback | Narrow source failure-path finding retained; normal live counts work. Not changed by the three focused PRs.                                  | Isolated fault-injection follow-up or explicitly accepted exception; do not rebuild summary/status queries.                                          |
| R07 standalone typecheck     | Three baseline errors on clean locked develop: AdminSidebar.tsx:493; __root.tsx:132,222.                                                     | A separate authorized type-compatibility correction or explicit engineering baseline disposition before release. Not a claimed live crash.           |
| R08 dependency gate          | New hosted dependency-audit failure on unchanged locked Zod 4.6.5: GHSA-mrhx-c7xc-m3w5, high severity, fixed in 4.6.6 or later.              | A separately scoped compatible security update and regression verification are required before release; do not suppress or lower the audit gate.     |

The reconciliation reports are preserved in this permanent managed feature
worktree and committed with the tracker/handover PR, not only in /tmp. Existing
audit observations are historical and retained; local implementation does not
turn them into production acceptance.

## 2. Exact decision register

Export: [18 client decisions](handover/client-decisions-2026-10-24.csv).
Each row contains the exact question, options, impact, owner, scope and approval
reference. All remain PENDING; no preference is inferred as consent.

Key release decisions are duration (T005), cancellation/refund/package-credit
policy (T005), notification recipients/domain (T113/T114), content (T139/T142/
T144/T177), scope/UAT/acceptance (T001–T008/T168/T184), and staff roster (T190).
New SEO programmes, booking redesign/photo selector, Home Visit, USD checkout and
new integrations remain outside this milestone unless separately quoted/approved.
Already-delivered partner invitations and admin preview are not re-quoted as
missing work.

## 3. Tracker proposals — no statuses automatically changed

Export: [12 proposed marker closures](handover/tracker-marker-proposals-2026-10-24.csv).
T011, T013, T014, T015, T023, T049, T140, T160, T161, T162, T170, T178 have
bounded existing evidence. T049 currently has [p]; the others [ ]. Proposed
marker is [x], but applied is NO for all 12. Prior acceptance is retained.

Repository tooling/test/document tasks can be closed using existing source and
hosted evidence; managed auth/import/domain tasks also have recorded live
observations. This does not approve every private permission or provider flow.
Content migration approval remains separate from technical import.

Export: [25 bounded verification items](handover/bounded-verification-2026-10-24.csv).
Reuse prior UAT reports, user sign-off and redacted historical provider/ledger
evidence first. Only the named missing acceptance case should run. Tests that
require provider writes must use a separately approved isolated environment.

## 4. Content approval — editorial review versus correctness

Export: [100-record approval summary](handover/legacy-content-approval-summary-2026-10-24.csv).

This is an **inventory-based review sheet, not a fresh production DB export**:

- Row metadata comes from the committed 2 August WordPress inventory: 9 pages,
  84 posts and 7 categories.
- The last successful authorized production observation on 24 October showed
  100 pending, zero approved, zero excluded and zero needs-revision decisions.
- A fresh browser read during remediation was blocked by the browser
  approval/usage gate. It was not bypassed using cookies, raw APIs or another
  browser. Current per-row decisions/reasons are therefore not asserted.
- IDs are WordPress inventory IDs, not app review-row UUIDs. Match source URL and
  kind against the current admin review row before recording any owner decision.
- Publication status is the inventory's old publication state, not approval.
  No row has been bulk-approved, imported again, published or removed.

The pending marker itself does **not** block public rendering or establish an
error: imported/public content already loads. Ordinary articles/categories are
editorial/clinical review. Prioritize legal, address, fee/duration, service and
clinical claims for correctness; a per-record blocking decision requires a
specific incorrect fact or owner ruling. R01/R02 are explicit known correctness
exceptions. Do not call all 100 records defective or re-import the whole site.

Owner review procedure: verify live identity by URL, inspect the current public
version, choose approve/exclude/needs revision with reason, record owner/date and
approval reference, then use the existing admin review workflow. Editing a
published page is a separate action; do not confuse review approval with publish.

## 5. Required repository protection — proposal only

Both main and develop report protected:false; no active rulesets were returned.
No protection is applied by these PRs. Repository owner must separately approve
and apply through an account with repository administration permission:

- Require pull requests into main and develop; at least one appropriate review.
- Require successful existing checks: verify, dependency-audit, secret-scan.
  Verify exact GitHub App/check identity when configuring, rather than trusting
  an identically named status posted by another actor.
- Require review of new commits and resolved conversations; limit bypass/admin
  exceptions to named emergency owners with an audit trail.
- Prevent force pushes and branch deletion; prevent unreviewed direct writes.
- Feature PRs go only to develop. A separate approved develop → main release PR
  follows bounded staging/UAT. Never merge a feature directly to main.
- Decide whether strict up-to-date checks/merge queue fit repository access and
  plan. Do not enforce an impossible check or enable new integrations blindly.
- Standalone TypeScript is not currently in hosted verify. Keep R07 visible;
  agree and add a clean typecheck gate in the authorized follow-up.

Acceptance: read-only branch/ruleset metadata confirms both branches enforce the
approved review/check/no-force policy, including named bypass rules. No test
force push or deliberate direct production write is needed.

## 6. Administrator training — two named recipients

- [ ] Client names Admin 1 and Admin 2, confirms client-owned accounts and role
      roster. Record names/receipt privately; no passwords in repository.
- [ ] Sign-in, password recovery, step-up protection and safe sign-out.
- [ ] Today/upcoming, Africa/Lagos times, paid versus unpaid/archived visibility.
- [ ] Payment review: approve/reject evidence, audit trail, recovery/escalation;
      train using synthetic sandbox records only, never a real payment approval.
- [ ] Packages: purchase/book later, remaining sessions, approved cancellation/
      refund/restoration rules; do not improvise policy in front of real clients.
- [ ] Calendar health/Meet recovery, failed notification queue and safe retries;
      distinguish OAuth connection, push watch and appointment sync states.
- [ ] CMS draft/preview/publish/revisions/media/FAQs/footer and content-review
      decisions; demonstrate in an isolated training environment.
- [ ] Therapist preview is admin-labelled and read-only for Calendar actions;
      names may show, but unnecessary contacts/intake remain private.
- [ ] Backup scope, restore limitations, audit log, escalation and emergency owner.
- [ ] Both admins acknowledge training date, topics, exceptions and documentation.

## 7. Source receipt, ownership and operations

- [ ] Client receives repository access, approved source revision/release tag,
      package lockfile, build/install instructions, schema/migration files and docs.
- [ ] Record source ownership/licence/IP and third-party subscriptions against
      the actual agreement; this document does not invent an IP-transfer term.
- [ ] Name repository/domain/DNS owners and confirm renewal/billing contacts.
- [ ] Provide an access inventory via an approved secure channel. Never put
      passwords, live keys, refresh tokens, .env values, database dumps or receipts
      in a PR, CSV, screenshot or training artifact.
- [ ] Name backup/restore owner, approved retention, cadence, restore target,
      recovery objective and last approved restore evidence. App logical backup is
      not provider full recovery and excludes auth identities/provider credentials.
- [ ] Name emergency owner and authorized rollback process; no destructive
      recovery rehearsal or deployment is part of this preparation.
- [ ] Record final acceptance, explicit exceptions and maintenance start/end,
      included support tasks, SLA and separately quoted future changes.

| Service                             | Named business owner | Technical operator | Evidence / remaining action                                                                                                                     |
| ----------------------------------- | -------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Cloud/OAuth/Calendar/Reviews | Client to name       | Client to name     | Six connections previously observed; authorize expired-watch renewal separately; resolve Places key/Place ID warning and Reviews refresh scope. |
| Paystack                            | Client to name       | Client to name     | Confirm merchant ownership/test-live separation/webhook settings and accepted historical reconciliation; no new charge.                         |
| Resend                              | Client to name       | Client to name     | Redacted verified-domain/from-address evidence, recipient policy and delivery ownership; no real test mail here.                                |
| Zoho / DNS                          | Client to name       | Client to name     | Confirm recipients and DNS/domain renewal owner; no mailbox/record changes.                                                                     |
| Supabase                            | Client to name       | Client to name     | Confirm actual production/staging identity, migrations/policies, backups and restore ownership read-only; no SQL applied.                       |
| Vercel                              | Client to name       | Client to name     | Linked team enyaelvis1-gmailcoms-projects still denies alias metadata; account access/alias SHA evidence required.                              |
| Backups / recovery                  | Client to name       | Client to name     | Distinguish encrypted logical app archive from full DB/Auth/provider recovery; attach accepted drill and cadence.                               |
| Monitoring / uptime                 | Client to name       | Client to name     | Sentry instrumentation exists; confirm activation, alert routing, external uptime checks and retention without sending an incident.             |

## 8. Deployment provenance and test evidence

Latest read-only GitHub record: Production/success deployment 7228374445,
21 October 2026 14:13:54Z, SHA 4205ae243792b4cbfc719a0f1825e5fbab399721.
Latest main 2732ccaa777cb1f242f140a8a678c85d98af4fc0; develop 4205ae2.
The scoped Vercel www.talkspace.ng alias lookup again returned 403. The exact
custom-domain SHA remains unknown; no older accessible project is substituted.

Local checks use clean npm ci --ignore-scripts and production builds with
loopback-only Supabase placeholders, no provider/Sentry environment. Focused tests
cover fallback/saved-CMS copy, simulated Calendar health, mocked reminder outcomes,
real 200-record consistency and the handover export counts. Record final PR check
results in the reconciliation update. Lint/build do not override R07's three
standalone type errors. No browser/provider UAT is claimed from these tests.

| Isolated feature             | Focused tests               | Lint                          | Sanitized production build | Standalone TypeScript  |
| ---------------------------- | --------------------------- | ----------------------------- | -------------------------- | ---------------------- |
| Copy consistency             | 30 passed, 0 failed/skipped | 0 errors, 7 baseline warnings | Passed                     | 3 baseline errors      |
| Calendar/reminder operations | 24 passed, 0 failed/skipped | 0 errors, 7 baseline warnings | Passed                     | Same 3 baseline errors |
| Tracker/handover             | 22 passed, 0 failed/skipped | 0 errors, 7 baseline warnings | Passed                     | Same 3 baseline errors |

These are 76 focused test executions, not a claim that every project test or live
provider journey passed. The unchanged dependency lockfile and baseline errors
remain visible release gates.

## 9. Final acceptance recommendation

Focused code PRs: [copy correctness PR112](https://github.com/enyaelvis1/talk-space-pro-august_enyaelvis1/pull/112)
and [Calendar/reminder PR113](https://github.com/enyaelvis1/talk-space-pro-august_enyaelvis1/pull/113).
This tracker/handover feature is an independent PR from the same develop base.
No PR is merged. The first hosted verify run exposed a public-FAQ source-contract
regression in the copy refactor; normalization was moved after deduplication and
the affected 20-case regression suite added to the 10 copy/pricing/privacy cases.
Hosted verify and secret-scan now pass on copy commit 3408161 (run 40082391478)
and operations commit e69b567 (run 40081870234). Their existing Vercel preview
checks report success, which is not production acceptance. Dependency auditing
still fails on both PRs because of the newly reported Zod advisory. The tracker
PR's hosted checks remain to be recorded after push. Local builds and focused
tests do not waive CI.

Ready for focused review/UAT of these corrections and handover preparation,
**not unconditional final acceptance yet**. Resolve/accept R01's duration
decision, remaining narrow provider/privacy/backup evidence and the engineering
baseline; name owners; approve the marker proposals and content exceptions;
obtain training/source receipts and contractual acceptance. No new SEO campaign,
booking redesign, Home Visit, USD checkout or integration is included.
