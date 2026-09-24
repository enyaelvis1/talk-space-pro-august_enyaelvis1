# Talk Space — P0 Booking/Payment Migration Handoff

Status: documented only; not applied  
Branch: `feat/talkspace-booking-payment-integrity`

The P0 booking/payment work depends on database-side invariants. The user
explicitly prohibited running migrations in this implementation pass, so this
file records the staging migration handoff. A qualified operator must review
the migration order and apply it only to staging after approval, then run the
required UAT before any production release.

## Existing repository migrations requiring staging review/application

- `20260913110000_reserve_only_committed_bookings.sql`
  - reserves therapist slots only for confirmed, unarchived appointments;
  - adds the confirmed-appointment commitment trigger and payment guard;
  - updates availability to ignore unpaid/pending rows after expiry.
- `20260913130000_harden_bank_transfer_commitment.sql`
  - validates bank-transfer amount and transfer reference;
  - keeps submissions awaiting confirmation until staff approval;
  - preserves approved/refunded status on replay.
- `20260917143000_retry_paid_booking_review.sql`
  - preserves succeeded payments while allowing review/retry handling after a
    temporary slot conflict.
- `20260912194500_fix_incomplete_booking_manage_tokens.sql`,
  `20260913120000_incomplete_booking_token_lifecycle.sql`, and
  `20260916100000_booking_checkout_clock.sql`
  - enforce incomplete checkout expiry, token lifecycle, and server-side
    checkout deadlines.
- `20260921190000_atomic_unpaid_test_booking_cleanup.sql`
  - safely removes eligible unpaid/test appointments without deleting paid
    records.

## Additional migration requirement identified by this implementation

Add a database-side invariant for committed appointments: when an appointment
transitions to `confirmed`, require a non-empty client name, valid email, and
valid phone, and require either a succeeded payment or an active package
credit. The application now checks contact completeness before successful
Paystack confirmation, but this trigger/RPC guard is still required to protect
direct service-role and future code paths.

The current schema represents “bank transfer pending review” as appointment
`pending_payment` plus payment `awaiting_confirmation`, and “bank transfer
approved” as appointment `confirmed` plus payment `succeeded`. If operations
requires distinct appointment enum values instead, that is a separate additive
enum/RPC/UI migration and must be approved before implementation.

## Application changes made without migration

- Paystack success paths now reject incomplete client contact data before the
  confirmation status RPC.
- Repeated successful Paystack checks re-run client reconciliation and Google
  sync safely instead of returning before downstream recovery.
- Single and grouped holds persist manage tokens before returning the hold,
  preventing resume/reminder-link races and avoiding duplicate token writes.

## Approval gate

- [ ] Confirm staging project and backup/rollback plan.
- [ ] Review migration ordering and schema compatibility.
- [ ] Explicitly approve applying the listed migrations to staging.
- [ ] Apply to staging only; do not apply from this branch to production.
- [ ] Run the ten P0 UAT cases and attach redacted evidence to the tracking
      checklist before merge.
