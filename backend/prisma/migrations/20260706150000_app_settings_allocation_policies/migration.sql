ALTER TABLE "app_settings"
  ADD COLUMN "allocation_threshold_mode" VARCHAR(10) NOT NULL DEFAULT 'warn',
  ADD COLUMN "designation_mismatch_mode" VARCHAR(10) NOT NULL DEFAULT 'warn',
  ADD COLUMN "department_staffing_mode" VARCHAR(10) NOT NULL DEFAULT 'off',
  ADD COLUMN "designation_rules" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "department_staffing_rules" JSONB NOT NULL DEFAULT '{"rule":"same_department_only"}';

UPDATE "app_settings"
SET
  "allocation_threshold_mode" = COALESCE("allocation_threshold_mode", 'warn'),
  "designation_mismatch_mode" = COALESCE("designation_mismatch_mode", 'warn'),
  "department_staffing_mode" = COALESCE("department_staffing_mode", 'off'),
  "designation_rules" = COALESCE("designation_rules", '[]'::jsonb),
  "department_staffing_rules" = COALESCE(
    "department_staffing_rules",
    '{"rule":"same_department_only"}'::jsonb
  )
WHERE "id" = 'default';
