-- Keep one stable purchase identity alongside each booking. Package bookings
-- resolve to client_session_packages.reference; paid grouped checkouts resolve
-- to payments.checkout_group_reference (or the single payment reference).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS purchase_reference text;

CREATE INDEX IF NOT EXISTS appointments_purchase_reference_idx
  ON public.appointments (purchase_reference);

CREATE OR REPLACE FUNCTION public.sync_appointment_purchase_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  package_reference text;
  payment_group_reference text;
BEGIN
  IF NEW.package_id IS NOT NULL THEN
    SELECT reference INTO package_reference
    FROM public.client_session_packages
    WHERE id = NEW.package_id;
  END IF;

  IF package_reference IS NULL AND NEW.payment_reference IS NOT NULL THEN
    SELECT COALESCE(checkout_group_reference, reference)
      INTO payment_group_reference
    FROM public.payments
    WHERE reference = NEW.payment_reference
       OR checkout_group_reference = NEW.payment_reference
    ORDER BY CASE WHEN reference = NEW.payment_reference THEN 0 ELSE 1 END, id
    LIMIT 1;
  END IF;

  NEW.purchase_reference := COALESCE(
    package_reference,
    payment_group_reference,
    NEW.purchase_reference
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_purchase_reference_sync ON public.appointments;
CREATE TRIGGER appointments_purchase_reference_sync
BEFORE INSERT OR UPDATE OF package_id, payment_reference
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_purchase_reference();

CREATE OR REPLACE FUNCTION public.sync_payment_purchase_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checkout_group_reference IS NOT NULL THEN
    UPDATE public.appointments
    SET purchase_reference = NEW.checkout_group_reference,
        updated_at = now()
    WHERE package_id IS NULL
      AND (payment_reference = NEW.reference
       OR payment_reference = NEW.checkout_group_reference);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_purchase_reference_sync ON public.payments;
CREATE TRIGGER payments_purchase_reference_sync
AFTER INSERT OR UPDATE OF checkout_group_reference
ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_purchase_reference();

-- Backfill package links first so they take precedence over a payment link.
UPDATE public.appointments a
SET purchase_reference = pkg.reference
FROM public.client_session_packages pkg
WHERE a.package_id = pkg.id
  AND a.purchase_reference IS DISTINCT FROM pkg.reference;

UPDATE public.appointments a
SET purchase_reference = COALESCE(p.checkout_group_reference, p.reference)
FROM public.payments p
WHERE a.package_id IS NULL
  AND a.payment_reference = p.reference
  AND a.purchase_reference IS DISTINCT FROM COALESCE(p.checkout_group_reference, p.reference);

REVOKE ALL ON FUNCTION public.sync_appointment_purchase_reference() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_appointment_purchase_reference() TO service_role;
REVOKE ALL ON FUNCTION public.sync_payment_purchase_reference() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_payment_purchase_reference() TO service_role;
