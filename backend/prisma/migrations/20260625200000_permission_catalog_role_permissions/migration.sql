-- Normalize permissions: catalog table + role_permissions join table.

-- 1. Preserve existing grants while rebuilding structure
ALTER TABLE "permissions" RENAME TO "permissions_legacy";

ALTER INDEX IF EXISTS "uq_permissions_role_module_action" RENAME TO "uq_permissions_legacy_role_module_action";
ALTER INDEX IF EXISTS "idx_permissions_role_module" RENAME TO "idx_permissions_legacy_role_module";

ALTER TABLE "permissions_legacy" RENAME CONSTRAINT "permissions_pkey" TO "permissions_legacy_pkey";
ALTER TABLE "permissions_legacy" RENAME CONSTRAINT "permissions_role_id_fkey" TO "permissions_legacy_role_id_fkey";

-- 2. Canonical permission catalog (module + action only)
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_permissions_module_action" ON "permissions"("module", "action");
CREATE INDEX "idx_permissions_module_action" ON "permissions"("module", "action");

INSERT INTO "permissions" ("module", "action")
SELECT DISTINCT "module", "action"
FROM "permissions_legacy"
ORDER BY "module", "action";

-- 3. Role ↔ permission grants (scopes live on the join row)
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" INTEGER NOT NULL,
    "permission_id" UUID NOT NULL,
    "record_scope" VARCHAR(50),
    "field_scope" JSONB,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_role_permissions_role_permission" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("role_id");
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions"("permission_id");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "role_permissions" ("role_id", "permission_id", "record_scope", "field_scope")
SELECT
  legacy."role_id",
  catalog."id",
  legacy."record_scope",
  legacy."field_scope"
FROM "permissions_legacy" legacy
INNER JOIN "permissions" catalog
  ON catalog."module" = legacy."module"
 AND catalog."action" = legacy."action";

-- 4. Drop legacy flat table
DROP TABLE "permissions_legacy";
