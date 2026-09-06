---
phase: 33-isometric-view
plan: 01
subsystem: encounter-map
tags: [svg, projection, geometry, react, encounter-map, isometric]

# Dependency graph
requires:
  - phase: 31-hull-render-details-poi
    provides: MapView/Projection geometry seam (project/unproject/wallEdges/roomPolygonPoints), circle room/detail shapes
provides:
  - isoProjection() true-isometric (30-degree) grid-to-SVG coordinate transform
  - view.circleTransform() reusable SVG-matrix technique for non-orthogonal circle rendering
  - Live top-down/iso projection toggle in EncounterMapRenderer (per-mount local state)
  - Vent polylines and token popup-anchor migrated off raw unitSize arithmetic onto view.project()/view.unitSize
affects: [33-02, 33-03]

# Actuals (#2632)
actuals:
  tokens: 5427
  tasks: 2
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG matrix() transform for circle-as-ellipse rendering, driven by a MapView.circleTransform() helper (cx,cy,m11,m21,m12,m22 matching SVG matrix(a,b,c,d,e,f) parameter order)"
    - "vectorEffect=\"non-scaling-stroke\" on stroked shapes that carry a scale/shear transform, so stroke width stays visually constant regardless of the projection's scale factor"

key-files:
  created:
    - src/components/domain/encounter/geometry/__tests__/mapView.test.ts
  modified:
    - src/components/domain/encounter/geometry/gridProjection.ts
    - src/components/domain/encounter/geometry/mapView.ts
    - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/renderer/RoomsLayer.tsx
    - src/components/domain/encounter/renderer/DetailsLayer.tsx

key-decisions:
  - "isoProjection uses tilt:30/rotation:45 as fixed, non-user-facing constants (D-01/D-02) — true 30-degree isometric, not the 26.565-degree dimetric convention"
  - "circleTransform's field names (m11/m21/m12/m22) intentionally mirror SVG matrix(a,b,c,d,e,f) parameter order so call sites emit the string literally, without reordering"
  - "Added vectorEffect=\"non-scaling-stroke\" to circle wall/detail strokes (not specified verbatim in the plan's action text) because rendering circles via a scaling transform would otherwise inflate stroke width by the projection's scale factor — a visual regression the plan's <behavior> section implicitly rules out"

patterns-established:
  - "Any future non-orthogonal projection or scaled shape reuses view.circleTransform() + matrix() + non-scaling-stroke rather than inventing per-shape scaling logic"

requirements-completed: [ISO-01, ISO-02, ISO-03]

coverage:
  - id: D1
    description: "isoProjection() produces a true 30-degree isometric axis angle, round-trips within 1e-9, and throws on degenerate tilt"
    requirement: "ISO-01"
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts#isoProjection"
        status: pass
    human_judgment: false
  - id: D2
    description: "makeMapView(isoProjection(...)) wires roomPolygonPoints/wallEdges/unitSize through the same methods RoomsLayer/DoorsLayer/PoiLayer already call"
    requirement: "ISO-02"
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/mapView.test.ts#makeMapView + isoProjection wiring"
        status: pass
    human_judgment: false
  - id: D3
    description: "Top-down/iso toggle button wired into EncounterMapRenderer per UI-SPEC (placement, copy, colors, aria attributes), local useState per mount"
    requirement: "ISO-03"
    verification:
      - kind: manual_procedural
        ref: "grep -n encounter-map__projection-toggle EncounterMapRenderer.tsx (1 match); grep -n isoProjection (2 matches)"
        status: pass
    human_judgment: true
    rationale: "Visual correctness of the toggle's placement/colors/copy against UI-SPEC and the actual on-screen iso skew of rooms/walls/doors/POI/vents/tokens requires a human to view the rendered map — no DOM-render test infrastructure exists in this repo (RESEARCH.md confirmed) to assert this automatically."
  - id: D4
    description: "Vent polylines and token popup-anchor migrated from raw unitSize arithmetic to view.project()/view.unitSize (D-05 bypass sites closed)"
    requirement: "ISO-01"
    verification:
      - kind: manual_procedural
        ref: "grep -n 'x \\* unitSize' and 'token.x \\* unitSize' EncounterMapRenderer.tsx (0 matches each)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Circle rooms and circle details render as true ellipses under iso via view.circleTransform() + SVG matrix(), byte-identical circles under top-down"
    requirement: "ISO-01"
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/mapView.test.ts#MapView.circleTransform"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-06
status: complete
---

# Phase 33 Plan 01: isoProjection + Toggle Wiring + Circle Ellipses Summary

**True-isometric `isoProjection()` wired into a live top-down/iso toggle, with vent/token bypass sites closed and circle rooms/details rendering as SVG-matrix ellipses via the new `view.circleTransform()`.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-06T19:50:00Z (approx, per STATE.md session start)
- **Completed:** 2026-09-06T19:57:06Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `isoProjection({unitSize,tilt,rotation})` added to `gridProjection.ts`: true 30-degree isometric transform satisfying the same `Projection` contract as `topDownProjection` (round-trip within 1e-9, degenerate-tilt guard).
- New `geometry/__tests__/mapView.test.ts` proves `makeMapView(isoProjection(...))`'s `roomPolygonPoints`/`wallEdges`/`unitSize` are wired through the exact same methods `RoomsLayer`, `DoorsLayer`, and `PoiLayer` already call — the tracer's core claim.
- Live top-down/iso toggle button added to `EncounterMapRenderer`'s bottom-left overlay slot, matching `33-UI-SPEC.md`'s copy/color/aria contract exactly, with independent local `useState` per mount (player and GM views toggle independently).
- Both D-05-named `unitSize`-bypass sites (vent polyline points, token popup-anchor position) migrated to `view.project()`/`view.unitSize`.
- `view.circleTransform()` added to `MapView`: reduces to a pure scale under top-down (byte-identical to the old `r * unitSize` approach) and produces a true ellipse matrix under iso. `RoomsLayer`'s and `DetailsLayer`'s circle branches now use it via an SVG `matrix()` transform.
- `RoomsLayer`'s `label_offset` bug fixed (`view.unitSize` instead of raw `unitSize` prop); the now-fully-dead `unitSize` prop removed from `RoomsLayer`.

## Task Commits

Each task was committed atomically (TDD RED/GREEN pairs per sub-feature):

1. **Task 1 (Tracer) — RED:** `c12bb96` (test) — failing isoProjection + makeMapView wiring tests
2. **Task 1 (Tracer) — GREEN:** `cde443f` (feat) — `isoProjection()` implementation
3. **Task 1 (Tracer) — toggle wiring:** `a13b103` (feat) — toggle button + D-05 bypass-site migration
4. **Task 2 — RED:** `2378b07` (test) — failing `circleTransform` tests
5. **Task 2 — GREEN:** `fd943df` (feat) — `circleTransform()` + RoomsLayer/DetailsLayer circle branches + label-offset fix + dead-prop cleanup

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `src/components/domain/encounter/geometry/gridProjection.ts` — added `isoProjection()` + `IsoProjectionOptions`
- `src/components/domain/encounter/geometry/mapView.ts` — added `circleTransform()` + `CircleTransform` to `MapView`
- `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — isoProjection describe block (axis-angle, round-trip, degenerate-throw)
- `src/components/domain/encounter/geometry/__tests__/mapView.test.ts` (new) — makeMapView wiring tests + circleTransform tests
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — projectionMode state, toggle button, vent/token bypass migration
- `src/components/domain/encounter/renderer/RoomsLayer.tsx` — circleTransform-based circle rendering, label-offset fix, dead unitSize prop removed
- `src/components/domain/encounter/renderer/DetailsLayer.tsx` — circleTransform-based circle rendering

## Decisions Made
- Kept `tilt:30, rotation:45` as hardcoded constants in the `EncounterMapRenderer` useMemo (not user-configurable), per UI-SPEC's "one fixed baked-in style" directive.
- `circleTransform`'s matrix field naming intentionally matches SVG `matrix(a,b,c,d,e,f)` order for direct string interpolation at call sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `vectorEffect="non-scaling-stroke"` to stroked circle-as-ellipse shapes**
- **Found during:** Task 2 (circleTransform wiring into RoomsLayer/DetailsLayer)
- **Issue:** The plan's action text specified keeping every prop besides `cx`/`cy`/`r`/`transform` unchanged on the affected `<circle>` elements. Applying a scaling `matrix()` transform to a `<circle r=1>` also scales the element's `strokeWidth` (SVG scales stroke width with the local coordinate system established by an element's own `transform`), which would inflate wall/detail stroke thickness by the projection's scale factor (e.g. `WALL_THICKNESS=5` rendering at ~40x that under a `unitSize=40` scale) — a visible regression versus the pre-existing unscaled-stroke rendering.
- **Fix:** Added `vectorEffect="non-scaling-stroke"` to the wall-stroke circle in `RoomsLayer.tsx` and the stroked circle in `DetailsLayer.tsx`, keeping visual stroke width constant regardless of the transform's scale.
- **Files modified:** `src/components/domain/encounter/renderer/RoomsLayer.tsx`, `src/components/domain/encounter/renderer/DetailsLayer.tsx`
- **Verification:** `pnpm run typecheck` clean; full encounter test suite (185 tests) green; the floor-fill and hit-target circles have no stroke, so they are unaffected.
- **Committed in:** `fd943df` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness fix for the transform-based circle rendering technique the plan introduced; no scope creep, no visual behavior added beyond what D-02 (flat re-projection only) requires.

### Note on an unsatisfiable literal acceptance-criterion grep

Task 2's acceptance criteria include `grep -n "unitSize" src/components/domain/encounter/renderer/RoomsLayer.tsx` returning zero matches. As written this is a plain substring grep, which also matches `view.unitSize` (used at 3 call sites: the label-offset fix this same task introduces, and the pre-existing `fontSize={view.unitSize * 0.45}`). The actual intent — confirmed by the task's `<done>` criterion ("RoomsLayer's ... now-fully-dead unitSize prop are cleaned up") — is that the raw/bare `unitSize` **prop** (not `view.unitSize`) is removed. That prop is fully removed from `RoomsLayerProps`, the destructured params, and the `EncounterMapRenderer.tsx` call site. Treated as a plan-authoring imprecision, not a deviation requiring a fix — no code change was needed beyond what the task's `<action>`/`<done>` already specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The projection seam now supports both top-down and true-isometric rendering, end-to-end, for rect rooms, walls, doors, hull, POI icons, vents, token popup anchors, and circle rooms/details.
- Token glyphs and mouse-inversion (drag/drop) correctness under iso are explicitly out of scope for this plan — Plan 33-02's job, per the plan's own objective statement.
- No blockers for 33-02.

---
*Phase: 33-isometric-view*
*Completed: 2026-09-06*
