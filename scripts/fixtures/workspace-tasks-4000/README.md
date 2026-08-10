# Workspace load fixtures — 20,000 tasks

Target project: **DLP & DC Project Plan** (`descount.mpp`), dates `2026-04-01` … `2026-09-16`.

## Excel — Import Tasks

| File | Purpose |
|------|---------|
| `workspace-phases-20000.xlsx` | Optional — project already has these 4 phases |
| `workspace-tasks-20000.xlsx` | **Import Tasks** file (20 000 rows) |

Phase names in the Excel **must match** existing project phases:

| Phase | Window | Tasks |
|-------|--------|------:|
| Phase 1 - Project Initiation & Planning | 2026-04-01 … 2026-04-02 | 2 000 |
| Phase 2- Design & Documentation | 2026-04-05 … 2026-04-29 | 4 000 |
| Phase 3- Implementation & UAT | 2026-06-29 … 2026-09-13 | 12 000 |
| Phase 4- Project Closure | 2026-09-13 … 2026-09-16 | 2 000 |

Every task start/end is clamped inside its phase window.

## MPP / XML — Import MPP

| File | Purpose |
|------|---------|
| `workspace-mpp-20000.xml` | Separate load-test MPP (generic workstream phases) |

## Regenerate Excel for DLP project

```bash
python scripts/fixtures/workspace-tasks-4000/gen-workspace-tasks-4000.py
```
