-- M2.3 Leave & backup: named backup resources on allocations and tasks

ALTER TABLE "allocations"
ADD COLUMN "backup_employee_id" UUID;

ALTER TABLE "tasks"
ADD COLUMN "backup_owner_id" UUID;

ALTER TABLE "allocations"
ADD CONSTRAINT "allocations_backup_employee_id_fkey"
FOREIGN KEY ("backup_employee_id") REFERENCES "employees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_backup_owner_id_fkey"
FOREIGN KEY ("backup_owner_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_allocations_backup" ON "allocations"("backup_employee_id");
CREATE INDEX "idx_tasks_backup_owner" ON "tasks"("backup_owner_id");
