---
phase: 32-svg-converter-details-per-deck-hulls-circular-rooms
plan: 02
subsystem: tooling
tags: [svg, inkscape, elementtree, python, deckplan-yaml, hull-polygons]

requires:
  - phase: 32-svg-converter-details-per-deck-hulls-circular-rooms plan 01
    provides: "circle/ellipse detection in Rooms/Corridors and the all_areas/ordered_ids polygon-key guards this plan built on top of"
provides:
  - "_extract_hull_layer(parent, unit) -> dict | None — shared multi-path + holes hull extractor, used identically for the top-level Hull layer and any per-deck Hull sublayer"
  - "_write_hull_block(f, hull_data, indent) -> None — shared YAML-emission helper for both top-level hull: and every deck's nested hull: key; compact polygon: form when a single polygon has no holes, polygons:/holes: nested-list form otherwise"
  - "Per-deck Hull sublayer support (nested inside each deck's <g>, sibling to Rooms/Corridors/Doors/Vents) — multi-deck mode only, per Pitfall 4 scoping"
  - "Root-level Hull layer now collects ALL <path> elements (not just the first) into polygons + holes (D-02 gap closed)"
affects: [32-03]

actuals:
  tokens: 3713
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "_extract_hull_layer()/_write_hull_block() are the single shared extraction+emission pair used for both the top-level hull: key and every per-deck hull: key — established as the template any future dual-scope (root+per-deck) SVG feature should follow"

key-files:
  created: []
  modified:
    - tools/svg_to_map.py
    - tools/test_svg_to_map.py
    - docs/schemas/schema-encounters.md

key-decisions:
  - "D-02 (from 32-CONTEXT.md) implemented as specified: every <path> in a Hull layer contributes one outer polygon (largest-area subpath) plus its remaining subpaths as holes, flattened across the whole layer into one combined holes: list — matching schema-encounters.md's existing 'not paired to any specific outer polygon' semantics."
  - "Per-deck Hull extraction is scoped to multi-deck mode only (Pitfall 4) — the single-deck decks_data=[{...}] construction never gets a 'hull' key, since there is no per-deck <g> distinct from root in single-deck mode."
  - "The plan's regression-test assumption (that tools/ship_template.svg and tools/ship_template_multideck.svg would exercise the compact polygon: form) did not match reality: both fixtures' Hull layer contains only a placeholder <rect id=\"hull_example\" inkscape:label=\"DELETE ME\"> — no <path> element at all. get_layer_paths()/get_layer_shapes()' path-tag-only iteration means hull_paths is empty for both files, so pre- AND post-refactor output is 'no hull: key at all' (verified against the unmodified pre-Task-1 code first). Adjusted test_root_hull_regression_ship_template to assert the true pre-refactor behavior (absence of hull:/polygons: keys) instead of the plan's assumed compact-form presence, and added a new controlled-fixture test (test_root_hull_single_path_compact_form) using an inline SVG string with a real Hull <path> to actually prove the compact polygon: form's byte-identical output — this is the grounded way to satisfy the plan's stated acceptance criterion given the real fixtures don't exercise that code path."

patterns-established:
  - "Dual-scope (root + per-deck) SVG sublayer features get one shared extractor + one shared writer, never two near-duplicate code paths — established by _extract_hull_layer()/_write_hull_block(), reusable by any future per-deck sublayer type."

requirements-completed: [HULL-03]

coverage:
  - id: D1
    description: "Root-level Hull layer parsing supports multi-path + holes via _extract_hull_layer()/_write_hull_block(), with byte-identical output to pre-refactor behavior for the two existing fixture SVGs (both of which, per source-grounding, have no actual Hull <path> and so emit no hull: key at all, before or after the refactor)"
    requirement: "HULL-03"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_root_hull_multi_path_with_hole"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_root_hull_no_layer_returns_none"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_root_hull_regression_ship_template"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_root_hull_single_path_compact_form"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-deck 'Hull' sublayer (nested inside a deck's <g>) produces a per-deck hull polygon set, including multi-polygon hulls, emitted as a nested hull: block under that deck's entry — scoped to multi-deck mode only"
    requirement: "HULL-03"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_per_deck_hull_multi_polygon"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#HullTests.test_single_deck_mode_no_per_deck_hull"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/schemas/schema-encounters.md's Tooling Note documents the per-deck Hull sublayer and its multi-deck-only scoping, committed alongside the code change"
    verification:
      - kind: manual_procedural
        ref: "grep -c 'only apply in multi-deck mode' docs/schemas/schema-encounters.md == 1"
        status: pass
    human_judgment: false

duration: ~7min
completed: 2026-08-24
status: complete
---

# Phase 32 Plan 02: Per-Deck Hulls Summary

**`svg_to_map.py` gains a shared `_extract_hull_layer()`/`_write_hull_block()` pair used for both the top-level and any per-deck `"Hull"` sublayer, closing the D-02 multi-path/holes gap and adding multi-deck-only per-deck hull polygon emission (HULL-03).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-08-24T23:01:01-05:00 (base commit)
- **Completed:** 2026-08-24T23:05:24-05:00
- **Tasks:** 2
- **Files modified:** 3 (`tools/svg_to_map.py`, `tools/test_svg_to_map.py`, `docs/schemas/schema-encounters.md`)

## Accomplishments
- `_extract_hull_layer(parent, unit)` — new shared function; finds a `Hull` `<g>` among `parent`'s direct children, collects ALL `<path>` elements in it (not just the first — the D-02 gap), splits each path's largest-area subpath into an outer polygon with remaining subpaths as holes (mirroring `_extract_areas()`'s existing pattern), returns `{"polygons": [...], "holes": [...]}` or `None`.
- `_write_hull_block(f, hull_data, indent)` — new shared YAML-emission helper; single-polygon-no-holes case writes the exact pre-refactor compact `polygon:` flat-list form (byte-identical), otherwise writes `polygons:`/`holes:` nested-list form matching room `holes:`'s existing flow-style.
- `convert()`'s inline root-Hull block replaced by a call to `_extract_hull_layer(root, unit)`; multi-deck loop gains a call to `_extract_hull_layer(deck_elem, unit)` stored as `decks_data[i]["hull"]` — scoped to multi-deck mode only (Pitfall 4).
- `_write_deckplan_yaml()`'s `hull_poly` parameter renamed/retyped to `hull_data: dict | None`; top-level `hull:` emission and the new per-deck `hull:` emission both call the same `_write_hull_block()` helper.
- `docs/schemas/schema-encounters.md`'s Tooling Note multi-deck section now lists `Hull` as a per-deck sublayer (alongside Rooms/Corridors/Vents) and states the single-deck-mode scoping explicitly.
- `tools/test_svg_to_map.py` — `HullTests` (new, stdlib `unittest`), 6 tests, all passing (5 from the plan's spec plus one extra grounded test — see Decisions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared `_extract_hull_layer()` + `_write_hull_block()` + root-Hull multi-path/holes refactor** - `e28bd03` (feat)
2. **Task 2: Per-deck Hull sublayer extraction + YAML emission + schema doc** - `8c480d8` (feat)

_Note: all `HullTests` (both tasks' tests) were written together before Task 1's implementation, in a single RED pass covering both tasks' `<behavior>` specs, then verified failing (`AttributeError: _extract_hull_layer` for Task 1's tests; a legitimate wiring-not-yet-done FAIL for Task 2's per-deck test) before any implementation — then committed with each task's own implementation (tests bundled into the Task 1 commit alongside `_extract_hull_layer`/`_write_hull_block`, since both tasks' test methods live in one file and Task 1's commit was the first to touch `tools/test_svg_to_map.py`)._

## Files Created/Modified
- `tools/svg_to_map.py` — `_extract_hull_layer()` (new), `_write_hull_block()` (new); `convert()`'s root-Hull inline block replaced by a call to the new extractor, multi-deck loop gains a per-deck `_extract_hull_layer()` call stored on `decks_data[i]["hull"]`; `_write_deckplan_yaml()`'s `hull_poly` parameter renamed to `hull_data: dict | None`, top-level and per-deck `hull:` emission both delegate to `_write_hull_block()`
- `tools/test_svg_to_map.py` — new `HullTests` class, 6 tests: root-hull multi-path+hole extraction, root-hull-layer-absent returns `None`, regression test against the two real fixture SVGs, a controlled-fixture compact-form test, per-deck multi-polygon hull emission, single-deck-mode has no per-deck hull key
- `docs/schemas/schema-encounters.md` — Tooling Note's multi-deck section gains a `Hull` per-deck sublayer bullet and an explicit single-deck-mode-scoping sentence

## Decisions Made
- D-02 (from 32-CONTEXT.md) implemented as specified: multi-path + holes collection, flattened holes list, shared extractor for root and per-deck.
- Per-deck Hull extraction scoped to multi-deck mode only, per Pitfall 4 — no code path attempts per-deck Hull extraction in single-deck mode.
- The plan's regression-test text assumed `tools/ship_template.svg`/`ship_template_multideck.svg` had a real Hull `<path>` exercising the compact `polygon:` form. Source-grounding against the actual files (before touching any code) showed both fixtures' Hull layer contains only a placeholder `<rect inkscape:label="DELETE ME">`, not a `<path>` — `get_layer_paths()` never matches it, so `hull_paths` is empty and the tool prints `"Hull: (none)"` with no `hull:` key written, both before and after this plan's refactor. Adjusted the regression test to assert this actual pre-refactor behavior (no `hull:`/`polygons:` keys present) and added `test_root_hull_single_path_compact_form` — a controlled inline-SVG fixture with a genuine single Hull `<path>` — to independently prove the compact-form byte-identical output the plan's acceptance criteria actually cared about.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues encountered during implementation.

### Test-assumption Correction (not a Rule 1-3 code fix — a fixture-grounding correction)

**1. `test_root_hull_regression_ship_template`'s expected assertion did not match the real fixtures**
- **Found during:** Task 1, running RED before implementation
- **Issue:** The plan's `<behavior>` text specified asserting `"hull:\n  polygon:\n"` is present in the converted output of both real fixture SVGs, on the stated assumption that each fixture's Hull layer has "exactly one simple path." Reading the actual fixture files showed the Hull layer in both `ship_template.svg` and `ship_template_multideck.svg` contains only a placeholder `<rect id="hull_example" inkscape:label="DELETE ME">`, never a `<path>` — running the pre-Task-1 (unmodified) `convert()` against both confirmed `"Hull: (none)"` and no `hull:` key written for either file today.
- **Fix:** Rewrote the test to assert the actual pre-refactor behavior (no `hull:`/`polygons:` key present for either fixture) as the true regression bar, and added a second test (`test_root_hull_single_path_compact_form`) using a controlled inline-SVG fixture with a real single Hull `<path>` to prove the compact `polygon:` form is still byte-identical to the pre-refactor inline writer — fully satisfying the plan's underlying intent (prove the simple-case output is unchanged) via a fixture that actually exercises the code path.
- **Files modified:** `tools/test_svg_to_map.py`
- **Verification:** Both tests pass; manual `convert()` runs against the real fixtures confirm zero `hull:` output before and after the refactor (`grep -c "^hull:\|  hull:"` == 0 on both).
- **Committed in:** `e28bd03` (Task 1 commit)

---

**Total deviations:** 0 auto-fixed code changes (Rules 1-3); 1 test-assumption correction grounded against the actual repo fixtures (documented above, not a Rule 1-3 category since no production code was wrong — the plan's test-writing instruction made an unverified assumption about fixture content).
**Impact on plan:** No scope creep. The correction strengthens rather than weakens the regression guarantee — it tests against ground truth instead of an incorrect assumption, and adds an extra test to independently cover what the original assumption intended to prove.

## Issues Encountered
None beyond the test-assumption correction documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HULL-03 fully satisfied; Phase 32 Plan 03 (Details layer) can proceed independently.
- `_extract_hull_layer()`/`_write_hull_block()` establish the dual-scope (root + per-deck) shared-extractor-and-writer pattern any future sublayer feature spanning both scopes should follow.
- Real-world SVG authors using the shipped `ship_template.svg`/`ship_template_multideck.svg` templates must replace the placeholder `<rect id="hull_example">` with an actual `<path>` (per the template's own "DELETE ME — draw your ship outline here" comment) to get any hull output at all — this was already true before this plan and is unaffected by it.

---
*Phase: 32-svg-converter-details-per-deck-hulls-circular-rooms*
*Completed: 2026-08-24*

## Self-Check: PASSED

All created/modified files verified present on disk:
- `tools/svg_to_map.py` — FOUND
- `tools/test_svg_to_map.py` — FOUND
- `docs/schemas/schema-encounters.md` — FOUND
- `.planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-02-SUMMARY.md` — FOUND

All commits verified present in `git log --oneline --all`:
- `e28bd03` (Task 1) — FOUND
- `8c480d8` (Task 2) — FOUND
