-- AlterTable
ALTER TABLE "departments" ADD COLUMN "keka_department_id" VARCHAR(100);

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "employee_number" VARCHAR(50),
ADD COLUMN "first_name" VARCHAR(100),
ADD COLUMN "last_name" VARCHAR(100),
ADD COLUMN "display_name" VARCHAR(255),
ADD COLUMN "keka_department_group_id" VARCHAR(100),
ADD COLUMN "job_title_identifier" VARCHAR(100),
ADD COLUMN "reports_to_keka_id" VARCHAR(100),
ADD COLUMN "time_type" INTEGER,
ADD COLUMN "worker_type" INTEGER,
ADD COLUMN "shift_policy_identifier" VARCHAR(100),
ADD COLUMN "weekly_off_policy_identifier" VARCHAR(100),
ADD COLUMN "attendance_number" VARCHAR(100),
ADD COLUMN "employment_status" INTEGER,
ADD COLUMN "joining_date" DATE,
ADD COLUMN "exit_date" DATE;

-- AlterTable
ALTER TABLE "leave_records" ADD COLUMN "keka_status" INTEGER,
ADD COLUMN "from_session" INTEGER,
ADD COLUMN "to_session" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "departments_keka_department_id_key" ON "departments"("keka_department_id");

-- CreateIndex
CREATE INDEX "idx_employees_employee_number" ON "employees"("employee_number");

-- CreateIndex
CREATE INDEX "idx_employees_keka_dept_group" ON "employees"("keka_department_group_id");
