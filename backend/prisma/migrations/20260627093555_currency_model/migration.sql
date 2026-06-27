/*
  Warnings:

  - The `currency` column on the `invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `project_budgets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `project_vendors` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `currency` column on the `projects` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "id" SET DEFAULT 'default',
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "currency",
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "project_budgets" DROP COLUMN "currency",
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "project_vendors" DROP COLUMN "currency",
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "currency",
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD';

-- DropEnum
DROP TYPE "CurrencyCode";

-- CreateTable
CREATE TABLE "currencies" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "number" VARCHAR(3) NOT NULL,
    "subunits_in_unit" INTEGER NOT NULL,
    "symbol" VARCHAR(10),

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);
