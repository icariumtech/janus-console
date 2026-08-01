# Deferred Items — Phase 31

Out-of-scope discoveries logged during execution (not fixed, per Scope Boundary rule).

## 31-03 Task 1: `core/tests/test_gm_api.py` leaks a real-file artifact into `data/`

**Found during:** Running `.venv/bin/python manage.py test core.tests -v 2` as this task's own
verification gate (whole-suite regression check, unrelated to `test_deckplan_passthrough.py`).

**Issue:** `core/tests/test_gm_api.py`'s write-path tests (`test_write_file_invalid_yaml_returns_400`,
`test_write_file_path_traversal_blocked`, and/or others exercising `PUT /api/gm/data/test_stub.md`)
write against the real `DATA_DIR` instead of a mocked/temp directory, leaving an untracked
`data/test_stub.md` behind after the run (confirmed via file mtime matching the test-run time).
One of that file's own tests is already marked `@unittest.skip("requires writable DATA_DIR")`,
suggesting the author was aware writes need isolation but didn't apply it consistently across all
methods in that class.

**Why deferred:** Pre-existing bug in a file (`core/tests/test_gm_api.py`) not touched by this
plan's `<files>` list (`core/tests/test_deckplan_passthrough.py`, `core/payload_builder.py`,
`core/encounter_utils.py`, `core/views/encounter.py`). Out of scope per the Scope Boundary rule.

**Action taken:** Removed the stray `data/test_stub.md` artifact (untracked test debris, not
authored campaign content) so it doesn't pollute the real data directory or get mistaken for
real content. Did NOT fix the underlying test isolation bug in `test_gm_api.py`.

**Suggested follow-up:** A future small task should give `test_gm_api.py`'s write/patch tests a
temp `DATA_DIR` override (e.g. `override_settings(DATA_DIR=...)` with `tempfile.TemporaryDirectory`)
so they stop touching the real `data/` directory.
