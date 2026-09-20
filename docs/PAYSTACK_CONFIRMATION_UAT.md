# Payment confirmation follow-up

Branch: `feature/feedback-paystack-confirmation`, based on `develop`.
Status: implementation and local verification complete; staging UAT pending.
Scope: BK-006 and the callback's successful-payment client sync path from BK-002.
No database migration, fee-setting change, live payment, content rewrite or production
deployment is included. `.env` is unchanged.

## Amount contract

- All API and database payment amounts are integer kobo. Never infer units from divisibility by 100.
- Sum the persisted price of every booking in a checkout, not current service prices or just the first booking.
- Paystack `amount` is retained as the charged checkout total. `requested_amount` is checked against the stored checkout price when supplied; `fees` is retained independently.
- With fees passed to the customer, require a matching provider-requested price and a positive surcharge no larger than the provider-reported fee. Missing fee/requested-amount evidence fails closed for an increased charge. Exact charges work when optional fields are absent.
- A processing fee absorbed by Talk Space must not be added again to the charged amount. No hard-coded fee rate or payout estimate is used.
- Keep per-booking `amount_kobo` unchanged. Store aggregate `paystack_receipt` in payment metadata using the existing status RPC. Group rows share the checkout receipt: do not sum this aggregate across rows as revenue.
- Callback, Check Paystack, webhook and scheduled recheck use the same group-total validation. Child rows resolve to the actual Paystack reference. Scheduled checks verify each checkout once per run.
- Callback refresh reuses a saved successful receipt without a new provider request. Older successful rows without receipts are reverified; admin Check Paystack can refresh already-successful records. Existing email claim markers prevent intentional receipt backfills from resending previously claimed emails.
- Confirmation and admin show checkout paid, booking total and fees added separately. Admin also sees the processing fee. Default successful-payment emails retain the per-booking amount and add clearly labelled checkout totals. Custom admin-authored templates are not overwritten; they may need to include `checkoutPaidKobo` and `checkoutFeeKobo` explicitly.

Provider references: [Transaction verification API](https://paystack.com/docs/api/transaction/),
[Paystack fee handling](https://support.paystack.com/en/articles/2130306).

## Automated verification

- [x] Unit tests for fee passing/absorption, kobo precision, invalid totals, reference and currency mismatches, and group consistency.
- [x] Actual callback/admin handler tests with mocked database and Paystack boundaries: full checkout confirmation, persisted receipts, child references, failed writes, and cached successful refresh.
- [x] Desktop/mobile browser fixture renders the actual receipt component at 1280, 390 and 320 pixels and checks precision, provider-fee visibility and overflow.
- [x] Full test suite: 184 passed, zero failures/skips. TypeScript and production build pass. Lint: zero errors, seven existing Fast Refresh warnings. Existing build deprecation/chunk warnings remain.
- [ ] Real staging callback/webhook race, cron, email and package behaviour. Unit tests and component screenshots do not replace this gate.

Local evidence: `output/playwright/payments/receipt-1280.png`, `receipt-390.png`,
`receipt-320.png`. Test log: `/tmp/paystack-confirmation-tests-final.log`;
build/type/lint logs: `/tmp/paystack-confirmation-{build,types,lint}.log`.

## Staging test matrix

Use synthetic clients and a test-mode Paystack account. Do not share secret keys or
unredacted API responses in the checklist.

1. Single booking with fees absorbed: compare Paystack's verified amount to the public confirmation; fees added must be zero even when the processing fee is positive.
2. Single booking with fees passed on: compare the exact amount, including kobo, against Paystack. Confirm booking price plus fees added equals checkout paid. Include a fractional-naira test.
3. Three sessions in one checkout: pay once, then Check Paystack on the first and a child row. Both must use the parent reference and show the full checkout paid; each row must retain its own booking allocation.
4. Repeat for ten sessions. Confirm one successful provider transaction confirms only those sessions and a scheduled run does not verify every child separately.
5. Let the webhook win before opening the callback. Refresh the confirmation twice: totals must remain identical, with no duplicate package issuance or email. Repeat with callback first, and with delayed verification.
6. On an older successful payment without receipt metadata, use Check Paystack. Confirm exact amounts are backfilled and previously sent emails are not resent.
7. In a controlled test fixture, supply underpayment, missing/mismatched currency/reference, unexplained surcharge, or failed DB write. None may produce a successful confirmation or trigger success side effects.
8. Check default confirmation email and any customized email template. A group receipt must distinguish the individual booking allocation from the total paid for checkout; fees must not count as extra sessions.
9. Regression: verify a paid client's record, Google/calendar delivery and the correct package remaining balance. A bank transfer must still require approval; no card charges should be inferred for it.

Evidence for each case: booking references, parent payment reference, redacted provider
`status`/`amount`/`requested_amount`/`fees`/`currency`, callback and admin screenshots,
email screenshot and package balance where relevant. Do not use actual client data.

## Remaining release gates

- [ ] Attach staging evidence for the matrix, especially the account's fee-passing behaviour.
- [ ] Review custom email templates and confirm their desired receipt fields.
- [ ] Reconcile overlapping payment changes in the separate feedback integrity PR before merging it.
- [ ] Finish the separate paid-slot/late-payment conflict work; this batch does not change SQL booking commitment or refund handling.
- [ ] Feature PR to `develop`, then a separately approved release PR to `main`.
