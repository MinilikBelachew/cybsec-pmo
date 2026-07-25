-- Project-level MPP % complete and duration variance (current − baseline).
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "percent_complete" INTEGER,
  ADD COLUMN IF NOT EXISTS "duration_variance_days" DECIMAL(8,2);
