-- AlterTable
ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "account_name" VARCHAR(255);
