# Purchase-first package migration contract

This documents the migration contract implemented for BPC-001 and BPC-002. The migration is included in this branch but is not executed against the hosted database by this work.

## Problem statement

The current payments schema assumes every payment is attached to an appointment:

- `public.payments.appointment_id` is `NOT NULL`
- later-booking package activation is tied to a successful payment that already belongs to an appointment
- the current package credit lifecycle is valid after a booking exists, but it cannot represent a purchase made before any booking exists

Because of that boundary, purchase-first package behavior cannot be implemented safely without a schema contract that allows package-only payments.

## Decision

Keep the existing appointment-linked flow intact and add a second payment state for package purchases.

This preserves compatibility with the booking checkout model while making the purchase-first flow legal.

## Contract

### Payments model

1. `public.payments.appointment_id` becomes nullable.
2. Add `public.payment_kind` enum with two values:
   - `appointment`
   - `package_purchase`
3. `payment_kind` is required.
4. Add a check constraint:
   - appointment payments require `appointment_id IS NOT NULL`
   - package purchases require `appointment_id IS NULL`
5. Existing appointment payment code continues to use `payment_kind = 'appointment'`.

### Package creation path

1. Successful package purchase inserts a payment row with `payment_kind = 'package_purchase'` and no appointment.
2. A payment confirmation RPC creates a `client_session_packages` row using the package purchase metadata.
3. The package row is linked to the payment through `source_payment_id`.
4. The package is available for later booking, but it does not consume sessions until a confirmed booking is created.

### Bookings from package balance

1. A client later creates a booking with service and session data.
2. Booking validation resolves the active package matching that service and client.
3. The package is decremented only when the booking is confirmed.
4. The existing `consume_session_package_credit` logic remains the source of truth.

## Proposed migration SQL

```sql
create type public.payment_kind as enum ('appointment', 'package_purchase');

alter table public.payments
  alter column appointment_id drop not null;

alter table public.payments
  add column if not exists payment_kind public.payment_kind not null default 'appointment';

alter table public.payments
  add constraint payments_payment_kind_appointment_check
  check (
    (payment_kind = 'appointment' and appointment_id is not null)
    or (payment_kind = 'package_purchase' and appointment_id is null)
  );

create index if not exists payments_kind_idx
  on public.payments(payment_kind, status, created_at desc);

create or replace function public.record_package_purchase_initiated(
  p_client_id uuid,
  p_service_id uuid,
  p_provider public.payment_provider,
  p_reference text,
  p_amount_kobo bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.payments;
begin
  if p_amount_kobo <= 0 then
    raise exception using errcode = 'P0001', message = 'invalid_amount';
  end if;

  insert into public.payments (
    appointment_id,
    payment_kind,
    provider,
    reference,
    amount_kobo,
    status,
    metadata,
    created_by
  ) values (
    null,
    'package_purchase',
    p_provider,
    p_reference,
    p_amount_kobo,
    case when p_provider = 'bank_transfer' then 'awaiting_confirmation'::public.payment_status else 'initiated'::public.payment_status end,
    jsonb_set(coalesce(p_metadata, '{}'::jsonb), '{service_id}', to_jsonb(p_service_id), true),
    auth.uid()
  )
  on conflict (reference) do update
    set metadata = public.payments.metadata || excluded.metadata,
        updated_at = now()
  returning * into payment;

  return payment;
end;
$$;

create or replace function public.confirm_package_purchase(
  p_reference text,
  p_service_id uuid,
  p_client_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_purchased_sessions integer,
  p_expires_at timestamptz default null
)
returns public.client_session_packages
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payment public.payments%rowtype;
  pkg public.client_session_packages%rowtype;
  raw_token text;
begin
  select * into payment
  from public.payments
  where reference = p_reference
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'payment_not_found';
  end if;

  if payment.payment_kind <> 'package_purchase' then
    raise exception using errcode = 'P0001', message = 'payment_kind_mismatch';
  end if;

  if payment.status <> 'succeeded' then
    raise exception using errcode = 'P0001', message = 'payment_not_succeeded';
  end if;

  select * into pkg
  from public.client_session_packages
  where source_payment_id = payment.id
  for update;

  if not found then
    raw_token := encode(gen_random_bytes(32), 'hex');

    insert into public.client_session_packages (
      client_id,
      client_name,
      client_email,
      client_phone,
      service_id,
      source_payment_id,
      purchased_sessions,
      used_sessions,
      status,
      access_token_hash,
      access_token,
      expires_at,
      created_by
    ) values (
      p_client_id,
      p_client_name,
      p_client_email,
      p_client_phone,
      p_service_id,
      payment.id,
      p_purchased_sessions,
      0,
      'active',
      encode(digest(raw_token, 'sha256'), 'hex'),
      raw_token,
      coalesce(p_expires_at, now() + interval '6 months'),
      auth.uid()
    )
    returning * into pkg;
  end if;

  return pkg;
end;
$$;
```

## Behavioral rules after migration

- appointment payments remain fully compatible with the current confirmation flow
- package purchase payments are allowed to exist without appointments
- the package purchase confirmation path must be idempotent
- the package row cannot be activated twice for the same payment
- a later booking consumes the matching package only after a successful booking confirmation

## Validation plan

Once approved, the implementation should be validated in this order:

1. Confirm a package-only payment row can be created with `appointment_id IS NULL`.
2. Confirm the package activation function creates exactly one package row per payment.
3. Confirm the booking flow uses the active package balance when no appointment payment exists yet.
4. Confirm over-balance booking attempts are rejected.
5. Confirm expired and exhausted package states still reject booking attempts.
6. Confirm the later-booking path still works for the existing appointment-linked package flow.

## Notable implementation note

This migration plan intentionally does not change the existing later-booking package model in [supabase/migrations/20260818120000_session_package_credits.sql](../supabase/migrations/20260818120000_session_package_credits.sql). It only adds the missing purchase-first state so the current balance logic can be reused safely.
