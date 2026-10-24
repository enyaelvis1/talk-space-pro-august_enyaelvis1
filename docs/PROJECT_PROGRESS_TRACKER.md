# Project Progress Tracker

The protected `/admin/progress` dashboard is a read-only view of the repository's implementation progress. The version-controlled checklist remains the source of truth; progress is not edited or persisted from the dashboard.

## Production closeout interpretation — 24 October 2026

The checklist is imported as Vite raw Markdown and bundled with the deployment.
It is not fetched from GitHub on each request. `buildProgressSnapshot()` assigns
`generatedAt` at request time; the UI's “Synced/Updated” label therefore does not
establish when task decisions were last reviewed or which commit owns the live
domain. “Needs attention” is the count of blocked markers, not all defects or
provider problems. The operational delivery-failure queue is separate.

Read the existing [production reconciliation report](CURRENT_IMPLEMENTATION_RECONCILED_AUDIT.md)
and [remaining-work register](ACTUAL_REMAINING_ISSUES_CHECKLIST.md) before using
133/200 as a delivery verdict. All 200 records and the 67 open markers are mapped
there. Several unchecked records already have completed implementation/evidence.
The seven partial tasks are included in the 67, not additional to them.

Known tracker presentation exceptions are recorded as R04: stale configured
source-repository link, contradictory section headings, and eight design tasks
parsed under section 27 although the design milestone selects section 25.
These require a separately approved tracker correction; this documentation
review does not change the application, the task markers or the live counts.

## Configuration

Closeout implementation note: the source link now targets the actual repository;
the UI labels request-time snapshots as generated, not synchronized. Displayed
section titles omit obsolete hand-maintained counts. The design milestone maps
both legacy section 25 and the eight records currently under section 27, without
moving records or changing their keys/statuses. The earlier production exception
notes above are historical until the feature passes UAT and is released.

The current Talk Space configuration is in [src/lib/progress-config.ts](../src/lib/progress-config.ts):

- Project: `Talk Space Production`
- Checklist source: `docs/IMPLEMENTATION_CHECKLIST.md`
- Source links: the configured GitHub document URL
- Milestones: Foundation and public experience, CMS and authentication, Care operations, and Migration/hardening/launch
- Due dates: optional and intentionally unset until project owners approve dates

To add a checklist, import its Markdown as a Vite `?raw` source and add a `ChecklistSourceInput` entry to `PROGRESS_SOURCES`. Add its section IDs to one or more configured milestones. Task links are keyed by the normalized task key and can point to application routes or source files.

## Supported checklist syntax

The parser supports document titles (`#`), sections (`##`), and these task markers:

| Marker | Status      | Weight |
| ------ | ----------- | -----: |
| `[x]`  | Completed   |   100% |
| `[~]`  | In progress |    50% |
| `[p]`  | Partial     |    50% |
| `[!]`  | Blocked     |     0% |
| `[ ]`  | Not started |     0% |

Matching tasks are normalized and deduplicated across sources. The conflict rule is: completed > in progress > partial > blocked > not started. Overall completion uses the configured weights on the deduplicated task index.

## Dashboard and exports

Administrators can open `/admin/progress` after signing in. The dashboard provides:

- Overall completion and status totals
- Milestone progress, optional due dates, overdue warnings, and blocked counts
- Section-level breakdowns and expandable task lists
- A “Next up” list with configured application/source links
- CSV export with summary and task rows
- Print / PDF using the browser print dialog

CSV files use the project name and generation date in the filename. Print styles hide navigation and controls and expand task details for a clean PDF handoff.

## Access control

The route is protected by the existing authenticated/admin middleware, the route `beforeLoad` guard, a component-level role check, and a server-function role check using Supabase `has_role('admin')`. The Progress navigation link is only rendered after the current session is confirmed as an administrator.

## Tests

Run the framework-independent parser, synchronization, completion, duplicate handling, empty/invalid input, CSV, and progress-access tests with:

```bash
npm test
```
