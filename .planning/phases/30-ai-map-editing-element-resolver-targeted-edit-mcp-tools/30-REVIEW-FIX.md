---
phase: 30-ai-map-editing-element-resolver-targeted-edit-mcp-tools
fixed_at: 2026-08-25T03:01:18Z
review_path: .planning/phases/30-ai-map-editing-element-resolver-targeted-edit-mcp-tools/30-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-08-25T03:01:18Z
**Source review:** .planning/phases/30-ai-map-editing-element-resolver-targeted-edit-mcp-tools/30-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (critical_warning: CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 4
- Skipped: 1

**Verification environment:** All fixes were applied and verified inside an isolated git
worktree (`workflow.use_worktrees=true`), then fast-forwarded onto the phase branch
`gsd/phase-30-ai-map-editing-element-resolver-targeted-edit-mcp-tools`. Django syntax
checks (`ast.parse`) and the full `core.tests.test_gm_api` suite (46 tests) were run
inside that worktree via the project's `.venv` interpreter with `DATA_DIR` overridden
per-test — reproducible from the main checkout after the worktree teardown since all
commits are now on the phase branch.

## Fixed Issues

### CR-01: `set` has no field allowlist — can rewrite `id` and break referential integrity

**Files modified:** `core/views/gm_data_mapedit.py`
**Commit:** `35a4cb7`
**Applied fix:** The `set` op now rejects any patch that includes an `id` key with a
400 error explaining that renaming elements is unsupported (doors reference rooms by
id, and door ids are derived from room ids, so an in-place rename would silently
desync those references). Verified: all 46 existing tests in
`core.tests.test_gm_api` still pass, and a manual POST of
`{"target": "mess_hall", "set": {"id": "galley"}}` now returns 400 instead of writing.

### WR-01: Glob strategy's label matching is broken — wildcard chars stripped before use as a glob pattern

**Files modified:** `core/views/gm_data_mapedit.py`
**Commit:** `61adf19`
**Applied fix:** Added `_slugify_glob`, which performs the same lowercase/collapse
normalization as `_slugify` but preserves glob metacharacters (`*`, `?`, `[`, `]`)
instead of stripping them. The glob strategy's label predicate now uses
`_slugify_glob(q)` instead of the wildcard-stripped `qslug`. Verified: manual
resolution of `'Coolant*'` against a two-room fixture now correctly returns strategy
`glob` with both `coolant_tanks` and `coolant_tanks_2` (previously this fell through
to prefix/fuzzy since the label glob pattern had degenerated to an exact match); all
46 existing tests still pass, including `test_glob_matches_multiple` which exercises
the id-based half of the same branch.

### WR-02: `add_poi` / `set` accept schema-invalid payloads with no validation

**Files modified:** `core/views/gm_data_mapedit.py`
**Commit:** `27149e8`
**Applied fix:** `add_poi` now requires `icon` to be a non-empty string (per
`docs/schemas/schema-encounters.md` POI Fields) and validates `add_poi.type` against
the documented enum (`item | objective | hazard | npc | player`) when present.
`set` on a door now validates `status` against `OPEN | CLOSED | LOCKED | SEALED |
DAMAGED | BROKEN` and `type` against `standard | blast_door | airlock | emergency |
open` when those keys are present in the patch (room/corridor `type` is left
unvalidated — it's a free-form string per schema, only `"corridor"` is special-cased).
Verified with ad hoc TestCase requests: `{"add_poi": {}}` -> 400
(`'add_poi.icon' is required...`), `{"set": {"status": "OOPEN"}}` on a door -> 400
(`'status' must be one of [...]`), `{"add_poi": {"icon": "x", "type": "bogus"}}` ->
400 (`'add_poi.type' must be one of [...]`); all 46 existing tests still pass
(`test_add_poi_preserves_existing`, `test_set_door_status_via_derived_id`, etc. all
supply schema-valid values and are unaffected).

### WR-04: `edit_map_element` swallows structured error detail for non-404/409 4xx responses

**Files modified:** `mcp_server.py`
**Commit:** `cebd525`
**Applied fix:** Changed the status check from `if r.status_code in (404, 409)` to
`if 400 <= r.status_code < 500`, so every 4xx response (400 validation errors from
`'set'`/`add_poi`/`remove_poi`, not just 404/409) returns the backend's parsed JSON
body — preserving the specific, actionable error text — instead of raising a generic
`httpx.HTTPStatusError` via `raise_for_status()`. `raise_for_status()` is now reserved
for 5xx. Verified: syntax check (`ast.parse`) passes and Tier-1 re-read confirms the
change is scoped to the intended branch; no automated test coverage exists for
`mcp_server.py` in this repo (no test file targets it), so this fix relies on Tier 1 +
Tier 2 (syntax) verification only.

## Skipped Issues

### WR-03: Read-modify-write has no locking — concurrent edits can silently lose an update

**File:** `core/views/gm_data_mapedit.py:196-303`
**Reason:** The review's own Fix guidance explicitly marks this out of scope for a
single-file quick fix: "consider a shared `read_yaml_for_edit`/
`write_yaml_if_unchanged` helper with an mtime or content-hash precondition, reused by
both PATCH and map-edit." This mirrors a pre-existing pattern in
`gm_data_files.py:261-297` (not a regression introduced by this phase) and requires a
cross-cutting refactor touching at least two endpoints, which is beyond the scope of
an atomic, per-finding fix. Recommend tracking as a follow-up phase/task to add a
shared optimistic-concurrency helper.
**Original issue:** The file is read, mutated in memory, then written with no file
lock or optimistic-concurrency check between the two, so two concurrent POSTs against
the same deckplan can silently lose one writer's update.

---

_Fixed: 2026-08-25T03:01:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
