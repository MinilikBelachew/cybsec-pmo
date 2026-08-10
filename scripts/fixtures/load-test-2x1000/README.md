# Load-test fixtures — 2 projects × 1000 tasks

Stress fixtures to reproduce large parallel imports (no code fix required to use).

## Files

| File | Use |
|------|-----|
| `load-test-2x1000-portfolio.xml` | **Projects → Import MPP** (MSPDI / Project XML) |
| `load-test-2x1000-portfolio.xlsx` | **Projects → Import** Excel (Projects + Phases / Tasks / Milestones) |

## Contents

- **2 projects:** `LoadTest Alpha`, `LoadTest Beta`
- **Per project:** 10 phases, **1000 tasks**, 10 milestones (one per phase)
- Excel sheet names stay under Excel’s 31-char limit (`LoadTest Alpha Tasks`, etc.)

## Regenerate

```bash
python scripts/fixtures/load-test-2x1000/gen-load-test-2x1000.py
```

## Suggested UAT

1. Import **one** file once — measure time / UI responsiveness.
2. Then open **multiple browsers** and import the same large file in parallel (what the tester did).
3. Confirm whether the app slows and whether the session / access drops.
