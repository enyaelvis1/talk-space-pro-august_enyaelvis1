# Talk Space — release readiness and bounded staging acceptance

Prepared 25 October 2026. This extends the existing reconciliation and handover
pack in PR #114; it does not create a replacement project checklist or reopen
delivered features. All acceptance boxes below start unapproved.

## Revision and change boundary

- Repository: enyaelvis1/talk-space-pro-august_enyaelvis1.
- Fetched develop: 4205ae243792b4cbfc719a0f1825e5fbab399721.
- Fetched main: 2732ccaa777cb1f242f140a8a678c85d98af4fc0.
- Feature: feature/release-readiness-security-types, created from fetched develop.
- Existing main checkout remains at 2d41a5c with its two Playwright changes.
  Existing feature worktrees are not reset, switched, cleaned or overwritten.
- PR #112 head 3408161: NGN-only copy and known saved-CMS promise correction.
- PR #113 head e69b567: Calendar health states and reminder delivery timestamps.
- PR #114 head 1b9e162: tracker presentation and handover evidence.
- All three existing PRs remain open into develop. No PR is merged, no migration
  is run and no production deployment/data/provider operation is performed.

## Engineering corrections

1. Raise the application Zod floor from ^4 to ^4.6.6. The lockfile resolves
   4.6.7; only the root requirement and the Zod package entry change.
   Advisory: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
   The production dependency audit is unsuppressed. The separate dev-only
   chromium-bidi Zod v3 dependency is not force-overridden across major versions.
2. Replace the removed RouterState.isTransitioning property with supported
   isLoading/status fields. A shared selector covers both loader work and the
   pending commit; admin and public loading indicators retain accessible labels.
3. Use the router's ErrorComponentProps and narrow unknown throws through
   routeErrorDetails. Error message/stack, Response status/URL and other thrown
   values are covered. Retry limits and telemetry calls are unchanged.
4. Add npm run typecheck (tsc --noEmit) to CI before starting the app/tests.
   No compiler option is weakened and no continue-on-error is added.

## Verification record

- Clean locked installation: npm ci --ignore-scripts --no-audit --no-fund;
  lifecycle scripts are disabled locally and no environment files are copied.
- npm run lint: passed, zero errors and seven pre-existing Fast Refresh warnings.
- npm run typecheck: passed; the three former errors are corrected, not waived.
- Focused tests: 82 passed, zero failed/skipped, covering router feedback,
  navigation/recovery, real checkout schemas, payment confirmation and pricing.
- Sanitized production build: passed using loopback-only Supabase placeholders
  and an empty inherited environment; no Sentry/provider keys are supplied.
- npm audit --omit=dev --audit-level=high: passed, zero vulnerabilities reported.
- Diff/pre-commit and final hosted checks: record after commit/push. Local
  checks are not a substitute for hosted verification or production acceptance.
- No database/E2E scripts are run locally; these can execute migrations or need
  browser/backend fixtures. No live credentials, messages or transactions.

## PR review and integration gate

At initial review, #112–#114 are MERGEABLE against the fetched develop. Hosted
verify, secret-scan and preview checks pass on their recorded heads; their
dependency-audit checks fail because those heads still contain Zod 4.6.5.
Rerunning an unchanged old head does not install this readiness fix.

- [ ] Readiness PR hosted verify (including standalone typecheck), dependency-audit
      and secret-scan pass on the exact reviewed commit.
- [ ] After that pass, refresh #112–#114 conflict metadata and rerun their existing
      CI/security workflows. Record success/failure honestly per SHA.
- [ ] Check an isolated, unpushed combined candidate of readiness + #112–#114
      without merging PRs or altering existing branches. Require clean textual
      application, typecheck, focused regression tests, audit and build.
- [ ] After separate merge authorization, integrate readiness into develop first;
      then update/recheck each approved feature against that base using normal
      commits, never rebase/force push. Require checks on the integrated revision.
- [ ] Approve isolated staging identity and providers before any staging browser
      actions. A green Vercel preview is not backend isolation evidence.

No request to merge, promote, renew subscriptions, invoke a scheduler or run
providers is implied by this plan. Existing Git integration may create previews
when feature branches are pushed; no deployment command is introduced here.

## Bounded staging acceptance plan

Owner: named QA/UAT lead with client service, content and operations owners.
Reuse the 25 bounded cases and prior accepted evidence in PR #114:
docs/handover/bounded-verification-2026-10-24.csv. Do not repeat a full project UAT.

| Case                         | Isolated test and expected result                                                                                                                                                                                                                | Evidence / owner                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| A1 navigation                | Navigate public routes and admin list/detail pages, including slow loaders; loading feedback clears after settlement. Induce synthetic Error/Response/non-Error throws and verify bounded retry/manual recovery.                                 | Browser result and revision; QA                       |
| A2 copy                      | Verify Pricing fallback, saved published FAQ, draft preview and body HTML no longer promise USD checkout. Unrelated copy is preserved; enabled checkout remains NGN.                                                                             | Synthetic CMS fixtures; content owner + QA            |
| A3 Calendar health           | Simulate connected-valid, exact expiry, expired, near-expiry, missing expiry, disconnected and failed states. Expired must never be Healthy; guidance distinguishes push renewal from busy sync. No live renewal.                                | Fixture screenshots/test output; operations           |
| A4 reminders                 | Mock sent, skipped, suppressed, failure, replay and timestamp-write failure for primary/partner. Stamp only successful primary delivery; successful claims are not released for duplicate send; partner failure remains independently retryable. | Mock claims/logs; QA + email owner                    |
| A5 tracker                   | Confirm all 200 keys/markers are retained, 133 done and 7 partial, design grouping is consistent, source link is correct, snapshot generation is not presented as a fresh task review.                                                           | Existing fixture plus bounded UI check; project owner |
| A6 payment/schema regression | Use synthetic fixtures for exact NGN amount/currency, invalid contacts/slots, package pricing and payment callbacks. Never make a live charge.                                                                                                   | Automated schemas/mocks; QA                           |

No new screenshots are required for unchanged functionality where valid accepted
evidence exists. On failure, record exact revision, route, reproduction and
expected/actual result. Only a reproducible defect reopens implementation.

## Client duration decision — held

Client/service owner must approve **50 minutes, 60 minutes, or an explicit
per-plan rule** for Teen/Child single and monthly plans, with date and reference.
Home/Book were observed at 50 and Pricing/fallback/scope notes at 60; a working
scope note is not signed contractual approval. No duration is changed here.
After approval, align service catalogue, CMS overrides, slot calculations,
admin displays and notification templates, then verify one relevant journey.
Cancellation/refund/package-credit policy is a separate policy answer, even
though both questions currently appear under T005 in the decision register.

## Remaining provider, browser and handover evidence

- [ ] QA/operations confirms staging Vercel/Supabase identities and isolation,
      approved runtime-only UAT credentials, email sink and provider sandbox.
      No production accounts are created or credentials stored in artifacts.
- [ ] Google owner supplies existing accepted Calendar/Meet delivery/recovery
      evidence and decides the expired-watch renewal action separately. No live
      renewal, sync or urgent/same-day Meet exercise is authorized here.
- [ ] Email owner supplies redacted Resend domain/from verification, Zoho
      routing, primary/partner recipient policy and due-versus-delivered records.
      Review scheduler gaps/logs without invoking the scheduler or sending mail.
- [ ] Payment owner supplies accepted historical Paystack/bank-transfer
      reconciliation and sandbox evidence; no new real payment/refund/approval.
- [ ] Operations provides accepted package restoration/privacy/storage/backup
      exceptions using the bounded cases, not an assumed absent implementation.
      R06 dashboard error fallback remains a separately recorded narrow item.
- [ ] Client approves the 18 decisions, 12 marker proposals and specific content
      exceptions from PR #114. Its 100-record sheet is inventory-based, not a
      fresh per-row production export; editorial approval is not 100 defects.
- [ ] Two named administrators acknowledge training; client records source
      receipt/revision, actual agreement ownership/licence, acceptance exceptions
      and maintenance dates.
- [ ] Named business owner and technical operator acknowledge Google, Paystack,
      Resend/Zoho/DNS, Supabase, Vercel, repository/domain, backups/recovery and
      monitoring access, billing, renewal and revocation responsibilities.
- [ ] Repository owner separately approves/applies main/develop protections
      proposed in PR #114. No settings are changed by this feature.

## Unresolved live-domain deployment identity

The 24 October reconciliation recorded Vercel alias metadata access returning
403 for www.talkspace.ng in the linked team. The exact live-domain deployment SHA
therefore remains unresolved; this document does not treat a preview or branch
HEAD as the production revision. The last recorded GitHub Production/success
deployment was 7228374445, 21 October, SHA 4205ae243792b4cbfc719a0f1825e5fbab399721.
That record alone is not proof of today's custom-domain alias.

Deployment owner must provide authorized read-only domain → deployment ID →
Git repository/branch/SHA evidence, including alias update time and environment.
Do not substitute an older accessible project, pull secrets, promote or redeploy
to resolve this evidence gap.

Final acceptance remains conditional on approved duration, bounded UAT/provider
evidence, named ownership/training/source receipts and the approved integrated
release revision. No SEO campaign, booking redesign, USD checkout, Home Visit or
new integration is added to this milestone.
