-- Mandatory override reason when over-allocation proceeds under warn/approve policy
ALTER TABLE "allocations"
  ADD COLUMN "override_reason" TEXT;
