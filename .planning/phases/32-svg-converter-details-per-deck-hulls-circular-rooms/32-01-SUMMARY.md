---
phase: 32-svg-converter-details-per-deck-hulls-circular-rooms
plan: 01
subsystem: tooling
tags: [svg, inkscape, elementtree, python, deckplan-yaml, circular-rooms]

requires: []
provides:
  - "svg_to_map.py detects literal <circle>, true <ellipse> (rx==ry), and Inkscape-native sodipodi:type=\"arc\" paths inside Rooms/Corridors layers and emits circle: {cx, cy, r} room/corridor entries"
  - "Non-circular ellipses (rx != ry, in either literal or sodipodi:arc form) are rejected with a stderr warning naming the room/layer, never approximated"
  - "get_layer_shapes() — generalized layer-scoped element lookup, with get_layer_paths() now a one-line delegate"
  - "Circle rooms/corridors are excluded from polygon-based door adjacency (_build_doors() and both convert() all_areas constructions guard on \"polygon\" in r) so mixed circle+polygon conversions never KeyError"
affects: [32-02, 32-03]

actuals:
  tokens: 5251
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "get_layer_shapes(parent, layer_label, *tag_names) generalizes single-tag layer lookup; get_layer_paths delegates to it"
    - "Circle/ellipse/sodipodi-arc geometry read directly off element attributes (cx/cy/r, cx/cy/rx/ry, sodipodi:cx/cy/rx/ry) — never routed through parse_path_d()"
    - "Warn-and-skip on a malformed/rejected individual shape (never sys.exit), matching the file's existing per-shape convention"

key-files:
  created:
    - tools/test_svg_to_map.py
  modified:
    - tools/svg_to_map.py
    - docs/schemas/schema-encounters.md

key-decisions:
  - "D-05/D-06 (from 32-CONTEXT.md): non-circular ellipses are rejected with a stderr warning, never averaged into an approximate circle"
  - "sodipodi:type=\"arc\" <path> elements are excluded from the regular Rooms/Corridors path-based room loop (which would otherwise emit a spurious 'unsupported curve command' warning for a shape that converts successfully via the circle path) — a deviation beyond the plan's literal text, justified by the fact Inkscape's ellipse tool defaults to sodipodi:arc serialization, so this is the primary real-world case, not an edge case"
  - "_build_doors()'s ordered_ids list (not just its all_areas dict) also needed the \"polygon\" in r guard — a circle room's id would otherwise KeyError on all_areas[a_id] the moment it was iterated as a_id, even though the plan's must_haves only named the three all_areas dict comprehensions"

patterns-established:
  - "Any future SVG-authored shape type follows the same three-part contract: (1) read geometry off raw element attributes, no d-string parsing, (2) warn-and-skip on malformed/invalid input, (3) exclude non-polygon shapes from polygon-based algorithms via an explicit key-presence guard rather than a crash"

requirements-completed: [CIRC-01]

coverage:
  - id: D1
    description: "Literal <circle> in a Rooms layer produces a circle: {cx,cy,r} room entry, end-to-end through convert() to deckplan.yaml"
    requirement: "CIRC-01"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_literal_circle_in_rooms_layer"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_literal_circle_pipeline_end_to_end"
        status: pass
    human_judgment: false
  - id: D2
    description: "A circle room mixed with a polygon room converts without crashing; door detection completes and excludes the circle room from adjacency"
    requirement: "CIRC-01"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_circle_and_rect_rooms_door_detection_no_crash"
        status: pass
    human_judgment: false
  - id: D3
    description: "sodipodi:type=\"arc\" path (Inkscape's native ellipse-tool serialization) inside Rooms produces the same circle: entry as a literal <circle>"
    requirement: "CIRC-01"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_sodipodi_arc_circle_in_rooms_layer"
        status: pass
    human_judgment: false
  - id: D4
    description: "Non-circular ellipse (rx != ry), in both literal <ellipse> and sodipodi:arc form, is rejected with a stderr warning naming the room/layer and produces zero room entries"
    requirement: "CIRC-01"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_noncircular_ellipse_rejected"
        status: pass
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_sodipodi_arc_noncircular_rejected"
        status: pass
    human_judgment: false
  - id: D5
    description: "Circle detection also works for the Corridors layer"
    requirement: "CIRC-01"
    verification:
      - kind: unit
        ref: "tools/test_svg_to_map.py#CircleRoomTests.test_circle_in_corridors_layer"
        status: pass
    human_judgment: false
  - id: D6
    description: "Existing fixtures (ship_template.svg, ship_template_multideck.svg, neither containing circle/ellipse content) convert with zero new stderr warnings and zero circle: keys in output — no regression"
    verification:
      - kind: manual_procedural
        ref: "python3 tools/svg_to_map.py tools/ship_template.svg --out-dir /tmp/svgtest_p1regress_final && python3 tools/svg_to_map.py tools/ship_template_multideck.svg --out-dir /tmp/svgtest_p1regress2_final; grep -c 'circle:' on both outputs == 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "docs/schemas/schema-encounters.md Tooling Note documents the circle/ellipse/sodipodi-arc authoring convention and the door-adjacency exclusion, committed in the same commit as the code change"
    verification:
      - kind: manual_procedural
        ref: "grep -c 'sodipodi:type' docs/schemas/schema-encounters.md == 4; grep -c 'not circular' docs/schemas/schema-encounters.md == 4"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-08-24
status: complete
---

# Phase 32 Plan 01: SVG Circular Rooms Summary

**svg_to_map.py detects `<circle>`/`<ellipse>`/`sodipodi:type="arc"` shapes in Rooms/Corridors layers and emits `circle: {cx, cy, r}` room/corridor entries, with non-circular ellipses warn-and-skip rejected (D-06) instead of approximated.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-24T22:47:00-05:00 (base commit)
- **Completed:** 2026-08-24T22:58:51-05:00
- **Tasks:** 2
- **Files modified:** 3 (`tools/svg_to_map.py`, `tools/test_svg_to_map.py` new, `docs/schemas/schema-encounters.md`)

## Accomplishments
- `get_layer_shapes(parent, layer_label, *tag_names)` generalizes the previous single-tag `get_layer_paths` lookup; `get_layer_paths` is now a one-line delegate with unchanged behavior for every existing caller.
- `_extract_circle_shape()` reads circle geometry directly off element attributes for three forms: literal `<circle>`, true `<ellipse>` (rx==ry), and Inkscape's native `sodipodi:type="arc"` `<path>` serialization — never through `parse_path_d()`.
- Non-circular ellipses (rx != ry) in either form are rejected with a stderr warning naming the room/layer and layer type, per D-06 — never approximated.
- `_extract_areas()` emits `circle:` room entries for the Rooms layer and `circle:` corridor entries for the Corridors layer; `_write_deckplan_yaml()` emits the matching inline `circle: {cx, cy, r}` YAML for both.
- `_build_doors()` and both `convert()` `all_areas` dict comprehensions (plus `_build_doors()`'s `ordered_ids` list, an extra guard beyond the plan's literal text) exclude entries without a `"polygon"` key, so a circle room/corridor coexisting with polygon rooms converts without a `KeyError`.
- `tools/test_svg_to_map.py` (new, stdlib `unittest`, `CircleRoomTests`) — 7 tests, all passing.
- `docs/schemas/schema-encounters.md`'s Tooling Note documents the circle/ellipse/sodipodi-arc authoring convention and the door-adjacency exclusion, under both single-deck and multi-deck Rooms/Corridors bullets.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — literal `<circle>` in Rooms layer → circle room entry, end-to-end** - `48265d8` (feat)
2. **Task 2: sodipodi:type="arc" detection + non-circular ellipse rejection + Corridors layer + schema doc** - `ae492f1` (feat)

_Note: both tasks executed as single atomic commits per the `type="tracer"`/`type="auto"` commit protocol (tests + implementation together), not separate RED/GREEN commits — tests were written and run to green before each commit._

## Files Created/Modified
- `tools/svg_to_map.py` — `SODIPODI` namespace constant; `get_layer_shapes()` (new) + `get_layer_paths()` (now a delegate); `_extract_circle_shape()` and `_get_circle_shape_elements()` (new, handle circle/ellipse/sodipodi-arc); circle-room/circle-corridor loops in `_extract_areas()`; `circle:` emission branches in `_write_deckplan_yaml()`'s room and corridor loops; polygon-key guards in `_build_doors()` (`all_areas` + `ordered_ids`) and both `convert()` call sites; sodipodi-arc-path skip in the regular Rooms/Corridors path loops
- `tools/test_svg_to_map.py` — new file, `CircleRoomTests` (7 tests: literal circle direct-extraction, literal circle full-pipeline, mixed circle+polygon door-detection no-crash, sodipodi-arc circle, non-circular ellipse rejection, non-circular sodipodi-arc rejection, circle in Corridors)
- `docs/schemas/schema-encounters.md` — Tooling Note's SVG layer conventions section extended with the circle/ellipse/sodipodi-arc authoring convention and door-adjacency exclusion note, under all four Rooms/Corridors bullets (single-deck + multi-deck)

## Decisions Made
- D-05/D-06 (from 32-CONTEXT.md) implemented as specified: circle/ellipse/sodipodi-arc detection is new code with zero prior analog; non-circular ellipses are strictly rejected, never averaged.
- Radius conversion uses `to_grid(r, unit) - to_grid(0.0, unit)` per the plan's explicit instruction (functionally equivalent to `to_grid(r, unit)` since `to_grid(0.0, unit) == 0`, but kept as specified for consistency with any future non-zero-origin grid conventions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_build_doors()`'s `ordered_ids` list also needed the polygon-key guard**
- **Found during:** Task 1 (writing `test_circle_and_rect_rooms_door_detection_no_crash`)
- **Issue:** The plan's must_haves and action steps only named the three `all_areas = {...}` dict comprehensions needing the `"polygon" in r` guard. But `_build_doors()` also builds `ordered_ids = [r["id"] for r in rooms] + [...]` and then does `poly_a = all_areas[a_id]` for every `a_id` in `ordered_ids` — a circle room's id would still `KeyError` there even with `all_areas` itself correctly filtered, since the circle id would be in `ordered_ids` but absent from `all_areas`.
- **Fix:** Applied the identical `if "polygon" in r`/`if "polygon" in c` filter to both halves of `ordered_ids`'s construction.
- **Files modified:** `tools/svg_to_map.py`
- **Verification:** `test_circle_and_rect_rooms_door_detection_no_crash` passes (would otherwise `KeyError` inside `_build_doors()`).
- **Committed in:** `48265d8` (Task 1 commit)

**2. [Rule 1 - Bug] Spurious "unsupported curve command" warning on sodipodi:arc circle rooms**
- **Found during:** Task 2 (running `test_sodipodi_arc_circle_in_rooms_layer`)
- **Issue:** A `sodipodi:type="arc"` element is still a `<path>` tag, so it was also picked up by the pre-existing plain-path Rooms/Corridors loops (which call `get_layer_paths`, not the new shape-specific lookup). Those loops tried `parse_path_d()` on its arc-based `d` attribute, which contains `A` commands and is rejected — printing a misleading "unsupported curve command ... skipping" warning even though the shape converts successfully via the new circle-detection code path. Since Inkscape's ellipse/circle tool defaults to `sodipodi:type="arc"` serialization (per 32-RESEARCH.md Pitfall 1), this would fire on essentially every real-world circle room, misleading GMs into thinking the room failed to convert.
- **Fix:** Added a `sodipodi:type="arc"` skip check at the top of both the Rooms and Corridors plain-path loops in `_extract_areas()`, so those paths are only processed by the circle-detection loop.
- **Files modified:** `tools/svg_to_map.py`
- **Verification:** `test_sodipodi_arc_circle_in_rooms_layer` passes with no stderr warning (confirmed via manual `-v` run before/after the fix).
- **Committed in:** `ae492f1` (Task 2 commit)

**3. [Rule 1 - Bug] `_write_deckplan_yaml()`'s corridor-writing loop would `KeyError` on circle corridors**
- **Found during:** Task 2 (adding Corridors-layer circle support)
- **Issue:** The plan's action items for Task 2 added circle-corridor emission to `_extract_areas()` but the existing corridor-writing block in `_write_deckplan_yaml()` unconditionally reads `corr["polygon"]`, which a circle corridor lacks — the full `convert()` pipeline (not exercised by the `_extract_areas()`-only Task 2 test) would crash on any real circle-corridor conversion.
- **Fix:** Added the same `circle:`-vs-`polygon:` branch to the corridor-writing loop that Task 1 added to the room-writing loop.
- **Files modified:** `tools/svg_to_map.py`
- **Verification:** Manual `convert()` run against a Corridors-circle fixture (via the test suite's temp-dir helper pattern) confirms `circle:` is written for the corridor with no exception.
- **Committed in:** `ae492f1` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs found while implementing the plan's own acceptance criteria)
**Impact on plan:** All three fixes were necessary to satisfy the plan's own stated `must_haves` (no `KeyError` on mixed circle+polygon conversion) and its `<verification>` no-regression requirement (no new stderr warnings). No scope creep — no new features beyond what CIRC-01 requires.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CIRC-01 fully satisfied; Phase 32 Plans 02 (per-deck hulls) and 03 (Details layer) can proceed independently — both reuse `get_layer_shapes()` and the polygon-key-guard pattern established here.
- `tools/svg_to_map.py`'s `all_areas` guard (`"polygon" in r`) is now the established convention any future non-polygon shape type (e.g. Plan 03's Details circles) should follow rather than reintroducing a crash risk.

---
*Phase: 32-svg-converter-details-per-deck-hulls-circular-rooms*
*Completed: 2026-08-24*

## Self-Check: PASSED

All created/modified files verified present on disk:
- `tools/svg_to_map.py` — FOUND
- `tools/test_svg_to_map.py` — FOUND
- `docs/schemas/schema-encounters.md` — FOUND
- `.planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-01-SUMMARY.md` — FOUND

All commits verified present in `git log --oneline --all`:
- `48265d8` (Task 1) — FOUND
- `ae492f1` (Task 2) — FOUND
- `ba43ad9` (Summary) — FOUND
