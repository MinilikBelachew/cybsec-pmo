-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "setup_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setup_completed_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "entra_connection_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "tenant_id" VARCHAR(128),
    "client_id_encrypted" TEXT,
    "client_secret_encrypted" TEXT,
    "redirect_uri" VARCHAR(500),
    "last_tested_at" TIMESTAMPTZ,
    "last_test_status" VARCHAR(20),
    "last_test_error" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "entra_connection_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_connection_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "sendgrid_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sendgrid_api_key_encrypted" TEXT,
    "smtp_host" VARCHAR(255),
    "smtp_port" INTEGER,
    "smtp_user" VARCHAR(255),
    "smtp_password_encrypted" TEXT,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "smtp_ignore_tls" BOOLEAN NOT NULL DEFAULT false,
    "smtp_require_tls" BOOLEAN NOT NULL DEFAULT false,
    "default_email" VARCHAR(255),
    "default_name" VARCHAR(255),
    "last_tested_at" TIMESTAMPTZ,
    "last_test_status" VARCHAR(20),
    "last_test_error" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "mail_connection_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "entra_connection_settings" ADD CONSTRAINT "entra_connection_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_connection_settings" ADD CONSTRAINT "mail_connection_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
