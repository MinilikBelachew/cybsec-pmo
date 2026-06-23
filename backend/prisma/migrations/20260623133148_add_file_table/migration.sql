-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path" VARCHAR NOT NULL,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);
