SELECT id, name, end_date
FROM projects
WHERE name ILIKE '%DLP%' OR name ILIKE '%DCS%'
ORDER BY updated_at DESC
LIMIT 5;

\echo --- task counts ---
WITH p AS (
  SELECT id, name, end_date
  FROM projects
  WHERE name ILIKE '%DLP%' OR name ILIKE '%DCS%'
  ORDER BY updated_at DESC
  LIMIT 1
)
SELECT
  p.name,
  p.end_date,
  COUNT(t.*)::int AS all_tasks,
  COUNT(*) FILTER (WHERE t.parent_task_id IS NULL)::int AS top_level,
  COUNT(*) FILTER (WHERE t.parent_task_id IS NOT NULL)::int AS nested,
  COUNT(*) FILTER (WHERE t.status = 'To_Do')::int AS to_do,
  COUNT(*) FILTER (WHERE t.status = 'In_Progress')::int AS in_progress,
  COUNT(*) FILTER (WHERE t.status = 'Done')::int AS done,
  COUNT(*) FILTER (WHERE t.status = 'Approved')::int AS approved,
  COUNT(*) FILTER (WHERE t.status = 'Done' AND t.parent_task_id IS NULL)::int AS done_top,
  COUNT(*) FILTER (WHERE t.status = 'Done' AND t.parent_task_id IS NOT NULL)::int AS done_nested
FROM p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.end_date;

\echo --- phases / milestones ---
WITH p AS (
  SELECT id FROM projects
  WHERE name ILIKE '%DLP%' OR name ILIKE '%DCS%'
  ORDER BY updated_at DESC LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM project_phases ph WHERE ph.project_id = p.id) AS phases,
  (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id) AS milestones
FROM p;

\echo --- done titles ---
WITH p AS (
  SELECT id FROM projects
  WHERE name ILIKE '%DLP%' OR name ILIKE '%DCS%'
  ORDER BY updated_at DESC LIMIT 1
)
SELECT t.title, t.status,
  CASE WHEN t.parent_task_id IS NULL THEN 'TOP' ELSE 'NESTED' END AS level
FROM tasks t, p
WHERE t.project_id = p.id AND t.status = 'Done'
ORDER BY t.title;
