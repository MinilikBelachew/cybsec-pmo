CREATE TABLE "app_settings" (
    "id" VARCHAR(32) NOT NULL,
    "audit_retention_months" INTEGER NOT NULL DEFAULT 12,
    "audit_export_max_rows" INTEGER NOT NULL DEFAULT 10000,
    "audit_export_excel_json_cell_limit" INTEGER NOT NULL DEFAULT 30000,
    "audit_export_pdf_json_limit" INTEGER NOT NULL DEFAULT 800,
    "audit_archive_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_audit_archive_at" TIMESTAMPTZ,
    "last_audit_archive_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "audit_logs_archive" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "object_type" VARCHAR(100) NOT NULL,
    "object_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "break_glass_action" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL,
    "archived_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_archive_actor" ON "audit_logs_archive"("actor_id");
CREATE INDEX "idx_audit_archive_created" ON "audit_logs_archive"("created_at");
CREATE INDEX "idx_audit_archive_archived" ON "audit_logs_archive"("archived_at");
