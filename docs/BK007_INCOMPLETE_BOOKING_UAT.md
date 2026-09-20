# BK-007: Incomplete booking token lifecycle

Branch: `feature/bk007-incomplete-token-lifecycle`, based on `develop`.
Implementation: complete. Status: **Ready for UAT**, not production approved.

## Behavior

- Checkout authority expires five minutes after creation, or at an earlier existing expiry. Starting Paystack, uploading a receipt, rescheduling, or submitting a transfer does not extend it.
- Both guest tokens and signed-in owners must pass the checkout deadline. A client cannot mark a payment successful through the payment-status RPC.
- Expired incomplete bookings stop blocking availability. Cleanup cancels them and revokes their manage tokens before another appointment is inserted, and through the existing payment-recheck job.
- Closing a tab does not immediately cancel a booking; abandonment expires at the same deadline. The browser countdown does not poll the database.
- Timely verified payment confirms the booking and extends its management link through 30 days after the session. Terminal booking states invalidate the link.
- A payment confirmed after expiry remains recorded as successful, but the old booking is not revived. The callback, admin payment list, and default receipt identify that the booking needs rescheduling/refund review. The system does not automatically issue package credit or a new meeting link for it.
- Uncommitted reschedules and cancellations do not send session-confirmation/change notices.

Scope boundary: the existing five-minute temporary reservation remains. BK-004's requirement to reserve slots only after payment, the complete bank-transfer approval workflow, and automated refund/rescheduling resolution remain separate work. This batch must not be used as evidence that those items are done.

## Staging prerequisites

1. Review the feature diff and provision a staging database with the existing migration history.
2. Apply `supabase/migrations/20260913120000_incomplete_booking_token_lifecycle.sql` to that staging database, then deploy this branch to staging. Do not blindly push all pending migrations to production.
3. Use Paystack test credentials and a staging mail sink; do not make real charges. Include one single-session service, one package, two client accounts, and test therapist availability.
4. Confirm the existing authenticated payment-recheck job calls `/api/public/hooks/recheck-payments`. Cleanup runs there even if Paystack credentials are unavailable. Slot lookup and the insert trigger also prevent stale checkouts from blocking replacement bookings.
5. Review any customized `payment_success` email template. It must honor `bookingNeedsReview` and avoid promising a confirmed session or showing a Meet/manage link when it is `yes`. Existing CMS templates and images are deliberately not overwritten.
6. An admin approval received after the five-minute bank-transfer deadline requires manual review; the old booking/token must not be silently restored. Test and approve this behavior before release.

No production schema or data has been changed by this implementation. The migration does not write CMS content or image settings.

## Automated verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The PostgreSQL test is opt-in. Set `BK007_TEST_POSTGRES_CONTAINER` to a **local disposable PostgreSQL container** with Supabase roles and extensions, then run:

```bash
BK007_TEST_POSTGRES_CONTAINER=<local-container> npm test
```

`test/bk007-database.test.ts` creates a uniquely named disposable database, loads its fixture and actual lifecycle/payment migrations, runs SQL assertions, and drops only that test database. Never point this test at production. Without the variable, this database test is skipped.

Coverage includes exact expiry boundaries, authenticated-owner restrictions, token hash lookup, payment-RPC permissions, pending-payment slot release, replacement bookings, idempotent cleanup, timely confirmation, late payment preservation, expired package-credit rejection, and rescheduling without accidental token revocation. The mobile browser fixture exercises the real countdown hook and verifies disabled controls with no Supabase polling; it is not a live payment integration test.

Local results (2026-09-13): 191 tests passed, none skipped with the database fixture enabled; TypeScript and production build passed; lint passed with seven existing Fast Refresh warnings and no errors. The local manage-link entry page rendered on desktop/mobile without browser errors. These results do not replace staging payment, email, or calendar UAT.

Local screenshots: [expired checkout fixture](../output/playwright/bk007/expired-checkout-mobile.png), [manage desktop](../output/playwright/bk007/manage-desktop.png), [manage mobile](../output/playwright/bk007/manage-mobile.png). Screenshots contain no real booking tokens or client records.

## Manual UAT

Use a fresh test booking for each case. Capture screenshots with bearer tokens, private client details, and secrets redacted.

| ID  | Steps                                                                                                                                                                           | Expected result                                                                                                                                                                                                       | Evidence                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T1  | As a guest, select a slot and reach payment. Do not pay. Wait until the original five-minute deadline. Repeat while signed in.                                                  | Countdown expires; Paystack and transfer submission are disabled; restart action is available. No committed appointment or session-confirmation email.                                                                | Before/after screenshots, booking reference, mail-sink screenshot.                           |
| T2  | Open Paystack test checkout before expiry, then abandon it. After the original deadline, refresh availability in a second browser and book that same therapist/time.            | Payment initiation does not extend the hold. The second booking succeeds; the first cannot block it indefinitely.                                                                                                     | Both booking references, times, availability screenshot.                                     |
| T3  | Test a valid manage link, change its token to random text, then retry its original token after expiry. Repeat as the signed-in booking owner. Navigate between links quickly.   | Invalid/expired links reveal no appointment details; an earlier successful lookup cannot repopulate the new invalid link. Expired owners cannot submit payment/transfer/receipt operations either.                    | Redacted error screenshots and rejected-request result.                                      |
| T4  | Complete a Paystack test payment within five minutes. Reload the callback and invoke Check Paystack again. Open the issued manage link after five minutes.                      | Exactly one committed booking and payment; management still works and resolves to the correct reference. No duplicate confirmation or package issuance.                                                               | Payment and booking references, receipt, admin status, manage view.                          |
| T5  | Keep test checkout open past expiry; let another client take the released slot; then complete the original test payment or deliver its delayed webhook.                         | Money is recorded once. The expired booking stays uncommitted/cancelled and its token stays invalid. Callback/admin/default receipt indicate review; no extra package, calendar event, or false session confirmation. | Both references, payment reference, admin review label, callback, mail sink, calendar check. |
| T6  | Make a timely multi-session payment; separately abandon a multi-session checkout. Submit a guest group bank transfer before expiry and attempt another submission after expiry. | Every token is checked against its own booking; timely payment confirms the correct group; expired checkouts cannot gain authority through another group's valid token. Transfer review does not extend the deadline. | Group references, resulting rows, rejected-request result.                                   |
| T7  | Reschedule a confirmed booking using its link, then cancel it. Also reschedule/cancel a still-unpaid test booking before expiry.                                                | Confirmed reschedule retains a working link; explicit cancellation revokes it. Unpaid changes do not send session-change notices.                                                                                     | Redacted link views, status history, mail-sink evidence.                                     |
| T8  | Complete a package purchase in time, then test a separate expired package checkout.                                                                                             | Timely purchase retains the existing first-session accounting. Expired checkout cannot consume credit or create a package even if its late payment is received.                                                       | Package counts, booking/payment references.                                                  |
| T9  | Run the staging payment-recheck job twice after abandoned checkouts expire. Try the same valid payment callback twice.                                                          | Cleanup is idempotent; paid records are untouched; no duplicate booking, credit, or emails.                                                                                                                           | Job result, payment/booking rows, mail delivery history.                                     |

For T3's server-side check, replay only your own staging test request after expiry using browser developer tools. Do not put tokens in shared reports. A disabled button alone is not proof of server-side rejection.

## UAT sign-off

- [x] Implementation and local regression coverage added.
- [ ] Staging migration and build validated.
- [ ] T1-T9 executed, including real Paystack test callbacks/webhooks and grouped transfers.
- [ ] Customized email templates checked for late-payment wording.
- [ ] Evidence links and redacted references added to BK-007 in the client checklist.
- [ ] Reviewer approves feature PR to `develop`.
- [ ] Status changed to UAT Passed / Production Ready after validation.
- [ ] Separate release PR to `main` approved before production deployment.
