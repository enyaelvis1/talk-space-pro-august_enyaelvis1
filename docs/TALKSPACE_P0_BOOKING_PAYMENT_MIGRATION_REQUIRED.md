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

## Staging readiness decision

PR #56 may be started against an isolated staging app for a build/route smoke
check without applying migrations. It is **not ready for meaningful P0 UAT**
without them. The application has a compatibility fallback for the checkout
clock, but slot commitment, bank-transfer approval, payment-review recovery,
token expiry, and unpaid cleanup depend on the database functions/triggers in
the migrations below. Do not use production data to validate the fallback.

The additional confirmed-contact/payment invariant is also required before
the final P0 UAT sign-off. It has not yet been created as a migration file;
prepare it as a separate additive migration after the existing sequence and
review it before applying.

## Staging-only application order

Apply only after a staging project/branch, backup, and rollback owner are
recorded. Run the migrations in repository timestamp order, one migration at
a time, checking the migration result and relevant function definitions after
each step:

1. `20260912194500_fix_incomplete_booking_manage_tokens.sql`
2. `20260913110000_reserve_only_committed_bookings.sql`
3. `20260913120000_incomplete_booking_token_lifecycle.sql`
4. `20260913130000_harden_bank_transfer_commitment.sql`
5. `20260916100000_booking_checkout_clock.sql`
6. `20260917143000_retry_paid_booking_review.sql`
7. `20260921190000_atomic_unpaid_test_booking_cleanup.sql`
8. A new, reviewed additive migration for the confirmed-contact and valid-
   payment/package invariant; filename/version to be assigned only after its
   SQL is reviewed.

Do not skip or reorder these migrations. The two token migrations deliberately
replace the same token-activity function, and the later payment migrations
extend the status/commitment behavior established earlier in the sequence.

## Staging backup and rollback plan

- [ ] Record the staging Supabase project ref, current schema migration
      version, deployed PR commit, operator, and WAT timestamp.
- [ ] Create/verify a recoverable staging database backup or snapshot using
      the approved Supabase control-plane process; confirm restore ownership.
- [ ] Export only redacted preflight counts and function-definition hashes;
      never commit dumps, secrets, tokens, or `.env` values.
- [ ] Pause staging cron/recheck/seed loops and provider delivery sinks during
      the migration window.
- [ ] Apply one migration at a time and run smoke checks before continuing.
- [ ] If a migration fails, stop immediately, preserve the error, and restore
      the staging snapshot or use an approved forward-fix. Do not manually
      delete migration rows or rewrite history.
- [ ] After rollback/restore, verify migration history, RPC signatures,
      appointment/payment counts, and that no UAT account or synthetic record
      was partially retained.

This is a staging plan only. No backup, restore, migration, provider request,
or production operation was run during this review.
