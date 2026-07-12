-- Allocation approval workflow (M2.2-05) + Keka sync fields (M2.2-06)
ALTER TABLE "allocations"
  ADD COLUMN "requested_by" UUID,
  ADD COLUMN "requested_at" TIMESTAMPTZ,
  ADD COLUMN "rejection_comment" TEXT,
  ADD COLUMN "keka_synced_at" TIMESTAMPTZ,
  ADD COLUMN "keka_sync_ref" VARCHAR(100);

ALTER TABLE "allocations"
  ADD CONSTRAINT "allocations_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_allocations_requested_by" ON "allocations"("requested_by");
