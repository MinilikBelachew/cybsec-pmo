-- MSP Task Mode + Constraint Type/Date for schedule round-trip.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "msp_task_mode" VARCHAR(16);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "msp_constraint_type" VARCHAR(16);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "msp_constraint_date" DATE;
