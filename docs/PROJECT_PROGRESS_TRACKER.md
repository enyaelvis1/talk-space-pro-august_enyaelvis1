# Project Progress Tracker

The protected `/admin/progress` dashboard is a read-only view of the repository's implementation progress. The version-controlled checklist remains the source of truth; progress is not edited or persisted from the dashboard.

## Configuration

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
