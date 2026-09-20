DROP FUNCTION IF EXISTS public._setup_exec(text);
CREATE SCHEMA IF NOT EXISTS _setup;
CREATE OR REPLACE FUNCTION _setup.exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE ALL ON FUNCTION _setup.exec(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT USAGE ON SCHEMA _setup TO sandbox_exec;
    GRANT EXECUTE ON FUNCTION _setup.exec(text) TO sandbox_exec;
  END IF;
END $$;
