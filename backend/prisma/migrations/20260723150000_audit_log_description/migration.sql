-- Human-readable audit descriptions for Audit Trail UI / export (DEF-P1-053).

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500);

ALTER TABLE "audit_logs_archive"
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500);
