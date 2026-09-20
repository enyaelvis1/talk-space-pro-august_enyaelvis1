# Storage security review — 2026-08-10

## Scope

Reviewed Supabase Storage usage for private receipts, intake-related data, and
public media.

## Findings

- `payment-receipts` is the only private file bucket in the app. It is used for
  bank-transfer receipt uploads.
- Receipt upload is server-mediated in `uploadReceiptWithToken`: the server
  validates appointment ownership or manage-token access before uploading with
  the service role.
- Receipt viewing is server-mediated in `getReceiptSignedUrl`: admins request a
  10-minute signed URL.
- Intake submissions are stored in database tables, not a file bucket.
- `content-media` is intentionally public because it serves CMS images, public
  page artwork, therapist images, and homepage media.

## Changes

- Added migration `20260810143000_harden_payment_receipt_storage.sql`.
- Ensured `payment-receipts` is private.
- Removed direct anonymous/authenticated write policies for receipt objects.
- Kept authenticated admin/staff read policy for least-privilege review access.

## Sign-off

Private receipt storage now uses signed-URL-only reads for admin review and
server-only writes after authorization checks. No private intake file bucket
exists in the current implementation.
