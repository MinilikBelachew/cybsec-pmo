-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "keka_project_id" VARCHAR(100),
ADD COLUMN     "keka_client_id" VARCHAR(100),
ADD COLUMN     "keka_project_code" VARCHAR(100),
ADD COLUMN     "keka_synced_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "keka_task_id" VARCHAR(100),
ADD COLUMN     "keka_synced_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "projects_keka_project_id_key" ON "projects"("keka_project_id");

-- CreateIndex
CREATE INDEX "idx_projects_keka_client" ON "projects"("keka_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_keka_task_id_key" ON "tasks"("keka_task_id");
