insert into public.email_template_settings (template_key, display_name, description)
values
  ('payment_success', 'Payment confirmation', 'Sent when an online payment or bank transfer is confirmed.'),
  ('payment_failed', 'Payment failed', 'Sent when an online payment fails or is abandoned.'),
  ('bank_transfer_received', 'Bank transfer received', 'Sent when a client submits bank-transfer details for review.')
on conflict (template_key) do nothing;

alter table public.payments
add column if not exists payment_success_email_claimed_at timestamptz,
add column if not exists payment_failed_email_claimed_at timestamptz,
add column if not exists bank_transfer_received_email_claimed_at timestamptz;

alter table public.email_delivery_logs
add column if not exists retry_payload_ciphertext text,
add column if not exists retry_count integer not null default 0 check (retry_count between 0 and 5),
add column if not exists next_retry_at timestamptz,
add column if not exists retried_from uuid references public.email_delivery_logs(id) on delete set null,
add column if not exists retry_trigger text not null default 'initial'
  check (retry_trigger in ('initial', 'automatic', 'manual')),
add column if not exists retry_actor_id uuid references auth.users(id) on delete set null;

create index if not exists email_delivery_logs_due_retry_idx
on public.email_delivery_logs (next_retry_at)
where status = 'failed' and next_retry_at is not null;

create index if not exists email_delivery_logs_retried_from_idx
on public.email_delivery_logs (retried_from);
