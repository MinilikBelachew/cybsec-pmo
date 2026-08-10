-- CreateTable
CREATE TABLE "keka_connection_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "company_subdomain" VARCHAR(100),
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "auth_url" VARCHAR(500),
    "api_base_url" VARCHAR(500),
    "client_id_encrypted" TEXT,
    "client_secret_encrypted" TEXT,
    "api_key_encrypted" TEXT,
    "last_tested_at" TIMESTAMPTZ,
    "last_test_status" VARCHAR(20),
    "last_test_error" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "keka_connection_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "keka_connection_settings"
  ADD CONSTRAINT "keka_connection_settings_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
