-- DropForeignKey
ALTER TABLE "template_tasks" DROP CONSTRAINT "template_tasks_template_id_fkey";

-- AlterTable
ALTER TABLE "project_templates" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "template_tasks" ADD COLUMN     "effort_hours" INTEGER,
ADD COLUMN     "template_phase_id" UUID;

-- CreateTable
CREATE TABLE "template_phases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "relative_start_days" INTEGER NOT NULL DEFAULT 0,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "template_phase_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "relative_target_days" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_template_phases_template" ON "template_phases"("template_id");

-- CreateIndex
CREATE INDEX "idx_template_milestones_template" ON "template_milestones"("template_id");

-- CreateIndex
CREATE INDEX "idx_template_milestones_phase" ON "template_milestones"("template_phase_id");

-- CreateIndex
CREATE INDEX "idx_template_tasks_phase" ON "template_tasks"("template_phase_id");

-- AddForeignKey
ALTER TABLE "template_phases" ADD CONSTRAINT "template_phases_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_milestones" ADD CONSTRAINT "template_milestones_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_milestones" ADD CONSTRAINT "template_milestones_template_phase_id_fkey" FOREIGN KEY ("template_phase_id") REFERENCES "template_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_template_phase_id_fkey" FOREIGN KEY ("template_phase_id") REFERENCES "template_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
