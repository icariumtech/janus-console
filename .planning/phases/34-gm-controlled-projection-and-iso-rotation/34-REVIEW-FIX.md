---
phase: 34-gm-controlled-projection-and-iso-rotation
fixed_at: 2026-10-15T00:00:00Z
review_path: /home/gjohnson/src/janus-console/.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-10-15
**Source review:** /home/gjohnson/src/janus-console/.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

Verification ran in the main checkout (no worktree, per instructions): `pnpm run build` passes, `pnpm exec vitest run` 413 tests passed (16 files), `SECRET_KEY=x .venv/bin/python manage.py test core` 184 tests OK (3 skipped).

## Fixed Issues

### WR-02: `build()` broadcasts unvalidated stored projection and offset

**Files modified:** `core/active_view_store.py`, `core/tests/test_active_view_store.py`
**Commit:** e883546
**Applied fix:** Added `normalize_view_fields()` to the store and applied it at the end of `_load_from_disk`, so a stored projection outside `PROJECTIONS` or an offset outside `ROTATION_OFFSETS` (non-int, bool, off-grid) falls back to its default independently. Added tests for invalid and valid stored values. No schema change needed (the schema does not document persisted state semantics).

### WR-01: `rotate_view` trusts the stored offset and does a non-atomic read-modify-write

**Files modified:** `core/active_view_store.py`, `core/encounter_state.py`, `core/views/active_view.py`, `core/tests/test_active_view_store.py`, `core/tests/test_encounter_state.py`
**Commit:** 404a344
**Applied fix:** Added `update_state_fn(fn)` to the store (runs `fn(copy_of_state)` and the write under `_lock`) and `sync_state_fn(fn)` to `core/views/active_view.py`. `rotate_view` now computes the step inside the lock via `_sync_fn`, and treats an off-grid or non-int stored offset as 0. Tests cover lock-held computation, state copy isolation, exception safety and bad stored offsets. Status: fixed, requires human verification (logic change in concurrency semantics; covered by tests but not exercised under a real multi-worker setup).

---

_Fixed: 2026-10-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
