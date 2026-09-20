# Batch E — Booking flow

**Sections:** 09

## Scope

- `appointments` table with state machine: `hold → pending_payment → confirmed → completed | cancelled | no_show`.
- Server fns: `listAvailableSlots`, `holdSlot` (5-min TTL), `confirmAppointment`, `rescheduleAppointment`, `cancelAppointment`.
- Reschedule ≥ 24h free; < 24h blocked by policy.
- `/book` uses real availability, not the placeholder form.
- Concurrency: unique index on `(therapist_id, starts_at)` where state ∈ (hold, pending_payment, confirmed).

## Current implementation

- The booking migration creates the appointment state enum, protected appointment records, recurring availability seed windows, a conflict-aware slot query, and a transactional five-minute hold RPC.
- `src/lib/booking.functions.ts` exposes the service and availability reads plus the public hold flow. Manage tokens are generated in the server function and only their SHA-256 hashes are stored.
- `/book` loads active services from Supabase, requests slots for the selected service/date/mode, and creates a real hold after server-side slot validation.
- Payment confirmation, authenticated appointment management, notifications, and the remaining state transitions continue in the payment, email, and admin batches.

## Acceptance

- Two users cannot book the same slot.
- Holds expire after 5 minutes if not paid.
