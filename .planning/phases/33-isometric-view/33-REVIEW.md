---
phase: 33-isometric-view
reviewed: 2026-09-07T00:00:00Z
depth: quick
files_reviewed: 14
files_reviewed_list:
  - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
  - src/components/domain/encounter/geometry/__tests__/mapView.test.ts
  - src/components/domain/encounter/geometry/gridProjection.ts
  - src/components/domain/encounter/geometry/mapView.ts
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/components/domain/encounter/Token.tsx
  - src/components/domain/encounter/TokenLayer.tsx
  - src/components/domain/encounter/renderer/DetailsLayer.tsx
  - src/components/domain/encounter/renderer/PoiLayer.tsx
  - src/components/domain/encounter/renderer/RoomsLayer.tsx
  - src/components/gm/MapPreview.tsx
  - src/hooks/useTokenPlacement.ts
  - src/utils/__tests__/svgCoordinates.test.ts
  - src/utils/svgCoordinates.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-09-07T00:00:00Z
**Depth:** quick
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase adds `isoProjection` alongside the existing `topDownProjection`, wires an
isometric toggle into `EncounterMapRenderer`, and migrates `Token`/`TokenLayer`/
`PoiLayer`/`RoomsLayer`/`useTokenPlacement` from raw `unitSize` arithmetic to the
`MapView` projection seam (`view.project`/`view.unproject`/`view.circleTransform`).
The projection math itself (`isoProjection.project`/`.unproject`) is correct and
well covered by round-trip tests in `gridProjection.test.ts` and `mapView.test.ts`.

However, `MapView.bbox()` — the function `EncounterMapRenderer` uses to compute the
SVG `viewBox` / background rect dimensions for the *entire map* — was not updated
for non-orthogonal projections. It samples only two of a grid rectangle's four
projected corners, which is safe for axis-aligned `topDownProjection` but produces
an incorrect (in some cases zero-width) bounding box once `isoProjection` is
selected. Since this is the actual size/origin used for the SVG `viewBox`, and the
container CSS clips overflow, this bug can make the isometric view partially or
completely invisible for maps whose grid bounding box is square (or near-square)
under the default `tilt: 30, rotation: 45` — exactly the config this phase wires up
by default. No test exercises `MapView.bbox()` under `isoProjection`, so this
regression is unguarded.

Two lower-severity issues also stand out: the always-visible background grid
pattern doesn't rotate/skew with the isometric projection, producing a visible
seam-mismatch between floor shapes and the backdrop when iso mode is toggled;
and `useTokenPlacement`'s `handleDrop` callback omits `mapRotation`/`mapCenterX`/
`mapCenterY` from its `useCallback` dependency array despite reading them in its
body, risking stale-closure token placement if those values change independently
of the other listed dependencies.

## Critical Issues

### CR-01: `MapView.bbox()` produces an incorrect (sometimes zero-width) viewBox under `isoProjection`

**File:** `src/components/domain/encounter/geometry/mapView.ts:220-231`
**Issue:**

```ts
bbox(rooms: GridRoom[], hull?: HullDef, padding = 0): SvgBBox {
  const grid: GridRectArea = roomBBoxGrid(rooms, hull, padding);
  const tl = projection.project({ gx: grid.gx, gy: grid.gy });
  const br = projection.project({ gx: grid.gx + grid.gw, gy: grid.gy + grid.gh });
  const originX = Math.min(tl.x, br.x);
  const originY = Math.min(tl.y, br.y);
  const width   = Math.abs(br.x - tl.x);
  const height  = Math.abs(br.y - tl.y);
  return { originX, originY, width, height };
},
```

This projects only the top-left and bottom-right corners of the grid-space
bounding rect and takes `min`/`max` of just those two points. For an
axis-aligned `topDownProjection` this is correct — the other two corners
(`tr`, `bl`) never extend the bbox further than `tl`/`br`. For a rotated/
sheared projection like `isoProjection`, that assumption is false: the
`tr`/`bl` corners can extend well beyond the `tl`–`br` diagonal, so the
resulting box under-counts the true extent (and the `min`/`max` normalization
does not fix this — it only handles `tl`/`br` being swapped, not the missing
samples).

Concretely, with the default `isoProjection({ unitSize: 40, tilt: 30, rotation: 45 })`
that `EncounterMapRenderer.tsx:194` wires up, the transform matrix has
`a = us·cos(t)·cos(r) ≈ 24.495` and `b = -us·cos(t)·sin(r) ≈ -24.495`
(i.e. `a + b == 0` when `rotation = 45`). For any grid bounding box where
`grid.gw === grid.gh` (a square bbox — common for symmetric/near-square decks,
and easy to hit by construction via `viewPadding`), `br.x - tl.x = grid.gw·(a+b) = 0`
**exactly**, so `width` computes to `0`. `EncounterMapRenderer` feeds this
straight into the SVG `viewBox` (`rotViewBoxW`/`rotViewBoxH`, line 462) and the
background `<rect>` (lines 501-510); the container has `overflow: hidden`
(`EncounterMapRenderer.css:14`) and the `<svg>` uses `preserveAspectRatio="xMidYMid meet"`
with `max-width/max-height: 100%`. A `viewBox` with `width: 0` collapses the
rendered map to nothing (or, for non-square bboxes, clips/misplaces content
that falls outside the under-counted box). This directly breaks the "ISO VIEW"
toggle that is the point of this phase, for a common class of decks.

No test in `mapView.test.ts` exercises `bbox()` under `isoProjection` (only
`roomPolygonPoints`, `wallEdges`, `unitSize`, and `circleTransform` are
covered), so this regression is not caught by the added test suite.

**Fix:** project all four corners of the grid rect (or the four corners
implied by `roomBBoxGrid`) and take min/max over all four, e.g.:

```ts
bbox(rooms: GridRoom[], hull?: HullDef, padding = 0): SvgBBox {
  const grid: GridRectArea = roomBBoxGrid(rooms, hull, padding);
  const corners = [
    projection.project({ gx: grid.gx, gy: grid.gy }),
    projection.project({ gx: grid.gx + grid.gw, gy: grid.gy }),
    projection.project({ gx: grid.gx, gy: grid.gy + grid.gh }),
    projection.project({ gx: grid.gx + grid.gw, gy: grid.gy + grid.gh }),
  ];
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  const originX = Math.min(...xs);
  const originY = Math.min(...ys);
  return {
    originX,
    originY,
    width: Math.max(...xs) - originX,
    height: Math.max(...ys) - originY,
  };
},
```

Add a `mapView.test.ts` case asserting `bbox()` under `isoProjection` matches
the min/max of all four projected corners for a square grid rect (this would
have caught the zero-width case).

## Warnings

### WR-01: Background grid pattern does not follow the isometric projection

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:482-493`
**Issue:** The faint background grid (`<pattern id="map-bg-grid" ...>`) is
still tiled in flat `unitSize × unitSize` squares in document space,
independent of `projection`/`view`. When `projectionMode === 'iso'`, room
floors, walls, and hull are all rendered through `view.project` and appear as
skewed/foreshortened shapes, but the backdrop grid stays perfectly square and
axis-aligned. This produces a visible mismatch between the floor grid and the
background grid specifically introduced by this phase's iso toggle (it was
never wrong before because the projection was always top-down).
**Fix:** Either hide the background grid pattern when `projectionMode === 'iso'`,
or generate the pattern from `view.project` of a unit cell's corners (e.g. a
`<pattern>` whose `patternTransform` applies the projection's linear part) so
it visually matches the projected room geometry.

### WR-02: `useTokenPlacement`'s `handleDrop` reads `mapRotation`/`mapCenterX`/`mapCenterY` but omits them from its dependency array

**File:** `src/hooks/useTokenPlacement.ts:42-67`
**Issue:**

```ts
const handleDrop = useCallback((e: React.DragEvent) => {
  ...
  const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
  ...
}, [isGM, onTokenPlace, view, isCellOccupied, findRoomAtCell, svgRef]);
```

`mapRotation`, `mapCenterX`, and `mapCenterY` are read inside the callback but
are not part of the `useCallback` dependency array. If any of them change on a
re-render where `view`, `isGM`, `onTokenPlace`, `isCellOccupied`, and
`findRoomAtCell` all happen to keep the same references (e.g. the deck's
authored `rotation` differs from the previous deck but `unit_size` and room
set stay referentially unchanged upstream), the memoized `handleDrop` will
compute the grid-drop target using stale rotation/center values, placing the
token in the wrong cell. This is an exhaustive-deps violation that predates
this phase's refactor (the same gap existed with `unitSize` before), but it's
still live in the reviewed file and worth closing while this hook is being
touched.
**Fix:** Add the three values to the dependency array:

```ts
}, [isGM, onTokenPlace, view, isCellOccupied, findRoomAtCell, svgRef, mapRotation, mapCenterX, mapCenterY]);
```

## Info

### IN-01: `MapView.doorBounds` explicitly scopes iso support to horizontal cell extent only

**File:** `src/components/domain/encounter/geometry/mapView.ts:177-191`
**Issue:** `doorBounds` derives both `slotLength` and `slotThickness` from the
single scalar `unitSize` (the projected horizontal cell extent), regardless of
a door's wall orientation. The docstring on `MapView.unitSize` (lines 132-141)
already flags this as a known limitation ("callers that need vertical cell
extent should use `project` directly"), so this isn't a regression, but it
means door slot rectangles rendered via `DoorBounds` will look inconsistently
sized/proportioned once the isometric toggle is in active use (a door on a
"vertical" grid wall gets the same length scalar as one on a "horizontal"
wall, even though the two walls project to different apparent lengths under
`isoProjection`).
**Fix:** If isometric door rendering needs to look correct (rather than just
not crash), thread the door's wall axis through to `circleTransform`-style
per-axis projection instead of the single scalar `unitSize`.

---

## Resolution

- **CR-01 (blocker):** Fixed — `MapView.bbox()` now samples all four projected
  corners of the grid bounding rect and takes min/max across them, instead of
  only the top-left/bottom-right pair. Regression test added to
  `mapView.test.ts` (`bbox() does not collapse to near-zero width for a
  square grid under isoProjection`), verified to fail against the pre-fix
  code (computed width ~1.4e-14) and pass against the fix (~195.96). Commit
  `ffb4470`.
- **WR-01, WR-02, IN-01:** Not fixed in this pass — non-blocking, left for a
  future phase or ad-hoc follow-up.

---

_Reviewed: 2026-09-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
