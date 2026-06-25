ALTER TABLE "audit_logs"
  ADD COLUMN "break_glass_action" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_audit_break_glass" ON "audit_logs"("break_glass_action");

UPDATE "audit_logs"
SET "break_glass_action" = true
WHERE action IN ('BREAK_GLASS_ACTIVATED', 'BREAK_GLASS_STOPPED')
   OR COALESCE((new_value->>'breakGlassAction')::boolean, false) = true;
