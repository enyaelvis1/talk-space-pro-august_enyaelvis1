# Supabase Request Reduction Milestone 6

## Browser request-budget harness

Status: **Implemented locally; ready for review/UAT**

The public-shell browser fixture now records a redacted request budget rather
than only raw endpoint counts. It categorizes traffic into Auth, database,
Storage, Realtime, server functions, and other requests; records response
status and known response bytes; and fails when the anonymous shell exceeds
its local budget.

Run the isolated browser evidence test when Chromium is available:

```bash
CHROME_PATH=/usr/bin/google-chrome \
  node --experimental-strip-types --test test/egress-public-shell.e2e.test.ts
```

The fixture uses synthetic Supabase responses, blocks unrelated external
requests, and writes `output/playwright/egress/request-counts.json`. It does
not access or mutate production Supabase. The current baseline allows two
public database reads for compatibility with both the existing shell and the
consolidated shell PR; it forbids anonymous Auth, Storage, and Realtime calls.

### Acceptance gates

- [x] Request categories and response status are recorded.
- [x] Known response bytes are recorded without reading private payloads.
- [x] Anonymous Auth, Storage, and Realtime traffic has a zero-request budget.
- [x] Public database traffic has an explicit request budget.
- [x] Budget violations fail the browser test and appear in redacted evidence.
- [ ] Chromium fixture passes in CI/staging.
- [ ] Seven-day real Supabase usage evidence is attached to UAT.
- [ ] Production budget is approved from observed cold and warm instances.

### Release boundary

This branch targets `develop` only. UAT should run the fixture with Chromium,
inspect the categorized JSON artifact, then separately compare real staging
Network traces with Supabase usage. Local synthetic counts are regression
signals, not a claim about billed production egress.
