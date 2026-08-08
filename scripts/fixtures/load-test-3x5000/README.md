# Load-test fixtures — 3 projects × 5000 tasks

Stress fixtures for large MPP/Excel import (phases, milestones, FS dependencies).

## Files

| File | Use |
|------|-----|
| `load-test-3x5000-portfolio.xml` | **Projects → Import MPP** |
| `load-test-3x5000-portfolio.xlsx` | **Projects → Import** Excel |

## Contents

- **3 projects:** `LoadTest Gamma`, `LoadTest Delta`, `LoadTest Epsilon`
- **Per project:** 20 phases, **5000 tasks**, 20 milestones
- **Dependencies:** FS link every 10th leaf task within a project

## Regenerate

```bash
python scripts/fixtures/load-test-3x5000/gen-load-test-3x5000.py
```

## Note

Expect long import times. Backend MPP persist transaction timeout is raised for large files; Nginx `proxy_read_timeout` may also need to be high for this size.
