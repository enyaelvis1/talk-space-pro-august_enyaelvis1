
REVOKE EXECUTE ON FUNCTION public.record_payment_initiated(uuid, public.payment_provider, text, bigint, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_bank_transfer(uuid, text, bigint, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_bank_transfer(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_payment_initiated(uuid, public.payment_provider, text, bigint, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_status(text, public.payment_status, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_bank_transfer(uuid, text, bigint, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_bank_transfer(uuid, boolean, text) TO authenticated, service_role;
