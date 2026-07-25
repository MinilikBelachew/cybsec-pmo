-- MSP Resource Names round-trip (comma-separated "Name (Org)" from Project).
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "resource_names" VARCHAR(1000);
