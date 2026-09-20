-- Existing connections that already failed with Google's invalid_grant error
-- need to be moved into the same reconnect-required state as future failures.

update public.therapist_google_connections
set access_token_ciphertext = null,
    refresh_token_ciphertext = null,
    token_expires_at = null,
    sync_channel_id = null,
    sync_resource_id = null,
    sync_expires_at = null,
    last_sync_error = 'Google access was revoked or expired. Reconnect this therapist''s Google account.',
    last_sync_at = coalesce(last_sync_at, now()),
    updated_at = now()
where last_sync_error ilike '%invalid_grant%';
