-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Draft', 'Active', 'On Hold', 'Pending Closure', 'Closed');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('To Do', 'In Progress', 'Submitted for Review', 'Approved', 'Rework', 'Done');

-- CreateEnum
CREATE TYPE "Methodology" AS ENUM ('Agile', 'Waterfall', 'Hybrid');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('Advisory', 'Assessment', 'Implementation', 'Managed Service', 'Training', 'Staff Augmentation');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('Fixed Price', 'Retainer', 'SLA-Based', 'Time & Materials');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('USD', 'AED', 'GBP', 'EUR');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('Company', 'Individual');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entra_object_id" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "role_code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_code" VARCHAR(50) NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "record_scope" VARCHAR(50),
    "field_scope" JSONB,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "object_type" VARCHAR(100) NOT NULL,
    "object_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "objective" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "methodology" "Methodology" NOT NULL DEFAULT 'Hybrid',
    "billing_model" "BillingModel" NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'Medium',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "baseline_start_date" DATE,
    "baseline_end_date" DATE,
    "actual_start_date" DATE,
    "actual_end_date" DATE,
    "value" DECIMAL(15,2),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "primary_pm_id" UUID NOT NULL,
    "secondary_pm_id" UUID,
    "status" "ProjectStatus" NOT NULL DEFAULT 'Draft',
    "crm_opportunity_id" UUID,
    "template_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,

    CONSTRAINT "project_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "target_date" DATE NOT NULL,
    "weight" DECIMAL(5,2),
    "status" VARCHAR(30) NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "parent_task_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'Medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "baseline_start" DATE,
    "baseline_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "effort_hours" INTEGER,
    "progress_approved" INTEGER NOT NULL DEFAULT 0,
    "progress_pending" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'To Do',
    "is_on_critical_path" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "predecessor_id" UUID NOT NULL,
    "successor_id" UUID NOT NULL,
    "dep_type" VARCHAR(10) NOT NULL,
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_progress_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "engineer_id" UUID NOT NULL,
    "progress_percent" INTEGER NOT NULL,
    "hours_spent" DECIMAL(6,2) NOT NULL,
    "comment" TEXT,
    "s3_evidence_key" VARCHAR(512),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "reviewed_by" UUID,
    "review_reason" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_progress_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keka_employee_id" VARCHAR(100) NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "department_id" UUID NOT NULL,
    "designation" VARCHAR(100) NOT NULL,
    "manager_id" UUID,
    "weekly_hours" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "percent" DECIMAL(5,2),
    "hours" DECIMAL(7,2),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "leave_date" DATE NOT NULL,
    "leave_type" VARCHAR(50) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "keka_ref" VARCHAR(100),
    "synced_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "regular_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "comment" TEXT,
    "keka_synced_at" TIMESTAMPTZ,
    "keka_sync_ref" VARCHAR(100),
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keka_sync_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "payload" JSONB,
    "error_msg" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keka_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "baseline_amount" DECIMAL(15,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "approved_by" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "budget_id" UUID NOT NULL,
    "revised_amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "budget_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "planned" DECIMAL(12,2) NOT NULL,
    "actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "rate_per_hour" DECIMAL(10,4) NOT NULL,
    "regular_hours" DECIMAL(7,2) NOT NULL,
    "overtime_hours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,2) NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employee_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "zoho_invoice_id" VARCHAR(100) NOT NULL,
    "invoice_number" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "due_date" DATE NOT NULL,
    "collection_date" DATE,
    "status" VARCHAR(20) NOT NULL,
    "matched_milestone_id" UUID,
    "discrepancy_note" TEXT,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zoho_opportunity_id" VARCHAR(100) NOT NULL,
    "expected_revenue" DECIMAL(15,2),
    "stage" VARCHAR(100),
    "last_writeback_at" TIMESTAMPTZ,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_sync_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "integration" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100),
    "direction" VARCHAR(10) NOT NULL,
    "payload" JSONB,
    "error_msg" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "last_attempted" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "impact" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "owner_id" UUID NOT NULL,
    "mitigation_plan" TEXT,
    "target_date" DATE,
    "residual_impact" INTEGER,
    "residual_likelihood" INTEGER,
    "residual_rating" INTEGER,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Open',
    "rule_version" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "owner_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_resolution_date" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Open',
    "resolution_note" TEXT,
    "s3_evidence_key" VARCHAR(512),
    "raised_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "threshold_config" JSONB NOT NULL,
    "channels" TEXT[],
    "reminder_cadence_hrs" INTEGER NOT NULL DEFAULT 24,
    "escalation_delay_hrs" INTEGER NOT NULL DEFAULT 48,
    "escalation_role" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "role_code" VARCHAR(50) NOT NULL,

    CONSTRAINT "alert_rule_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "object_type" VARCHAR(100) NOT NULL,
    "object_id" UUID,
    "channel" VARCHAR(20) NOT NULL,
    "delivery_status" VARCHAR(20) NOT NULL,
    "acknowledged_by" UUID,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "fired_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acked_at" TIMESTAMPTZ,
    "next_reminder_at" TIMESTAMPTZ,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_escalations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "sla_target_hrs" INTEGER NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Open',
    "resolution_summary" TEXT,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_communications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escalation_id" UUID NOT NULL,
    "channel" VARCHAR(30) NOT NULL,
    "content" TEXT NOT NULL,
    "logged_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID NOT NULL,
    "project_id" UUID,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "due_date" DATE NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Open',
    "closure_note" TEXT,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons_learned" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "tags" TEXT[],
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_learned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_rule_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dimension" VARCHAR(50) NOT NULL,
    "green_threshold" DECIMAL(10,4) NOT NULL,
    "amber_threshold" DECIMAL(10,4) NOT NULL,
    "unit" VARCHAR(20),
    "version" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "kpi_family" VARCHAR(50) NOT NULL,
    "value" JSONB NOT NULL,
    "rag_status" VARCHAR(10) NOT NULL,
    "rule_version" VARCHAR(20) NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "report_type" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "generated_by" UUID,
    "approved_by" UUID,
    "s3_pdf_key" VARCHAR(512),
    "s3_docx_key" VARCHAR(512),
    "data_snapshot" JSONB,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ,
    "distributed_at" TIMESTAMPTZ,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_type" VARCHAR(50) NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "project_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run" TIMESTAMPTZ,
    "next_run" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedule_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schedule_id" UUID NOT NULL,
    "role_code" VARCHAR(50),
    "contact_id" UUID,

    CONSTRAINT "report_schedule_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flag_type" VARCHAR(50) NOT NULL,
    "object_type" VARCHAR(50) NOT NULL,
    "object_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" UUID,
    "flagged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "data_quality_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "teams_meeting_id" VARCHAR(255),
    "teams_join_url" TEXT,
    "organiser_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "item_type" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "owner_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mom_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "s3_key" VARCHAR(512),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mom_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mom_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mom_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acked_at" TIMESTAMPTZ,

    CONSTRAINT "mom_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_upload" BOOLEAN NOT NULL DEFAULT false,
    "can_comment" BOOLEAN NOT NULL DEFAULT false,
    "access_start" DATE NOT NULL,
    "access_end" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_threads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_thread_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_thread_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "logical_doc_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "filename" VARCHAR(255) NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "tags" TEXT[],
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "patch" JSONB NOT NULL,
    "base_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "conflict_data" JSONB,
    "queued_at" TIMESTAMPTZ NOT NULL,
    "synced_at" TIMESTAMPTZ,

    CONSTRAINT "offline_sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "vapid_endpoint" TEXT NOT NULL,
    "vapid_keys" TEXT NOT NULL,
    "device_label" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_charters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "customer_id" UUID,
    "source_order_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "scope_summary" TEXT,
    "value_snapshot" DECIMAL(15,2),
    "start_date" DATE,
    "end_date" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "incomplete_fields" JSONB,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "s3_pdf_key" VARCHAR(512),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_charters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sow_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "opportunity_id" UUID,
    "creation_mode" VARCHAR(20) NOT NULL,
    "source_data_snapshot" JSONB,
    "prompt_sent" TEXT,
    "raw_llm_output" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "s3_final_key" VARCHAR(512),
    "document_link" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "crm_written_back_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sow_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "engagement_type" "EngagementType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "stale_reason" TEXT,
    "last_reviewed" TIMESTAMPTZ,
    "review_interval_days" INTEGER NOT NULL DEFAULT 90,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "relative_start_days" INTEGER NOT NULL DEFAULT 0,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'Medium',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_checklists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "template_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'In Progress',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closure_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checklist_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(50),
    "owner_id" UUID,
    "signed_by" UUID,
    "signed_at" TIMESTAMPTZ,
    "notes" TEXT,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "priority" VARCHAR(10) NOT NULL,
    "response_target_hrs" INTEGER NOT NULL,
    "resolution_target_hrs" INTEGER NOT NULL,
    "pause_rules" JSONB,
    "business_hours" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "project_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" VARCHAR(10) NOT NULL,
    "category" VARCHAR(100),
    "owner_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'Open',
    "response_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "timer_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMPTZ,
    "sla_response_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_resolution_breached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_timer_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "reason" TEXT,
    "logged_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_timer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_customer_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_customer_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_customer_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_compliance_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "total_tickets" INTEGER NOT NULL,
    "breached_response" INTEGER NOT NULL DEFAULT 0,
    "breached_resolution" INTEGER NOT NULL DEFAULT 0,
    "attainment_pct" DECIMAL(5,2) NOT NULL,
    "s3_report_key" VARCHAR(512),
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "PartyType" NOT NULL,
    "company_name" VARCHAR(255),
    "registration_number" VARCHAR(100),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "display_name" VARCHAR(255) NOT NULL,
    "industry" VARCHAR(100),
    "country" VARCHAR(100),
    "address" TEXT,
    "primary_email" VARCHAR(255),
    "primary_phone" VARCHAR(50),
    "zoho_contact_id" VARCHAR(100),
    "account_manager_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "job_title" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "receives_reports" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "PartyType" NOT NULL,
    "company_name" VARCHAR(255),
    "registration_number" VARCHAR(100),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "display_name" VARCHAR(255) NOT NULL,
    "vendor_category" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100),
    "address" TEXT,
    "primary_email" VARCHAR(255),
    "primary_phone" VARCHAR(50),
    "tax_id" VARCHAR(100),
    "bank_account_ref" VARCHAR(255),
    "payment_terms_days" INTEGER,
    "relationship_manager_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "job_title" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_invoicing_contact" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "engagement_type" VARCHAR(50) NOT NULL,
    "agreed_cost" DECIMAL(12,2),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "internal_contact_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "security_domains_code_key" ON "security_domains"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_object_id_key" ON "users"("entra_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_entra" ON "users"("entra_object_id");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role_code");

-- CreateIndex
CREATE INDEX "idx_permissions_role_module" ON "permissions"("role_code", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_token" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_object_type" ON "audit_logs"("object_type");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_object" ON "audit_logs"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "idx_projects_customer" ON "projects"("customer_id");

-- CreateIndex
CREATE INDEX "idx_projects_pm" ON "projects"("primary_pm_id");

-- CreateIndex
CREATE INDEX "idx_projects_status" ON "projects"("status");

-- CreateIndex
CREATE INDEX "idx_projects_dept" ON "projects"("department_id");

-- CreateIndex
CREATE INDEX "idx_projects_engagement" ON "projects"("engagement_type");

-- CreateIndex
CREATE INDEX "idx_project_domains_domain" ON "project_domains"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_project_domain" ON "project_domains"("project_id", "domain_id");

-- CreateIndex
CREATE INDEX "idx_milestones_project" ON "project_milestones"("project_id");

-- CreateIndex
CREATE INDEX "idx_tasks_project" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "idx_tasks_owner" ON "tasks"("owner_id");

-- CreateIndex
CREATE INDEX "idx_tasks_parent" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "idx_task_comments_task" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "idx_task_attachments_task" ON "task_attachments"("task_id");

-- CreateIndex
CREATE INDEX "idx_deps_predecessor" ON "task_dependencies"("predecessor_id");

-- CreateIndex
CREATE INDEX "idx_deps_successor" ON "task_dependencies"("successor_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_task_dependency" ON "task_dependencies"("predecessor_id", "successor_id");

-- CreateIndex
CREATE INDEX "idx_progress_task" ON "task_progress_updates"("task_id");

-- CreateIndex
CREATE INDEX "idx_progress_engineer" ON "task_progress_updates"("engineer_id");

-- CreateIndex
CREATE INDEX "idx_progress_status" ON "task_progress_updates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_keka_employee_id_key" ON "employees"("keka_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "idx_employees_keka_id" ON "employees"("keka_employee_id");

-- CreateIndex
CREATE INDEX "idx_employees_dept" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "idx_employees_manager" ON "employees"("manager_id");

-- CreateIndex
CREATE INDEX "idx_allocations_employee" ON "allocations"("employee_id");

-- CreateIndex
CREATE INDEX "idx_allocations_project" ON "allocations"("project_id");

-- CreateIndex
CREATE INDEX "idx_allocations_status" ON "allocations"("status");

-- CreateIndex
CREATE INDEX "idx_leave_employee" ON "leave_records"("employee_id");

-- CreateIndex
CREATE INDEX "idx_leave_date" ON "leave_records"("leave_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_leave_employee_date" ON "leave_records"("employee_id", "leave_date");

-- CreateIndex
CREATE INDEX "idx_timesheets_employee" ON "timesheets"("employee_id");

-- CreateIndex
CREATE INDEX "idx_timesheets_project" ON "timesheets"("project_id");

-- CreateIndex
CREATE INDEX "idx_timesheets_date" ON "timesheets"("work_date");

-- CreateIndex
CREATE INDEX "idx_timesheets_status" ON "timesheets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_timesheet_entry" ON "timesheets"("employee_id", "work_date", "task_id");

-- CreateIndex
CREATE INDEX "idx_ts_approvals_timesheet" ON "timesheet_approvals"("timesheet_id");

-- CreateIndex
CREATE INDEX "idx_ts_approvals_reviewer" ON "timesheet_approvals"("reviewer_id");

-- CreateIndex
CREATE INDEX "idx_keka_log_entity_type" ON "keka_sync_log"("entity_type");

-- CreateIndex
CREATE INDEX "idx_keka_log_status" ON "keka_sync_log"("status");

-- CreateIndex
CREATE INDEX "idx_keka_log_created" ON "keka_sync_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_budgets_project_id_key" ON "project_budgets"("project_id");

-- CreateIndex
CREATE INDEX "idx_budget_revisions_budget" ON "budget_revisions"("budget_id");

-- CreateIndex
CREATE INDEX "idx_line_items_budget" ON "budget_line_items"("budget_id");

-- CreateIndex
CREATE INDEX "idx_emp_costs_employee" ON "employee_costs"("employee_id");

-- CreateIndex
CREATE INDEX "idx_emp_costs_project" ON "employee_costs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_emp_cost_period" ON "employee_costs"("employee_id", "project_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_zoho_invoice_id_key" ON "invoices"("zoho_invoice_id");

-- CreateIndex
CREATE INDEX "idx_invoices_project" ON "invoices"("project_id");

-- CreateIndex
CREATE INDEX "idx_invoices_zoho" ON "invoices"("zoho_invoice_id");

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "idx_invoices_due" ON "invoices"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_opportunities_zoho_opportunity_id_key" ON "crm_opportunities"("zoho_opportunity_id");

-- CreateIndex
CREATE INDEX "idx_crm_opps_zoho" ON "crm_opportunities"("zoho_opportunity_id");

-- CreateIndex
CREATE INDEX "idx_failed_sync_integration" ON "failed_sync_records"("integration");

-- CreateIndex
CREATE INDEX "idx_failed_sync_resolved" ON "failed_sync_records"("is_resolved");

-- CreateIndex
CREATE INDEX "idx_risks_project" ON "risks"("project_id");

-- CreateIndex
CREATE INDEX "idx_risks_score" ON "risks"("score");

-- CreateIndex
CREATE INDEX "idx_risks_status" ON "risks"("status");

-- CreateIndex
CREATE INDEX "idx_issues_project" ON "issues"("project_id");

-- CreateIndex
CREATE INDEX "idx_issues_owner" ON "issues"("owner_id");

-- CreateIndex
CREATE INDEX "idx_issues_status" ON "issues"("status");

-- CreateIndex
CREATE INDEX "idx_issues_due" ON "issues"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alert_rule_recipient" ON "alert_rule_recipients"("rule_id", "role_code");

-- CreateIndex
CREATE INDEX "idx_alert_events_rule" ON "alert_events"("rule_id");

-- CreateIndex
CREATE INDEX "idx_alert_events_object_type" ON "alert_events"("object_type");

-- CreateIndex
CREATE INDEX "idx_alert_events_status" ON "alert_events"("delivery_status");

-- CreateIndex
CREATE INDEX "idx_escalations_project" ON "customer_escalations"("project_id");

-- CreateIndex
CREATE INDEX "idx_escalations_status" ON "customer_escalations"("status");

-- CreateIndex
CREATE INDEX "idx_escalations_severity" ON "customer_escalations"("severity");

-- CreateIndex
CREATE INDEX "idx_esc_comms_escalation" ON "escalation_communications"("escalation_id");

-- CreateIndex
CREATE INDEX "idx_actions_owner" ON "action_points"("owner_id");

-- CreateIndex
CREATE INDEX "idx_actions_project" ON "action_points"("project_id");

-- CreateIndex
CREATE INDEX "idx_actions_source" ON "action_points"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "idx_actions_due" ON "action_points"("due_date");

-- CreateIndex
CREATE INDEX "idx_actions_status" ON "action_points"("status");

-- CreateIndex
CREATE INDEX "idx_lessons_category" ON "lessons_learned"("category");

-- CreateIndex
CREATE INDEX "idx_lessons_project" ON "lessons_learned"("project_id");

-- CreateIndex
CREATE INDEX "idx_health_rules_active" ON "health_rule_configs"("dimension", "is_active");

-- CreateIndex
CREATE INDEX "idx_kpi_project" ON "kpi_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "idx_kpi_family" ON "kpi_snapshots"("kpi_family");

-- CreateIndex
CREATE INDEX "idx_kpi_captured" ON "kpi_snapshots"("captured_at");

-- CreateIndex
CREATE INDEX "idx_reports_project" ON "generated_reports"("project_id");

-- CreateIndex
CREATE INDEX "idx_reports_type" ON "generated_reports"("report_type");

-- CreateIndex
CREATE INDEX "idx_reports_status" ON "generated_reports"("status");

-- CreateIndex
CREATE INDEX "idx_report_recipients_schedule" ON "report_schedule_recipients"("schedule_id");

-- CreateIndex
CREATE INDEX "idx_dq_flags_type" ON "data_quality_flags"("flag_type");

-- CreateIndex
CREATE INDEX "idx_dq_flags_resolved" ON "data_quality_flags"("is_resolved");

-- CreateIndex
CREATE INDEX "idx_meetings_project" ON "meetings"("project_id");

-- CreateIndex
CREATE INDEX "idx_meetings_scheduled" ON "meetings"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_meeting_attendee" ON "meeting_attendees"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_meeting_items_meeting" ON "meeting_items"("meeting_id");

-- CreateIndex
CREATE INDEX "idx_mom_meeting" ON "mom_documents"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_mom_ack" ON "mom_acknowledgements"("mom_id", "attendee_id");

-- CreateIndex
CREATE INDEX "idx_ext_grants_project" ON "external_access_grants"("project_id");

-- CreateIndex
CREATE INDEX "idx_ext_grants_user" ON "external_access_grants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ext_grant" ON "external_access_grants"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_threads_project" ON "workspace_threads"("project_id");

-- CreateIndex
CREATE INDEX "idx_threads_internal" ON "workspace_threads"("is_internal");

-- CreateIndex
CREATE INDEX "idx_thread_posts_thread" ON "workspace_thread_posts"("thread_id");

-- CreateIndex
CREATE INDEX "idx_docs_project" ON "workspace_documents"("project_id");

-- CreateIndex
CREATE INDEX "idx_docs_logical" ON "workspace_documents"("logical_doc_id");

-- CreateIndex
CREATE INDEX "idx_docs_internal" ON "workspace_documents"("is_internal");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_version" ON "workspace_documents"("logical_doc_id", "version");

-- CreateIndex
CREATE INDEX "idx_offline_user" ON "offline_sync_queue"("user_id");

-- CreateIndex
CREATE INDEX "idx_offline_status" ON "offline_sync_queue"("status");

-- CreateIndex
CREATE INDEX "idx_offline_device" ON "offline_sync_queue"("device_id");

-- CreateIndex
CREATE INDEX "idx_push_subs_user" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_charters_source_order_id_key" ON "project_charters"("source_order_id");

-- CreateIndex
CREATE INDEX "idx_charters_project" ON "project_charters"("project_id");

-- CreateIndex
CREATE INDEX "idx_charters_order" ON "project_charters"("source_order_id");

-- CreateIndex
CREATE INDEX "idx_charters_status" ON "project_charters"("status");

-- CreateIndex
CREATE INDEX "idx_sow_project" ON "sow_documents"("project_id");

-- CreateIndex
CREATE INDEX "idx_sow_opportunity" ON "sow_documents"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_sow_status" ON "sow_documents"("status");

-- CreateIndex
CREATE INDEX "idx_template_tasks_template" ON "template_tasks"("template_id");

-- CreateIndex
CREATE INDEX "idx_template_tasks_parent" ON "template_tasks"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "closure_checklists_project_id_key" ON "closure_checklists"("project_id");

-- CreateIndex
CREATE INDEX "idx_checklist_items_checklist" ON "checklist_items"("checklist_id");

-- CreateIndex
CREATE INDEX "idx_checklist_items_mandatory" ON "checklist_items"("is_mandatory");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sla_contract" ON "sla_contracts"("customer_id", "priority");

-- CreateIndex
CREATE INDEX "idx_tickets_contract" ON "sla_tickets"("contract_id");

-- CreateIndex
CREATE INDEX "idx_tickets_project" ON "sla_tickets"("project_id");

-- CreateIndex
CREATE INDEX "idx_tickets_owner" ON "sla_tickets"("owner_id");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "sla_tickets"("status");

-- CreateIndex
CREATE INDEX "idx_tickets_priority" ON "sla_tickets"("priority");

-- CreateIndex
CREATE INDEX "idx_timer_events_ticket" ON "ticket_timer_events"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_ticket_updates_ticket" ON "ticket_customer_updates"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_ticket_updates_visible" ON "ticket_customer_updates"("is_customer_visible");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sla_report_period" ON "sla_compliance_reports"("customer_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "customers_primary_email_key" ON "customers"("primary_email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_zoho_contact_id_key" ON "customers"("zoho_contact_id");

-- CreateIndex
CREATE INDEX "idx_customers_email" ON "customers"("primary_email");

-- CreateIndex
CREATE INDEX "idx_customers_zoho" ON "customers"("zoho_contact_id");

-- CreateIndex
CREATE INDEX "idx_customers_status" ON "customers"("status");

-- CreateIndex
CREATE INDEX "idx_customers_type" ON "customers"("type");

-- CreateIndex
CREATE INDEX "idx_customer_contacts_customer" ON "customer_contacts"("customer_id");

-- CreateIndex
CREATE INDEX "idx_customer_contacts_user" ON "customer_contacts"("user_id");

-- CreateIndex
CREATE INDEX "idx_customer_contacts_email" ON "customer_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_primary_email_key" ON "vendors"("primary_email");

-- CreateIndex
CREATE INDEX "idx_vendors_email" ON "vendors"("primary_email");

-- CreateIndex
CREATE INDEX "idx_vendors_category" ON "vendors"("vendor_category");

-- CreateIndex
CREATE INDEX "idx_vendors_status" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "idx_vendors_type" ON "vendors"("type");

-- CreateIndex
CREATE INDEX "idx_vendor_contacts_vendor" ON "vendor_contacts"("vendor_id");

-- CreateIndex
CREATE INDEX "idx_vendor_contacts_user" ON "vendor_contacts"("user_id");

-- CreateIndex
CREATE INDEX "idx_vendor_contacts_email" ON "vendor_contacts"("email");

-- CreateIndex
CREATE INDEX "idx_project_vendors_project" ON "project_vendors"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_vendors_vendor" ON "project_vendors"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_project_vendor" ON "project_vendors"("project_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_primary_pm_id_fkey" FOREIGN KEY ("primary_pm_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_secondary_pm_id_fkey" FOREIGN KEY ("secondary_pm_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_crm_opportunity_id_fkey" FOREIGN KEY ("crm_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_domains" ADD CONSTRAINT "project_domains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_domains" ADD CONSTRAINT "project_domains_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "security_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_updates" ADD CONSTRAINT "task_progress_updates_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_updates" ADD CONSTRAINT "task_progress_updates_engineer_id_fkey" FOREIGN KEY ("engineer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_updates" ADD CONSTRAINT "task_progress_updates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "project_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "project_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_costs" ADD CONSTRAINT "employee_costs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_costs" ADD CONSTRAINT "employee_costs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_matched_milestone_id_fkey" FOREIGN KEY ("matched_milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_sync_records" ADD CONSTRAINT "failed_sync_records_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_recipients" ADD CONSTRAINT "alert_rule_recipients_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_recipients" ADD CONSTRAINT "alert_rule_recipients_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_escalations" ADD CONSTRAINT "customer_escalations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_escalations" ADD CONSTRAINT "customer_escalations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_escalations" ADD CONSTRAINT "customer_escalations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_communications" ADD CONSTRAINT "escalation_communications_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "customer_escalations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_communications" ADD CONSTRAINT "escalation_communications_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_points" ADD CONSTRAINT "action_points_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_points" ADD CONSTRAINT "action_points_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_rule_configs" ADD CONSTRAINT "health_rule_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedule_recipients" ADD CONSTRAINT "report_schedule_recipients_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedule_recipients" ADD CONSTRAINT "report_schedule_recipients_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedule_recipients" ADD CONSTRAINT "report_schedule_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_flags" ADD CONSTRAINT "data_quality_flags_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_items" ADD CONSTRAINT "meeting_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_items" ADD CONSTRAINT "meeting_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mom_documents" ADD CONSTRAINT "mom_documents_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mom_documents" ADD CONSTRAINT "mom_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mom_acknowledgements" ADD CONSTRAINT "mom_acknowledgements_mom_id_fkey" FOREIGN KEY ("mom_id") REFERENCES "mom_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mom_acknowledgements" ADD CONSTRAINT "mom_acknowledgements_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_access_grants" ADD CONSTRAINT "external_access_grants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_access_grants" ADD CONSTRAINT "external_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_access_grants" ADD CONSTRAINT "external_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_threads" ADD CONSTRAINT "workspace_threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_threads" ADD CONSTRAINT "workspace_threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_thread_posts" ADD CONSTRAINT "workspace_thread_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "workspace_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_thread_posts" ADD CONSTRAINT "workspace_thread_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sow_documents" ADD CONSTRAINT "sow_documents_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "template_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_checklists" ADD CONSTRAINT "closure_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_checklists" ADD CONSTRAINT "closure_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "closure_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_contracts" ADD CONSTRAINT "sla_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_tickets" ADD CONSTRAINT "sla_tickets_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sla_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_tickets" ADD CONSTRAINT "sla_tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_tickets" ADD CONSTRAINT "sla_tickets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_timer_events" ADD CONSTRAINT "ticket_timer_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sla_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_timer_events" ADD CONSTRAINT "ticket_timer_events_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_customer_updates" ADD CONSTRAINT "ticket_customer_updates_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sla_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_customer_updates" ADD CONSTRAINT "ticket_customer_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_compliance_reports" ADD CONSTRAINT "sla_compliance_reports_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_relationship_manager_id_fkey" FOREIGN KEY ("relationship_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_vendors" ADD CONSTRAINT "project_vendors_internal_contact_id_fkey" FOREIGN KEY ("internal_contact_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
