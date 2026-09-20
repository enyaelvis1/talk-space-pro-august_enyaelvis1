# Supabase Auth setup

Batch C uses Supabase directly for email/password authentication, password reset,
profiles, and role-based route gates.

## Environment variables

Copy `.env.example` to `.env.local` and set values from Supabase Project Settings → API:

```env
VITE_SUPABASE_URL=https://vwupdobwjlmitsgasdrz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

The publishable key is safe for browser use when Row Level Security is enabled.
Never put a service-role key in `VITE_*` variables or commit it to the repository.

## Database setup

Run `supabase/migrations/20260715070000_auth_foundation.sql` in the Supabase SQL
Editor or through the Supabase CLI. It creates:

- `profiles`, auto-created for each new auth user;
- `app_role` with `admin`, `staff`, and `client` values;
- `user_roles`, defaulting new users to `client`;
- `has_role()` as a restricted `security definer` function;
- RLS policies for profiles and roles.

After creating the first account, grant admin access from the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR_AUTH_USER_UUID', 'admin')
on conflict (user_id, role) do nothing;
```

## Auth URLs

In Supabase Authentication → URL Configuration, add the local and deployed origins
to the redirect allow list, including `/reset-password`, for example:

- `http://localhost:8090/reset-password`
- `https://your-preview-domain/reset-password`
- `https://your-production-domain/reset-password`

The `/account` and `/admin` routes are protected both by browser route guards and
server request middleware. Keep private data authorization in Supabase RLS and
server functions as future data features are added.
