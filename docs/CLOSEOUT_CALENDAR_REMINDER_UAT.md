# Calendar health and reminder timestamp closeout — R03 / R05

No new scheduler, automatic Google renewal, migration or production delivery.

## Calendar operator guidance

Health distinguishes disconnected, failed, expired, renewal-needed and healthy.
Missing/malformed expiry or expiry within 24 hours requires renewal; expired
watches never show Healthy. OAuth token presence does not certify push health.
Recorded sync failures take precedence and remain visible.

The existing admin-only `startTherapistWatch` server function can renew a watch,
but this milestone does not invoke it automatically or introduce another job.
Calendar owner/engineering must approve a manual renewal or reconnect procedure
for the affected therapist. Stop/renew/reconnect operations affect live Google
state and require separate operational authorization. The existing Sync busy
button refreshes availability only; it does not renew push channels.

## Reminder semantics

Mocked delivery reproduces the old predicate: sent:true skipped the appointment
sent-at update, while emails_disabled reached it. The correction stamps only an
actual successful primary-client delivery. Skipped, suppressed and failed results
remain unsent; their existing email delivery logs retain reasons. Partner claims
and finalized sent states are independent and never stamp the primary client.
A client's sent-at timestamp only skips that client; it cannot suppress a partner
retry within the existing due window. The job response identifies sent, skipped,
suppressed and failed outcomes separately without changing the scheduler.
Provider exceptions release the unsent claim. Successful claims finalize before
the timestamp write, so a timestamp-write failure cannot trigger duplicate mail.
Timestamp database errors are surfaced instead of ignored. Atomic claim/field
transactions would need separately reviewed SQL; no migration is added.

No missed or duplicated production message is inferred from the source defect.
Observed scheduler gaps need a read-only due-versus-delivered review before any
catch-up/window change. The existing scheduler is unchanged.

## Bounded UAT — isolated fixtures only

1. Simulate expired, exact-expiry, valid, missing/malformed, near-expiry,
   disconnected and failed subscriptions; verify labels and operator guidance.
2. Send using a mocked delivery callback: sent, skipped (mail/template disabled),
   suppressed (uncommitted booking), failed and thrown exception.
3. Verify successful primary client stamps once; successful partner does not
   stamp the client. Claimed notifications do not resend.
4. Verify finalize/write errors surface; logged failed/skipped/suppressed
   attempts are not presented as sent. Re-run existing notification privacy and
   policy tests. Never use real recipients or Google subscriptions.
5. After release approval, inspect existing production logs read-only for target,
   cadence and timestamps. Local fixtures do not certify provider acceptance.
