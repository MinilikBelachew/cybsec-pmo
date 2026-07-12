-- AlterEnum
CREATE TYPE "ProjectMethodology" AS ENUM ('Agile', 'Waterfall', 'Hybrid');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "methodology" "ProjectMethodology" NOT NULL DEFAULT 'Agile';
