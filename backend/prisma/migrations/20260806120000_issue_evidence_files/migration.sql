-- Multiple issue closure evidence files (keeps s3_evidence_key for backward compatibility)
ALTER TABLE "issues" ADD COLUMN "evidence_files" JSONB;

UPDATE "issues"
SET "evidence_files" = jsonb_build_array(
  jsonb_build_object(
    'storageKey', "s3_evidence_key",
    'filename', 'Evidence file'
  )
)
WHERE "s3_evidence_key" IS NOT NULL
  AND "evidence_files" IS NULL;
