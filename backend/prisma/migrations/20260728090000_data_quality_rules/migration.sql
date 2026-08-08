ALTER TABLE "app_settings"
ADD COLUMN IF NOT EXISTS "data_quality_rules" JSONB NOT NULL DEFAULT '{}';
