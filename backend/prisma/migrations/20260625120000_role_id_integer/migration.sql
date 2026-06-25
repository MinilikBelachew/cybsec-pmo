-- Convert role IDs from UUID to integer (1–11 fixed, sequence continues at 12+)

-- 1) Map stable integer IDs on roles
ALTER TABLE "roles" ADD COLUMN "id_int" INTEGER;

UPDATE "roles" SET "id_int" = 1 WHERE "code" = 'super_admin';
UPDATE "roles" SET "id_int" = 2 WHERE "code" = 'it_admin';
UPDATE "roles" SET "id_int" = 3 WHERE "code" = 'pmo_lead';
UPDATE "roles" SET "id_int" = 4 WHERE "code" = 'pm';
UPDATE "roles" SET "id_int" = 5 WHERE "code" = 'team_lead';
UPDATE "roles" SET "id_int" = 6 WHERE "code" = 'engineer';
UPDATE "roles" SET "id_int" = 7 WHERE "code" = 'finance';
UPDATE "roles" SET "id_int" = 8 WHERE "code" = 'hr';
UPDATE "roles" SET "id_int" = 9 WHERE "code" = 'sales';
UPDATE "roles" SET "id_int" = 10 WHERE "code" = 'client';
UPDATE "roles" SET "id_int" = 11 WHERE "code" = 'vendor';

ALTER TABLE "roles" ALTER COLUMN "id_int" SET NOT NULL;

-- 2) Users
ALTER TABLE "users" ADD COLUMN "role_id_int" INTEGER;

UPDATE "users" u
SET "role_id_int" = r."id_int"
FROM "roles" r
WHERE u."role_id" = r."id";

ALTER TABLE "users" ALTER COLUMN "role_id_int" SET NOT NULL;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_id_fkey";
DROP INDEX IF EXISTS "idx_users_role";
ALTER TABLE "users" DROP COLUMN "role_id";
ALTER TABLE "users" RENAME COLUMN "role_id_int" TO "role_id";

CREATE INDEX "idx_users_role" ON "users"("role_id");

-- 3) Permissions
ALTER TABLE "permissions" ADD COLUMN "role_id_int" INTEGER;

UPDATE "permissions" p
SET "role_id_int" = r."id_int"
FROM "roles" r
WHERE p."role_id" = r."id";

ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_role_id_fkey";
DROP INDEX IF EXISTS "idx_permissions_role_module";
DROP INDEX IF EXISTS "uq_permissions_role_module_action";
ALTER TABLE "permissions" DROP COLUMN "role_id";
ALTER TABLE "permissions" RENAME COLUMN "role_id_int" TO "role_id";

CREATE INDEX "idx_permissions_role_module" ON "permissions"("role_id", "module", "action");
CREATE UNIQUE INDEX "uq_permissions_role_module_action" ON "permissions"("role_id", "module", "action");

-- 4) Alert rule recipients
ALTER TABLE "alert_rule_recipients" ADD COLUMN "role_id_int" INTEGER;

UPDATE "alert_rule_recipients" arr
SET "role_id_int" = r."id_int"
FROM "roles" r
WHERE arr."role_id" = r."id";

ALTER TABLE "alert_rule_recipients" DROP CONSTRAINT IF EXISTS "alert_rule_recipients_role_id_fkey";
DROP INDEX IF EXISTS "uq_alert_rule_recipient";
ALTER TABLE "alert_rule_recipients" DROP COLUMN "role_id";
ALTER TABLE "alert_rule_recipients" RENAME COLUMN "role_id_int" TO "role_id";

CREATE UNIQUE INDEX "uq_alert_rule_recipient" ON "alert_rule_recipients"("rule_id", "role_id");

-- 5) Report schedule recipients
ALTER TABLE "report_schedule_recipients" ADD COLUMN "role_id_int" INTEGER;

UPDATE "report_schedule_recipients" rsr
SET "role_id_int" = r."id_int"
FROM "roles" r
WHERE rsr."role_id" = r."id";

ALTER TABLE "report_schedule_recipients" DROP CONSTRAINT IF EXISTS "report_schedule_recipients_role_id_fkey";
ALTER TABLE "report_schedule_recipients" DROP COLUMN "role_id";
ALTER TABLE "report_schedule_recipients" RENAME COLUMN "role_id_int" TO "role_id";

-- 6) Roles PK swap UUID -> integer + autoincrement sequence
ALTER TABLE "roles" DROP CONSTRAINT "roles_pkey";
DROP INDEX IF EXISTS "roles_id_key";
ALTER TABLE "roles" DROP COLUMN "id";
ALTER TABLE "roles" RENAME COLUMN "id_int" TO "id";
ALTER TABLE "roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");

CREATE SEQUENCE IF NOT EXISTS "roles_id_seq" AS INTEGER OWNED BY "roles"."id";
ALTER TABLE "roles" ALTER COLUMN "id" SET DEFAULT nextval('"roles_id_seq"');
SELECT setval('"roles_id_seq"', (SELECT COALESCE(MAX("id"), 1) FROM "roles"), true);

-- 7) Re-add foreign keys
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_rule_recipients" ADD CONSTRAINT "alert_rule_recipients_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_schedule_recipients" ADD CONSTRAINT "report_schedule_recipients_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
