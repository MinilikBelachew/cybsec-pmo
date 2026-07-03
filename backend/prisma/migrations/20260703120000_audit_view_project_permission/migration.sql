-- Split project-scoped audit from system-wide audit trail.
INSERT INTO "permissions" ("module", "action")
VALUES ('audit', 'view_project')
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "record_scope")
SELECT grants.role_id, p.id, grants.record_scope
FROM (
  VALUES
    (3, 'all'),
    (4, 'own_projects'),
    (5, 'team')
) AS grants(role_id, record_scope)
INNER JOIN "permissions" p
  ON p."module" = 'audit' AND p."action" = 'view_project'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "record_scope" = EXCLUDED."record_scope";
