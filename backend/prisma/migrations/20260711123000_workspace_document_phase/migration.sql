-- Add phase-level documents (Phase ≠ Milestone)

ALTER TABLE "workspace_documents"
  ADD COLUMN IF NOT EXISTS "phase_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_docs_phase" ON "workspace_documents"("phase_id");

ALTER TABLE "workspace_documents"
  DROP CONSTRAINT IF EXISTS "workspace_documents_phase_id_fkey";

ALTER TABLE "workspace_documents"
  ADD CONSTRAINT "workspace_documents_phase_id_fkey"
    FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
