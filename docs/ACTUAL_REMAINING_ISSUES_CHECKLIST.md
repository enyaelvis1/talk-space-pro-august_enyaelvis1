# Talk Space — Actual remaining issues and handover checklist

Reconciled against the **live production tracker and read-only production functionality**, 24 October 2026. This updates the existing checklist and replaces its earlier 69-finding source-audit action plan. Do not reopen completed work from that historical version.

Read [the production evidence/defect report](CURRENT_IMPLEMENTATION_RECONCILED_AUDIT.md) first. This is the **one closeout register**, not a second tracker. The raw source remains [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md), imported at build time. Its original 200 markers were preserved.

## Rules, scope and evidence

Remediation update: R02/R03/R05 have focused implementation PRs 112/113; this
tracker/handover branch corrects R04 presentation only. None is released or
accepted by local checks. The [handover pack](HANDOVER_PREPARATION_2026-10-24.md)
and its four CSV exports propose closures/decisions without changing any of the
200 source markers. The original observations and classifications below are
retained as the audit baseline. New release gate R08 is the hosted high-severity
Zod advisory on the unchanged lockfile; do not disable auditing to merge.

- IDs **T001–T200** are assigned in original Markdown source order; original line numbers below remain valid at this review. Titles/normalized parser keys, not these ordinal aliases, are the app's task identity.
- M = origin/main `2732ccaa777cb1f242f140a8a678c85d98af4fc0`; D = origin/develop `4205ae243792b4cbfc719a0f1825e5fbab399721`.
- The source checklist is byte-identical on M/D (SHA256 `99ba109fd4d43036122739c9ccd4af0709a6f346b94bf36be0bef31e85542933` before this review's appended note). The current 133/7/60 markers also match live production.
- Source groups E01–E24/E27 below map tasks to implementation, tests and acceptance limits. All grouped source paths exist in M+D unless the report explicitly identifies D-only admin preview/payment-name code. Grouping avoids inventing one PR per task when the repository imported many earlier records together in `5c2e1db`.
- Current GitHub Production-labelled D deployment is successful; custom-domain SHA is blocked by Vercel scope authorization (G01/G02 in report). **Observed live functionality overrides a mistaken “not released because absent from main” inference.**
- Scope **Baseline** = explicit 200-item working implementation obligation, not proof of signed commercial scope. **Design supplement** = T193–T200, whose separate approval must be checked against the agreement. New client requests are listed separately in report F; already delivered additions are not re-quoted as missing work.
- COMPLETE_AND_DEPLOYED = completion of the bounded task is substantiated by production observation and/or delivered repository/hosted evidence, with relevant limits retained. It is not proof of every provider's behavior.
- DEPLOYED_NEEDS_VERIFICATION = retain the implemented/delivered feature and prior UAT; settle only its named production/acceptance qualification. It is **not** a demand for new screenshots for every task.
- CONFIRMED_PRODUCTION_DEFECT = specific live failure/contradiction, not a missing evidence artefact. Four reproduced incidents R01–R04 are described in report C; two existing task rows (T036 and T111) carry incidents R01–R03. R04 concerns the tracker itself.
- CLIENT_ACTION_REQUIRED = owner decision/access/approval, not a missing code feature. DOCUMENTATION_OR_HANDOVER = receipt/runbook/training/maintenance closure.
- A checkbox in the 67-row action list means the **bounded disposition is complete**. It does not change the bundled source marker or certify an unrelated provider flow.
- Effort S ≈ up to one working day; M = several days including a bounded isolated validation, excluding client/provider waiting. These are planning assumptions, not new quotations.

## Counts — not a new delivery percentage

| Status                       | All 200 records | Originally open 67 |
| ---------------------------- | --------------: | -----------------: |
| COMPLETE_AND_DEPLOYED        |              36 |                 12 |
| DEPLOYED_NEEDS_VERIFICATION  |             132 |                 25 |
| CONFIRMED_PRODUCTION_DEFECT  |               2 |                  0 |
| ORIGINAL_SCOPE_NOT_DELIVERED |               1 |                  1 |
| CLIENT_ACTION_REQUIRED       |              18 |                 18 |
| OPTIONAL_ENHANCEMENT         |               0 |                  0 |
| DOCUMENTATION_OR_HANDOVER    |              11 |                 11 |

**Raw live tracker:** 200 total, 133 complete, 60 not started, 7 partial, zero blocked/in-progress. Open = **60 + 7 = 67**, not 74. The 36 directly substantiated completion dispositions do not mean the other 97 previously completed markers are undelivered. This is conservative evidence mapping; **do not derive a new completion percentage from this register**.

The original seven partial rows are T049, T096, T114, T139, T152, T197, T198. One is substantively complete (managed auth); three involve provider/content/sandbox acceptance; the visual/Lighthouse rows have later implementation/evidence and should not be rebuilt.

## Immediate confirmed defect work and narrow validation

These records are **cross-references**, not 67 new tasks. Full repro/journey/source/root-cause/acceptance details are in [report C](CURRENT_IMPLEMENTATION_RECONCILED_AUDIT.md#c-actual-outstanding-production-issues).

- [ ] **R01, P1** — Live Teen/Child Home and Book 50 minutes vs Pricing 60. Owner: content/product + Engineering. Acceptance: agreed duration everywhere including actual slots. Dependency: client-approved duration. Source: E05/E08/E09 and report L02/L05. S–M.
- [ ] **R02, P1** — Live Pricing promises USD payment, current initializer uses NGN. Owner: content + Engineering. Acceptance: truthful NGN wording unless separately approved multi-currency work. Dependency: currency-copy decision. Source: E05/E12, L02. S.
- [ ] **R03, P1** — Three expired Google push-watch dates labelled Healthy. Owner: Calendar owner + Engineering. Acceptance: expired/stale watches visibly distinguished; actual renewal/fallback checked in isolation. Dependency: approved isolated Google connection. Source: E14/L06. S–M.
- [ ] **R04, P2** — Tracker stale source URL, request-time “Synced”, contradictory headings and design milestone 0/0. Owner: project owner + Engineering. Acceptance: 200 identities retained, correct grouping/counts/freshness. Dependency: accepted 67-row dispositions. Source: tracker code and L01. S.
- [ ] **R05, P1 validation** — Reminder success timestamp logic and observed schedule gaps. Owner: QA + Operations. Acceptance: isolate successful/disabled/failure/partner sent-at/claim behavior; compare existing due/delivered logs. Dependency: isolated fixture + read-only scheduler target. No demonstrated missed or duplicate customer mail is claimed. Source: E15/G04. M.
- [ ] **R06, P2 validation** — Dashboard zero fallback under query failure. Owner: Engineering + QA. Acceptance: isolated injected failure is unavailable/retry rather than false zero; normal live stats retained. Dependency: mock/fixture. Source: E17. S.
- [ ] **R07, P1 engineering gate** — Three clean-lock TypeScript errors. Owner: Engineering. Acceptance: explicit typecheck clean or accepted baseline disposition before release. Dependency: locked isolated environment. Source: T02 in report. S–M.

## Exact disposition of all 67 originally outstanding records

This list includes all seven partials. No unchecked source record is omitted. Close only its named action; reuse accepted evidence first. Tasks classified complete below are stale marker corrections, not work to reimplement.

### COMPLETE_AND_DEPLOYED — 12

- [x] **T011 — Configure lint/format/pre-commit** (P2; original [ ]; E02; source L52)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: ESLint, Prettier and pre-commit hook exist; hosted checks passed.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale marker with existing pipeline and hook evidence.

- [x] **T013 — Create CI** (P2; original [ ]; E02; source L56)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: CI workflow exists and has successful hosted runs.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale marker using hosted verify result.

- [x] **T014 — Configure secret/dependency scanning** (P2; original [ ]; E02; source L58)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Security workflow, Gitleaks and dependency auditing exist; hosted checks passed.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale marker using existing scan results.

- [x] **T015 — Create PR/issue templates** (P2; original [ ]; E02; source L60)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: PR and bug/feature issue templates already exist.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale marker; verify templates in repository UI.

- [x] **T023 — Document component states** (P2; original [ ]; E03; source L79)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: docs/COMPONENT_STATES.md contains the component/state matrix.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale marker; use existing document.

- [x] **T049 — Managed auth** (P2; original [p]; E07; source L143)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Authenticated live admin and owner-only tracker work; historical password-reset evidence exists.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close generic managed-auth marker; retain only explicit recovery/provider setup questions.

- [x] **T140 — Migrate core content** (P2; original [ ]; E18; source L358)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Imported/public journal and pages render; the main marker is obsolete for the migration mechanism.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close technical import marker; keep content approval at T139/T144.

- [x] **T160 — Threat/security review** (P2; original [ ]; E20; source L404)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Written threat/security review already exists; it is an engineering batch review, not a penetration-test certificate.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close written-review marker; retain only stated residual operating actions.

- [x] **T161 — Unit availability/states** (P2; original [ ]; E21; source L409)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Availability/state regression test file exists and passes this reconciliation.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale test marker; no new availability engine required.

- [x] **T162 — Permission/token tests** (P2; original [ ]; E21; source L411)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Permission/token test file exists and passes this reconciliation.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close stale test marker; cross-account provider UAT remains bounded.

- [x] **T170 — DNS/CDN/SSL** (P2; original [ ]; E22; source L430)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Live www HTTPS works and known legacy URL redirects. DNS/CDN/SSL cannot be called uncreated.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close delivery marker; document renewal/ownership with T178.

- [x] **T178 — Domain redirects/SSL** (P2; original [ ]; E23; source L449)
  - Status: COMPLETE_AND_DEPLOYED. Scope: Baseline.
  - Evidence / exact remaining boundary: Live HTTPS/legacy-home redirect verified; no DNS change required on this evidence.
  - Owner: Engineering + QA. Dependency: Existing accepted evidence; no production mutation. Effort: S.
  - Action / acceptance: Close duplicate delivery marker; record domain owner and renewals.

### DEPLOYED_NEEDS_VERIFICATION — 25

- [ ] **T012 — Create env schema/example** (P2; original [ ]; E02; source L54)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Env example and Supabase/provider validation paths exist; never print real values.
  - Owner: Engineering. Dependency: Redacted configuration checklist. Effort: S.
  - Action / acceptance: Confirm required-variable failure/URL guards in isolated fixture; do not rewrite .env.

- [ ] **T096 — Sandbox E2E** (P1; original [p]; E12; source L252)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Paystack safeguards and confirmed production ledger exist; sandbox E2E is an acceptance test, not absent checkout.
  - Owner: QA + payment owner. Dependency: Isolated sandbox credentials and email sink. Effort: M.
  - Action / acceptance: Reuse approved sandbox evidence; if missing, run one isolated sandbox positive/replay/mismatch matrix.

- [ ] **T141 — Optimise media** (P2; original [ ]; E18; source L360)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Responsive image delivery exists; inspected home/services images have no broken loads. Not proof every legacy alt/asset is optimized.
  - Owner: Content owner + QA. Dependency: Legacy inventory exception list. Effort: S.
  - Action / acceptance: Reuse image/performance evidence; review only identified remaining legacy exceptions.

- [ ] **T143 — Redirect map** (P2; original [ ]; E18; source L364)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Redirect map/editor exists; migrated-home slug returns 301 to root.
  - Owner: QA + content owner. Dependency: Approved legacy URL list. Effort: S.
  - Action / acceptance: Accept existing redirect inventory; spot-check approved retired URLs only.

- [ ] **T152 — Lighthouse/axe** (P2; original [p]; E19; source L385)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: August mobile Lighthouse/axe evidence and audit scripts exist; all-category full-route record is the partial boundary.
  - Owner: QA. Dependency: Agreed route/device matrix. Effort: M.
  - Action / acceptance: Reuse approved reports; fill only changed-route or missing four-category coverage.

- [ ] **T156 — Private storage** (P1; original [ ]; E20; source L396)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Private receipt/backup storage and signed-URL implementation exist; written storage review is complete.
  - Owner: Operations + QA. Dependency: Authorized Supabase read-only policy evidence. Effort: S.
  - Action / acceptance: Operator confirms deployed grants/policies from redacted read-only evidence; no anonymous private-file exposure test on real files.

- [ ] **T157 — Protect tokens/secrets** (P1; original [ ]; E20; source L398)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Encrypted settings, server-only grants and secret handling review exist.
  - Owner: Engineering + Operations. Dependency: Read-only grants/configuration evidence. Effort: S.
  - Action / acceptance: Accept review plus current redacted configuration/grant verification.

- [ ] **T159 — Token expiry/revocation** (P1; original [ ]; E20; source L402)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Token expiry/revocation migration, guards, revoke action and tests exist.
  - Owner: QA + Operations. Dependency: Isolated database/token fixtures. Effort: S.
  - Action / acceptance: Reuse prior UAT; if necessary verify lifecycle on disposable isolated fixtures only.

- [ ] **T163 — Paystack edge cases** (P1; original [ ]; E21; source L413)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Payment validation/replay/edge contracts already exist; real sandbox concurrency is separate.
  - Owner: QA + payment owner. Dependency: T096; sandbox only. Effort: M.
  - Action / acceptance: Link existing Paystack accepted run or fill its missing isolated negative cases.

- [ ] **T164 — Bank review tests** (P1; original [ ]; E21; source L415)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Bank integrity/review tests exist and local integrity suite passes.
  - Owner: QA. Dependency: Disposable database and receipt fixture. Effort: S.
  - Action / acceptance: Reuse accepted submit/approve/reject fixture results; fill only missing isolated DB/browser cases.

- [ ] **T165 — Form version tests** (P2; original [ ]; E21; source L417)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Form drafts and template/version implementation exist; exact version round-trip evidence is incomplete here.
  - Owner: QA. Dependency: Isolated form registry fixture. Effort: S.
  - Action / acceptance: Link accepted template-version round trip, or add/run isolated regression if genuinely absent.

- [ ] **T166 — Critical Playwright** (P1; original [ ]; E21; source L419)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Critical Playwright suites/fixtures exist. Do not classify browser tests as not written.
  - Owner: QA. Dependency: Isolated app/DB/provider sinks. Effort: M.
  - Action / acceptance: Reuse accepted book/pay/reschedule/cancel/contact/publish runs; run gaps only in isolated environment.

- [ ] **T167 — Cross-browser/mobile** (P2; original [ ]; E21; source L421)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Mobile/desktop evidence exists; current iOS/Safari/Firefox coverage not independently inspected.
  - Owner: QA + client. Dependency: Agreed devices; no new production test records. Effort: M.
  - Action / acceptance: Client/QA confirms accepted device matrix; perform only uncovered smoke paths.

- [ ] **T169 — Create environments** (P1; original [ ]; E22; source L428)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Production exists; independent staging/backend/provider isolation has not been established by metadata available here.
  - Owner: Operations. Dependency: Vercel/Supabase project ownership. Effort: S.
  - Action / acceptance: Confirm environment/backend separation read-only; never provision or repoint during this review.

- [ ] **T171 — Vercel/secrets** (P1; original [ ]; E22; source L432)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Running app and deployment record exist; linked Vercel team alias metadata is 403.
  - Owner: Deployment owner. Dependency: Vercel enyaelvis1-gmailcoms-projects access. Effort: S.
  - Action / acceptance: Provide domain→deployment→SHA read-only evidence and redacted required-secret presence.

- [ ] **T173 — Storage policies** (P1; original [ ]; E22; source L436)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Storage policies exist in migrations/reviews; production policy version was not queried.
  - Owner: Operations. Dependency: Authorized Supabase policy history. Effort: S.
  - Action / acceptance: Combine with T156; read-only migration/grant evidence only.

- [ ] **T174 — Jobs/retries** (P1; original [ ]; E22; source L438)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Reminder workflow and retry/recheck routes exist and scheduled runs succeed. Recent run gaps are 285 and 147 minutes; success stamps need R05 validation.
  - Owner: Operations + QA. Dependency: R05; redacted scheduler target/run and provider logs. Effort: M.
  - Action / acceptance: Confirm target and due/delivered claims from logs; isolate timestamp/catch-up tests, do not trigger job.

- [ ] **T175 — Errors/uptime** (P1; original [ ]; E22; source L440)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Sentry client/server instrumentation already exists. Current DSN activation, alert routing and uptime service not proven.
  - Owner: Operations. Dependency: Monitoring account access and agreed SLA. Effort: S.
  - Action / acceptance: Confirm redacted dashboard/alert ownership; decide if external uptime monitor already exists.

- [ ] **T179 — Smoke tests** (P1; original [ ]; E23; source L451)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Read-only production smoke succeeded in this reconciliation; no live transaction was attempted.
  - Owner: QA. Dependency: Current release identity and existing accepted smoke. Effort: S.
  - Action / acceptance: Use these results plus existing accepted transactional smoke, not a new live charge.

- [ ] **T180 — Production Paystack** (P1; original [ ]; E23; source L453)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: 63 confirmed payments show a functioning ledger; that alone does not certify every provider path or key mode.
  - Owner: Payment owner + Operations. Dependency: Redacted historical provider/ledger evidence. Effort: S.
  - Action / acceptance: Payment owner confirms existing accepted production configuration and historical transaction reconciliation, without new charges.

- [ ] **T181 — Google/Resend/Zoho** (P1; original [ ]; E23; source L455)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Six connected Google calendars, email failure queue empty, routing code exists; these are not all-provider end-to-end proof.
  - Owner: Operations + provider owners. Dependency: R03; T113/T114; existing provider evidence. Effort: S.
  - Action / acceptance: Reuse accepted provider evidence; confirm domain/Zoho owner and expired-watch exceptions.

- [ ] **T187 — Review reminders/calendar** (P1; original [ ]; E24; source L470)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Baseline.
  - Evidence / exact remaining boundary: Reminders/calendar exist; live empty failure queue is encouraging, not recipient-delivery proof.
  - Owner: Operations + QA. Dependency: Historical redacted logs; no new messages. Effort: S.
  - Action / acceptance: Review existing due-vs-delivered/Meet records and R03/R05 exceptions only.

- [ ] **T197 — Redesign public hero + Home sections** (P2; original [p]; E27; source L508)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Design supplement; confirm approval.
  - Evidence / exact remaining boundary: Live Home has hero, service/gallery, three-step section, testimonials, FAQ and CTA; later design checklist marks refresh done.
  - Owner: Client/design owner + QA. Dependency: Approved design, not an unapproved new booking redesign. Effort: S.
  - Action / acceptance: Accept existing visual UAT or review specific deviations only; do not rebuild completed Home.

- [ ] **T198 — Public inner pages composition** (P2; original [p]; E27; source L510)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Design supplement; confirm approval.
  - Evidence / exact remaining boundary: Services/Pricing/Therapists/FAQs load; detailed design checklist records inner-page completion.
  - Owner: Client/design owner + QA. Dependency: Approved design baseline. Effort: S.
  - Action / acceptance: Accept existing inner-page design UAT, list any concrete exception.

- [ ] **T200 — Refresh visuals and social image** (P2; original [ ]; E27; source L514)
  - Status: DEPLOYED_NEEDS_VERIFICATION. Scope: Design supplement; confirm approval.
  - Evidence / exact remaining boundary: Warm social image already exists and later checklist marks regeneration done; old main note contradicts it.
  - Owner: Content/design owner. Dependency: Approved social asset/CMS selection. Effort: S.
  - Action / acceptance: Confirm live configured OG image is the approved asset; close stale note.

### ORIGINAL_SCOPE_NOT_DELIVERED — 1

- [ ] **T009 — Create/protect repository** (P1; original [ ]; E02; source L48)
  - Status: ORIGINAL_SCOPE_NOT_DELIVERED. Scope: Baseline.
  - Evidence / exact remaining boundary: Repository exists, but main protection API returns Branch not protected, both main/develop branch metadata reports protected:false, and repository rulesets are empty.
  - Owner: Repository owner + Engineering. Dependency: GitHub admin rights and agreed protection rules. Effort: S.
  - Action / acceptance: Approve and configure main/develop review/check protections; verify read-only after change.

### CLIENT_ACTION_REQUIRED — 18

- [ ] **T001 — Approve terminology** (P1; original [ ]; E01; source L29)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Terminology/glossary exists; approval is a business decision.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T002 — Approve Sections 01–28** (P1; original [ ]; E01; source L31)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Working section map exists; original signed acceptance is not located.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T003 — Confirm inclusions/exclusions** (P1; original [ ]; E01; source L33)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Current scope doc exists, but is not a signed variation or commercial approval.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T004 — Confirm staff roles** (P1; original [ ]; E01; source L35)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Roles implemented; confirm who owns each access level and least-privilege policy.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T005 — Confirm services/prices/rules** (P1; original [ ]; E01; source L37)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Catalogue exists; live Teen/Child duration conflict is R01. Confirm canonical duration and cancellation/credit policy.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T006 — Confirm providers/cost ownership** (P1; original [ ]; E01; source L39)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Providers exist; identify subscription/billing and renewal owners.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T007 — Confirm retention/policy owners** (P1; original [ ]; E01; source L41)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Retention/form guidance exists; identify policy owner and approved retention periods.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T008 — Confirm success measures** (P1; original [ ]; E01; source L43)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Agree final measurable acceptance, support period and escalation contacts.
  - Owner: Client/product owner. Dependency: Original agreement or written decision. Effort: S.
  - Action / acceptance: Owner records approval/reference in existing scope notes.

- [ ] **T024 — Approve responsive direction** (P2; original [ ]; E03; source L81)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Responsive implementation and earlier QA exist; sign-off is not a missing layout engine.
  - Owner: Client/design owner. Dependency: Approved design baseline. Effort: S.
  - Action / acceptance: Attach existing visual approval or record a bounded final review.

- [ ] **T113 — Confirm Zoho recipients** (P1; original [ ]; E15; source L295)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Zoho routing is implemented; recipient ownership remains separate.
  - Owner: Client/email owner. Dependency: Mailbox ownership. Effort: S.
  - Action / acceptance: Confirm approved mailbox and recipients without sending a test mail here.

- [ ] **T114 — Verify sending domain** (P1; original [p]; E15; source L297)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Sending-domain setup is external; an empty failure queue alone does not prove Resend DNS/domain state.
  - Owner: Client/email owner. Dependency: Resend/DNS account read access. Effort: S.
  - Action / acceptance: Owner supplies redacted verified-domain/sender evidence or confirms existing accepted evidence.

- [ ] **T139 — Select approved content** (P1; original [p]; E18; source L356)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Live migration review queue has 100 pending and no approved/excluded decisions.
  - Owner: Client/content owner. Dependency: Approved content/clinical review. Effort: M.
  - Action / acceptance: Content owner approves/excludes each inventory record; preserve originals.

- [ ] **T142 — Correct errors** (P1; original [ ]; E18; source L362)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Generic migration correction task has no current record-specific defect list; R01/R02 are explicit copy exceptions.
  - Owner: Client/content owner. Dependency: T139 decisions; R01/R02. Effort: S.
  - Action / acceptance: Owner records specific content corrections, not a blanket rebuild.

- [ ] **T144 — Obtain approval** (P1; original [ ]; E18; source L366)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Content publication did not record migration approval; live queue remains pending.
  - Owner: Client/content owner. Dependency: T139. Effort: S.
  - Action / acceptance: Record migration/content acceptance.

- [ ] **T168 — Staging QA sign-off** (P1; original [ ]; E21; source L423)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: User has repeatedly reported UAT passed; no new screenshot is required to prove implementation.
  - Owner: Client/UAT owner. Dependency: Existing UAT approval. Effort: S.
  - Action / acceptance: Record accepted revision, approving person/date and scope, with any exclusions.

- [ ] **T177 — Production data/content** (P1; original [ ]; E23; source L447)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Live CMS content exists; not-started marker is not an empty production database. Approval queue is still pending.
  - Owner: Client/content owner. Dependency: T139/T144. Effort: S.
  - Action / acceptance: Approve the delivered production content and named exceptions.

- [ ] **T184 — Acceptance/maintenance start** (P1; original [ ]; E23; source L461)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Final acceptance/maintenance start is a commercial approval, not 0% launch implementation.
  - Owner: Client/project owner. Dependency: Resolved P1 defects and agreed exceptions. Effort: S.
  - Action / acceptance: Sign final acceptance with explicit exceptions and support start/end.

- [ ] **T190 — Review staff access** (P1; original [ ]; E24; source L476)
  - Status: CLIENT_ACTION_REQUIRED. Scope: Baseline.
  - Evidence / exact remaining boundary: Role isolation exists; staff approval/review is business ownership.
  - Owner: Client/access owner. Dependency: Authorized access roster. Effort: S.
  - Action / acceptance: Approve active staff/therapist access roster privately.

### DOCUMENTATION_OR_HANDOVER — 11

- [ ] **T010 — Configure pnpm/Node/TypeScript/lockfile** (P1; original [ ]; E02; source L50)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Node/npm/TypeScript/lockfile already configured. pnpm wording is stale. Three clean-lock type errors remain an engineering release gate, not a reproduced live failure.
  - Owner: Engineering. Dependency: Clean install baseline; R07. Effort: S.
  - Action / acceptance: Record npm as agreed toolchain; resolve or explicitly disposition the three type errors before next release.

- [ ] **T016 — Create changelog/release process** (P2; original [ ]; E02; source L62)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Release process exists; no standalone changelog located. Release PRs contain change history.
  - Owner: Engineering + project owner. Dependency: Existing merged PR/release history. Effort: S.
  - Action / acceptance: Agree whether linked release notes suffice, then index releases for handover.

- [ ] **T176 — Rollback/emergency access** (P1; original [ ]; E22; source L442)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Release rollback guidance and encrypted app-backup feature exist. App backup excludes auth/credentials and is not full provider recovery.
  - Owner: Operations + project owner. Dependency: Provider backup plan; staging restore target. Effort: M.
  - Action / acceptance: Name rollback/emergency owners; attach approved restore drill and backup cadence.

- [ ] **T182 — Train two admins** (P1; original [ ]; E23; source L457)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Training delivery is not a software feature and absence of a record does not prove training never happened.
  - Owner: Project owner + client admins. Dependency: Training availability. Effort: S.
  - Action / acceptance: Record two named admins, topics and completion/remaining session.

- [ ] **T183 — Deliver source/docs** (P1; original [ ]; E23; source L459)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Repository and substantial docs exist; receipt/ownership transfer needs a record.
  - Owner: Project owner. Dependency: Client-owned destination/access; no secret transfer in report. Effort: S.
  - Action / acceptance: Deliver source access, runbooks and access inventory; obtain handover acknowledgement.

- [ ] **T185 — Monitor first bookings** (P2; original [ ]; E24; source L466)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Actual bookings exist; operational monitoring has started in practice, but ownership/window not recorded here.
  - Owner: Operations. Dependency: Maintenance agreement. Effort: S.
  - Action / acceptance: Name monitor, review period and incident evidence.

- [ ] **T186 — Review webhook errors** (P1; original [ ]; E24; source L468)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Webhook handling/logging exists; ongoing error review is a support task.
  - Owner: Operations. Dependency: Read-only provider logs. Effort: S.
  - Action / acceptance: Attach current historical error review and escalation owner.

- [ ] **T188 — Fix scope defects** (P1; original [ ]; E24; source L472)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Scope-defect repair is a maintenance commitment, not an unimplemented feature.
  - Owner: Engineering + project owner. Dependency: Agreed defect/support scope. Effort: S.
  - Action / acceptance: Track only reproducible R01–R04 and validated residuals; close accepted cases.

- [ ] **T189 — Security patches** (P2; original [ ]; E24; source L474)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Dependency scanning and October dependency remediation already exist; patching is recurring.
  - Owner: Engineering + Operations. Dependency: Maintenance term and current scan results. Effort: S.
  - Action / acceptance: Record patch owner/cadence and accepted baseline; avoid unapproved broad upgrades.

- [ ] **T191 — Post-launch review** (P2; original [ ]; E24; source L478)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Post-launch review is an operating meeting, not absent application code.
  - Owner: Client/project owner. Dependency: Acceptance/maintenance agreement. Effort: S.
  - Action / acceptance: Record outcomes, exceptions and maintenance decisions.

- [ ] **T192 — Record future change requests** (P2; original [ ]; E24; source L480)
  - Status: DOCUMENTATION_OR_HANDOVER. Scope: Baseline.
  - Evidence / exact remaining boundary: Issue templates and client-feedback registers exist; quote approval remains separate.
  - Owner: Project owner. Dependency: Original scope and approved variations. Effort: S.
  - Action / acceptance: Use existing change register and written approval before new work.

## All 200 task records — traceability index

Every record below has its raw marker preserved. E references resolve to exact implementation and evidence qualifications in the next section; M+D denotes current branch source evidence, **not an independently established custom-domain SHA**. The separate 67-row list gives concrete owner/action/dependency for open markers. A previously checked row with a discovered live defect is explicitly flagged, rather than silently blessed.

| ID / source line | Requirement                                          | Raw marker | Current classification       | Scope / source and acceptance evidence                                |
| ---------------- | ---------------------------------------------------- | ---------- | ---------------------------- | --------------------------------------------------------------------- |
| T001 / L29       | Approve terminology                                  | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T002 / L31       | Approve Sections 01–28                               | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T003 / L33       | Confirm inclusions/exclusions                        | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T004 / L35       | Confirm staff roles                                  | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T005 / L37       | Confirm services/prices/rules                        | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T006 / L39       | Confirm providers/cost ownership                     | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T007 / L41       | Confirm retention/policy owners                      | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T008 / L43       | Confirm success measures                             | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E01; M+D; retain bounded evidence/acceptance below          |
| T009 / L48       | Create/protect repository                            | [ ]        | ORIGINAL_SCOPE_NOT_DELIVERED | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T010 / L50       | Configure pnpm/Node/TypeScript/lockfile              | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T011 / L52       | Configure lint/format/pre-commit                     | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T012 / L54       | Create env schema/example                            | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T013 / L56       | Create CI                                            | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T014 / L58       | Configure secret/dependency scanning                 | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T015 / L60       | Create PR/issue templates                            | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T016 / L62       | Create changelog/release process                     | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E02; M+D; retain bounded evidence/acceptance below          |
| T017 / L67       | Obtain logo/favicon — pending client visual approval | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T018 / L69       | Finalise colours                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T019 / L71       | Implement typography                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T020 / L73       | Implement spacing/radius/motion                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T021 / L75       | Create social image                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T022 / L77       | Configure accessible primitives                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T023 / L79       | Document component states                            | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T024 / L81       | Approve responsive direction                         | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E03; M+D; retain bounded evidence/acceptance below          |
| T025 / L86       | Build header/booking CTA                             | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T026 / L88       | Build mobile navigation                              | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T027 / L90       | Build footer                                         | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T028 / L92       | Implement breadcrumbs/titles                         | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T029 / L94       | Implement skip/focus                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T030 / L96       | Add WhatsApp CTA                                     | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T031 / L98       | Create 404/errors                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T032 / L100      | Verify links/redirects                               | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E04; M+D; retain bounded evidence/acceptance below          |
| T033 / L105      | Build Home                                           | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T034 / L107      | Build Services                                       | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T035 / L109      | Build Therapists                                     | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T036 / L111      | Build Pricing                                        | [x]        | CONFIRMED_PRODUCTION_DEFECT  | Baseline; E05; M+D; R01/R02, L02/L05                                  |
| T037 / L113      | Build About                                          | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T038 / L115      | Build Blog                                           | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T039 / L117      | Build Contact/FAQ                                    | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T040 / L119      | Build approved legal/emergency pages                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E05; M+D; retain bounded evidence/acceptance below          |
| T041 / L124      | Secure CMS access                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T042 / L126      | Page/block editor                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T043 / L128      | Blog/categories                                      | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T044 / L130      | Media library                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T045 / L132      | Services/pricing                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T046 / L134      | Therapists/testimonials/FAQs                         | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T047 / L136      | Draft/preview/publish/archive                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T048 / L138      | Revisions/scheduling/redirects                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E06; M+D; retain bounded evidence/acceptance below          |
| T049 / L143      | Managed auth                                         | [p]        | COMPLETE_AND_DEPLOYED        | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T050 / L145      | Create two roles                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T051 / L147      | Route protection                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T052 / L149      | Secure cookies                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T053 / L151      | Password reset                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T054 / L153      | MFA readiness                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T055 / L155      | Step-up actions                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T056 / L157      | Auth/permission audit                                | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E07; M+D; retain bounded evidence/acceptance below          |
| T057 / L162      | Service schema                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T058 / L164      | Therapist assignment                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T059 / L166      | Modes/locations                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T060 / L168      | Duration/price                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T061 / L170      | Weekly rules                                         | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T062 / L172      | Exceptions                                           | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T063 / L174      | Buffers/lead time                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T064 / L176      | Availability tests                                   | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E08; M+D; retain bounded evidence/acceptance below          |
| T065 / L181      | First-time path                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T066 / L183      | Returning path                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T067 / L185      | Secure tokens                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T068 / L187      | Transactional slot reservation                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T069 / L189      | Appointment state machine                            | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T070 / L191      | Summary/validation                                   | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T071 / L193      | Reschedule request                                   | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T072 / L195      | Cancel/no-show/complete                              | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E09; M+D; retain bounded evidence/acceptance below          |
| T073 / L200      | Client schema                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T074 / L202      | Capture contact/DOB                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T075 / L204      | Search/filter                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T076 / L206      | Client detail                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T077 / L208      | Appointment history                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T078 / L210      | Payment/form summaries                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T079 / L212      | Administrative updates                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T080 / L214      | Permissioned export                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E10; M+D; retain bounded evidence/acceptance below          |
| T081 / L219      | Inventory Google Forms                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T082 / L221      | Versioned templates                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T083 / L223      | Question editor                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T084 / L225      | Secure intake                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T085 / L227      | Approved assessments                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T086 / L229      | Save/resume                                          | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T087 / L231      | Completion state                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T088 / L233      | Consent acknowledgement                              | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E11; M+D; retain bounded evidence/acceptance below          |
| T089 / L238      | Test/live config                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T090 / L240      | Server initialisation                                | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T091 / L242      | Webhook signature                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T092 / L244      | Idempotent confirmation                              | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T093 / L246      | Amount/currency/reference validation                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T094 / L248      | Status/timeline                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T095 / L250      | Delayed recheck                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T096 / L252      | Sandbox E2E                                          | [p]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E12; M+D; retain bounded evidence/acceptance below          |
| T097 / L257      | Account details                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T098 / L259      | Reference instructions                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T099 / L261      | Transfer submission                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T100 / L263      | Private receipt upload                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T101 / L265      | Review queue                                         | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T102 / L267      | Verify/reject                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T103 / L269      | Audit actor/reason                                   | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T104 / L271      | Connect confirmation                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E13; M+D; retain bounded evidence/acceptance below          |
| T105 / L276      | OAuth config                                         | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T106 / L278      | Connect calendar                                     | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T107 / L280      | Calendar adapter                                     | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T108 / L282      | Create Meet                                          | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T109 / L284      | Update reschedule                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T110 / L286      | Update cancellation                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T111 / L288      | Retry/sync state                                     | [x]        | CONFIRMED_PRODUCTION_DEFECT  | Baseline; E14; M+D; R03, L06                                          |
| T112 / L290      | Failure tests                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E14; M+D; retain bounded evidence/acceptance below          |
| T113 / L295      | Confirm Zoho recipients                              | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T114 / L297      | Verify sending domain                                | [p]        | CLIENT_ACTION_REQUIRED       | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T115 / L299      | Resend adapter                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T116 / L301      | Confirmation template                                | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T117 / L303      | Form reminder                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T118 / L305      | Appointment reminder                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T119 / L307      | Payment templates                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T120 / L309      | Delivery/retry/resend                                | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E15; M+D; retain bounded evidence/acceptance below          |
| T121 / L314      | Contact form                                         | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T122 / L316      | Route to Zoho                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T123 / L318      | Spam/rate protection                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T124 / L320      | Store enquiry                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T125 / L322      | WhatsApp number                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T126 / L324      | Prefilled message                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T127 / L326      | Desktop/mobile test                                  | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T128 / L328      | Response guidance                                    | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E16; M+D; retain bounded evidence/acceptance below          |
| T129 / L333      | Overview                                             | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T130 / L335      | Today/upcoming                                       | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T131 / L337      | Pending forms                                        | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T132 / L339      | Pending transfers                                    | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T133 / L341      | Failed notification/Meet queue                       | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T134 / L343      | Appointment timeline                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T135 / L345      | Integration/settings                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T136 / L347      | Audit log                                            | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E17; M+D; retain bounded evidence/acceptance below          |
| T137 / L352      | Export WordPress                                     | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T138 / L354      | Inventory URLs                                       | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T139 / L356      | Select approved content                              | [p]        | CLIENT_ACTION_REQUIRED       | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T140 / L358      | Migrate core content                                 | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T141 / L360      | Optimise media                                       | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T142 / L362      | Correct errors                                       | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T143 / L364      | Redirect map                                         | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T144 / L366      | Obtain approval                                      | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E18; M+D; retain bounded evidence/acceptance below          |
| T145 / L371      | Metadata/canonical                                   | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T146 / L373      | Sitemap/robots                                       | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T147 / L375      | Structured data                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T148 / L377      | Images/fonts                                         | [x]        | COMPLETE_AND_DEPLOYED        | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T149 / L379      | Core Web Vitals                                      | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T150 / L381      | Reduced motion/focus                                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T151 / L383      | Keyboard/screen reader                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T152 / L385      | Lighthouse/axe                                       | [p]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E19; M+D; retain bounded evidence/acceptance below          |
| T153 / L390      | CSP/HSTS                                             | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T154 / L392      | CSRF/CORS                                            | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T155 / L394      | Rate limits                                          | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T156 / L396      | Private storage                                      | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T157 / L398      | Protect tokens/secrets                               | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T158 / L400      | Security/audit logging                               | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T159 / L402      | Token expiry/revocation                              | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T160 / L404      | Threat/security review                               | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E20; M+D; retain bounded evidence/acceptance below          |
| T161 / L409      | Unit availability/states                             | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T162 / L411      | Permission/token tests                               | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T163 / L413      | Paystack edge cases                                  | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T164 / L415      | Bank review tests                                    | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T165 / L417      | Form version tests                                   | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T166 / L419      | Critical Playwright                                  | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T167 / L421      | Cross-browser/mobile                                 | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T168 / L423      | Staging QA sign-off                                  | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E21; M+D; retain bounded evidence/acceptance below          |
| T169 / L428      | Create environments                                  | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T170 / L430      | DNS/CDN/SSL                                          | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T171 / L432      | Vercel/secrets                                       | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T172 / L434      | Migrations/backups                                   | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T173 / L436      | Storage policies                                     | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T174 / L438      | Jobs/retries                                         | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T175 / L440      | Errors/uptime                                        | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T176 / L442      | Rollback/emergency access                            | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E22; M+D; retain bounded evidence/acceptance below          |
| T177 / L447      | Production data/content                              | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T178 / L449      | Domain redirects/SSL                                 | [ ]        | COMPLETE_AND_DEPLOYED        | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T179 / L451      | Smoke tests                                          | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T180 / L453      | Production Paystack                                  | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T181 / L455      | Google/Resend/Zoho                                   | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T182 / L457      | Train two admins                                     | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T183 / L459      | Deliver source/docs                                  | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T184 / L461      | Acceptance/maintenance start                         | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E23; M+D; retain bounded evidence/acceptance below          |
| T185 / L466      | Monitor first bookings                               | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T186 / L468      | Review webhook errors                                | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T187 / L470      | Review reminders/calendar                            | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T188 / L472      | Fix scope defects                                    | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T189 / L474      | Security patches                                     | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T190 / L476      | Review staff access                                  | [ ]        | CLIENT_ACTION_REQUIRED       | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T191 / L478      | Post-launch review                                   | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T192 / L480      | Record future change requests                        | [ ]        | DOCUMENTATION_OR_HANDOVER    | Baseline; E24; M+D; retain bounded evidence/acceptance below          |
| T193 / L500      | Adopt warm surface palette                           | [x]        | COMPLETE_AND_DEPLOYED        | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T194 / L502      | Serif display + sans body typography                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T195 / L504      | Section badge and heading pattern                    | [x]        | COMPLETE_AND_DEPLOYED        | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T196 / L506      | Pill buttons, cards and soft shadows                 | [x]        | DEPLOYED_NEEDS_VERIFICATION  | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T197 / L508      | Redesign public hero + Home sections                 | [p]        | DEPLOYED_NEEDS_VERIFICATION  | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T198 / L510      | Public inner pages composition                       | [p]        | DEPLOYED_NEEDS_VERIFICATION  | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T199 / L512      | Floating action dock                                 | [x]        | COMPLETE_AND_DEPLOYED        | Design supplement; E27; M+D; retain bounded evidence/acceptance below |
| T200 / L514      | Refresh visuals and social image                     | [ ]        | DEPLOYED_NEEDS_VERIFICATION  | Design supplement; E27; M+D; retain bounded evidence/acceptance below |

## Implementation, merged-release and acceptance mapping

Current paths are repository-relative. Functions/tests below locate the actual implementation; they are not substitutes for production acceptance. The tracker file itself was imported in `5c2e1db`; task labels have not been maintained alongside many later releases. Detailed PR evidence cannot honestly be invented for every initial foundation item.

| Group | Original obligation       | Current source/functions/tests                                                                                                                                                                                                                        | Acceptance evidence and remaining limit                                                                                                                                                                 |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E10   | Client records            | src/lib/clients.functions.ts; src/components/admin/AdminClients.tsx; src/lib/client-csv.ts; test/client-management.test.ts; test/client-csv.test.ts                                                                                                   | Live dashboard has 69 clients. Existing linkage/import/export implementation retained; private records not exported.                                                                                    |
| E11   | Forms                     | src/lib/form-templates.ts; src/lib/form-drafts.ts; src/routes/_authenticated.admin.forms.tsx; docs/FORM_TEMPLATES_AND_VERSIONING.md; test/form-drafts.test.ts                                                                                         | Version/template/intake flows exist. No actual client intake submitted or synthetic production record created.                                                                                          |
| E12   | Paystack                  | src/lib/payments.functions.ts; src/lib/payments.server.ts; src/lib/payment-validation.ts; src/routes/api/public/paystack-webhook.ts; src/routes/api/public/hooks/recheck-payments.ts; test/payment-flow.test.ts; test/paystack-confirmation.test.ts   | Live confirmed ledger is populated. No provider initialization, recheck, charge, webhook replay or refund executed.                                                                                     |
| E13   | Bank transfer             | src/lib/payments.functions.ts; src/lib/payment-booking-review.ts; src/routes/_authenticated.admin.payments.tsx; test/bank-transfer-integrity.test.ts; test/payment-booking-review.test.ts                                                             | Live payment page: 0 pending, 63 confirmed, 20 archived; confirmed tab renders 50 rows, page 1/2. No approve/reject or receipt download.                                                                |
| E14   | Google Calendar/Meet      | src/lib/google.functions.ts::loadTherapistConnections/syncAppointmentToGoogle; src/lib/google.server.ts; src/routes/_authenticated.admin.google.tsx; test/google-calendar-flow.test.ts                                                                | Live: six connected calendars; three expired watch dates still Healthy. Connection is not proof of an active push subscription or delivered Meet.                                                       |
| E15   | Email/reminders           | src/lib/email.functions.ts; src/lib/email.server.ts; src/lib/email-templates.server.ts; src/routes/api/public/hooks/send-reminders.ts::sendReminderRecipient; .github/workflows/send-reminders.yml; test/notification-policy.test.ts                  | No unresolved notification failures on dashboard. Successful scheduled workflow runs exist; no real messages sent by this review. Timestamp branch requires targeted fixture validation.                |
| E16   | Contact/WhatsApp          | src/routes/contact.tsx; src/lib/contact.functions.ts; src/lib/talkspace.ts; docs/ADMIN_RESPONSE_GUIDANCE.md; test/contact-flow.test.ts; docs/qa/contact/                                                                                              | Live WhatsApp links use configured public number. Actual enquiry/email submission deliberately not executed.                                                                                            |
| E17   | Admin operations          | src/components/progress/AdminOverview.tsx; src/lib/admin.functions.ts::getAdminOperationsWorkspace/loadAdminDashboardSummary; src/lib/payment-booking-review.ts; test/payment-flow.test.ts                                                            | Live: 69 clients, six therapists, 15 upcoming, 0 pending, 0 sync issues, no unresolved delivery failures. The old zeros issue does not reproduce.                                                       |
| E18   | Migration/content         | docs/migration/WORDPRESS_INVENTORY_2026-08-02.md; docs/migration/LEGACY_URL_INVENTORY_2026-08-02.md; src/routes/_authenticated.admin.migration.tsx; src/lib/admin.functions.ts::listMigrationContentReviews; src/lib/legacy-redirects.ts              | Live approval queue: 100 Pending, 0 Approved, 0 Needs revision, 0 Excluded. Published/imported content exists; publication is not approval.                                                             |
| E19   | SEO/performance           | src/lib/seo.ts; src/lib/sitemap.ts; src/routes/robots[.]txt.ts; src/components/site/OptimizedImage.tsx; docs/qa/SEO_PERFORMANCE_ACCESSIBILITY_2026-08-02.md; test/sitemap.test.ts                                                                     | Live sitemap 200 XML, 106 URLs, no tested private path patterns; robots points to apex sitemap; Home canonical correct and inspected images load. August Lighthouse/axe proof is historical.            |
| E20   | Security/privacy          | docs/{STORAGE_SECURITY_REVIEW_2026-08-10,SECRET_HANDLING_REVIEW_2026-08-10,THREAT_SECURITY_REVIEW_2026-08-10}.md; supabase/migrations/20260810145500_manage_token_expiry_revocation.sql; src/lib/security-headers.ts; test/security-hardening.test.ts | Written reviews and lifecycle/security controls exist. Current production grants and cross-account denials were not exercised destructively.                                                            |
| E21   | QA/acceptance             | test/{availability-and-appointment-state,permission-and-token-contracts,payment-flow,bank-transfer-integrity,form-drafts}.test.ts; test/*e2e.test.ts; docs/qa/; docs/TALKSPACE_CLIENT_FEEDBACK_UAT_CHECKLIST.md                                       | Many unchecked QA tasks already have tests. Historical UAT is not discarded; attach existing accepted runs and fill only material coverage gaps.                                                        |
| E22   | Deployment/operations     | vercel.json; .github/workflows/{ci,security,send-reminders}.yml; instrument.server.mjs; src/instrument.client.ts; docs/ADMIN_BACKUP_RESTORE_CHECKLIST_2026-09-22.md; docs/RELEASE_PROCESS.md                                                          | Production serves real data. Vercel alias metadata blocked; successful Production-labelled D deployment known. Backup schedule/restore scope and external monitor ownership need operator confirmation. |
| E23   | Handover                  | docs/DEVELOPMENT_WORKFLOW.md; docs/RELEASE_PROCESS.md; docs/ADMIN_RESPONSE_GUIDANCE.md; README.md; docs/TALKSPACE_CLIENT_FEEDBACK_TRACKING_CHECKLIST.md                                                                                               | Source/docs exist and user reported UAT approvals. Locate final named sign-off, ownership, training and maintenance-start record; absence here is not evidence no training ever occurred.               |
| E24   | Maintenance               | docs/ADMIN_RESPONSE_GUIDANCE.md; docs/PAYSTACK_PAYMENT_ABUSE_RESPONSE_RUNBOOK.md; docs/SUPABASE_FREE_PLAN_MAINTENANCE_CHECKLIST.md; .github/dependabot.yml                                                                                            | Ongoing operating obligations, not eight absent software modules. Bound support term and named owners must be agreed.                                                                                   |
| E27   | Design refresh supplement | src/styles.css; src/components/site/FloatingActionDock.tsx; src/lib/page-seed-content.ts; public/og-image.jpg; docs/REMAINING_IMPLEMENTATION_CHECKLIST.md#9-public-design-refresh                                                                     | Eight design tasks are accidentally parsed under section 27, not 25; live design milestone therefore shows 0/0. Later detailed checklist records inner-page/social-image completion.                    |
| E01   | Scope approvals           | docs/PRODUCT_TERMINOLOGY_AND_SECTIONS.md; docs/PRODUCT_SCOPE_AND_BOOKING_RULES.md; docs/FORMS_INVENTORY_AND_RETENTION.md                                                                                                                              | Working scope only; signed commercial acceptance not located. Product owner approves, rather than engineering recreating functionality.                                                                 |
| E02   | Repository/toolchain      | docs/REPOSITORY_BASELINE.md; package.json; package-lock.json; tsconfig.json; eslint.config.js; .githooks/pre-commit; .github/workflows/{ci,security}.yml; .github/{pull_request_template.md,ISSUE_TEMPLATE/}; docs/RELEASE_PROCESS.md                 | Repository files and hosted checks exist. Both main/develop report protected:false; main protection endpoint reports Branch not protected; rulesets list empty. npm is documented, not pnpm.            |
| E03   | Design/brand              | src/styles.css; src/components/ui/button.tsx; public/og-image.jpg; docs/COMPONENT_STATES.md; docs/DESIGN_SYSTEM.md                                                                                                                                    | Live home renders branded content. Client visual acceptance is distinct from technical implementation.                                                                                                  |
| E04   | Public shell              | src/components/site/{SiteHeader,SiteFooter,SiteBreadcrumbs,FloatingActionDock}.tsx; src/routes/__root.tsx; src/lib/legacy-redirects.ts; test/legacy-redirects.test.ts                                                                                 | Live header/footer/WhatsApp links and 301 legacy-home redirect observed. No new visual redesign is inferred.                                                                                            |
| E05   | Public pages              | src/routes/{index,services,therapists,pricing,about,blog,contact,faqs,privacy-policy,terms,cancellation-refund-policy,emergency-support}.tsx; src/lib/page-seed-content.ts; test/public-pages.test.ts                                                 | Live Home, Services, Pricing, Therapists and FAQs loaded. Existing UAT remains relevant; not every legal text was re-approved.                                                                          |
| E06   | CMS                       | src/lib/admin.functions.ts; src/lib/content.functions.ts; src/routes/_authenticated.admin.content.$id.edit.tsx; src/components/site/sections/LiveSections.tsx; test/cms-lifecycle.test.ts; docs/REMAINING_IMPLEMENTATION_CHECKLIST.md                 | CMS navigation, public CMS content and content-approval screen observed. No save/publish/archive/restore was executed in production.                                                                    |
| E07   | Authentication            | src/lib/server-auth.ts; src/lib/progress.functions.ts; src/routes/_authenticated.tsx; src/routes/login.tsx; docs/SUPABASE_AUTH_SETUP.md; test/permission-and-token-contracts.test.ts                                                                  | Existing authenticated admin session works. Historical reset/role browser evidence is in docs/qa; no new accounts or password changes.                                                                  |
| E08   | Availability              | src/lib/availability.functions.ts; src/lib/availability-validation.ts; src/lib/booking.functions.ts; supabase/migrations/; test/availability-and-appointment-state.test.ts; docs/BK008_THERAPIST_SLOT_UAT.md                                          | Service/mode/duration options render on live Book. No slot holds or same-time bookings created.                                                                                                         |
| E09   | Booking/packages          | src/routes/book.tsx; src/routes/purchase.tsx; src/lib/booking.functions.ts; src/lib/session-packages.server.ts; test/purchase-first-package-payment.test.ts; docs/BK007_INCOMPLETE_BOOKING_UAT.md                                                     | Live purchase-later affordance and Infidelity partner fields observed. No booking/payment/cancel/credit mutation executed.                                                                              |

### Later release evidence resolving old “missing” reports

| Capability / affected groups                                       | Current commit / merged history                                                              | Actual production treatment                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Payment expiry/review and client linkage — E09/E10/E12/E13/E17     | PR76 and 7 Oct rollout/UAT record; later payment-status fix `574d830`; `76a0b75` test update | Live populated ledger, matching pending zero, 50-row pagination. No new review/expiry subsystem.             |
| Partner notifications — E09/E15                                    | `8031369`, later than old `2d41a5c`, on M+D                                                  | Retain implementation; use bounded recipient delivery history.                                               |
| FAQ/therapist resilience, content/services/locations — E05/E06/E19 | `8f25994`, PR102 → PR103 release, on M+D                                                     | FAQ/therapists render live; additional editorial/local SEO campaigns remain separate scope.                  |
| Therapist client names — E10/E17 + therapist supplement            | `ba3eb46`, related `d2c8558`, on M+D                                                         | Live preview renders client names, not Hidden.                                                               |
| Admin therapist preview                                            | `ed79cc9`, PR106, D only                                                                     | Live View dashboard/preview banner verified. Do not call missing or undeployed.                              |
| Infidelity partner invite — E09                                    | `9a98392`, PR107 → PR108 release, on M+D                                                     | Live fields verified without submit.                                                                         |
| Legacy homepage repair — E04/E18/E19                               | `df6008a`, PR109 → PR110 release, on M+D                                                     | Live 301 verified.                                                                                           |
| Admin payment names — E13                                          | `b83793c`, PR111, D only                                                                     | Live confirmed view no longer has the suppression text.                                                      |
| Reminder scheduler — E15/E22                                       | `d7701c4` predates old audit; workflow remains on M+D; successful scheduled runs G04         | Earlier “no scheduler” finding withdrawn. Check actual timing/recipient history, not create a duplicate job. |

## Client decisions and handover — minimum combined actions

These consolidate overlapping tasks, not additional implementation requirements:

- [ ] **Scope/policy acceptance:** T001–T008, T024, T168/T184. Owner: client/project owner. Accept approved duration/currency/cancellation/credit rules, role/retention/provider/cost owners, existing UAT scope and maintenance dates.
- [ ] **Content acceptance:** T139/T142/T144/T177. Owner: content owner. Decide 100 pending legacy records, approved office facts and any item-specific corrections. Do not re-import all content.
- [ ] **Provider/operations confirmation:** T096/T113/T114/T169/T171/T174/T175/T176/T180/T181/T187. Owner: deployment/payment/mail/Calendar owners. Use redacted existing provider logs, sandbox evidence and backup/monitoring ownership; no new production charge/message/restore.
- [ ] **Governance/engineering gate:** T009/T010 and R05–R07. Owner: repository owner + Engineering/QA. Approved protection change, narrow fixture fixes/verification and typecheck disposition.
- [ ] **Delivery receipt:** T182/T183/T185/T186/T188–T192. Owner: project owner + client admins/operations. Record training, source/runbook receipt, support boundaries and incident/change-request owners.
- [ ] **Tracker closure:** R04 plus the 67 dispositions. Owner: project owner. Update accepted markers/notes/section metadata and the configured source/freshness labels through normal review; never mark all 67 Done merely to reach 100%.

## Optional enhancements — not part of the 200-task remaining count

See [report F](CURRENT_IMPLEMENTATION_RECONCILED_AUDIT.md#f-new-requests-and-separate-quotation-boundary). No assumption of commercial approval: expanded SEO/service/location programmes, booking redesign/photo selector, Home Visit, new corporate workflow, topic hubs/author bios/inline booking cards, USD checkout and WhatsApp video integration. Some foundational landing pages and partner/admin-preview additions are already delivered; quote **only incremental approved work**, not rebuilding them.

## Verification and change record

- Live read-only inspection: authenticated dashboard/tracker; Google status; legacy-content approval counts; Reviews readiness; payment tabs and pagination; admin therapist preview; public Home/Services/Pricing/Therapists/FAQ/Book; Infidelity service selection only; robots/sitemap/legacy redirect responses.
- All 200 raw records parsed with actual `checklist-progress.ts`; exactly 67 open, exactly 7 partial, no duplicate collapse.
- Eleven targeted test files passed during this review. Earlier clean M/D automated checks are retained in report T02; three standalone type errors remain, not an invented production crash.
- No production save/approval/booking/charge/refund/notification/Calendar sync/receipt export/account creation/migration/deploy/push/merge occurred. Existing original dirty files remain preserved.
- Existing UAT/sign-offs and historical evidence remain valid within their documented scope. This report does not revoke acceptance because fresh screenshots are absent.
- Only these existing reconciliation documents and explanatory links/notes in the existing tracker documents are updated. Application source and raw task markers are unchanged.
