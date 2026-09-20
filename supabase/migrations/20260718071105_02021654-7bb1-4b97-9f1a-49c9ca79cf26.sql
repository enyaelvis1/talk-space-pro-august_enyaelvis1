DROP POLICY IF EXISTS payment_receipts_public_write ON storage.objects;

CREATE POLICY payment_receipts_owner_write
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id::text = split_part(storage.objects.name, '/', 1)
        AND a.client_id = auth.uid()
    )
  )
);