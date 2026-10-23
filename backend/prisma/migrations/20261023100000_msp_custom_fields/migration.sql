-- MSP local custom fields: project catalog + per-task values for import/export round-trip.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "msp_custom_field_defs" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "msp_custom_fields" JSONB;
