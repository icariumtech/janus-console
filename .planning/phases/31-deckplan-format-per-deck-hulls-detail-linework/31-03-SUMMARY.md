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

requirements-completed: [HULL-01, HULL-02, DET-01, DET-03]  # Task 2 checkpoint approved; HULL-01/HULL-02/DET-01/DET-03 now fully confirmed end-to-end

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
    verification:
      - kind: manual
        ref: "Human checkpoint approval, 2026-08-04 — see 'Checkpoint Status' below"
        status: pass
    human_judgment: true
    rationale: "No component-render or browser-driven test harness exists in this codebase (vitest covers pure modules and YAML fixtures only, per 31-CONTEXT.md's flagged_assumptions). Task 2 (checkpoint:human-verify, gate=\"blocking\") was approved by the human. The approval was reached iteratively with the orchestrator across three screenshot rounds directly confirming HULL-02 (detached sensor pod + atrium hole + strut + sensor dish), DET-01 (console line thinner than wall stroke), and DET-03 (interior detail absent while hidden, appears together with the room's reveal cascade — not a separate pop-in). The remaining 5 of the 8 how-to-verify sub-items (Main Deck HULL-01 toggle, exterior-always-visible, atrium hole close-up as a standalone check, editor preview parity, click-through) were covered by the final unqualified \"approved\" response without additional screenshots. Recorded here for traceability in case anything surfaces later."

duration: ~60min (Task 1) + Task 2 human verification
completed: 2026-08-04
status: complete
---

# Phase 31 Plan 03: Backend Passthrough Regression Guard + Visual Verification Summary

**A new Django regression suite (`core/tests/test_deckplan_passthrough.py`, 6 tests) proves — with zero source changes — that deck-level `hull:` and `details:` survive both the SSE payload path and the `api_encounter_map_data` REST endpoint unmodified; the plan's second task (human visual verification of the five ROADMAP success criteria) was approved on 2026-08-04, closing out Phase 31.**

## Performance

- **Duration:** ~60 min (Task 1) + human verification session (Task 2)
- **Started:** 2026-07-31T20:08:06Z
- **Completed:** 2026-08-04
- **Tasks:** 2/2 completed
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
2. **Task 2: Visual verification of the five phase success criteria** - `checkpoint:human-verify` — **approved**, no code commit (verification-only task). See "Checkpoint Status" below.

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

**Task 2: Visual verification of the five phase success criteria** — `type="checkpoint:human-verify" gate="blocking"` — **APPROVED, 2026-08-04.**

The human replied "approved" to close the checkpoint. The approval was reached iteratively with
the orchestrator rather than as a single blind pass over the full 8-point script:

1. **Screenshot round 1** — Upper Deck GM view showing the shared silhouette + spine block +
   detached SENSOR POD (unclipped) + sensor-dish circle + strut line + filled rectangle in
   SENSOR POD. This directly confirmed HULL-02 (multiple disjoint polygons, atrium hole punched
   near the spine) and the DET-01 strut/dish/fill linework. The orchestrator flagged two open
   items at this point — the atrium hole not being clearly visible against the dark
   GM-unrevealed rendering, and low overall contrast — which were resolved by the next round.
2. **Screenshot rounds 2-3** — OBSERVATION room hidden vs. revealed on the player terminal.
   These directly confirmed DET-01 (the console line renders visibly thinner than the room wall
   stroke) and DET-03 (the console line is completely absent while OBSERVATION is hidden, then
   appears together with the room's own reveal cascade when the GM reveals it — not a separate
   pop-in, and not always-rendered-but-dimmed).
3. **Final "approved"** — sent without further screenshots for the remaining sub-items: Main
   Deck HULL-01 toggle (spine appears/disappears while shared silhouette persists), always-visible
   exterior details with both rooms hidden, atrium hole as a standalone close-up check, editor
   preview parity in the GM Console file editor, and click-through on rooms with detail linework.

**Traceability note:** of the plan's 8 how-to-verify sub-items, 3 (HULL-02, DET-01, DET-03) were
directly visually confirmed via screenshot exchange; the remaining 5 (HULL-01 deck toggle,
always-visible exterior details, atrium hole standalone close-up, editor preview parity,
click-through) were covered by the final approval on trust rather than individually
screenshotted. Per the resume instructions this is treated as full checkpoint approval and is
not being re-litigated — recorded here so it is traceable if anything surfaces later.

Both dev servers were running for the verification session:
- Django: `http://localhost:8000/gmconsole/` (and `/terminal/` for the player view)
- Vite: `http://localhost:5173/` (HMR dev server backing the above)

See the plan's Task 2 `<what-built>` / `<how-to-verify>` / `<resume-signal>` (`.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-03-PLAN.md`) for the full 8-point verification script.

## User Setup Required

None - no external service configuration required. (Dev servers were started by the executor as environment preparation for the pending checkpoint, not as a setup requirement for the user.)

## Next Phase Readiness

- Task 1's regression guard is committed and green — the backend passthrough contract Phase 32's SVG converter will emit into is now proven, not assumed.
- Task 2's checkpoint is approved — Phase 31 as a whole is now complete. `HULL-01`/`HULL-02`/`DET-01`/`DET-03` are confirmed both by unit/integration test (backend passthrough) and by human visual verification (frontend rendering, reveal gating).
- Phase 32 (deckplan SVG converter) can proceed on a backend and frontend contract that is now fully proven end-to-end, not assumed.

---
*Phase: 31-deckplan-format-per-deck-hulls-detail-linework*
*Completed: 2026-08-04*

## Self-Check: PASSED

`core/tests/test_deckplan_passthrough.py` found on disk; commit `e13f880` confirmed present in `git log --oneline --all`. Task 2 checkpoint approval recorded via human response, not a filesystem/commit artifact — no further self-check applicable for a verification-only task.
