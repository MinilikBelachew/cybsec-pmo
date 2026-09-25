-- Invoice Books fields + optional project link (manual / unique-customer)

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_project_id_fkey";

ALTER TABLE "invoices"
  ALTER COLUMN "project_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "reference_number" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "balance" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "payment_made" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "invoice_date" DATE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
