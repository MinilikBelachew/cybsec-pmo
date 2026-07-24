ALTER TABLE "tasks"
  ADD COLUMN "is_phase_gate" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_tasks_phase_gate" ON "tasks"("phase_id", "is_phase_gate");

-- At most one phase-gate task per phase (top-level only enforced in app).
CREATE UNIQUE INDEX "uq_tasks_one_phase_gate_per_phase"
  ON "tasks"("phase_id")
  WHERE "is_phase_gate" = true AND "phase_id" IS NOT NULL;
