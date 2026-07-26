-- Gate 3 reporting schema extensions
ALTER TABLE "health_rule_configs" ADD COLUMN IF NOT EXISTS "red_threshold" DECIMAL(10,4);

ALTER TABLE "kpi_snapshots" ADD COLUMN IF NOT EXISTS "period_start" DATE;
ALTER TABLE "kpi_snapshots" ADD COLUMN IF NOT EXISTS "period_end" DATE;

ALTER TABLE "report_schedules" ADD COLUMN IF NOT EXISTS "last_error" TEXT;

ALTER TABLE "data_quality_flags" ADD COLUMN IF NOT EXISTS "project_id" UUID;
ALTER TABLE "data_quality_flags" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) NOT NULL DEFAULT 'medium';

DO $$ BEGIN
  ALTER TABLE "data_quality_flags"
    ADD CONSTRAINT "data_quality_flags_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_dq_flags_project" ON "data_quality_flags"("project_id");

ALTER TABLE "mom_documents" ADD COLUMN IF NOT EXISTS "content_json" JSONB;
ALTER TABLE "mom_documents" ADD COLUMN IF NOT EXISTS "s3_pdf_key" VARCHAR(512);
ALTER TABLE "mom_documents" ADD COLUMN IF NOT EXISTS "s3_docx_key" VARCHAR(512);
