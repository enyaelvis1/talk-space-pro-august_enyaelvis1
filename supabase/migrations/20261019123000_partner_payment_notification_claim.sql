alter table public.payments
  add column if not exists payment_partner_email_claimed_at timestamptz;
