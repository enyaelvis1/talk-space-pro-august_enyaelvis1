-- Lock receipt storage to the server-mediated flow.
--
-- Bank-transfer receipts are uploaded by a server function after appointment
-- ownership/manage-token validation. Admins view them through short-lived
-- signed URLs. No browser role needs direct object writes.

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set
  name = excluded.name,
  public = false;

drop policy if exists payment_receipts_public_write on storage.objects;
drop policy if exists payment_receipts_authed_write on storage.objects;
drop policy if exists payment_receipts_staff_read on storage.objects;

create policy payment_receipts_staff_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
);
