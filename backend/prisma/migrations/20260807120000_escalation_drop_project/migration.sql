-- Drop project linkage from customer escalations (escalations are customer-scoped).
ALTER TABLE "customer_escalations" DROP CONSTRAINT IF EXISTS "customer_escalations_project_id_fkey";
DROP INDEX IF EXISTS "idx_escalations_project";
ALTER TABLE "customer_escalations" DROP COLUMN IF EXISTS "project_id";
CREATE INDEX IF NOT EXISTS "idx_escalations_customer" ON "customer_escalations"("customer_id");
