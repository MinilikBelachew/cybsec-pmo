-- AlterTable
ALTER TABLE "customers" ADD COLUMN "keka_client_id" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "keka_client_code" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "keka_synced_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "customers_keka_client_id_key" ON "customers"("keka_client_id");
CREATE INDEX "idx_customers_keka_code" ON "customers"("keka_client_code");
