-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN "value_usd" DECIMAL(15, 2),
  ADD COLUMN "fx_rate_to_usd" DECIMAL(18, 8),
  ADD COLUMN "fx_rate_at" TIMESTAMPTZ;

-- Existing USD projects can be snapshotted without an FX lookup.
UPDATE "projects"
SET
  "value_usd" = "value",
  "fx_rate_to_usd" = 1,
  "fx_rate_at" = NOW()
WHERE "currency" = 'USD'
  AND "value" IS NOT NULL;
