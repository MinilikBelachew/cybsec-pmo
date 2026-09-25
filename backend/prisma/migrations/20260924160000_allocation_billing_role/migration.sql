-- Store Keka client billing role + snapshotted billing rate on allocations.
ALTER TABLE "allocations"
  ADD COLUMN IF NOT EXISTS "keka_billing_role_id" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "keka_billing_role_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "billing_rate" DECIMAL(12, 4);

CREATE INDEX IF NOT EXISTS "idx_allocations_keka_billing_role"
  ON "allocations" ("keka_billing_role_id");
