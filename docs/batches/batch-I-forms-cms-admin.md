# Batch I — Forms, CMS-lite, Admin dashboard

**Sections:** 11 (Forms), 06 (CMS), 17 (Admin operations)

## Scope

- Intake forms (individual/couple/teen) rendered from JSON schema, saved per appointment.
- Consent form e-signature capture.
- CMS-lite: `pages`, `blog_posts` tables editable in `/admin/content`; blog rendered from DB, not hard-coded.
- Admin dashboard: today's appointments, unpaid holds, contact inbox, therapist availability grid, revenue snapshot.

## Current implementation

- The protected `/admin/availability` workspace lets administrators create and remove one-off therapist availability windows in 15-minute increments.
- Added windows are stored in `availability_exceptions` and consumed by the public `/book` availability query for matching service and session mode selections.

## Acceptance

- Admin can publish a new blog post without a code change.
- Intake form data appears in the therapist's appointment view.
