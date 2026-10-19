SELECT unnest(enum_range(NULL::"TaskStatus")) AS status;

WITH p AS (
  SELECT id, name, end_date
  FROM projects
  WHERE id = '3fc497c2-f016-438b-9b97-ee6389e3de9b'
)
SELECT
  COUNT(*)::int AS all_tasks,
  COUNT(*) FILTER (WHERE parent_task_id IS NULL)::int AS top_level,
  COUNT(*) FILTER (WHERE parent_task_id IS NOT NULL)::int AS nested
FROM tasks t, p WHERE t.project_id = p.id;

WITH p AS (SELECT id FROM projects WHERE id = '3fc497c2-f016-438b-9b97-ee6389e3de9b')
SELECT t.status::text, COUNT(*)::int AS cnt,
  COUNT(*) FILTER (WHERE parent_task_id IS NULL)::int AS top,
  COUNT(*) FILTER (WHERE parent_task_id IS NOT NULL)::int AS nest
FROM tasks t, p WHERE t.project_id = p.id
GROUP BY t.status ORDER BY t.status;

SELECT COUNT(*) AS phases FROM project_phases WHERE project_id = '3fc497c2-f016-438b-9b97-ee6389e3de9b';
SELECT COUNT(*) AS milestones FROM project_milestones WHERE project_id = '3fc497c2-f016-438b-9b97-ee6389e3de9b';

-- schedule milestone linked tasks?
SELECT COUNT(*) AS schedule_ms_tasks
FROM tasks t
LEFT JOIN schedule_milestones sm ON sm.task_id = t.id
WHERE t.project_id = '3fc497c2-f016-438b-9b97-ee6389e3de9b' AND sm.id IS NOT NULL;
