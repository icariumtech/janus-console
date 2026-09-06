# Phase 33: Isometric View - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 10 (1 new function, 9 modified)
**Analogs found:** 10 / 10 (all analogs are sibling code in the same files being modified — this phase extends an existing seam rather than introducing a new subsystem)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/domain/encounter/geometry/gridProjection.ts` (add `isoProjection()`) | utility (geometry transform) | transform | `topDownProjection()` in the same file (lines 67-80) | exact — same interface, same file |
| `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` (add iso describe-block) | test | transform | existing `topDownProjection` describe-block in the same file | exact |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` (projection-mode state + toggle button + fix vent bypass) | component (renderer/orchestrator) | request-response (React render) | existing `useMemo` projection instantiation (~line 188) + RESET VIEW button (~line 719-741) in the same file | exact — same file, same pattern family |
| `src/components/domain/encounter/Token.tsx` (migrate position math to `view.project()`) | component | transform | itself (needs prop-shape change from `unitSize: number` to `view: MapView`) — closest external analog is `RoomsLayer.tsx`'s `view.project()` usage | role-match |
| `src/components/domain/encounter/TokenLayer.tsx` (thread `view` prop through to `Token`) | component (layer/container) | transform | `renderer/RoomsLayer.tsx`, `renderer/DoorsLayer.tsx` — both already receive/use `view: MapView` | exact |
| `src/components/domain/encounter/renderer/RoomsLayer.tsx` (circle→ellipse matrix fix; label-offset `view.unitSize` fix) | component (layer) | transform | `renderer/DetailsLayer.tsx`'s identical circle-radius line (same bug, same fix needed) | exact |
| `src/components/domain/encounter/renderer/DetailsLayer.tsx` (circle→ellipse matrix fix) | component (layer) | transform | `renderer/RoomsLayer.tsx`'s circle handling (mirror fix) | exact |
| `src/utils/svgCoordinates.ts` (add projection-aware `getGridCellViaView`/inverse helper) | utility | transform | `snapToGrid`/`getGridCell` in the same file (lines 67-76 and callers) | exact — same file, inverse-direction sibling function |
| `src/hooks/useTokenPlacement.ts` (call new view-aware grid-cell helper) | hook | event-driven (drag/drop) | itself, current `getGridCell` call at line 54 | exact |
| `src/components/gm/views/EncounterView.tsx` / `MapPreview.tsx` (no code change expected; human-verify entry point) | component | request-response | N/A — verification target, not a pattern-copy target | n/a |

## Pattern Assignments

### `src/components/domain/encounter/geometry/gridProjection.ts` (utility, transform)

**Analog:** `topDownProjection()`, same file, lines 67-80 (verified via direct read this session):

```typescript
export function topDownProjection(opts: TopDownProjectionOptions): Projection {
  const us = opts.unitSize;
  if (!(us > 0) || !Number.isFinite(us)) {
    throw new Error(`topDownProjection: unitSize must be a positive finite number, got ${us}`);
  }
  return {
    project({ gx, gy }) {
      return { x: gx * us, y: gy * us };
    },
    unproject({ x, y }) {
      return { gx: x / us, gy: y / us };
    },
  };
}
```

**Pattern to copy:** same shape — validate options up front with a thrown `Error` (matching message style `"<fnName>: <field> must be ...,  got ${value}"`), then return an object literal implementing `Projection` with `project`/`unproject` closures capturing the validated locals. Module docstring at lines 1-14 already documents "Interface Invariant 2" (projection is the ONLY producer of SVG-space numbers) and explicitly names `isoProjection({ unitSize, tilt, rotation })` as the intended next addition (lines 9-10, 63-65) — add it immediately after `topDownProjection` in the same file, exporting `IsoProjectionOptions` alongside `TopDownProjectionOptions`.

**Core transform (RESEARCH.md-derived, numerically verified this session — use verbatim):**
```typescript
export interface IsoProjectionOptions {
  unitSize: number;
  tilt: number;      // degrees, (0, 90) exclusive — 30 for true isometric (D-01)
  rotation: number;  // degrees — 45 is the standard diagonal orientation
}

export function isoProjection(opts: IsoProjectionOptions): Projection {
  const { unitSize: us, tilt, rotation } = opts;
  if (!(us > 0) || !Number.isFinite(us)) {
    throw new Error(`isoProjection: unitSize must be a positive finite number, got ${us}`);
  }
  if (!(tilt > 0 && tilt < 90) || !Number.isFinite(tilt)) {
    throw new Error(`isoProjection: tilt must be a finite number in (0, 90), got ${tilt}`);
  }
  const t = (tilt * Math.PI) / 180;
  const r = (rotation * Math.PI) / 180;
  const a = us * Math.cos(t) * Math.cos(r);
  const b = -us * Math.cos(t) * Math.sin(r);
  const c = us * Math.sin(t) * Math.sin(r);
  const d = us * Math.sin(t) * Math.cos(r);
  const det = a * d - b * c; // = us^2 * sin(t) * cos(t)
  return {
    project({ gx, gy }) { return { x: a * gx + b * gy, y: c * gx + d * gy }; },
    unproject({ x, y }) { return { gx: (d * x - b * y) / det, gy: (-c * x + a * y) / det }; },
  };
}
```

---

### `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` (test)

**Analog:** existing `topDownProjection` describe-block in the same file (round-trip + guard-throw conventions; `1e-10` epsilon already established there).

**Pattern:** add a sibling `describe('isoProjection', ...)` block with three `it`s — axis-angle-equals-tilt (D-01's actual acceptance criterion), round-trip within epsilon, and throws on degenerate `tilt` (0 or 90). Exact test bodies given in RESEARCH.md "Code Examples" (verified numerically: 30.0000° axis angle at `tilt=30,rotation=45`; round-trip error 1.4e-14).

---

### `src/components/domain/encounter/EncounterMapRenderer.tsx` (component, request-response)

**Analog (projection instantiation):** same file, ~line 188 (verified):
```tsx
const projection = useMemo(
  () => topDownProjection({ unitSize }),
  [unitSize]
);
const view = useMemo(() => makeMapView(projection), [projection]);
```
**Pattern to copy:** add `const [projectionMode, setProjectionMode] = useState<'top-down' | 'iso'>('top-down')`, then switch the `useMemo` factory on `projectionMode` (include it in the deps array):
```tsx
const projection = useMemo(
  () => projectionMode === 'iso'
    ? isoProjection({ unitSize, tilt: 30, rotation: 45 })
    : topDownProjection({ unitSize }),
  [unitSize, projectionMode]
);
```

**Analog (toggle button styling — copy verbatim from RESET VIEW):** same file, ~lines 719-741. Reuse the exact style block (background, border, font, padding) with a color swap keyed on `projectionMode` (teal `#4a6b6b`/`#7ab8b8` for top-down, amber `#c9a050` for iso — matches CLAUDE.md's teal/amber palette). Place in `gridArea: 'bottom-left'` of `encounter-map__overlays` per D-03. Concrete button JSX given in RESEARCH.md "Code Examples" — copy near-verbatim, only the projection-mode wiring is new.

**Bypass fix — vent polyline (Pitfall 2), same file, line 567 (verified):**
```typescript
// BEFORE (bypasses view — bug under iso):
const pts = vent.points.map(([x, y]) => `${x * unitSize},${y * unitSize}`).join(' ');
// AFTER:
const pts = vent.points.map(([gx, gy]) => {
  const p = view.project({ gx, gy });
  return `${p.x},${p.y}`;
}).join(' ');
```
Sibling `strokeWidth`/`strokeDasharray` sizing on lines 574, 589, 592 should switch from raw `unitSize` to `view.unitSize` for consistency (same convention as `RoomsLayer.tsx`'s circle-radius sizing).

**Bypass fix — token popup-anchor position, ~line 658:** same `view.project({ gx: token.x, gy: token.y })` substitution pattern.

---

### `src/components/domain/encounter/Token.tsx` (component, transform)

**Analog:** `renderer/RoomsLayer.tsx`'s established `view: MapView` prop + `view.project()` usage (this is the target convention Token.tsx currently violates — Interface Invariant 2).

**Current (buggy) pattern, lines 41-42 (verified):**
```typescript
const centerX = data.x * unitSize + unitSize / 2;
const centerY = data.y * unitSize + unitSize / 2;
```
**Fix pattern:** change `Token`'s prop from `unitSize: number` to `view: MapView`, then:
```typescript
const center = view.project({ gx: data.x + 0.5, gy: data.y + 0.5 });
const centerX = center.x;
const centerY = center.y;
```
Radius/glow/stroke sizing (lines 45-50, `tokenRadius = unitSize * 0.45` etc.) should switch to `view.unitSize` — same convention `RoomsLayer.tsx` already uses for circle radii (`room.circle.r * view.unitSize`, verified at `RoomsLayer.tsx:122-126`).

---

### `src/components/domain/encounter/TokenLayer.tsx` (component, transform)

**Analog:** `renderer/RoomsLayer.tsx` / `renderer/DoorsLayer.tsx` prop shape — both already declare `view: MapView` rather than a raw `unitSize: number`.

**Current pattern to change, line 24 (verified):** `unitSize: number;` in `TokenLayer`'s props interface.
**Fix:** replace with `view: MapView;`, pass `view` down into each `<Token view={view} .../>` instead of `unitSize`. Also thread `view` (not just `unitSize`) into the drag-to-move snap logic (see `svgCoordinates.ts` section below) since `TokenLayer.tsx:213-215` is one of the four `snapToGrid` call sites.

---

### `src/components/domain/encounter/renderer/RoomsLayer.tsx` / `DetailsLayer.tsx` (component, transform)

**Analog:** each other — both have the identical bug at their own circle-rendering call site.

**Current pattern, `RoomsLayer.tsx:122-126` (verified):**
```typescript
// Circle radius scales with horizontal unit size (top-down projection;
// for iso projections circles would render as ellipses — out of scope).
const svgCx = center.x;
const svgCy = center.y;
const svgR = room.circle.r * view.unitSize;
```
and identically at `DetailsLayer.tsx:39-41` (`const r = detail.circle.r * view.unitSize;`).

**Fix pattern (SVG-native `matrix()`, no new math library) — copy into both files:**
```tsx
const origin = view.project({ gx: cx, gy: cy });
const ux = view.project({ gx: cx + 1, gy: cy });
const uy = view.project({ gx: cx, gy: cy + 1 });
const a = ux.x - origin.x, c = ux.y - origin.y;
const b = uy.x - origin.x, d = uy.y - origin.y;
<circle
  r={1}
  transform={`translate(${origin.x},${origin.y}) matrix(${a * r},${c * r},${b * r},${d * r},0,0)`}
/>
```
This generalizes to `topDownProjection` too (reduces to a pure scale+translate), so no projection-mode branching is needed inside the layer — it's a pure function of `view`.

**Secondary fix — `RoomsLayer.tsx` label offset, lines 74-76 (verified):**
```typescript
// BEFORE:
const lx = label.x + odx * unitSize;
const ly = label.y + ody * unitSize;
// AFTER:
const lx = label.x + odx * view.unitSize;
const ly = label.y + ody * view.unitSize;
```

---

### `src/utils/svgCoordinates.ts` (utility, transform/inverse)

**Analog:** `snapToGrid`/`getGridCell`, same file, lines 67-76 (verified) — the sibling function this phase must add an inverse-projection-aware variant of, not replace outright (other non-iso call sites like the Phase 29 editor's `PoiLayer.tsx` may keep using the raw version, per RESEARCH.md's scope note).

**Current pattern:**
```typescript
export function snapToGrid(
  svgX: number,
  svgY: number,
  unitSize: number
): { gridX: number; gridY: number } {
  return {
    gridX: Math.floor(svgX / unitSize),
    gridY: Math.floor(svgY / unitSize),
  };
}
```
**Fix pattern — add a new sibling function following the same signature/naming convention:**
```typescript
export function getGridCellViaView(
  view: MapView,
  svgX: number,
  svgY: number
): { gridX: number; gridY: number } {
  const { gx, gy } = view.unproject({ x: svgX, y: svgY });
  return { gridX: Math.floor(gx), gridY: Math.floor(gy) };
}
```
Wire this into the four call sites that matter for ISO-03 (`TokenLayer.tsx:213-215` GM drag-to-move, `useTokenPlacement.ts:54` GM drag-drop placement) by threading `view: MapView` alongside/instead of `unitSize` through those call chains — same "thread `view` down" pattern as the `TokenLayer`/`Token` fix above. `PoiLayer.tsx`'s editor-mode calls are lower priority (editor screen isn't in this phase's toggle scope per RESEARCH.md) but should ideally get the same treatment for consistency.

---

### `src/hooks/useTokenPlacement.ts` (hook, event-driven)

**Analog:** itself, current call at line 54 (verified):
```typescript
const { gridX, gridY } = getGridCell(svgRef.current, e.clientX, e.clientY, unitSize, mapRotation, mapCenterX, mapCenterY);
```
**Fix pattern:** accept a `view: MapView` param (in addition to or instead of raw `unitSize`) and call `getGridCellViaView` (after the existing `screenToSVG` + `inverseRotatePoint` steps, which stay unchanged per D-06 — `mapRotation` is orthogonal to projection and continues to be handled outside the projection/view layer).

## Shared Patterns

### Interface Invariant 2 — `MapView`/`Projection` is the only producer of SVG coordinates
**Source:** `src/components/domain/encounter/geometry/mapView.ts` (doc comments) and `gridProjection.ts` lines 1-14, 30-43.
**Apply to:** every layer/component file listed above. The single unifying pattern this phase enforces: replace every direct `<value> * unitSize` (forward) or `<value> / unitSize` (inverse) arithmetic outside `gridProjection.ts`/`mapView.ts` with `view.project()` / `view.unproject()` respectively. Mandatory pre-merge check per RESEARCH.md: `grep -rn "unitSize" src/` outside those two files, verifying every remaining hit is a `view.unitSize` size-only read (acceptable) rather than raw `unitSize` prop position/inversion math (bug).

### `view.unitSize` vs raw `unitSize` prop — "size, not position" convention
**Source:** `src/components/domain/encounter/geometry/mapView.ts` lines 107-116 (verified doc comment):
```
* Pixel-scale of one grid cell along an axis. Exposed for door slot
* dimensions and other "size, not position" pixel computations.
*
* Defined as the projected length of the unit grid vector (1, 0).
* For top-down this equals `unitSize`. For an iso projection this is
* the projected horizontal cell extent (callers that need vertical
* cell extent should use `project` directly).
```
**Apply to:** any *size* computation (stroke width, radius, label offset, glow radius) in `RoomsLayer.tsx`, `DetailsLayer.tsx`, `Token.tsx`, and the vent block in `EncounterMapRenderer.tsx` — use `view.unitSize`, never the raw `unitSize` prop, once a component also has access to `view`.

### Toggle button style contract (D-03/D-04)
**Source:** RESET VIEW button, `EncounterMapRenderer.tsx` lines 719-741 (verified, byte-for-byte reuse target).
**Apply to:** the new projection toggle button — copy the style object verbatim (background `rgba(15, 21, 21, 0.95)`, font `'Cascadia Code', 'Courier New', monospace`, `fontSize: '11px'`, `letterSpacing: '2px'`), swap only the border/text color to reflect active/inactive state (teal `#4a6b6b`/`#7ab8b8` vs. amber `#c9a050`) and `gridArea: 'bottom-left'`.

## No Analog Found

None — every file in scope either already contains the pattern to extend (same-file analog) or has a direct sibling file with the exact target convention (`RoomsLayer.tsx`/`DoorsLayer.tsx` as the `view: MapView`-prop exemplar for `Token.tsx`/`TokenLayer.tsx`).

## Metadata

**Analog search scope:** `src/components/domain/encounter/**`, `src/utils/svgCoordinates.ts`, `src/hooks/useTokenPlacement.ts` — all files already fully read and line-verified by RESEARCH.md this session; this pattern map reuses those verified excerpts rather than re-reading (per no-re-read rule) and confirms all 10 target files are git-tracked (`git ls-files`).
**Files scanned:** 10 (all confirmed tracked, no gitignored mirrors involved — this is a pure application-code phase, no `.gsd/capabilities` involvement)
**Pattern extraction date:** 2026-09-06
