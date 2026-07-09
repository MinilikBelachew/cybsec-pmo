-- AlterTable
ALTER TABLE "employees" ADD COLUMN "profile_image_file_name" VARCHAR(255),
ADD COLUMN "profile_image_thumbs" JSONB,
ADD COLUMN "profile_image_url" VARCHAR(500);
