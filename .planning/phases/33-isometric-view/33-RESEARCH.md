# Phase 33: Isometric View - Research

**Researched:** 2026-09-06
**Domain:** 2D affine coordinate transforms (SVG isometric projection), React/SVG rendering seam migration
**Confidence:** HIGH (all findings grounded in this session's direct reads of the source tree; no external packages/docs involved — this phase adds zero new dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use **true isometric** projection — 30° angle, equal foreshortening on all
  three axes (the architectural/blueprint-drafting convention), not the 26.57° "2:1"
  pixel-game dimetric convention. Rationale: the renderer is SVG (vector), so the 2:1
  convention's original purpose (crisp raster pixel alignment) doesn't apply here, and
  true isometric matches the "blueprint-grade" aesthetic language already established
  for Phase 31's hull/detail linework.
  — Reversible: `isoProjection`'s tilt/rotation are just parameters.
- **D-02:** **Flat re-projection only — no fake depth/height cues.** Walls, hulls, and
  detail linework render exactly as they do today, just through the new projection; no
  new wall-extrusion, shading, or height geometry. Matches Phase 31's D-10 philosophy.
  — Reversible.
- **D-03:** The top-down/iso toggle lives in the **bottom-left slot of
  `EncounterMapRenderer`'s existing overlay grid** (`encounter-map__overlays`,
  `gridTemplateAreas` in `EncounterMapRenderer.tsx` ~line 712) — currently empty
  (top-left = RESET VIEW, top-right = LevelIndicator, bottom-right = LegendPanel). Reuses
  the same button styling as RESET VIEW. Because both `EncounterView` (player) and
  `EncounterMapDisplay` (GM) render through this same component, the toggle and its
  independent-per-viewer state come for free from each viewer's own render of the shared
  component — no new prop plumbing needed to satisfy ISO-02/ISO-03's "independently"
  requirement.
  — Reversible.
- **D-04:** **Button only — no keyboard shortcut.** No existing encounter-map control has
  a keyboard shortcut today; players are mobile-first (CLAUDE.md).
  — Reversible.
- **D-05:** Room labels, door/POI icons, and token glyphs **stay upright and horizontal
  (billboarded)** when iso is active — only wall/hull/detail *linework* follows the iso
  transform. Text and icons render at their projected position but keep normal
  orientation.
  — Reversible.
  — **Implementation note for planner/researcher:** `EncounterMapRenderer.tsx` currently
    computes token SVG position via direct `token.x * unitSize` / `token.y * unitSize`
    arithmetic in at least one place (~line 658), bypassing the `view` (`MapView`) facade
    that Interface Invariant 2 says should be the *only* producer of SVG coordinates. This
    call site (and any sibling ones, e.g. vent polyline points ~line 567) must be migrated
    to `view.project()` as part of this phase, or tokens/vents will not move correctly when
    `isoProjection` is active — this is a prerequisite for ISO-01, not an optional cleanup.
- **D-06:** The existing per-ship authored `mapRotation` (0/90/180/270, applied as an SVG
  `rotate()` transform after projection) **still applies when iso is active**. Orthogonal
  authoring metadata about the ship's grid orientation.
  — Reversible.

### Claude's Discretion

- Exact `isoProjection` parameter shape/defaults (`tilt`, `rotation` values) beyond "30°
  true isometric" — the researcher/planner should pick concrete numbers that satisfy D-01.
- Whether `mapRotation`'s SVG `rotate()` transform composes cleanly with the iso-skewed
  coordinate space visually, or needs adjustment to still read correctly.
- Whether other call sites beyond tokens/vents bypass `view` and need the same migration
  called out in D-05's implementation note — the researcher should audit for all direct
  `unitSize` multiplication in `EncounterMapRenderer.tsx` and layer files.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Also locked in `.planning/REQUIREMENTS.md`
"Out of Scope": no animated isometric transitions (toggle is a cut); no per-map
projection lock (projection is a live view preference, not YAML data).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ISO-01 | An isometric projection renders any deckplan via the existing `gridProjection`/`mapView` seam — rooms, doors, vents, POIs, tokens, and details all project correctly | See "Standard Stack" (derived+verified `isoProjection` formula), "Common Pitfalls" #1–#6 (every non-conforming call site found this session, including two NOT named in CONTEXT.md: `Token.tsx`'s render position and the circle-room/circle-detail ellipse gap), "Code Examples" |
| ISO-02 | Players can toggle the encounter view between top-down and isometric live | See "Architecture Patterns" (confirms the two real screen entry points and the self-contained-state design that satisfies "independently" for free) |
| ISO-03 | GM can toggle the GM console map between top-down and isometric live | See "Architecture Patterns" (identifies the *actual* GM console map component — `src/components/gm/views/EncounterView.tsx` via `MapPreview.tsx`, not the file CONTEXT.md named) plus Pitfall #5 (GM token drag/placement inverse-projection bypass) |

</phase_requirements>

## Summary

This phase is a pure client-side geometry + rendering change with zero new dependencies.
The seam already exists exactly as documented: `gridProjection.ts`'s `Projection`
interface and `mapView.ts`'s `MapView` facade were purpose-built in prior phases to accept
an `isoProjection({ unitSize, tilt, rotation })` swap with no changes to any consuming
layer. This session derived and numerically verified (via a Python round-trip/angle check,
see "Sources") a concrete, invertible matrix formula that satisfies D-01's "true
isometric, 30°, equal foreshortening on both axes" requirement exactly — confirmed
`atan2` axis angles of 30.0000° for both grid axes at `tilt=30, rotation=45`, versus
26.565° for the dimetric convention D-01 explicitly rejects — with round-trip
`unproject(project(p))` error of ~1.4e-14, well inside the `1e-10` epsilon the existing
`gridProjection.test.ts` suite uses.

The harder finding is scope, not math. CONTEXT.md's implementation note flagged two
`view`-bypass call sites (token popup-anchor position, vent polyline points). This
session's full-repo audit of every `unitSize`-multiplication site found **four more**,
one of which is more severe than either of the two named ones: `Token.tsx` — the
component that renders every token's *actual visible glyph* — computes its center via
raw `data.x * unitSize` (line 41-42), not `view.project()`. If left unmigrated, tokens
will render in the wrong place (not just their click-to-open-popup anchor) as soon as iso
is active. Separately, `svgCoordinates.ts`'s `snapToGrid`/`getGridCell` helpers — used by
GM token drag-to-move, GM token drag-and-drop placement, and editor-mode POI drag — invert
mouse position to grid cell by dividing by raw `unitSize`, never `view.unproject()`; under
iso this silently drops tokens/POIs into the wrong cell rather than erroring. And circle
rooms/circle details (Phase 32's CIRC-01), which project to true *ellipses* under any
non-orthogonal projection, are drawn today with a plain `<circle r={r * view.unitSize}>` —
the code's own comment already says "for iso projections circles would render as ellipses
— out of scope," a deferral this phase's ISO-01 wording ("rooms ... project correctly")
now directly contradicts and must resolve.

This session also corrected a naming ambiguity in the phase's own canonical refs:
`EncounterMapDisplay.tsx` is not GM-specific (it's shared, format-routing, and used by
both the player terminal and a couple of GM dashboard thumbnails); the actual "GM console
map" the phase goal means (the tactical/combat `ENCOUNTER` view) is
`src/components/gm/views/EncounterView.tsx` → `MapPreview.tsx` → `EncounterMapRenderer`.
This doesn't change the recommended implementation (state/button self-contained inside
`EncounterMapRenderer.tsx` still works for both), but it changes which screens the
planner/executor must open during human verification, and it surfaces that the toggle —
by construction — will also silently appear on two dashboard thumbnails and the
deckplan-editor preview that CONTEXT.md never mentioned.

**Primary recommendation:** Implement `isoProjection` as a single invertible 2×2 linear
map (rotate by `rotation`, then scale x by `cos(tilt)` and y by `sin(tilt)`, both times
`unitSize`) — the exact matrix is given in "Code Examples." Before wiring the toggle,
migrate `Token.tsx`'s position math and `svgCoordinates.ts`'s inverse-mapping helpers onto
`view.project()`/`view.unproject()` (not just the two sites CONTEXT.md named), and resolve
the circle-room/circle-detail ellipse gap using the SVG-native `matrix()` transform
technique (no library, no manual SVD) shown below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Isometric projection math (`isoProjection`) | Browser / Client | — | Pure client-side coordinate transform; no data leaves the browser, no persistence |
| Top-down/iso toggle UI + state | Browser / Client | — | Local `useState` inside a React component, per CONTEXT.md D-03 |
| Re-rendering rooms/doors/vents/POIs/tokens/details under the active projection | Browser / Client | — | All rendering is client-side SVG; backend (Django) is untouched by this phase |
| Token/POI drag inverse-projection (mouse → grid cell) | Browser / Client | — | Pointer-event math, entirely client-side |

This phase touches **zero** backend code. No Django model, API endpoint, or YAML schema
changes — `docs/schemas/*.md` do not need updates for this phase.

## Standard Stack

### Core

No new libraries. This phase is implemented entirely with the project's existing React 19
+ TypeScript + native SVG stack; the isometric transform is ~15 lines of arithmetic, not a
library concern.

### The `isoProjection` formula (derived and verified this session)

`gridProjection.ts`'s own doc comment already sketches the target shape:

```
[VERIFIED: src/components/domain/encounter/geometry/gridProjection.ts:63-65]
 * @example future iso swap (lands later, in the same shape)
 *   const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
 *   const view = makeMapView(proj);     // every other module is unaffected
```

This session derived a concrete formula satisfying that shape and D-01, then verified it
numerically (Python, see "Sources" — not from any external doc, this is original
derivation + computed verification, tag accordingly):

```
t = tilt * DEG2RAD      // default 30°
r = rotation * DEG2RAD  // default 45°

// 2×2 linear map, no translation (grid origin (0,0) → SVG origin (0,0), same as topDown)
a = unitSize * cos(t) * cos(r)
b = -unitSize * cos(t) * sin(r)
c = unitSize * sin(t) * sin(r)
d = unitSize * sin(t) * cos(r)

project({gx, gy})   = { x: a*gx + b*gy, y: c*gx + d*gy }
unproject({x, y})   = { gx: (d*x - b*y) / det, gy: (-c*x + a*y) / det }   // det = a*d - b*c = unitSize² * sin(t) * cos(t)
```

Computed confirmation (not an assumption — this is a reproducible calculation, re-run it
to check): with `unitSize=40, tilt=30, rotation=45`, `project({gx:1,gy:0})` lands at
`(24.4949, 14.1421)`, whose angle from horizontal is **exactly 30.0000°** (matches D-01's
"true isometric, 30° angle" precisely); the mirror axis `project({gx:0,gy:1})` lands at
`(-24.4949, 14.1421)`, also 30° from horizontal on the other side — the classic symmetric
isometric "V". The same formula at `tilt=26.565°` reproduces the 2:1 dimetric angle
(26.565°) D-01 explicitly says NOT to use — this is a useful acceptance test: **the
planner should encode "axis angle from horizontal equals `tilt`" as a unit test**, since
it's the one number D-01 actually cares about. Round-trip `unproject(project(p))` error
was `1.4e-14` across 1000 random points in `[-50, 50]`, comfortably inside the `1e-10`
epsilon `gridProjection.test.ts` already uses for `topDownProjection`.

`det = unitSize² * sin(tilt) * cos(tilt)` is the same non-positive-unitSize / non-finite
guard `topDownProjection` already has, plus a new degenerate case: `tilt` at 0° or 90°
collapses the map (det=0) — `isoProjection` should throw on that, matching
`topDownProjection`'s existing `unitSize` guard style
(`[VERIFIED: src/components/domain/encounter/geometry/gridProjection.ts:69-71]`
`if (!(us > 0) || !Number.isFinite(us)) { throw new Error(...) }`).

**Note on `unitSize` semantics under iso:** `mapView.ts` already documents that
`view.unitSize` (the *horizontal projected cell extent*, derived as
`Math.hypot(unitX.x - origin.x, unitX.y - origin.y)`) will differ from the raw
`opts.unitSize` passed into the projection once iso is active
(`[VERIFIED: src/components/domain/encounter/geometry/mapView.ts:107-116]`, quoted in
full under Pitfall #4 below). With the formula above and defaults `tilt=30, rotation=45`,
`view.unitSize` = `Math.hypot(24.4949, 14.1421)` ≈ **28.28**, not 40 — any code that reads
the raw `unitSize` prop (not `view.unitSize`) for a *size* computation under iso will be
off by that ~30% factor. See Pitfall #6.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct 2×2 matrix (rotate-then-anisotropic-scale) | A "3D camera" derivation (rotate around Z by `rotation`, tip around X by `tilt`, drop Z) | Numerically checked this session and rejected: at `tilt=30, rotation=45` it produces a **26.565°** axis angle (the dimetric look), not 30° — it conflates "true isometric" (drafting convention, D-01's actual requirement) with the different concept of a literal isometric *camera* angle (≈35.26° elevation for true 3D isometric). The chosen formula matches D-01's literal wording ("30° angle... on all three axes") exactly; the camera-derivation does not, despite superficially looking more "principled." |
| SVG-native `matrix()` transform for circle→ellipse | Manually computing `rx`, `ry`, and rotation angle via 2×2 SVD | SVD is correct but is unnecessary hand-rolled linear algebra when three calls to the *already-existing* `view.project()` plus the browser's native `matrix()` transform produce an identical, provably-correct result with zero new math surface — see "Don't Hand-Roll" and "Code Examples" |

**Installation:** none — no packages to install for this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages (confirmed by full read of
`EncounterMapRenderer.tsx` and every file it imports from `./geometry`, `./renderer`,
`./hull`, `./details`, `./animation` — all first-party project code, no new npm
dependencies referenced anywhere in this session's investigation).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │  Two real screens (per CONTEXT.md's intent)  │
                    ├───────────────────────┬───────────────────────┤
                    │ Player: domain/        │ GM: gm/views/         │
                    │ encounter/EncounterView│ EncounterView.tsx     │
                    │        ↓               │        ↓              │
                    │ EncounterMapDisplay    │ MapPreview.tsx        │
                    │ (4 render branches,    │ (grid-format branch,  │
                    │  all format-routing)   │  ~line 163-245;       │
                    │        ↓               │  legacy branch below  │
                    │                        │  is a DIFFERENT,      │
                    │                        │  untouched renderer)  │
                    └───────────┬────────────┴──────────┬────────────┘
                                └──────────┬─────────────┘
                                           ↓
                          ┌─────────────────────────────────────┐
                          │      EncounterMapRenderer.tsx        │
                          │  (single shared component — owns:)   │
                          │                                       │
                          │  useState<ProjectionMode>  ← NEW      │
                          │  ('top-down' | 'iso'), self-contained │
                          │           ↓                           │
                          │  projection = mode === 'iso'          │
                          │    ? isoProjection({unitSize})  ← NEW │
                          │    : topDownProjection({unitSize})    │
                          │           ↓                           │
                          │  view = makeMapView(projection)       │
                          │           ↓ (single source of SVG     │
                          │             coords — Invariant 2)     │
                          │  ┌─────────┬─────────┬────────┬─────┐ │
                          │  │RoomsLayer│DoorsLayer│PoiLayer│... │ │
                          │  │(circles  │(billboard│(billbd)│    │ │
                          │  │→ellipse  │per D-05, │        │    │ │
                          │  │gap, see  │no changes│        │    │ │
                          │  │Pitfall 3)│needed)   │        │    │ │
                          │  └─────────┴─────────┴────────┴─────┘ │
                          │  Token.tsx ← NEEDS MIGRATION (Pitfall 1)│
                          │  vent inline block ← NEEDS MIGRATION   │
                          │  overlay grid (bottom-left) ← NEW btn  │
                          └─────────────────────────────────────┘
                                           ↑
                     mouse/touch events (drag token, drag POI, drop palette token)
                                           │
                          ┌─────────────────────────────────────┐
                          │  svgCoordinates.ts snapToGrid/       │
                          │  getGridCell ← NEEDS MIGRATION        │
                          │  (Pitfall 5 — currently divides by    │
                          │   raw unitSize, ignores projection)   │
                          └─────────────────────────────────────┘

  Also mounts EncounterMapRenderer (toggle appears here too, unless
  explicitly suppressed — see Open Questions):
    - gm/views/BridgeView.tsx → GmBridgeShipPanel small ship-deck thumbnail (isGM=false)
    - domain/dashboard/sections/StatusSection.tsx dashboard thumbnail (isGM=false, showLegend=false)
    - gm/views/deckplan/DeckplanPreviewPane.tsx → MapPreview(editable=true) (Phase 29 editor preview)
```

### Recommended Project Structure

No new files/folders are required — the seam already exists in the right place.

```
src/components/domain/encounter/geometry/
├── gridProjection.ts        # ADD isoProjection() here, beside topDownProjection()
├── mapView.ts                # unchanged — already projection-agnostic
└── __tests__/
    └── gridProjection.test.ts   # ADD isoProjection describe-block (mirror existing
                                  #   topDownProjection round-trip/axis-angle tests)
```

### Pattern 1: Self-contained toggle state (satisfies "independently" for free)

**What:** The projection-mode `useState` and the toggle `<button>` both live *inside*
`EncounterMapRenderer.tsx`, next to the existing projection `useMemo`
(`[VERIFIED: src/components/domain/encounter/EncounterMapRenderer.tsx:188-192]`):

```tsx
const projection = useMemo(
  () => topDownProjection({ unitSize }),
  [unitSize]
);
const view = useMemo(() => makeMapView(projection), [projection]);
```

**When to use:** Any time two independent mounted instances of the same component need
independent UI state with zero prop plumbing — React gives you this for free per
component *instance*, not per component *definition*. Since `EncounterMapRenderer` is
mounted once per screen (player screen, GM screen, and — see Open Questions — a few
secondary places), each mount gets its own `useState`.

**Example (recommended shape):**
```tsx
// Source: this session's derivation, following the existing useMemo pattern verbatim
type ProjectionMode = 'top-down' | 'iso';
const [projectionMode, setProjectionMode] = useState<ProjectionMode>('top-down');

const projection = useMemo(
  () => projectionMode === 'iso'
    ? isoProjection({ unitSize, tilt: 30, rotation: 45 })
    : topDownProjection({ unitSize }),
  [unitSize, projectionMode]
);
const view = useMemo(() => makeMapView(projection), [projection]);
```

### Pattern 2: SVG-native matrix transform for linear-projection shape distortion

**What:** Any grid-space *shape* that isn't a simple polyline/polygon of already-projected
vertices (i.e. circles) can be correctly re-projected without any new math by applying the
projection's *linear part* as an SVG `transform="matrix(...)"` directly on the SVG
primitive, rather than converting the shape into vertices or computing ellipse
parameters by hand.

**When to use:** Circle rooms (`GridRoom.circle`) and circle details (`DetailEntry.circle`)
— see Pitfall #3.

**Example:**
```tsx
// Source: this session's derivation (SVG spec: matrix(a,b,c,d,e,f) maps
// x'=a*x+c*y+e, y'=b*x+d*y+f — i.e. SVG's (a,b) column is the image of the
// x-unit-vector, SVG's (c,d) column is the image of the y-unit-vector).
// Generalizes to ANY Projection (works unchanged for topDownProjection too —
// there it reduces to matrix(unitSize,0,0,unitSize,cx,cy), a pure scale+translate).
const origin = view.project({ gx: cx, gy: cy });
const ux = view.project({ gx: cx + 1, gy: cy });
const uy = view.project({ gx: cx, gy: cy + 1 });
const a = ux.x - origin.x, c = ux.y - origin.y;   // image of grid x-unit-vector
const b = uy.x - origin.x, d = uy.y - origin.y;   // image of grid y-unit-vector
// <circle r={r}> in LOCAL untransformed units, then matrix-transform it:
<circle
  r={1}
  transform={`translate(${origin.x},${origin.y}) matrix(${a*r},${c*r},${b*r},${d*r},0,0)`}
/>
```

### Anti-Patterns to Avoid

- **Re-deriving grid→SVG arithmetic inline (`gx * unitSize`) anywhere in a layer file or
  hook:** every one of Pitfalls #1, #2, #5, #6 below is exactly this anti-pattern. The
  moment `isoProjection` exists, every such site silently produces wrong output instead of
  erroring — there is no compiler help here, only visual QA, which is why the planner
  should treat "grep for `* unitSize` / `unitSize *` outside `gridProjection.ts` and
  `mapView.ts`" as a mandatory pre-merge check, not just a one-time audit.
- **Deriving `isoProjection` from a literal 3D-camera rotation:** produces the wrong axis
  angle for D-01's stated 30°/"true isometric" requirement (see "Alternatives
  Considered" — this was verified, not assumed, via the Python check in "Sources").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circle → ellipse under a linear (non-orthogonal) projection | Manual 2×2 SVD to extract `rx`, `ry`, rotation angle for an `<ellipse>` | Three `view.project()` calls + a native SVG `matrix()` transform (Pattern 2 above) | Mathematically identical result, zero new linear-algebra code, generalizes to any future `Projection` implementation automatically |
| Mouse-position → grid-cell inversion (drag/drop, click-to-place) | A second, parallel "inverse projection" formula duplicated per call site (there are currently 4: `TokenLayer.tsx`, `useTokenPlacement.ts`, `PoiLayer.tsx`, `EncounterMapRenderer.tsx`'s editor-mode room click) | `view.unproject()` — the seam already has this method; it is currently unused by any of those 4 sites | `Projection.unproject` is defined as the exact inverse of `project` per the interface's own doc comment; hand-duplicating the inverse formula per call site is exactly how #6/#5 (below) went stale |

**Key insight:** The `Projection`/`MapView` seam was built specifically so this phase
would not need new geometry primitives — the actual risk in this phase is not "can we
write the iso math" (a self-contained, testable ~15-line function) but "did we find every
place that quietly duplicated the *inverse* of that math outside the seam." This session's
full-repo grep for `unitSize` found **6 additional bypass points** beyond the shared
`view` API on top of the 2 CONTEXT.md already named.

## Common Pitfalls

### Pitfall 1 (CONTEXT.md-flagged, but worse than described): `Token.tsx` renders position via raw `unitSize`, not `view`

**What goes wrong:** Every token's *visible glyph* — not just the popup-anchor point
CONTEXT.md's D-05 note called out at `EncounterMapRenderer.tsx:658` — is positioned via:
```
[VERIFIED: src/components/domain/encounter/Token.tsx:41-42]
  const centerX = data.x * unitSize + unitSize / 2;
  const centerY = data.y * unitSize + unitSize / 2;
```
`Token` receives a raw `unitSize: number` prop (not a `MapView`), so it has no access to
`view.project()` at all. Under iso, every token will render in its *top-down* screen
position regardless of which projection is active — the single most visible bug ISO-01
("tokens ... appear correctly positioned") would produce if unaddressed.

**Why it happens:** `Token.tsx` predates the `MapView` seam and was never migrated;
`TokenLayer.tsx` (its only caller) also only holds a raw `unitSize: number` prop
(`[VERIFIED: src/components/domain/encounter/TokenLayer.tsx:24]` `unitSize: number;`), so
the fix must thread a `MapView` (or a pre-computed projected `{x,y}`) down through
`TokenLayer` into `Token`, not just patch `Token.tsx` in isolation.

**How to avoid:** Pass `view: MapView` (or the already-projected center point) into both
`TokenLayer` and `Token`, replacing the `data.x * unitSize` arithmetic with
`view.project({ gx: data.x, gy: data.y })`. The token's *radius/glow/stroke* sizing
(`tokenRadius = unitSize * 0.45`, etc., lines 45-50) should switch to `view.unitSize`
(the mapView-exposed projected horizontal cell extent), following the same convention
`RoomsLayer.tsx`/`DetailsLayer.tsx` already use for circle radii.

**Warning signs:** Tokens visibly "stuck" in top-down grid position while the rest of the
map (walls, hull, rooms) skews to iso — the clearest possible visual regression signal.

### Pitfall 2 (CONTEXT.md-flagged): Vent polyline points bypass `view`

```
[VERIFIED: src/components/domain/encounter/EncounterMapRenderer.tsx:567]
const pts = vent.points.map(([x, y]) => `${x * unitSize},${y * unitSize}`).join(' ');
```
Same fix pattern: `vent.points.map(([gx, gy]) => view.project({ gx, gy }))`. The
`strokeWidth`/`strokeDasharray` sizing on the same block (lines 574, 589, 592) already
use raw `unitSize` for *size*, not position — per the `view.unitSize` convention
established elsewhere, these should switch to `view.unitSize` too for consistency (minor;
lower severity than the position bug since sizing is proportional either way).

### Pitfall 3 (NEW — not named in CONTEXT.md, directly contradicts a code comment): circle rooms/details need to become ellipses

**What goes wrong:** `GridRoom.circle` and `DetailEntry.circle` are both
`{ cx, cy, r }` (grid-space) —
`[VERIFIED: src/types/encounterMap.ts:262]` `circle?: { cx: number; cy: number; r: number };  // circular room (grid coords)`
and
`[VERIFIED: src/types/encounterMap.ts:337]` `circle?: { cx: number; cy: number; r: number };  // circle variant`.
Both are rendered today as plain SVG `<circle r={r * view.unitSize}>` —
`[VERIFIED: src/components/domain/encounter/renderer/RoomsLayer.tsx:122-126]`:
```
      // Circle radius scales with horizontal unit size (top-down projection;
      // for iso projections circles would render as ellipses — out of scope).
      const svgCx = center.x;
      const svgCy = center.y;
      const svgR = room.circle.r * view.unitSize;
```
and identically at `[VERIFIED: src/components/domain/encounter/renderer/DetailsLayer.tsx:39-41]`
(`const r = detail.circle.r * view.unitSize;`). Under a linear-but-not-orthogonal
projection (isoProjection), the true image of a grid circle is an **ellipse**, not a
circle of the "horizontal extent" radius — rendering a plain circle will make circular
rooms/details look visually wrong (too "round," not skewed like every wall/hull edge
around them) the moment iso is active. The code's own comment already
flags this as "out of scope" — that comment predates Phase 33; ISO-01's own wording
("rooms ... project correctly") does not carve out an exception for circle rooms, so this
is now squarely in scope and must be resolved (fixed via Pattern 2, or explicitly
re-descoped by the planner with a stated rationale — CIRC-01 (circle rooms) shipped in
Phase 32, so there are real maps that will exercise this).

**Why it happens:** Circle rendering was written before `isoProjection` existed and never
revisited; a scalar radius has no way to represent "skewed in one direction."

**How to avoid:** Use Pattern 2 (SVG-native `matrix()` transform) above — no new math
library, no manual SVD, generalizes automatically to any future non-orthogonal projection.

**Warning signs:** Any deckplan with a `circle:` room or `circle:` detail (Phase 32
fixtures / any ship using `svg_to_map.py`'s `<circle>`/`<ellipse>` detection) will show
this immediately in iso mode — a perfect visual-QA test case already exists in the repo.

### Pitfall 4: `RoomsLayer.tsx` label offset uses raw `unitSize`, not `view.unitSize`

```
[VERIFIED: src/components/domain/encounter/renderer/RoomsLayer.tsx:74-76]
      const [odx, ody] = room.label_offset ?? [0, 0];
      const lx = label.x + odx * unitSize;
      const ly = label.y + ody * unitSize;
```
`unitSize` here is the raw prop passed into `RoomsLayer`
(`[VERIFIED: src/components/domain/encounter/renderer/RoomsLayer.tsx:25]` `unitSize: number;`),
not `view.unitSize`. `mapView.ts` explicitly documents why this distinction matters under
iso:
```
[VERIFIED: src/components/domain/encounter/geometry/mapView.ts:107-116]
   * Pixel-scale of one grid cell along an axis. Exposed for door slot
   * dimensions and other "size, not position" pixel computations.
   *
   * Defined as the projected length of the unit grid vector (1, 0).
   * For top-down this equals `unitSize`. For an iso projection this is
   * the projected horizontal cell extent (callers that need vertical
   * cell extent should use `project` directly).
```
With the formula in "Standard Stack," `view.unitSize` ≈ 28.28 at the recommended
defaults, vs. the raw `unitSize` of 40 — using the wrong one displaces authored
`label_offset` values by roughly +40% under iso. This is a real but low-severity bug
(only affects rooms with a non-default `label_offset`); fix by using `view.unitSize` in
place of the `unitSize` prop at this call site.

### Pitfall 5 (NEW — not named in CONTEXT.md; the highest-impact gap found this session): GM token drag / drop / editor-drag inverts mouse position with raw `unitSize`, never `view.unproject()`

**What goes wrong:** `src/utils/svgCoordinates.ts`'s `snapToGrid`/`getGridCell` — the
*only* mouse→grid-cell inversion in the codebase — divide by a raw `unitSize` parameter:
```
[VERIFIED: src/utils/svgCoordinates.ts:67-76]
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
This is called from **four** live call sites, at least one of which is squarely in
ISO-03's scope (the GM console tactical map):
- `TokenLayer.tsx:215` — GM token drag-to-move
  (`[VERIFIED: src/components/domain/encounter/TokenLayer.tsx:213-215]`
  `const svgCoords = screenToSVG(...); const unrotated = inverseRotatePoint(...); const snapped = snapToGrid(unrotated.x, unrotated.y, unitSizeRef.current);`)
- `useTokenPlacement.ts:54` — GM drag-and-drop token placement from the palette
  (`[VERIFIED: src/hooks/useTokenPlacement.ts:54]`
  `const { gridX, gridY } = getGridCell(svgRef.current, e.clientX, e.clientY, unitSize, mapRotation, mapCenterX, mapCenterY);`)
- `PoiLayer.tsx:105,126` — editor-mode POI drag (Phase 29 deckplan editor; this specific
  screen won't get the iso toggle per current scope, but shares the same buggy helper)
- `EncounterMapRenderer.tsx:380` — editor-mode "click empty cell to add POI" grid-snap

`TokenLayer` and `useTokenPlacement` are both used, with `isGM={true}`/`onTokenPlace`/
`onTokenMove` wired live, on `src/components/gm/views/EncounterView.tsx`'s tactical map
(via `MapPreview.tsx`'s grid-format branch) — the actual "GM console map" ISO-03 refers
to. If a GM switches that screen to iso and then drags a token or drops one from the
palette, it will silently land in the *wrong* grid cell (computed via top-down-only
division), not error — this is a functional correctness bug, not just a cosmetic one, and
sits outside CONTEXT.md's audit note (which only covered *rendering* positions).

**Why it happens:** `svgCoordinates.ts` predates the `Projection`/`MapView` seam and
implements its own coordinate math independently, including its own `mapRotation` inverse
(duplicating logic that `MapView` doesn't even own — `mapRotation` is handled entirely
outside the projection, which is correct per D-06, but the *grid-cell snap* step after
un-rotating needs to become projection-aware).

**How to avoid:** Add a projection-aware variant — e.g. `getGridCellViaView(view, svg,
screenX, screenY, mapRotation, mapCenterX, mapCenterY)` that calls `view.unproject()`
after `screenToSVG` + `inverseRotatePoint`, instead of `snapToGrid`'s raw division — and
thread `view` (not just `unitSize`) into `TokenLayer`, `useTokenPlacement`, and `PoiLayer`.
This is the same "route everything through `view`" principle as Pitfalls #1/#2, applied to
the *inverse* direction, and is a `Don't Hand-Roll` (see above).

**Warning signs:** In iso mode, dragging a GM token any nonzero screen distance visibly
teleports it to a grid cell that doesn't match where the cursor is.

### Pitfall 6: Background void-grid pattern will not skew with the projection

```
[VERIFIED: src/components/domain/encounter/EncounterMapRenderer.tsx:477-487]
          <pattern
            id="map-bg-grid"
            width={unitSize} height={unitSize}
            patternUnits="userSpaceOnUse"
            x={originX} y={originY}
          >
            <path
              d={`M ${unitSize} 0 L 0 0 0 ${unitSize}`}
              fill="none" stroke="#141e1e" strokeWidth={0.5}
            />
          </pattern>
```
This is a purely decorative square-grid texture filling the *void* area outside rooms —
it is not derived from grid-space geometry at all (no `gx`/`gy` inputs), so it cannot be
"migrated to `view.project()`" the way the other pitfalls can; fixing it would mean
authoring an entirely new skewed-parallelogram SVG pattern. Given D-02's "no new
rendering pipeline" philosophy, the pragmatic recommendation is to **leave this pattern
unchanged** (it's void-space decoration, not ship geometry, so a top-down-looking
background grid under an iso ship silhouette is a minor, plausibly acceptable visual
quirk) — but the planner should make this an explicit choice, not a silent gap. See Open
Questions.

## Code Examples

### `isoProjection` (recommended implementation)

```typescript
// Source: derived and numerically verified this session (see Sources) — not from an
// external doc. Mirrors topDownProjection's structure/guard style exactly.
export interface IsoProjectionOptions {
  /** Pixels per grid cell before foreshortening (matches TopDownProjectionOptions.unitSize's role). */
  unitSize: number;
  /** Elevation angle in degrees — 30 for true isometric per D-01. Must be in (0, 90). */
  tilt: number;
  /** Azimuthal rotation in degrees — 45 is the standard diagonal isometric orientation. */
  rotation: number;
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
  const det = a * d - b * c; // = us^2 * sin(t) * cos(t), nonzero since 0 < tilt < 90
  return {
    project({ gx, gy }) {
      return { x: a * gx + b * gy, y: c * gx + d * gy };
    },
    unproject({ x, y }) {
      return { gx: (d * x - b * y) / det, gy: (-c * x + a * y) / det };
    },
  };
}
```

### Recommended round-trip / axis-angle test (mirrors existing `gridProjection.test.ts` style)

```typescript
// Source: this session — pattern-matched against the existing topDownProjection suite
// at src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
describe('isoProjection', () => {
  it('projects both grid axes at exactly `tilt` degrees from horizontal (D-01)', () => {
    const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    const ex = proj.project({ gx: 1, gy: 0 });
    const angleDeg = Math.atan2(ex.y, ex.x) * 180 / Math.PI;
    expect(angleDeg).toBeCloseTo(30, 6);
  });

  it('round-trips within epsilon', () => {
    const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    const p = { gx: 12.34, gy: -5.6 };
    const rt = proj.unproject(proj.project(p));
    expect(Math.abs(rt.gx - p.gx)).toBeLessThan(1e-9);
    expect(Math.abs(rt.gy - p.gy)).toBeLessThan(1e-9);
  });

  it('throws on tilt outside (0, 90)', () => {
    expect(() => isoProjection({ unitSize: 40, tilt: 0, rotation: 45 })).toThrow();
    expect(() => isoProjection({ unitSize: 40, tilt: 90, rotation: 45 })).toThrow();
  });
});
```

### Toggle button (D-03/D-04, byte-for-byte styling contract per UI-SPEC)

```tsx
// Source: this session, following the RESET VIEW button's exact style block verbatim
// (VERIFIED: src/components/domain/encounter/EncounterMapRenderer.tsx:719-741)
<button
  className="encounter-map__projection-toggle"
  onClick={() => setProjectionMode(m => m === 'iso' ? 'top-down' : 'iso')}
  title={projectionMode === 'iso' ? 'Switch to top-down view' : 'Switch to isometric view'}
  aria-label="Toggle map projection between top-down and isometric"
  aria-pressed={projectionMode === 'iso'}
  style={{
    gridArea: 'bottom-left',
    alignSelf: 'end',
    justifySelf: 'start',
    pointerEvents: 'auto',
    background: 'rgba(15, 21, 21, 0.95)',
    border: `1px solid ${projectionMode === 'iso' ? '#c9a050' : '#4a6b6b'}`,
    color: projectionMode === 'iso' ? '#c9a050' : '#7ab8b8',
    fontFamily: "'Cascadia Code', 'Courier New', monospace",
    fontSize: '11px',
    letterSpacing: '2px',
    padding: '8px 16px',
    cursor: 'pointer',
  }}
>
  {projectionMode === 'iso' ? 'TOP DOWN' : 'ISO VIEW'}
</button>
```

## State of the Art

Not applicable in the usual "library X replaced library Y" sense — this is a first
implementation of a capability the seam was built for, not a migration off something
deprecated. The one relevant "old → new" framing is internal to this codebase:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Renderer computes SVG coordinates by directly multiplying grid coords by `unitSize` (pre-Phase-21-03) | Renderer asks a `MapView` (backed by a swappable `Projection`) for every SVG coordinate | Phase 21-03 (per `EncounterMapRenderer.tsx`'s own code comment, `~line 185`) | Phase 33 is the first phase to actually exercise the "swappable" half of that migration — this research's core finding is that the migration was incomplete (6 leftover bypass sites found this session) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isoProjection` defaults `tilt: 30, rotation: 45` (numeric defaults are explicitly "Claude's discretion" per CONTEXT.md) | Standard Stack, Code Examples | Low — the formula's correctness (30° axis angle, invertibility) was numerically verified for these exact values this session; a different `rotation` value would still produce a valid, invertible true-isometric projection (any `rotation` preserves the 30°-from-horizontal axis property, since it's a rotation of a fixed-angle symmetric pair) — so this is a purely aesthetic/orientation choice, not a correctness risk. Confirm with user/planner only if a specific "which corner faces the viewer" orientation is desired. |
| A2 | Leaving the background void-grid pattern (`map-bg-grid`) un-skewed in iso mode is an acceptable visual quirk rather than a bug to fix | Pitfall #6, Open Questions | Low-medium — purely cosmetic; if a human reviewer considers a top-down grid texture under an iso ship silhouette jarring, this becomes a follow-up task, not a blocker for ISO-01 (rooms/doors/vents/POIs/tokens/details are the requirement's explicit list; the void background is not named) |
| A3 | The toggle rendering unconditionally in `EncounterMapRenderer` (D-03's self-contained design) appearing on the two dashboard/ship-panel thumbnails and the deckplan-editor preview is acceptable, not a regression to prevent | Architecture Patterns, Open Questions | Medium — if the human reviewer/user considers this out-of-scope UI clutter, the planner needs an opt-in prop (e.g. `enableProjectionToggle?: boolean`) threaded through `MapPreview`/`EncounterMapDisplay`'s 5 render sites, which is a real (if small) scope increase over CONTEXT.md's "no new prop plumbing" framing |

## Open Questions

1. **Should the toggle appear on every `EncounterMapRenderer` mount, or only the two "real" screens?**
   - What we know: CONTEXT.md's D-03 says the toggle needs "no new prop plumbing" because
     "both `EncounterView` (player) and `EncounterMapDisplay` (GM) render through this
     same component." This session found `EncounterMapRenderer` actually mounts in **5+**
     places: the player screen, the real GM tactical map (`gm/views/EncounterView.tsx` →
     `MapPreview`), a small ship-deck thumbnail in `BridgeView.tsx`'s slide-out panel
     (`isGM={false}`), a dashboard thumbnail in `StatusSection.tsx` (`isGM={false},
     showLegend={false}`), and the Phase-29 deckplan-editor live preview
     (`DeckplanPreviewPane.tsx` → `MapPreview(editable=true)`).
   - What's unclear: whether a toggle appearing on the two small thumbnails and the editor
     preview is acceptable (existing precedent: `LegendPanel` already renders
     unconditionally on the `BridgeView` thumbnail today, so *some* overlay chrome already
     appears there) or should be suppressed there.
   - Recommendation: default to **allowing it everywhere** (matches D-03's stated "no new
     prop plumbing" intent and existing precedent for overlay chrome on thumbnails); flag
     for a human-verify checkpoint during execution rather than pre-building an opt-out
     prop nobody asked for. If the human reviewer flags it as clutter, add
     `enableProjectionToggle?: boolean` (default `true`) as a fast follow-up — this is a
     one-line, fully reversible change.

2. **Should circle-room/circle-detail ellipse correctness (Pitfall #3) be fixed in this
   phase, or explicitly descoped with a follow-up ticket?**
   - What we know: ISO-01's wording ("rooms ... project correctly") does not carve out an
     exception, and Pattern 2 (SVG `matrix()` transform) is a small, self-contained fix
     with no new dependencies.
   - What's unclear: whether any *shipped* deckplan actually has a `circle:` room/detail
     today (CIRC-01 shipped in Phase 32, but real-map adoption wasn't checked in this
     research pass — that's a data question, not a code question).
   - Recommendation: fix it (Pattern 2 is cheap and correct) rather than descope; the risk
     of leaving it is a visible, easy-to-spot rendering bug on any map that uses the
     feature Phase 32 just shipped.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`[VERIFIED: vitest.config.ts:1-13]` `environment: 'jsdom'`, `include: ['src/**/__tests__/**/*.test.{ts,tsx}']`) |
| Config file | `/home/gjohnson/src/janus-console/vitest.config.ts` |
| Quick run command | `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` |
| Full suite command | `pnpm run test` (`[VERIFIED: package.json]` `"test": "vitest run"`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISO-01 | `isoProjection` produces a 30°-from-horizontal axis angle and round-trips within epsilon | unit | `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` | ❌ Wave 0 — add an `isoProjection` describe-block to the existing file |
| ISO-01 | Circle room/detail renders as a matrix-transformed circle (ellipse image) whose bounding geometry matches `view.project()` of 4 cardinal points on the grid circle | unit | new test in a `RoomsLayer`/`DetailsLayer` test file (none currently exists for these — see Wave 0 gap) | ❌ Wave 0 |
| ISO-01 | Token/vent/POI render positions match `view.project()` output under `isoProjection`, not raw `unitSize` arithmetic | unit or snapshot | new test targeting `Token.tsx`/`TokenLayer.tsx` | ❌ Wave 0 |
| ISO-02, ISO-03 | Toggle button flips `projectionMode` local state and re-renders with the new projection; two independent mounts do not affect each other | manual (component interaction across two mounted instances is awkward to assert cheaply in unit tests; verify via the human checkpoint) | — | manual-only, justified: cross-instance independence is a React-fundamentals guarantee already exercised implicitly by existing multi-mount usage (5+ mounts today), not new risk surface worth a bespoke test harness |
| ISO-03 | GM token drag/drop lands in the correct grid cell under `isoProjection` (Pitfall #5) | unit | new test for the projection-aware replacement of `snapToGrid`/`getGridCell` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts`
- **Per wave merge:** `pnpm run test` (full suite) + `pnpm run typecheck`
- **Phase gate:** Full suite green before `/gsd-verify-work`; plus a human-verify
  checkpoint opening both real screens (player `EncounterView` and GM
  `gm/views/EncounterView.tsx`'s tactical map) and toggling each independently, per
  ISO-02/ISO-03's explicit "live" + "independently" wording.

### Wave 0 Gaps

- [ ] `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — add
      `isoProjection` describe-block (axis-angle, round-trip, degenerate-tilt-throws)
- [ ] A test file for the circle→ellipse matrix-transform technique (no existing test file
      covers `RoomsLayer.tsx`/`DetailsLayer.tsx` circle rendering at all today — this is a
      pre-existing gap, not new to this phase, but Phase 33 is what makes it visible)
- [ ] A test (or extension of an existing `svgCoordinates.test.ts` if the planner creates
      one — none currently exists) for the projection-aware inverse-mapping replacement of
      `snapToGrid`/`getGridCell`

## Security Domain

`security_enforcement` is enabled in `.planning/config.json`
(`[VERIFIED: .planning/config.json]` `"security_enforcement": true, "security_asvs_level": 1`),
so this section is required, but this phase has essentially no security surface: it adds
no new user input, no new network calls, no new persisted data, and no new
authentication/authorization boundary — `isoProjection`'s inputs (`unitSize`, `tilt`,
`rotation`) are all internal, developer-chosen constants, not user- or network-supplied
values.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — this phase touches no auth code |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | The existing `isGM` gating on token drag/place/room-toggle is untouched by this phase; Pitfall #5's fix changes *where a token lands*, not *who is allowed to move it* |
| V5 Input Validation | Marginal | `isoProjection`'s own `unitSize`/`tilt` guards (mirroring `topDownProjection`'s existing pattern) are the only "input validation" in scope, and their inputs are developer constants, not user input — no new attack surface |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

None applicable — no new trust boundary, no new data flow crossing client/server, no new
parsing of untrusted input. The only "input" `isoProjection` accepts is numeric
configuration baked into the toggle's own code (`tilt: 30, rotation: 45`), not anything
reachable by a player or GM through the UI.

## Sources

### Primary (HIGH confidence — direct reads of the source tree this session)
- `src/components/domain/encounter/geometry/gridProjection.ts` — `Projection` interface, `topDownProjection`, the doc-comment sketch of `isoProjection`'s intended shape
- `src/components/domain/encounter/geometry/mapView.ts` — `MapView` facade, `unitSize` semantics doc comment
- `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — existing test conventions to mirror
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — full file read; overlay grid, projection instantiation, token/vent bypass sites
- `src/components/domain/encounter/Token.tsx`, `TokenLayer.tsx`, `renderer/RoomsLayer.tsx`, `renderer/DetailsLayer.tsx`, `renderer/DoorsLayer.tsx`, `renderer/DoorSymbol.tsx`, `renderer/PoiLayer.tsx` — full reads for the `unitSize` bypass audit
- `src/utils/svgCoordinates.ts`, `src/hooks/useTokenPlacement.ts` — full reads for the inverse-projection bypass audit
- `src/types/encounterMap.ts` — `GridRoom.circle`, `DetailEntry.circle`, `GridEncounterMapData.unit_size` field definitions
- `src/components/gm/MapPreview.tsx`, `src/components/gm/views/EncounterView.tsx`, `src/components/domain/encounter/EncounterMapDisplay.tsx`, `src/components/domain/encounter/EncounterView.tsx`, `src/components/gm/views/BridgeView.tsx`, `src/components/domain/dashboard/sections/StatusSection.tsx` — full/partial reads to map every real mount point of `EncounterMapRenderer`
- `src/components/domain/encounter/renderer/mapColors.ts` — color/thickness constants
- `vitest.config.ts`, `package.json` — test tooling
- A Python computation run in this session (not a citable external doc — this is
  original derivation, verified by direct execution, quoted numerically throughout this
  document: axis angles of 30.0000°/150.0000° at `tilt=30,rotation=45`, round-trip error
  1.4e-14, dimetric comparison at `tilt=26.565°`)

### Secondary / Tertiary
None used — no web search was needed or performed; every finding in this document is
grounded in either a direct source-tree read or a self-contained, reproducible
computation, both done this session.

## Metadata

**Confidence breakdown:**
- Standard stack (the `isoProjection` formula): HIGH — derived from first principles against D-01's explicit numeric requirement (30°) and confirmed by direct computation, not assumed from any external source
- Architecture (seam shape, real mount points, self-contained-toggle design): HIGH — every claim traced to a specific file/line read this session
- Pitfalls (bypass sites): HIGH for the 6 newly-found sites (all read directly, quoted verbatim) — this is the highest-value output of this research pass, since 4 of the 6 were not named in CONTEXT.md/UI-SPEC at all

**Research date:** 2026-09-06
**Valid until:** No expiry concern — this is a static analysis of the current source tree with zero external dependencies; re-run the bypass grep (`grep -rn "unitSize" src/`) before planning if significant time has passed and the encounter renderer has changed further.
