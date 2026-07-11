-- Unify attachments into workspace_documents (project / milestone / sign-off / technical / task)

ALTER TABLE "workspace_documents"
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(30) NOT NULL DEFAULT 'Project',
  ADD COLUMN IF NOT EXISTS "milestone_id" UUID,
  ADD COLUMN IF NOT EXISTS "task_id" UUID;

-- Migrate legacy task_attachments → workspace_documents (category = Task)
INSERT INTO "workspace_documents" (
  "id",
  "project_id",
  "logical_doc_id",
  "version",
  "category",
  "milestone_id",
  "task_id",
  "filename",
  "s3_key",
  "mime_type",
  "size_bytes",
  "tags",
  "is_internal",
  "uploaded_by",
  "created_at"
)
SELECT
  ta."id",
  t."project_id",
  gen_random_uuid(),
  1,
  'Task',
  NULL,
  ta."task_id",
  ta."filename",
  ta."s3_key",
  ta."mime_type",
  ta."size_bytes",
  ARRAY[]::TEXT[],
  TRUE,
  ta."uploaded_by",
  ta."created_at"
FROM "task_attachments" ta
INNER JOIN "tasks" t ON t."id" = ta."task_id"
ON CONFLICT ("id") DO NOTHING;

DROP TABLE IF EXISTS "task_attachments";

CREATE INDEX IF NOT EXISTS "idx_docs_category" ON "workspace_documents"("category");
CREATE INDEX IF NOT EXISTS "idx_docs_milestone" ON "workspace_documents"("milestone_id");
CREATE INDEX IF NOT EXISTS "idx_docs_task" ON "workspace_documents"("task_id");

ALTER TABLE "workspace_documents"
  DROP CONSTRAINT IF EXISTS "workspace_documents_milestone_id_fkey",
  DROP CONSTRAINT IF EXISTS "workspace_documents_task_id_fkey";

ALTER TABLE "workspace_documents"
  ADD CONSTRAINT "workspace_documents_milestone_id_fkey"
    FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "workspace_documents_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
