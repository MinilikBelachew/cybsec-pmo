-- Make audit_logs immutable for normal UPDATE/DELETE (TC-M1.8-05).
-- Scheduled archival may DELETE after setting app.allow_audit_archive_delete=on
-- for the current transaction only.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs are immutable: UPDATE is not allowed'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_audit_archive_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION 'audit_logs are immutable: DELETE is not allowed'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON "audit_logs";

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
