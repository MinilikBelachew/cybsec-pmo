-- Project delete: cascade child rows when a project is removed.
-- Run: npx prisma migrate deploy   (or migration:run in dev)

-- Drop and recreate FKs with ON DELETE CASCADE / SET NULL.
-- Prisma default constraint names: {table}_{column}_fkey

-- Tasks: project cascade, phase/parent set null
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_project_id_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_phase_id_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_id_fkey"
  FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parent_task_id_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey"
  FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task children
ALTER TABLE "task_comments" DROP CONSTRAINT IF EXISTS "task_comments_task_id_fkey";
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_attachments" DROP CONSTRAINT IF EXISTS "task_attachments_task_id_fkey";
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_progress_updates" DROP CONSTRAINT IF EXISTS "task_progress_updates_task_id_fkey";
ALTER TABLE "task_progress_updates" ADD CONSTRAINT "task_progress_updates_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "task_dependencies_predecessor_id_fkey";
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_fkey"
  FOREIGN KEY ("predecessor_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "task_dependencies_successor_id_fkey";
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_id_fkey"
  FOREIGN KEY ("successor_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project-scoped tables (CASCADE)
ALTER TABLE "project_domains" DROP CONSTRAINT IF EXISTS "project_domains_project_id_fkey";
ALTER TABLE "project_domains" ADD CONSTRAINT "project_domains_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_phases" DROP CONSTRAINT IF EXISTS "project_phases_project_id_fkey";
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_milestones" DROP CONSTRAINT IF EXISTS "project_milestones_project_id_fkey";
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_milestones" DROP CONSTRAINT IF EXISTS "project_milestones_phase_id_fkey";
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_phase_id_fkey"
  FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "allocations" DROP CONSTRAINT IF EXISTS "allocations_project_id_fkey";
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timesheets" DROP CONSTRAINT IF EXISTS "timesheets_project_id_fkey";
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timesheets" DROP CONSTRAINT IF EXISTS "timesheets_task_id_fkey";
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_budgets" DROP CONSTRAINT IF EXISTS "project_budgets_project_id_fkey";
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_costs" DROP CONSTRAINT IF EXISTS "employee_costs_project_id_fkey";
ALTER TABLE "employee_costs" ADD CONSTRAINT "employee_costs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_project_id_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_matched_milestone_id_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_matched_milestone_id_fkey"
  FOREIGN KEY ("matched_milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "risks" DROP CONSTRAINT IF EXISTS "risks_project_id_fkey";
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_project_id_fkey";
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_escalations" DROP CONSTRAINT IF EXISTS "customer_escalations_project_id_fkey";
ALTER TABLE "customer_escalations" ADD CONSTRAINT "customer_escalations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "action_points" DROP CONSTRAINT IF EXISTS "action_points_project_id_fkey";
ALTER TABLE "action_points" ADD CONSTRAINT "action_points_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lessons_learned" DROP CONSTRAINT IF EXISTS "lessons_learned_project_id_fkey";
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kpi_snapshots" DROP CONSTRAINT IF EXISTS "kpi_snapshots_project_id_fkey";
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generated_reports" DROP CONSTRAINT IF EXISTS "generated_reports_project_id_fkey";
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_schedules" DROP CONSTRAINT IF EXISTS "report_schedules_project_id_fkey";
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_project_id_fkey";
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_access_grants" DROP CONSTRAINT IF EXISTS "external_access_grants_project_id_fkey";
ALTER TABLE "external_access_grants" ADD CONSTRAINT "external_access_grants_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_threads" DROP CONSTRAINT IF EXISTS "workspace_threads_project_id_fkey";
ALTER TABLE "workspace_threads" ADD CONSTRAINT "workspace_threads_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_documents" DROP CONSTRAINT IF EXISTS "workspace_documents_project_id_fkey";
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_charters" DROP CONSTRAINT IF EXISTS "project_charters_project_id_fkey";
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sow_documents" DROP CONSTRAINT IF EXISTS "sow_documents_project_id_fkey";
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "closure_checklists" DROP CONSTRAINT IF EXISTS "closure_checklists_project_id_fkey";
ALTER TABLE "closure_checklists" ADD CONSTRAINT "closure_checklists_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_tickets" DROP CONSTRAINT IF EXISTS "sla_tickets_project_id_fkey";
ALTER TABLE "sla_tickets" ADD CONSTRAINT "sla_tickets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_vendors" DROP CONSTRAINT IF EXISTS "project_vendors_project_id_fkey";
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
