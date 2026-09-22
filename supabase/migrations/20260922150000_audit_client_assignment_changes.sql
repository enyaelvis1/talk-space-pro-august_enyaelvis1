-- Include client profile and therapist-assignment changes in the existing
-- immutable admin audit trail. The trigger stores changed field names only;
-- it does not copy client profile values into the audit record.
DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL
    AND to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS clients_audit_log ON public.clients;
    CREATE TRIGGER clients_audit_log
      AFTER INSERT OR UPDATE OR DELETE ON public.clients
      FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_log();
  END IF;
END
$$;
