# Batch C — Supabase Auth foundation

**Sections:** 07 (Authentication)
**Status:** Implementation complete; Supabase project is linked and the auth foundation migration is applied. Password-reset recovery flow and live role verification are now verified in the app; email provider allow-list/delivery remains a deployment check.

## Scope

- Create/configure the Supabase project.
- Managed email/password auth + password reset.
- `app_role` enum (`admin`, `staff`, `client`) + `user_roles` table with `has_role()` security-definer.
- `_authenticated` route gate; nested admin gate using `has_role(auth.uid(), 'admin')`.
- Client profile row auto-created on signup via trigger.

## Deployment status

- Supabase project ref: `vwupdobwjlmitsgasdrz`
- Migration `20260715070000_auth_foundation.sql` applied to the linked remote database on 15 July 2026.
- Supabase email provider settings, redirect URLs, and first-user admin-role verification remain deployment checks.

## Acceptance

- `/account` requires login; `/admin` requires `admin` role.
- Password reset recovery flow completes in the app.
