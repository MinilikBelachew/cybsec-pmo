-- AlterTable
ALTER TABLE "failed_sync_records"
  ADD COLUMN "failure_class" VARCHAR(20) NOT NULL DEFAULT 'transient',
  ADD COLUMN "dead_lettered_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "idx_failed_sync_dead_lettered" ON "failed_sync_records"("dead_lettered_at");

-- Backfill exhausted unresolved rows as dead-lettered
UPDATE "failed_sync_records"
SET "dead_lettered_at" = "last_attempted"
WHERE "is_resolved" = false
  AND "dead_lettered_at" IS NULL
  AND (
    "retry_count" >= 5
    OR ("entity_type" = 'timesheet' AND "retry_count" >= 3)
  );
