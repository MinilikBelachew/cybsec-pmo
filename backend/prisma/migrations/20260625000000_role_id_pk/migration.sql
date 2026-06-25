-- Role PK migration: code -> id UUID, relate users/permissions by role_id

-- 1) Add id column to roles and assign stable UUIDs
ALTER TABLE "roles" ADD COLUMN "id" UUID;

UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000001' WHERE "code" = 'super_admin';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000002' WHERE "code" = 'it_admin';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000003' WHERE "code" = 'pmo_lead';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000004' WHERE "code" = 'pm';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000005' WHERE "code" = 'team_lead';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000006' WHERE "code" = 'engineer';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000007' WHERE "code" = 'finance';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000008' WHERE "code" = 'hr';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000009' WHERE "code" = 'sales';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000010' WHERE "code" = 'client';
UPDATE "roles" SET "id" = 'a0000001-0000-4000-8000-000000000011' WHERE "code" = 'vendor';

ALTER TABLE "roles" ALTER COLUMN "id" SET NOT NULL;
CREATE UNIQUE INDEX "roles_id_key" ON "roles"("id");

-- 2) Users: role_code -> role_id
ALTER TABLE "users" ADD COLUMN "role_id" UUID;

UPDATE "users" u
SET "role_id" = r."id"
FROM "roles" r
WHERE u."role_code" = r."code";

ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_code_fkey";
DROP INDEX IF EXISTS "idx_users_role";
ALTER TABLE "users" DROP COLUMN "role_code";

CREATE INDEX "idx_users_role" ON "users"("role_id");
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Permissions: role_code -> role_id
ALTER TABLE "permissions" ADD COLUMN "role_id" UUID;

UPDATE "permissions" p
SET "role_id" = r."id"
FROM "roles" r
WHERE p."role_code" = r."code";

ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_role_code_fkey";
DROP INDEX IF EXISTS "idx_permissions_role_module";
ALTER TABLE "permissions" DROP COLUMN "role_code";

CREATE INDEX "idx_permissions_role_module" ON "permissions"("role_id", "module", "action");
CREATE UNIQUE INDEX "uq_permissions_role_module_action" ON "permissions"("role_id", "module", "action");

ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Alert rule recipients
ALTER TABLE "alert_rule_recipients" ADD COLUMN "role_id" UUID;

UPDATE "alert_rule_recipients" arr
SET "role_id" = r."id"
FROM "roles" r
WHERE arr."role_code" = r."code";

ALTER TABLE "alert_rule_recipients" DROP CONSTRAINT IF EXISTS "alert_rule_recipients_role_code_fkey";
DROP INDEX IF EXISTS "uq_alert_rule_recipient";
ALTER TABLE "alert_rule_recipients" DROP COLUMN "role_code";

CREATE UNIQUE INDEX "uq_alert_rule_recipient" ON "alert_rule_recipients"("rule_id", "role_id");
ALTER TABLE "alert_rule_recipients" ADD CONSTRAINT "alert_rule_recipients_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Report schedule recipients
ALTER TABLE "report_schedule_recipients" ADD COLUMN "role_id" UUID;

UPDATE "report_schedule_recipients" rsr
SET "role_id" = r."id"
FROM "roles" r
WHERE rsr."role_code" = r."code";

ALTER TABLE "report_schedule_recipients" DROP CONSTRAINT IF EXISTS "report_schedule_recipients_role_code_fkey";
ALTER TABLE "report_schedule_recipients" DROP COLUMN "role_code";

ALTER TABLE "report_schedule_recipients" ADD CONSTRAINT "report_schedule_recipients_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Roles PK swap (code was PK; id is now PK, code stays unique)
ALTER TABLE "roles" DROP CONSTRAINT "roles_pkey";
ALTER TABLE "roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
