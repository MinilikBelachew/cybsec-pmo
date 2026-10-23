-- AlterTable: phase schedule twin (MPP summary row)
ALTER TABLE "project_phases" ADD COLUMN "task_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "project_phases_task_id_key" ON "project_phases"("task_id");

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: MSP-style display row id
ALTER TABLE "tasks" ADD COLUMN "plan_row_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_tasks_project_plan_row" ON "tasks"("project_id", "plan_row_id");
