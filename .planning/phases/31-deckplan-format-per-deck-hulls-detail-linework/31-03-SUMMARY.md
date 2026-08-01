---
phase: 31-deckplan-format-per-deck-hulls-detail-linework
plan: 03
subsystem: testing
tags: [django, python, testing, deckplan, encounter-map, regression]

requires:
  - phase: 31-01
    provides: "patrol_gunboat upper_deck hull testbed (polygons/holes) consumed by the fixture in this plan's Task 1"
  - phase: 31-02
    provides: "patrol_gunboat upper_deck details testbed consumed by the fixture in this plan's Task 1"
provides:
  - "core/tests/test_deckplan_passthrough.py — Django regression guard proving deck-level hull and details survive both the SSE payload path (PayloadBuilder) and the api_encounter_map_data REST endpoint unmodified"
  - "Confirmation (not assumption) that core/payload_builder.py, core/encounter_utils.py, and core/views/encounter.py require zero code changes for HULL-01/HULL-02/DET-01/DET-03 — the backend is a genuine thin passthrough"
affects: [32-deckplan-svg-converter]

tech-stack:
  added: []
  patterns:
    - "Django TestCase + FakeLoader (reused via import from core.tests.test_payload_builder) — fast, deterministic tests independent of data/"
    - "core.data_loader.set_loader() convenience hook used to inject a fixture loader for a Django test-client-driven view test"

key-files:
  created:
    - core/tests/test_deckplan_passthrough.py
    - .planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/deferred-items.md
  modified: []

key-decisions:
  - "Reused FakeLoader by importing it from core.tests.test_payload_builder rather than copying it, since core/tests/ has an __init__.py making it a proper importable package"
  - "Zero source changes needed — load_deckplan returns yaml.safe_load output verbatim, both payload paths spread the deck dict ({**deck, ...}), and normalize_deck_poi shallow-copies (dict(deck)) rather than allow-listing keys, so hull/details survive unchanged on both paths"
  - "Task 2 (visual verification of the five ROADMAP success criteria) cannot be completed by an executor agent — it is a checkpoint:human-verify with gate=\"blocking\" per the plan; this SUMMARY documents Task 1's completion and Task 2's pending state rather than fabricating a verification result"

requirements-completed: []  # HULL-01/HULL-02/DET-01/DET-03 were already marked complete by 31-01/31-02; this plan's Task 2 checkpoint is the final human confirmation and has not yet been approved

coverage:
  - id: D1
    description: "PayloadBuilder output: location_data.map.manifest.hull equals the top-level hull (distinct from the deck-level hull, proving no swap)"
    requirement: HULL-01
    verification:
      - kind: unit
        ref: "core/tests/test_deckplan_passthrough.py#PayloadBuilderDeckplanPassthroughTests.test_manifest_hull_is_the_top_level_hull"
        status: pass
    human_judgment: false
  - id: D2
    description: "PayloadBuilder output for the requested deck: current_deck.hull.polygons has 2 entries and current_deck.hull.holes has 1 entry"
    requirement: HULL-02
    verification:
      - kind: unit
        ref: "core/tests/test_deckplan_passthrough.py#PayloadBuilderDeckplanPassthroughTests.test_deck_hull_polygons_and_holes_survive"
        status: pass
    human_judgment: false
  - id: D3
    description: "PayloadBuilder output for the requested deck: current_deck.details has 3 entries with room/points/closed/filled/circle keys preserved exactly as authored"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "core/tests/test_deckplan_passthrough.py#PayloadBuilderDeckplanPassthroughTests.test_deck_details_survive_with_all_keys_intact"
        status: pass
    human_judgment: false
  - id: D4
    description: "normalize_deck_poi copies rather than filters the deck dict — an unknown deck key (zzz_regression_probe_key, absent anywhere else in encounter_utils.py) survives unchanged, and the caller's original dict is never mutated"
    verification:
      - kind: unit
        ref: "core/tests/test_deckplan_passthrough.py#NormalizeDeckPoiPassthroughTests (both test methods)"
        status: pass
    human_judgment: false
  - id: D5
    description: "api_encounter_map_data returns current_deck.hull and current_deck.details matching authored values for a deck selected via the deck_id query parameter"
    requirement: DET-03
    verification:
      - kind: unit
        ref: "core/tests/test_deckplan_passthrough.py#ApiEncounterMapDataDeckplanPassthroughTests.test_encounter_map_data_endpoint_preserves_deck_hull_and_details"
        status: pass
    human_judgment: false
  - id: D6
    description: "GM and player see the five ROADMAP Phase 31 success criteria working end-to-end on patrol_gunboat's Upper Deck: additive shared silhouette + deck spine + detached sensor pod with atrium cutout, hull greebles, room interior details, reveal-gated interior linework with correct flicker cascade, always-visible exterior details, somnus no-regression, editor preview parity, and click-through on rooms with detail linework"
    verification: []
    human_judgment: true
    rationale: "No component-render or browser-driven test harness exists in this codebase (vitest covers pure modules and YAML fixtures only, per 31-CONTEXT.md's flagged_assumptions). This is Task 2 of the plan — a checkpoint:human-verify with gate=\"blocking\" — and has not yet been performed. Both dev servers (Django on :8000, Vite on :5173) were started and confirmed responsive by the executor to remove friction from the human verification step, but the verification itself requires a human browser session and has not occurred."

duration: ~60min (Task 1 only; Task 2 pending)
completed: null
status: blocked
---

# Phase 31 Plan 03: Backend Passthrough Regression Guard + Pending Visual Verification Summary

**A new Django regression suite (`core/tests/test_deckplan_passthrough.py`, 6 tests) proves — with zero source changes — that deck-level `hull:` and `details:` survive both the SSE payload path and the `api_encounter_map_data` REST endpoint unmodified; the plan's second task (human visual verification of the five ROADMAP success criteria) is a blocking checkpoint awaiting human sign-off.**

## Performance

- **Duration:** ~60 min (Task 1 only)
- **Started:** 2026-07-31T20:08:06Z
- **Tasks:** 1/2 completed (Task 2 is a blocking human-verify checkpoint, not yet performed)
- **Files modified:** 1 new test file + 1 deferred-items log

## Accomplishments

- New `core/tests/test_deckplan_passthrough.py` (6 test methods across 3 `TestCase` classes) pins the phase's central backend assumption — "the backend requires no code change for HULL-01/HULL-02/DET-01/DET-03" — as an executable guard rather than a trusted assumption.
- Confirmed, not just asserted: `core/data_loader.py::load_deckplan` returns `yaml.safe_load` output verbatim, both `core/payload_builder.py` payload paths (`_load_ship_deck` and `_add_encounter_location`) forward the deck dict via a `{**deck, ...}` spread, and `core/encounter_utils.py::normalize_deck_poi` ends with a `dict(deck)` shallow copy rather than an explicit key allow-list — so an authored deck-level `hull:`/`details:` reaches the browser intact on both paths.
- The `normalize_deck_poi` anti-allow-list regression case uses an unknown key name (`zzz_regression_probe_key`) that appears nowhere else in `core/encounter_utils.py` (`grep -c` confirms 0 matches), so a future refactor that rebuilds the deck dict from an explicit key list will fail this suite instead of silently dropping a pod's hull or details.
- `git diff --stat core/payload_builder.py core/encounter_utils.py core/views/encounter.py core/data_loader.py` is empty — the assumption from 31-01/31-02 is confirmed, zero backend fix was needed.
- `git diff --stat requirements.txt package.json pnpm-lock.yaml` is empty — no dependency added, satisfying the T-31-SC threat-register enforcement.
- Full `core.tests` suite (117 tests, 3 pre-existing skips unrelated to this plan) passes with the new suite included — no regression introduced.
- Both dev servers were started and confirmed responsive (Django `:8000` returns 302 on `/gmconsole/` — an auth redirect, not an error; Vite `:5173` is serving) so Task 2's human verification can begin immediately without any server-startup friction.

## Task Commits

1. **Task 1: Django regression guard — deck-level hull and details survive both payload paths** - `e13f880` (test)

**Task 2 (checkpoint:human-verify, gate="blocking") is pending** — not yet performed. See "Checkpoint Status" below.

## Files Created/Modified

- `core/tests/test_deckplan_passthrough.py` - new: 6 tests across `PayloadBuilderDeckplanPassthroughTests`, `NormalizeDeckPoiPassthroughTests`, `ApiEncounterMapDataDeckplanPassthroughTests`
- `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/deferred-items.md` - new: logs an out-of-scope pre-existing test-isolation bug found while running the full suite (see below)

## Decisions Made

- **Imported `FakeLoader` rather than copying it** — `core/tests/__init__.py` exists, making `core.tests.test_payload_builder` a normal importable module; copying would have created drift risk between two loader stand-ins.
- **Used `core.data_loader.set_loader()`** (an existing test-injection convenience function, previously unused by any test in the suite) to patch the loader `api_encounter_map_data` resolves via `get_loader()`, restoring it with `set_loader(None)` in `tearDown` so the lazily-constructed real loader is available to any other test.
- **Did not attempt Task 2 verification myself.** Per this plan's explicit instruction and the checkpoint protocol, `type="checkpoint:human-verify" gate="blocking"` requires a human browser session across the GM console and player terminal — fabricating a result was explicitly out of scope for this executor run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Scope-boundary, not a deviation to my task's files] Removed a stray `data/test_stub.md` artifact left by an unrelated pre-existing test**
- **Found during:** Running the full `core.tests` suite as Task 1's own verification gate
- **Issue:** `core/tests/test_gm_api.py`'s write-path tests write against the real `DATA_DIR` instead of a mocked/temp directory, leaving an untracked `data/test_stub.md` behind after any full-suite run. This file/bug is unrelated to this plan's `<files>` list.
- **Fix:** Removed the stray untracked artifact so it doesn't pollute the real campaign data directory; did NOT fix the underlying test-isolation bug (out of scope — logged to `deferred-items.md` for a future task).
- **Files modified:** none (deletion of an untracked, non-campaign file)
- **Verification:** `git status --short` clean of the stray file afterward
- **Committed in:** not committed (untracked file, deleted before it could be staged)

---

**Total deviations:** 0 auto-fixed within this plan's own files (Rule 1-3 sense) — the one item above is a logged, deferred, out-of-scope discovery per the Scope Boundary rule, not a fix to this plan's deliverables.
**Impact on plan:** None. Task 1 executed exactly as written with zero source changes to the files the plan's `<action>` anticipated might need a fix.

## Issues Encountered

None for Task 1. Task 2 is intentionally incomplete — see Checkpoint Status.

## Checkpoint Status

**Task 2: Visual verification of the five phase success criteria** — `type="checkpoint:human-verify" gate="blocking"` — **PENDING, not yet performed.**

Both dev servers are running and ready for verification:
- Django: `http://localhost:8000/gmconsole/` (and `/terminal/` for the player view)
- Vite: `http://localhost:5173/` (HMR dev server backing the above)

See the plan's Task 2 `<what-built>` / `<how-to-verify>` / `<resume-signal>` (`.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-03-PLAN.md`) for the full 8-point verification script covering HULL-01, HULL-02, DET-01, DET-03, always-visible exterior details, somnus no-regression, editor preview parity, and click-through on detailed rooms.

## User Setup Required

None - no external service configuration required. (Dev servers were started by the executor as environment preparation for the pending checkpoint, not as a setup requirement for the user.)

## Next Phase Readiness

- Task 1's regression guard is committed and green — the backend passthrough contract Phase 32's SVG converter will emit into is now proven, not assumed.
- This plan (31-03) — and therefore Phase 31 as a whole — cannot be marked complete until Task 2's checkpoint is approved by a human. `HULL-01`/`HULL-02`/`DET-01`/`DET-03` remain marked complete in REQUIREMENTS.md from 31-01/31-02 (the underlying code is proven correct by unit/integration tests), but the phase-level visual sign-off covering the ROADMAP success criteria is still open.
- Once Task 2 is approved (or issues are reported and fixed), a continuation run should: record the resume signal, update this SUMMARY's `status` to `complete` and `completed` date, and proceed with the plan's final state/roadmap updates and metadata commit.

---
*Phase: 31-deckplan-format-per-deck-hulls-detail-linework*
*Completed: pending Task 2 checkpoint approval*

## Self-Check: PASSED

`core/tests/test_deckplan_passthrough.py` found on disk; commit `e13f880` confirmed present in `git log --oneline --all`.
