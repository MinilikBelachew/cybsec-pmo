-- M5.1: budget adjustments + cascade deletes for budget children
ALTER TABLE "budget_revisions" DROP CONSTRAINT IF EXISTS "budget_revisions_budget_id_fkey";
ALTER TABLE "budget_revisions"
  ADD CONSTRAINT "budget_revisions_budget_id_fkey"
  FOREIGN KEY ("budget_id") REFERENCES "project_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_line_items" DROP CONSTRAINT IF EXISTS "budget_line_items_budget_id_fkey";
ALTER TABLE "budget_line_items"
  ADD CONSTRAINT "budget_line_items_budget_id_fkey"
  FOREIGN KEY ("budget_id") REFERENCES "project_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "budget_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "budget_id" UUID NOT NULL,
  "line_item_id" UUID,
  "target_field" VARCHAR(30) NOT NULL,
  "old_amount" DECIMAL(15,2) NOT NULL,
  "new_amount" DECIMAL(15,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
  "requested_by" UUID NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "budget_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_budget_adjustments_budget" ON "budget_adjustments"("budget_id");
CREATE INDEX IF NOT EXISTS "idx_budget_adjustments_status" ON "budget_adjustments"("status");

ALTER TABLE "budget_adjustments"
  ADD CONSTRAINT "budget_adjustments_budget_id_fkey"
  FOREIGN KEY ("budget_id") REFERENCES "project_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_adjustments"
  ADD CONSTRAINT "budget_adjustments_line_item_id_fkey"
  FOREIGN KEY ("line_item_id") REFERENCES "budget_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "budget_adjustments"
  ADD CONSTRAINT "budget_adjustments_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_adjustments"
  ADD CONSTRAINT "budget_adjustments_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
