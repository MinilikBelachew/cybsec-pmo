-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('Planned', 'Active', 'Completed', 'On Hold');

-- AlterTable
ALTER TABLE "project_milestones" ADD COLUMN     "phase_id" UUID;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "phase_id" UUID;

-- CreateTable
CREATE TABLE "project_phases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "color" VARCHAR(20),
    "status" "PhaseStatus" NOT NULL DEFAULT 'Planned',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_phases_project" ON "project_phases"("project_id");

-- CreateIndex
CREATE INDEX "idx_milestones_phase" ON "project_milestones"("phase_id");

-- CreateIndex
CREATE INDEX "idx_tasks_phase" ON "tasks"("phase_id");

-- AddForeignKey
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
