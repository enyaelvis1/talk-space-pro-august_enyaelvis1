# Admin service reorder safety checklist

Incident finding: the Supabase logs showed 1,183 successful `PATCH /rest/v1/services`
requests from one server-side Node client. The admin reorder handler was issuing one
PATCH per service, and repeated reorder submissions multiplied those writes.

## Containment

- [x] Confirm the requests came from an authorized admin action.
- [x] Preserve the request evidence and identify the affected endpoint.
- [ ] Monitor `/rest/v1/services` PATCH traffic while the fix is being tested.

## Implementation

- [x] Replace the per-service PATCH loop with one transactional RPC.
- [x] Authorize the RPC for admins and deny anonymous execution.
- [x] Validate that the submitted order contains every service exactly once.
- [x] Reject duplicate display positions and unknown service IDs.
- [x] Set an audit reason for the reorder transaction.
- [x] Keep the UI disabled while a reorder request is in flight.
- [x] Add server-side idempotency for repeated identical submissions.
- [ ] Add a short public services read cache with invalidation after service writes.

## Verification

- [ ] Run unit/contract tests for the RPC contract and duplicate-submit behavior.
- [ ] Apply the migration in staging/develop.
- [ ] Move one service up and down once during UAT.
- [ ] Confirm one reorder action produces one RPC request and no direct service PATCH fan-out.
- [ ] Confirm service order remains correct after refresh and on the booking page.
- [ ] Confirm unauthorized users cannot invoke the reorder RPC.

## Release and monitoring

- [ ] Review the diff for unrelated changes or secrets.
- [ ] Open the feature pull request to `develop`.
- [ ] Complete UAT and promote through the approved `develop` to `main` release path.
- [ ] Monitor service PATCH traffic, Postgres errors, and database load for 24 hours.
