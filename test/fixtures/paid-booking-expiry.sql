-- Extend the minimal isolated-cluster fixture, never the configured app DB.
CREATE TYPE payment_kind AS ENUM ('appointment', 'package_purchase');
ALTER TABLE appointments
  ADD COLUMN created_at timestamptz DEFAULT now(),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancel_reason text,
  ADD COLUMN booking_reference text DEFAULT 'TEST-BOOKING',
  ADD COLUMN rescheduled_from_starts_at timestamptz,
  ADD COLUMN manage_token text DEFAULT 'synthetic-checkout-token',
  ADD COLUMN manage_token_hash text DEFAULT 'synthetic-checkout-hash',
  ADD COLUMN manage_token_expires_at timestamptz,
  ADD COLUMN manage_token_revoked_at timestamptz,
  ADD COLUMN manage_token_revoked_by uuid,
  ADD COLUMN manage_token_revocation_reason text;
ALTER TABLE payments
  ADD COLUMN provider text DEFAULT 'paystack',
  ADD COLUMN payment_kind payment_kind DEFAULT 'appointment',
  ADD COLUMN currency text DEFAULT 'NGN',
  ADD COLUMN transfer_note text,
  ADD COLUMN transfer_reference text,
  ADD COLUMN receipt_path text,
  ADD COLUMN created_by uuid;
ALTER TABLE services ADD COLUMN price_ngn numeric DEFAULT 55000,
  ADD COLUMN in_person_price_ngn numeric DEFAULT 85000;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor_id', true), '')::uuid
$$;
CREATE FUNCTION has_role(uuid, text) RETURNS boolean LANGUAGE sql AS $$
  SELECT $1 = '00000000-0000-0000-0000-000000000001'::uuid AND $2 = 'admin'
$$;
-- Package creation is an independent boundary; record calls for replay tests.
CREATE TABLE test_package_confirmations (reference text);
CREATE FUNCTION confirm_package_purchase(text, uuid, uuid, text, text, text, integer)
RETURNS void LANGUAGE sql AS $$ INSERT INTO test_package_confirmations VALUES ($1) $$;
