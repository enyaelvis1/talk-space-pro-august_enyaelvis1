# Demo client seed

The admin client directory requires records linked to `auth.users`. Use the
service-role seed script to create five confirmed demo users and upsert their
matching `public.clients` records.

## Run

Set the server-only service-role key in your shell, then run:

```bash
SUPABASE_SECRET_KEY='your-supabase-secret-key' \
DEMO_CLIENT_PASSWORD='a-strong-local-test-password' \
npm run db:seed:clients
```

`SUPABASE_SECRET_KEY` must be the server-only `sb_secret_...` key. The script
also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY`. Public
`VITE_SUPABASE_PUBLISHABLE_KEY`/anon keys cannot create or list users. Set
`SUPABASE_URL` explicitly if `VITE_SUPABASE_URL` is not exported in your shell.
If `DEMO_CLIENT_PASSWORD` is omitted, the script uses the development-only
default `TalkSpaceDemo!2026`.

The script is idempotent for the five `@talkspace.test` addresses and does not
delete or modify other users. Never expose the service-role key to the browser
or commit it to the repository.

## Full demo dataset

If you also want realistic booking and payment rows for admin, client, and
payment testing, run:

```bash
npm run db:seed:demo
```

That command runs the client seed first, then adds sample appointments and
payment records, and finally seeds content data for the homepage, testimonials,
and CMS preview flows.

## Content-only seed

If you just want the homepage, testimonials, media library, and editor demo
rows, run:

```bash
npm run db:seed:content
```
