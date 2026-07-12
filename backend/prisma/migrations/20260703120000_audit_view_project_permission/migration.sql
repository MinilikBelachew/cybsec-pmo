-- Split project-scoped audit from system-wide audit trail.
INSERT INTO "permissions" ("module", "action")
VALUES ('audit', 'view_project')
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "record_scope")
SELECT r.id, p.id, grants.record_scope
FROM (
  VALUES
    ('pmo_lead', 'all'),
    ('pm', 'own_projects'),
    ('team_lead', 'team')
) AS grants(role_code, record_scope)
INNER JOIN "roles" r ON r."code" = grants.role_code
INNER JOIN "permissions" p
  ON p."module" = 'audit' AND p."action" = 'view_project'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "record_scope" = EXCLUDED."record_scope";
