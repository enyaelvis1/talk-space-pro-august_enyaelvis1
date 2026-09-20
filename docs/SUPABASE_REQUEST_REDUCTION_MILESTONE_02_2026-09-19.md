# Supabase Request Reduction Milestone 2

## Bounded failure recovery

Status: **Implemented locally; ready for review/UAT**

This milestone prevents public route failures from creating an automatic
`router.invalidate()` retry loop. A route/error combination can claim one
automatic retry within a 30-second window. If it fails again, the user sees a
manual `Try again` action and no further automatic requests are scheduled.

### Changed surfaces

- `src/lib/route-recovery.ts` owns the bounded retry window.
- `src/routes/__root.tsx` applies the policy to public route errors.
- `src/routes/index.tsx` applies the policy to homepage loader recovery.
- `test/egress-request-reduction.test.ts` covers the retry limit and source
  integration.

### Acceptance gates

- [x] One automatic retry is allowed for a failed public route.
- [x] A repeated failure stops automatic retries and exposes manual recovery.
- [x] Expired retry state can allow one later retry.
- [x] Existing admin error behavior remains manual and unchanged.
- [ ] Staging failure simulation confirms request count stays bounded.
- [ ] Before/after Supabase request evidence is recorded.

### Release boundary

This branch targets `develop` only. Staging/UAT must simulate a temporary
public loader failure and verify one retry at most, then verify that the
manual button recovers after the service is available. Payment callbacks,
booking mutations, and email retries are not automatically retried by this
change.
