-- Professional charter fields + typed approval signature
ALTER TABLE "project_charters"
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "success_criteria" TEXT,
  ADD COLUMN IF NOT EXISTS "scope_exclusions" TEXT,
  ADD COLUMN IF NOT EXISTS "key_deliverables" TEXT,
  ADD COLUMN IF NOT EXISTS "high_level_risks" TEXT,
  ADD COLUMN IF NOT EXISTS "milestone_schedule" TEXT,
  ADD COLUMN IF NOT EXISTS "resource_estimates" TEXT,
  ADD COLUMN IF NOT EXISTS "stakeholders" TEXT,
  ADD COLUMN IF NOT EXISTS "pm_authority" TEXT,
  ADD COLUMN IF NOT EXISTS "approver_signature_name" VARCHAR(255);
