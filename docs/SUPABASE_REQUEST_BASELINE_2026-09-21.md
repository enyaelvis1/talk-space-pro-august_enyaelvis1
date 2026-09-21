# Supabase Request Baseline — 21 September 2026

## Measurement record

- Environment: local workspace; no production or staging data was queried.
- Current branch: `feature/admin-email-template-editor`.
- Current commit: `d42c31e4901b327cc1ff1ebac350fffdcbcfd424` (`update supabase request`).
- `origin/develop`: `79efaf19996fe04a04c33f55208b5a2a7865a695`.
- Deployed SHA: not available from the local workspace.
- Supabase project, plan, and billing window: intentionally not recorded; `.env`
  values were not read or copied into evidence.
- Measurement window: 21 September 2026, local audit run.
- Production-backed Lighthouse, seed, import, and retry loops: none were run.

## Branch synchronization audit

Remote refs were refreshed with `git fetch --prune origin`. Divergence is
reported as `origin/develop...branch` using `git rev-list --left-right --count`.

| Branch                                       | Behind `origin/develop` | Ahead of `origin/develop` | Status                                           |
| -------------------------------------------- | ----------------------: | ------------------------: | ------------------------------------------------ |
| `origin/develop`                             |                       0 |                         0 | reference                                        |
| `origin/feature/admin-email-template-editor` |                       0 |                         2 | current feature branch is ahead; not fully equal |
| `origin/main`                                |                       0 |                         1 | not equal; release branch is ahead               |
| `origin/feature/forms-template-editor`       |                       1 |                         0 | behind develop                                   |
| `origin/feature/chore-gitignore-cleanup`     |                       3 |                         0 | behind develop                                   |

The current feature branch is not behind `develop`, but no branch should be
rebased, merged, or force-pushed as part of this audit. The project workflow
requires feature → `develop` PR → staging/UAT → separate `develop` → `main`
release PR.

## Trace attempts

### Anonymous public trace

- Method: local synthetic Supabase fixture via
  `test/egress-public-shell.e2e.test.ts`.
- Browser: `/usr/bin/google-chrome`.
- Command:

  ```sh
  CHROME_PATH=/usr/bin/google-chrome \
    node --experimental-strip-types --test test/egress-public-shell.e2e.test.ts
  ```

- Result: failed after approximately 75 seconds because the synthetic public
  shell did not expose the expected header link within the 60-second locator
  timeout.
- Valid request counts: none produced by this run.
- Existing `output/playwright/egress/request-counts.json` was not used because
  it predates this run and is not a current baseline.

### Authenticated admin trace

- Result: not run. No staging URL or approved UAT credentials were provided.
- No credentials were read from `.env` or written to an artifact.

### Tab visibility and multi-tab traces

- Result: not run because the public fixture did not complete and no staging
  target was available.
- The code-level tests cover event-driven refresh and hidden-tab polling, but
  they are not a substitute for a deployed browser trace.

## Request grouping status

The request-budget implementation supports grouping into Auth, database
REST/RPC, Storage, Realtime, server functions, and other traffic, including
status and response bytes. The grouping tests pass, but this baseline has no
new browser sample set because the fixture failed before the shell assertion.

## Phase 1 conclusion

Phase 1 is **partially complete**:

- Branch and commit identity were recorded.
- Production-backed measurement loops were not run.
- No secret or private credential data was placed in evidence.
- Anonymous browser measurement needs a fixture/debugging follow-up.
- Authenticated, hidden-tab, and two-tab measurements require staging/UAT
  access and must be captured before declaring the request issue fully fixed.
