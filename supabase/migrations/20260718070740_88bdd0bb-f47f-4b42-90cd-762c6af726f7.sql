DROP POLICY IF EXISTS payment_receipts_authed_write ON storage.objects;
CREATE POLICY payment_receipts_public_write ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-receipts');