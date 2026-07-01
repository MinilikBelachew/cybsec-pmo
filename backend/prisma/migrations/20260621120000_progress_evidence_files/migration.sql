-- Add JSON array for multiple progress evidence files (keeps s3_evidence_key for backward compatibility)
ALTER TABLE "task_progress_updates" ADD COLUMN "evidence_files" JSONB;

UPDATE "task_progress_updates"
SET "evidence_files" = jsonb_build_array(
  jsonb_build_object(
    'storageKey', "s3_evidence_key",
    'filename', 'Evidence file'
  )
)
WHERE "s3_evidence_key" IS NOT NULL
  AND "evidence_files" IS NULL;
