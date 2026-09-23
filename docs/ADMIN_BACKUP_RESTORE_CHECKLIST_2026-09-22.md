# Admin backup and restore checklist

This checklist covers a protected, application-level backup system for the Talk
Space admin console. It is not a replacement for Supabase managed backups or
point-in-time recovery. Auth identities, provider credentials, encryption keys,
`.env` values, and raw payment secrets must never be exported.

## Milestone 1 — Safety contract and design

- [x] Create the feature from `develop` using the project branch workflow.
- [x] Define the archive as an encrypted logical backup of allowlisted
      application and operational data plus a storage-object manifest.
- [x] Exclude auth users, service keys, provider tokens, secret ciphertexts,
      manage-token hashes, and `.env` values.
- [x] Require server-side admin authorization for every catalog, download,
      validation, and restore action.
- [x] Keep archives in a private `site-backups` storage bucket with short-lived
      signed download URLs.
- [x] Document that a full physical database restore remains a Supabase
      provider operation and must be tested separately.

## Milestone 2 — Database and storage foundation

- [x] Add the private backup catalog table, status constraints, indexes, and
      RLS policy.
- [x] Add the private storage bucket and prevent browser uploads.
- [x] Add a server-only restore RPC for the supported site-content/configuration
      profile, with an explicit service-role/admin guard.
- [x] Keep restore operations auditable and reject arbitrary table names or SQL
      supplied by the browser.

## Milestone 3 — Admin backup operations

- [x] Add server functions to create an encrypted archive, list catalog rows,
      issue a signed download URL, validate an archive, and restore supported
      site content/configuration.
- [x] Include recoverable clients, appointments, payments, availability,
      audit/events, submissions, profiles, and application settings in the
      encrypted archive, with sensitive fields redacted.
- [x] Fail closed when `BACKUP_ENCRYPTION_KEY` is missing or invalid.
- [x] Add typed restore confirmation and existing admin step-up protection in
      the UI.
- [x] Show archive scope, counts, checksum, status, errors, and restore limits.

## Milestone 4 — Verification and promotion

- [x] Add migration, redaction/encryption, server-contract, navigation, and
      restore-safety tests.
- [x] Run focused backup tests, TypeScript, ESLint, and the production build.
- [ ] Run the complete local test suite without baseline failures. The suite
      currently stops in the pre-existing public-shell egress browser fixture
      with Vite's `ERR_CLOSED_SERVER`/"server is being restarted" failure;
      this backup feature does not exercise that fixture.
- [ ] Review the generated migration and archive behavior in staging/UAT.
- [ ] Apply the migration to the approved Supabase target after explicit
      approval; never apply it to production as part of a local commit.
- [x] Open the feature PR into `develop` (PR #54), complete UAT, then open the
      separate approved release PR from `develop` into `main`.
- [ ] Verify a backup download, validation, restore preview, and audit entry in
      the deployed admin UI.
