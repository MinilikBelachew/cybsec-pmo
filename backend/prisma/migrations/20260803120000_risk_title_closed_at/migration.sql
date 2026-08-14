-- Phase 4 M4.1: Risk register title + closedAt
ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "risks" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ;

-- Backfill existing rows (table may be empty in most envs)
UPDATE "risks"
SET "title" = COALESCE(NULLIF(TRIM("title"), ''), LEFT(COALESCE("mitigation_plan", "category"), 255))
WHERE "title" IS NULL OR TRIM("title") = '';

ALTER TABLE "risks" ALTER COLUMN "title" SET NOT NULL;
