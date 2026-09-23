-- M5.2: cost formula setting + idempotent employee cost ledger
ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "cost_formula" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "employee_cost_timesheets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "employee_cost_id" UUID NOT NULL,
  "timesheet_id" UUID NOT NULL,
  "regular_hours" DECIMAL(7,2) NOT NULL,
  "overtime_hours" DECIMAL(7,2) NOT NULL,
  "rate_per_hour" DECIMAL(10,4) NOT NULL,
  "ot_multiplier" DECIMAL(5,2) NOT NULL,
  "line_cost" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "employee_cost_timesheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_cost_timesheets_timesheet_id_key"
  ON "employee_cost_timesheets"("timesheet_id");
CREATE INDEX IF NOT EXISTS "idx_emp_cost_ts_cost"
  ON "employee_cost_timesheets"("employee_cost_id");

ALTER TABLE "employee_cost_timesheets"
  ADD CONSTRAINT "employee_cost_timesheets_employee_cost_id_fkey"
  FOREIGN KEY ("employee_cost_id") REFERENCES "employee_costs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_cost_timesheets"
  ADD CONSTRAINT "employee_cost_timesheets_timesheet_id_fkey"
  FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
