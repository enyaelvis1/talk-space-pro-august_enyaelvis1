-- Duplicate booking foundation snapshot.
-- The canonical appointment schema, availability seed, and booking RPCs are
-- created by 20260715200000_booking_foundation.sql and repaired by later
-- function-specific migrations.

grant all on public.appointments to service_role;
