-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN "task_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_task_id_key" ON "project_milestones"("task_id");

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
