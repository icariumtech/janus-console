---
phase: 32-svg-converter-details-per-deck-hulls-circular-rooms
verified: 2026-08-25T20:30:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 32: SVG Converter Details-Per-Deck-Hulls-Circular-Rooms Verification Report

**Phase Goal:** Extend `tools/svg_to_map.py` to emit the new Phase 31 schema fields and circular rooms, so Inkscape-authored decks convert directly into richer `deckplan.yaml` output.

**Verified:** 2026-08-25T20:30:00Z
**Status:** PASSED
**Requirements:** CIRC-01, HULL-03, DET-02

## Goal Achievement Summary

Phase 32 extends the SVG-to-YAML map converter with three major features:
1. **CIRC-01 (Circular Rooms)**: SVG `<circle>`, true `<ellipse>` (rx==ry), and Inkscape-native `sodipodi:type="arc"` paths in Rooms/Corridors layers now emit `circle: {cx, cy, r}` room/corridor entries.
2. **HULL-03 (Per-Deck Hulls)**: Per-deck `Hull` sublayers (nested inside each deck's `<g>`) emit polygon/holes hull geometry for multi-deck ships.
3. **DET-02 (Details Layer)**: Per-deck `Details` sublayers emit decorative linework (polylines and circles) with automatic room-association-based interior/exterior reveal gating.

All three features are now implemented, tested (19 tests, all passing), and the schema documentation is updated.

## Observable Truths Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Literal `<circle>` elements in Rooms layer produce `circle: {cx, cy, r}` room entries | ✓ VERIFIED | `CircleRoomTests.test_literal_circle_in_rooms_layer` passes; `_extract_circle_shape()` at line 549-595 handles `elem.tag == "{svg}circle"` |
| 2 | Non-circular ellipses (rx != ry) are rejected with stderr warning, never approximated | ✓ VERIFIED | `CircleRoomTests.test_noncircular_ellipse_rejected` passes; lines 567-574 check `abs(rx - ry) > 1e-4` and warn/return None |
| 3 | Sodipodi arc paths (`sodipodi:type="arc"`) produce circle entries, same as literal circles | ✓ VERIFIED | `CircleRoomTests.test_sodipodi_arc_circle_in_rooms_layer` passes; lines 576-589 handle sodipodi arc detection |
| 4 | Circle rooms coexist with polygon rooms without KeyError in door detection | ✓ VERIFIED | `CircleRoomTests.test_circle_and_rect_rooms_door_detection_no_crash` passes; polygon-key guard at lines 818-821, 1291, 1329 filters circle entries from door adjacency |
| 5 | Per-deck Hull sublayer produces nested `hull:` blocks in multi-deck mode | ✓ VERIFIED | `HullTests.test_per_deck_hull_multi_polygon` passes; `_extract_hull_layer()` wired at line 1299 in multi-deck loop |
| 6 | Root-level Hull layer supports multi-path and holes (D-02 gap closed) | ✓ VERIFIED | `HullTests.test_root_hull_multi_path_with_hole` passes; lines 641-655 iterate every path in the layer |
| 7 | Details layer produces polyline/circle entries with room association | ✓ VERIFIED | `DetailsTests.test_open_polyline_exterior`, `test_closed_polyline_interior_filled`, `test_circle_detail` all pass; `_extract_details_layer()` at lines 1012-1096 |
| 8 | Closed polylines emit `closed: true, filled: true`; open polylines do not | ✓ VERIFIED | `_first_subpath_closed()` at lines 994-1009 correctly detects first subpath closure for compound paths (CR-03 fix) |
| 9 | Schema doc updated with circle/ellipse/sodipodi:arc/per-deck-hull/details conventions | ✓ VERIFIED | `docs/schemas/schema-encounters.md` contains "circle room", "sodipodi:type=\"arc\"", "Details — optional per-deck", "Hull — optional per-deck" |

**Score: 9/9 must-haves verified**

## Artifact Verification

| Artifact | Status | Verification |
|----------|--------|--------------|
| `tools/svg_to_map.py` (modified) | ✓ EXISTS & WIRED | 1,435 lines; `SODIPODI` constant, `get_layer_shapes()`, `_extract_circle_shape()`, `_get_circle_shape_elements()`, `_extract_hull_layer()`, `_write_hull_block()`, `_first_subpath_closed()`, `_extract_details_layer()` all present and called from `convert()` and `_write_deckplan_yaml()` |
| `tools/test_svg_to_map.py` (new) | ✓ EXISTS & WIRED | 19 tests: `CircleRoomTests` (7), `HullTests` (6), `DetailsTests` (6); all pass with no cross-feature interference |
| `docs/schemas/schema-encounters.md` (modified) | ✓ EXISTS & WIRED | Circle room shape documented, sodipodi authoring convention documented, per-deck Hull documented with multi-deck-only scoping, Details layer documented with room-association rules and id-generation convention |

## Key Link Verification (Wiring)

| From | To | Via | Status |
|------|----|----|--------|
| `_extract_circle_shape()` output | `_write_deckplan_yaml()` circle: emission | Room/corridor loop calls `_extract_circle_shape()`, stores result as `"circle"` key, which is checked at write time | ✓ WIRED |
| `get_layer_shapes()` generalization | Backwards compatibility for `get_layer_paths()` | `get_layer_paths()` becomes one-line delegate at line 478: `return get_layer_shapes(parent, layer_label, "path")` | ✓ WIRED |
| Circle shape detection | All-areas dict construction | Polygon-key guard `if "polygon" in r` applied at lines 818-821, 1291, 1329; circle entries excluded from polygon-based door adjacency | ✓ WIRED |
| `_extract_hull_layer()` (root) | `_write_deckplan_yaml()` top-level hull: | `hull_data` parameter at line 1104 passed to `_write_hull_block()` call at line 1117 | ✓ WIRED |
| `_extract_hull_layer()` (per-deck) | `_write_deckplan_yaml()` per-deck hull: | `d.get("hull")` checked at line 1126, passed to `_write_hull_block()` at line 1128 | ✓ WIRED |
| `_extract_details_layer()` | `_write_deckplan_yaml()` details: emission | `d.get("details", [])` at line 1137, per-detail iteration writes `points:` or `circle:`, mutually exclusive | ✓ WIRED |

## Code Review Fixes Verification

All 9 code review findings (3 critical, 6 warning) were fixed and verified:

| Issue | Fix Commit | Verification |
|-------|-----------|--------------|
| CR-01: Duplicate deck IDs from colliding labels | `9e455b1` | `seen_deck_ids` dict at line 1280, `_unique_id()` call at line 1287 |
| CR-02: `_unique_id()` could generate colliding ids | `2423103` | Loop-bump logic at lines 541-543, emitted ids tracked in `seen` dict at lines 544-545 |
| CR-03: Details layer silently drops subpaths, mis-reports closed | `124ecab` | `_first_subpath_closed()` function at lines 994-1009, warning for multi-subpath at lines 1045-1051 |
| WR-01: Details id-uniqueness missing | `68c2085` | `seen_ids` dict at line 1031, `_unique_id()` calls at lines 1036 and 1078 |
| WR-02: Empty id from `to_snake()` | `fac2e11` | Fallback chain at line 1035: `to_snake(label) or to_snake(path.get("id", "")) or f"detail_{i + 1}"` (and equivalents elsewhere) |
| WR-03: `--grid-scale 0` crashes unhandled | `5092857` | Validation at line 1413: `if args.grid_scale < 1: sys.exit(...)` |
| WR-04: Docstring says "0.5 grid cell" but code uses 0.25 | `8de5dc3` | Docstring line 97 corrected to "nearest 0.25 grid cell" |
| WR-05: Module docstring doesn't document new features | `b1368de` | Lines 31-32, 51-52, 54-77 document circle/ellipse shapes, per-deck Hull, Details layer |
| WR-06: No-op zero subtraction in radius conversion | `1f44c1f` | Line 594: `gr = to_grid(r, unit)` (dead code removed) |

## Test Coverage

**Unit Tests: 19 total, all passing**

- **CircleRoomTests (7 tests):** Literal circle detection, pipeline end-to-end, circle+polygon mixed conversion, sodipodi arc, non-circular ellipse rejection (both forms), Corridors layer circles
- **HullTests (6 tests):** Root-level multi-path+holes, missing layer returns None, regression for real fixtures, controlled single-path compact form, per-deck multi-polygon, single-deck mode has no per-deck hull
- **DetailsTests (6 tests):** Open polyline exterior, closed polyline interior+filled, circle detail, id auto-generation, <2-vertex warn-and-skip, full end-to-end fixture with 3 mixed entries

**Command:** `python3 -m unittest discover -s tools -p "test_*.py"`  
**Result:** `Ran 19 tests in 0.005s — OK`

## Requirements Traceability

| REQ-ID | Phase | Description | Status | Evidence |
|--------|-------|-------------|--------|----------|
| CIRC-01 | 32 | `svg_to_map.py` detects SVG circle/ellipse elements in room layers and emits circle rooms (renderer support already exists) | ✓ COMPLETE | `CircleRoomTests` (7 tests); `_extract_circle_shape()` + `_get_circle_shape_elements()` + circle: emission in `_write_deckplan_yaml()` |
| HULL-03 | 32 | `svg_to_map.py` emits per-deck hulls from per-deck Hull sublayers | ✓ COMPLETE | `HullTests` (6 tests); `_extract_hull_layer()` + `_write_hull_block()` wired to multi-deck loop; schema doc updated |
| DET-02 | 32 | `svg_to_map.py` converts Inkscape "Details" sublayers into detail linework in the output YAML | ✓ COMPLETE | `DetailsTests` (6 tests); `_extract_details_layer()` + details: emission in `_write_deckplan_yaml()` with room association; schema doc updated |

## Anti-Patterns & Quality Checks

**Debt Markers:** None found  
**Stub Code:** None found  
**Dead Code:** Removed (WR-06 fix)  
**Unhandled Exceptions:** `--grid-scale < 1` now handled (WR-03 fix)  
**Module Documentation:** Updated (WR-05 fix)  
**Type Signatures:** Correct (hull_data: dict | None, all_areas: dict[...], etc.)

## Schema Compliance

**Converted output remains valid per docs/schemas/schema-encounters.md:**
- Circle room shape: `circle: {cx, cy, r}` matches schema "Circular room" field (mutually exclusive with `polygon:`)
- Per-deck hull: `hull: {polygons, holes}` or `hull: {polygon}` matches schema deck-level hull field
- Details entries: `points:` + optional `room:`, `closed:`, `filled:` OR `circle:` + optional `room:` matches schema Detail Fields
- Backwards compatibility confirmed: both existing fixture SVGs (`ship_template.svg`, `ship_template_multideck.svg`) convert with identical output (no `circle:`, per-deck `hull:`, or `details:` keys) as before Phase 32

## Regression Testing

**Pre-existing fixtures (unchanged):**
- `tools/ship_template.svg` (single-deck, no circle/details/per-deck-hull content)
- `tools/ship_template_multideck.svg` (multi-deck, no circle/details/per-deck-hull content)

**Result:** Both convert with zero output change — confirmed by full 19-test suite passing with no new stderr warnings and no new YAML keys in output.

**Full suite regression:** `CircleRoomTests` + `HullTests` + `DetailsTests` all run together with zero cross-feature interference.

## Conclusion

**Phase 32 goal is fully achieved.** All three requirements (CIRC-01, HULL-03, DET-02) are implemented, tested, and integrated into the production codebase. All code review findings have been fixed and verified. The schema documentation is updated to reflect the new features. Regression testing confirms no impact on pre-existing map conversions.

---

**Verified by:** Claude (gsd-verifier)  
**Verification Date:** 2026-08-25T20:30:00Z  
**Test Suite:** `python3 -m unittest discover -s tools -p "test_*.py"` — 19 tests, 0 failures
