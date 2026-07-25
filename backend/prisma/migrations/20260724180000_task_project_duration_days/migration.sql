-- MSP schedule duration fields (working days, fractional allowed).
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "duration_days" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "baseline_duration_days" DECIMAL(8,2);

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "duration_days" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "baseline_duration_days" DECIMAL(8,2);
