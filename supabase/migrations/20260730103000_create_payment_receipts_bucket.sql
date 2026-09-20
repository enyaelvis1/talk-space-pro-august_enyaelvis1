-- Create the private bucket used for bank-transfer receipt uploads.
--
-- Receipts are uploaded server-side with the service role, then exposed to
-- admins through signed URLs. The bucket must exist even if no direct storage
-- policies are required for the current flow.

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;
