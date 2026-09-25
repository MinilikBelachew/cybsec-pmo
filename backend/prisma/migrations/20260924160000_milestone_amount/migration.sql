-- Optional billing amount on milestones (project currency; sum must not exceed project value)

ALTER TABLE "project_milestones"
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(15,2);

ALTER TABLE "template_milestones"
  ADD COLUMN IF NOT EXISTS "amount" DECIMAL(15,2);
