# Phase 34: GM-Controlled Projection and Iso Rotation - Research

**Researched:** 2026-10-14
**Domain:** Broadcast view state (Django active-view store + SSE), SVG grid projection math (top-down / iso + 90° azimuth), React controlled/uncontrolled renderer, deckplan schema
**Confidence:** HIGH for codebase facts and rotation math (read or executed this session); MEDIUM for fade/reset UX (no human verification yet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One shared, GM-owned view setting; the GM console map always mirrors what players see. The GM's map controls *are* the broadcast controls — no private preview / "send to players" step. Follow the `encounter_vents_visible` pattern: state in `core/active_view_store.py`, a GM API endpoint in `core/views/encounter.py` (via `core/encounter_state.py`), delivered to clients on the existing active-view/SSE path. This **supersedes Phase 33 D-03's per-viewer independence and requirement ISO-02** (players toggling) — update REQUIREMENTS.md accordingly.
- **D-02:** GM controls live in the **map overlay**: the existing bottom-left projection button (Phase 33 D-03 slot) plus new ⟲ ⟳ rotate buttons beside it, same button styling as RESET VIEW. Not duplicated in the GM encounter side panel.
- **D-03:** **Player terminal shows no view controls at all** — no toggle, no read-only orientation badge. Players keep pan/zoom and RESET VIEW only.
- **D-04:** The **deckplan editor preview** (`DeckplanPreviewPane` → `MapPreview`) keeps a **private, local** projection toggle + rotate controls that never broadcast — authoring a map must not change what players see mid-session. `EncounterMapRenderer` therefore needs both modes: controlled (broadcast value + GM callbacks / read-only for players) and uncontrolled (local state, editor).
- **D-05:** Rotation applies in **both projections as one shared view angle**, stepping 0/90/180/270. Toggling top-down ↔ iso preserves "which way is up." (Rotate buttons are visible in both projections.)
- **D-06:** Direction: **⟳ turns the ship clockwise on screen** (and ⟲ counter-clockwise) — like turning a physical model on the table.
- **D-07:** GM rotation is an **offset added on top of the deck's authored YAML `rotation`** (Phase 25 `mapRotation`, per-deck). Offset 0 = exactly today's rendering in both projections. Under iso this composes with the existing iso base rotation (45°).
- **D-08:** Rotation change is presented as a **quick fade** (brief fade-out → snap to new angle → fade-in), not an animated spin. The **top-down ↔ iso toggle stays an instant cut** (unchanged from Phase 33).
- **D-09:** Rendering, hit-testing (`unproject` / `getGridCellViaView`), background grid, door/POI/token placement, and billboarded labels (Phase 33 D-05) must all be correct at every rotation in both projections.
- **D-10:** **Deck switch within the same location keeps** projection + rotation offset (spatial consistency across decks; sets up Phase 35 stacking).
- **D-11:** **Loading a different location/map resets to that map's authored default view.** `deckplan.yaml` gains an optional location-level default view (projection + rotation offset); absent → top-down, offset 0. Schema change: update `docs/schemas/schema-encounters.md` in the same commit (CLAUDE.md Schema Sync), and the loader/typing in `core/data_loader.py` / `src/types/encounterMap.ts` as needed. — **Reversibility:** costly — published schema field consumed via `janus-skills` sync; removing/renaming later means a schema doc change + data migration.
- **D-12:** The broadcast view setting **persists** like other encounter state (survives server restart / client reload).
- **D-13:** On any GM view change (projection toggle or rotation), **pan/zoom resets to fit** (same as RESET VIEW) — on players **and** on the GM map (one rule everywhere).
- **D-14:** **No extra on-screen cue** (no JANUS text flash); the fade / cut is the cue.

### Claude's Discretion

- Exact YAML field name/shape for the authored default view (e.g. `default_view: { projection: iso, rotation: 90 }`) — keep it at deckplan/location level, not per-deck.
- Store shape for the broadcast value (single combined field vs. two fields) and the API endpoint shape.
- Fade duration (short — ~150–250ms each way) and whether it uses GSAP or CSS.
- How rotation is applied under top-down (projection parameter vs. composing with the existing post-projection SVG `rotate()`), provided D-07/D-09 hold.
- Rotate-button glyphs/labels within the existing overlay button style.

### Deferred Ideas (OUT OF SCOPE)

- Stacked semi-transparent decks + animated deck transitions — Phase 35.
- Animated top-down ↔ iso "tip back" transition — considered, rejected for this phase.
- Read-only orientation badge / JANUS "VIEW REORIENTED" flash for players — considered, rejected.
- Out of scope per CONTEXT: stacked/ghost decks, deck-switch animation, animating the top-down ↔ iso toggle, any new height/extrusion rendering.

</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped to Phase 34 yet (ROADMAP says TBD). CONTEXT D-01 supersedes ISO-02. Proposed IDs for the planner to add to REQUIREMENTS.md:

| ID | Description (proposed) | Research Support |
|----|-------------|------------------|
| ISO-04 | GM sets one broadcast projection (top-down / iso) that all clients render live; players have no projection control | Broadcast Path; Pitfalls P1, P6 |
| ISO-05 | GM rotates the shared view ⟲/⟳ in 90° steps; offset composes on top of each deck's authored `rotation`; players follow | Rotation Math; Pitfalls P5, P8, P10 |
| ISO-06 | `deckplan.yaml` `default_view` is applied when a different location is loaded; absent means top-down / offset 0; persists across reloads | Schema & Loader; Pitfalls P2, P3, P4 |
| ISO-07 | At every projection × rotation, rooms, doors, POIs, tokens, details, background grid, labels, and hit-testing are correct; view changes fade (rotation) or cut (projection) and reset pan/zoom | Rotation Math; Renderer Modes; Fade and Reset; Pitfalls P6, P7, P9 |

ISO-02 (player toggle) is superseded by ISO-04 — update its row in REQUIREMENTS.md (currently marked Complete under Phase 33).

</phase_requirements>

## Summary

Phase 34 is a thin backend broadcast addition plus a moderate frontend seam change. The backend work is mechanical: two new keys in the active-view store, two GM endpoints, one payload-builder change, one navigation hook, one loader change. The frontend risk is concentrated in three places: (1) the renderer's projection construction and how `EncounterMapRenderer` gets its value (controlled vs. uncontrolled across six mount sites), (2) the rotation math, and (3) the fade/reset state machine driven by SSE.

The central rotation finding: **fold the GM offset into the projection's grid-space azimuth, not into an SVG `rotate()`**. Under `isoProjection`, a screen-space rotation of the 45°-base iso picture produces grid axes at 120°/240° (60° from horizontal), which violates D-01's 30° true-isometric requirement. A grid-space azimuth change keeps the axes at exactly 30° multiples and keeps the projected unit length constant (28.28 px at unitSize 40) for all four 90° steps. Because every layer already routes through `MapView`, rendering, bbox/viewBox, background grid, door transforms, circle ellipses, and hit-testing pick up the offset automatically. The authored per-deck `rotation` stays a screen-space SVG `rotate()` exactly as Phase 33 D-06 locked it; this creates one asymmetry under iso that the user should confirm (Open Question 1).

Other load-bearing findings: `load_deckplan` does not pass through unknown top-level keys (it returns only `decks`, `hull`, `total_decks`), so `default_view` must be added explicitly; `payload_builder.build()` is an explicit key allow-list, so the new store keys are invisible to clients until added there; `api_switch_view`'s new-location block is the single D-11 hook; and the pan/zoom reset must be keyed on primitive values, not on the SSE payload object, or every map-state broadcast will reset players' zoom.

**Primary recommendation:** (a) store `encounter_projection` and `encounter_rotation_offset` in `_DEFAULT_STATE`; (b) expose server-side relative `rotate` (±90) and `set projection` endpoints; (c) add `rotation?: number` to `topDownProjection` and build the projection through one `buildProjection(projection, offset, unitSize)` helper that uses `isoProjection({ tilt: 30, rotation: 45 + offset })`; (d) drive the GM map purely from SSE (no optimistic local state for the view); (e) give `EncounterMapRenderer` a discriminated `viewControl` prop (`readonly` | `broadcast` | `local`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist broadcast projection + rotation offset | Database / Storage (`var/active_view.json` via `active_view_store`) | — | Same store and atomic-write path as `encounter_vents_visible`; survives restart (D-12) |
| Validate and mutate view state | API / Backend (`encounter_state.py`, `views/encounter.py`) | — | Single authority; server-side relative rotate avoids stale-client races |
| Authored default view (`default_view`) | API / Backend (`data_loader.load_deckplan`, `navigation.api_switch_view`) | — | Applied server-side on location switch, so every client gets it via SSE with no client logic |
| Broadcast delivery | API / Backend (`payload_builder`, SSE `activeview` event) | Browser / Client (SharedConsole / GM console activeView) | Existing path; new keys must be added to the explicit builder allow-list |
| Projection + azimuth math | Browser / Client (`geometry/gridProjection.ts`) | — | Pure client geometry; no data leaves the browser |
| Fade + pan/zoom reset | Browser / Client (`EncounterMapRenderer`, `usePanZoom`) | — | Presentation-only; driven by broadcast values |
| Editor-local view state (D-04) | Browser / Client (MapPreview or renderer, local state) | — | Must never reach the store |

## Standard Stack

### Core

No new packages. Everything is existing project code plus libraries already in `package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (per CLAUDE.md) | Controlled/uncontrolled component state | Already the renderer's framework |
| gsap | ^3.14.2 (`package.json`, grep-observed) | Fade timeline for D-08 | Already a dependency; currently used only in `src/entries/SharedConsole.tsx` — this phase makes it a first use inside the encounter renderer |
| vitest | ^2.1.9 (`package.json`, grep-observed) | Geometry unit tests | Existing `test` script (`vitest run`) |
| Django | 5.2.7 (per CLAUDE.md) | Endpoints, store, loader | Existing backend |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `isoProjection` / `topDownProjection` | in-repo | Projection seam | All projected coordinates — never inline rotation matrices |
| `makeMapView` / `MapView` | in-repo | `project`, `unproject`, `bbox`, `unitSize`, `doorTransform`, `circleTransform` | Every SVG coordinate and inverse |
| `usePanZoom` `resetView` | in-repo (`src/hooks/usePanZoom.ts`, `resetView` sets `{ panX: 0, panY: 0, zoom: 1 }`) | D-13 pan/zoom reset | On snap / cut |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Grid-space azimuth folded into projection (recommended) | Screen-space SVG `rotate(offset)` on the existing `<g>` | Screen rotation is trivial to add, but under iso it breaks the 30° axis invariant (D-01) and requires separate inverse-rotate, viewBox-swap, and bbox handling that the projection path gets for free. Rejected. |
| GSAP timeline for fade | CSS `transition` + `transitionend` | CSS needs a two-phase state machine driven by DOM events; GSAP `timeline` makes the three-step sequence a single cancellable object. Either is acceptable (D-08 leaves it to discretion); GSAP recommended for kill/restart semantics. |
| Server-side relative `rotate` (`delta: ±90`) | Client sends absolute offset | Absolute offset from a stale client can overwrite a concurrent rotate. Relative is race-free. Recommended. |

**Installation:** none.

**Version verification:** `gsap` and `vitest` versions are the ones already pinned in `package.json`; no new packages are recommended, so no registry check is needed. The Package Legitimacy Gate does not apply (zero external packages installed by this phase).

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. No `gsd-tools query package-legitimacy check` run is required.

## Architecture Patterns

### System Architecture Diagram

```
 GM console (ENCOUNTER)                       Django backend                          Players / other clients
 ─────────────────────                        ──────────────                          ───────────────────────
 overlay buttons                              POST /api/gm/encounter/set-projection/
  [projection] [⟲] [⟳]  ──POST──────────────▶  encounter_state.set_projection()  ─┐
                                              POST /api/gm/encounter/rotate-view/   │  sync_state(**kw)
                                              encounter_state.rotate_view(±90) ────┤  (update_state → var/active_view.json)
                                                                                   │
 navigation: POST /api/switch-view (new loc)  api_switch_view ──────────────────────┤  is_new_encounter_location
   reads deckplan.default_view ───────────────▶ (load_deckplan → default_view) ──────┘  → set projection + offset
                                                                                   │
                                              payload_builder.build()  ◀───────────┘
                                                (explicit allow-list: add 2 keys)
                                                      │  SSE event "activeview"
        ┌─────────────────────────────────────────────┴───────────────────────────┐
        ▼                                                                         ▼
 GM console activeView (gmConsole.ts)                                 SharedConsole activeView (SharedConsole.tsx)
        │                                                                         │
 gm/views/EncounterView → MapPreview(fill)                          domain EncounterView → EncounterMapDisplay
        │  viewControl = { mode: 'broadcast', … }                              │  viewControl = { mode: 'readonly' }
        ▼                                                                         ▼
 ┌──────────────────────── EncounterMapRenderer ────────────────────────────┐
 │ requested (props)  ──► change detector (primitive compare, skip mount)    │
 │   projection change  → cut: displayed = requested; resetView()            │
 │   offset change      → GSAP fade: opacity→0, snap displayed, resetView(), │
 │                         opacity→1  (wrapper element, not the <svg>)       │
 │ displayed (projection, offset) → buildProjection() → makeMapView()        │
 │   → bbox / viewBox / rotate(mapRotation) / layers / hit-testing via view  │
 │   overlay: [projection][⟲][⟳] only when mode is 'broadcast' or 'local'    │
 └───────────────────────────────────────────────────────────────────────────┘
 Editor (DeckplanPreviewPane → MapPreview editable): viewControl = { mode: 'local' } (never POSTs)
```

### Recommended Project Structure

```
src/components/domain/encounter/geometry/
├── gridProjection.ts            # ADD rotation?: number to topDownProjection (default 0)
├── viewOrientation.ts           # NEW: ViewProjection / RotationOffset types, normalizeRotationOffset, buildProjection
└── __tests__/
    ├── gridProjection.test.ts   # ADD topDown rotation tests; iso 4-azimuth tests
    └── viewOrientation.test.ts  # NEW: normalize, buildProjection, rotate-delta, D-07 offset-0 identity
src/components/domain/encounter/
└── viewTransition.ts (or hook)  # NEW (optional): pure state machine for requested→displayed + fade plan (testable without DOM)
core/tests/
└── test_encounter_view_state.py # NEW (or extend test_encounter_state.py): set/rotate validation, default_view parse, switch-view reset
```

### Pattern 1: Single-source view state in the store (mirror `encounter_vents_visible`)

**What:** Two new keys beside `encounter_vents_visible`.

Verbatim from `core/active_view_store.py` (read this session, line 35):
```python
    'encounter_vents_visible': False,
```

Recommended additions to `_DEFAULT_STATE`:
```python
    'encounter_projection': 'top-down',
    'encounter_rotation_offset': 0,
```

Persistence (D-12) is free: `update_state` calls `_write_to_disk`, and `_load_from_disk` merges stored values over defaults key-by-key, so an existing `var/active_view.json` without these keys loads with the defaults.

**Example (encounter_state.py, mirrors `set_vents_visible`):**
```python
PROJECTIONS = ('top-down', 'iso')

def set_projection(projection: str) -> dict:
    if projection not in PROJECTIONS:
        raise ValueError(f"Invalid projection '{projection}'. Must be one of: {', '.join(PROJECTIONS)}")
    return _sync(encounter_projection=projection)

def rotate_view(delta: int) -> dict:
    """Rotate the shared view by ±90, computed server-side from current state."""
    if delta not in (90, -90):
        raise ValueError(f"Invalid rotation delta {delta}. Must be 90 or -90.")
    offset = (get_state().get('encounter_rotation_offset', 0) + delta) % 360
    return _sync(encounter_rotation_offset=offset)
```
`get_state` is already imported in `encounter_state.py`. Python `%` returns non-negative for negative operands, so `-90` from 0 yields 270.

### Pattern 2: Endpoint shape mirrors `api_encounter_set_vents_visible`

Existing (read this session, `core/views/encounter.py` lines ~87-96): `@login_required` + `@post_json`, `def api_encounter_set_vents_visible(request, data)`, returns `JsonResponse({'success': True, 'vents_visible': visible})`. URL: `api/gm/encounter/set-vents-visible/` in `core/urls.py:77`, exported via `core/views/__init__.py:68`.

Recommended:
- `POST api/gm/encounter/set-projection/` → `{ projection }` → `{ success, projection }`
- `POST api/gm/encounter/rotate-view/` → `{ delta }` (±90) → `{ success, rotation_offset }`

Two endpoints mirror the one-action-per-endpoint convention. Validation failures return 400 (ASVS V5). Use the same decorators as the vents endpoint; do not add stricter auth than existing `/api/gm/` routes have (see Security Domain).

### Pattern 3: Rotation as grid-space azimuth (the seam)

**What:** The offset rotates the grid inside the projection, not the drawing on screen.

Current code (read this session, `EncounterMapRenderer.tsx` lines 200-212):
```tsx
  const [projectionMode, setProjectionMode] = useState<'top-down' | 'iso'>('top-down');
  const projection = useMemo(
    () =>
      projectionMode === 'iso'
        ? isoProjection({ unitSize, tilt: 30, rotation: 45 })
        : topDownProjection({ unitSize }),
    [unitSize, projectionMode]
  );
```

Recommended replacement (new pure helper in `geometry/viewOrientation.ts`):
```ts
export type ViewProjection = 'top-down' | 'iso';
export type RotationOffset = 0 | 90 | 180 | 270;

export function buildProjection(p: ViewProjection, offset: RotationOffset, unitSize: number): Projection {
  return p === 'iso'
    ? isoProjection({ unitSize, tilt: 30, rotation: 45 + offset })   // 45 base is unchanged from Phase 33
    : topDownProjection({ unitSize, rotation: offset });            // new optional azimuth, default 0
}
```

`topDownProjection` gains `rotation?: number` (default 0). Implement it as a 2×2 rotation of the scaled grid about grid origin, and use exact `0/±1` cosine/sine values for multiples of 90° (`Math.cos(Math.PI/2)` is ~6e-17, which would produce `-0`/noise in `toBe` assertions and in snapshot-like geometry). Offset 0 must be the identity so `topDownProjection({ unitSize })` stays byte-identical (existing tests remain valid).

### Pattern 4: Controlled / uncontrolled renderer via discriminated prop

**Recommended prop (new, replacing the local `projectionMode` useState):**
```ts
type ViewControl =
  | { mode: 'readonly' }                                                     // players, thumbnails, GM side panel: mirror props, no buttons
  | { mode: 'broadcast'; onProjectionChange: (p: ViewProjection) => void;
                         onRotate: (delta: 90 | -90) => void }              // GM tactical overlay (D-02)
  | { mode: 'local' };                                                       // deckplan editor (D-04): private state, shows buttons
// value props (controlled):  projection?: ViewProjection;  rotationOffset?: RotationOffset;
```

Hooks must run unconditionally: keep one `useState` for local values and select `effective = mode === 'local' ? local : props` (with `readonly`/`broadcast` defaulting to `'top-down'` / `0` when props are absent).

Buttons render only for `broadcast` and `local`. `isGM` cannot be used to infer this: `MapPreview` defaults `isGM ?? true` (`src/components/gm/MapPreview.tsx`, read this session at line 227: `isGM={isGM ?? true}`), and `DeckplanPreviewPane` does not pass `isGM`, so the editor is already "GM" by default.

### Pattern 5: Overlay grid placement for the controls

The overlay is a 3×3 CSS grid: `gridTemplateAreas: '"top-left . top-right" ". . ." "bottom-left . bottom-right"'` (grep-observed, `EncounterMapRenderer.tsx` ~line 812). The projection button currently owns `gridArea: 'bottom-left'`. Wrap the projection button and both rotate buttons in one flex container that takes `gridArea: 'bottom-left'` with `alignSelf: 'end'`, `justifySelf: 'start'`, `pointerEvents: 'auto'`, rather than adding new grid areas. Keep the existing button inline style block (`EncounterMapRenderer.tsx` ~lines 846-866) for all three buttons.

### Anti-Patterns to Avoid

- **Rotating the SVG with `rotate(offset)` for the GM offset.** Under iso this turns the 30° grid axes into 60° axes (see Rotation Math). It also forces separate inverse-rotate, viewBox-swap, and bbox handling that the projection path already gets.
- **Optimistic local view state on the GM console.** The vents pattern sets local state then calls the API. For the view, drive the GM map purely from SSE. The GM map then mirrors the broadcast exactly (D-01), and there is no double-reset when the echo arrives.
- **Client-computed absolute rotation.** `setOffset((cur + 90) % 360)` on the client races with other clients. Send `delta`, compute on the server.
- **Effect dependencies on the whole `activeView` object for the reset.** The SSE payload fires on every state change (token moves, room toggles). Compare `projection` and `rotationOffset` primitives against a ref.
- **Inline `rotate(...)` or raw `unitSize * gx` in any new code path.** Route everything through `view`.

## Rotation Math

### Derivation (verified this session)

`isoProjection` already builds the matrix `us · diag(cos t, sin t) · R(r)`, where `t` is the tilt and `r` the rotation (`src/components/domain/encounter/geometry/gridProjection.ts`, read this session: `a = us·cos t·cos r`, `b = −us·cos t·sin r`, `c = us·sin t·sin r`, `d = us·sin t·cos r`). Changing `r` is therefore a change of grid azimuth before the fixed foreshortening.

Executed check (this session, `python3 -I`, unitSize 40, tilt 30):

| Grid azimuth `r` | x-axis screen angle | y-axis screen angle | `|u_x|` | `|u_y|` |
|---|---|---|---|---|
| 45 (today) | 30.0° | 150.0° | 28.2843 | 28.2843 |
| 135 (offset 90) | 150.0° | 210.0° | 28.2843 | 28.2843 |
| 225 (offset 180) | 210.0° | 330.0° | 28.2843 | 28.2843 |
| 315 (offset 270) | 330.0° | 30.0° | 28.2843 | 28.2843 |

Every grid-space offset keeps both axes on the 30° lattice and equal projected length, so D-01 holds and `view.unitSize` does not change across offsets. (For arbitrary non-90° azimuths the axes would leave the 30° family and `view.unitSize` would vary; the phase only uses 90° steps, so this does not arise. Add a test that pins the 90° family.)

Comparison (same run): applying a 90° **screen** rotation to the base iso picture gives x-axis 120.0° and y-axis 240.0° — 60° from horizontal, violating D-01's "30° angle" requirement. This is why the offset must be grid-space.

### Composition with the authored `rotation` (D-07)

- The authored `mapData.rotation` remains the screen-space `rotate(mapRotation, mapCenterX, mapCenterY)` on the layer `<g>` (`EncounterMapRenderer.tsx` lines 257 and 579; read this session: `const mapRotation = mapData.rotation ?? 0;`). Phase 33 D-06 locked this, and offset 0 must reproduce today's rendering, so it does not change.
- The GM offset is applied inside the projection. The effective transform is `R_screen(authored) ∘ M(base + offset)`.
- **Top-down:** grid rotation and screen rotation commute, so the composition equals `R(authored + offset)` exactly, as D-07 describes.
- **Iso:** they do not commute. Authored-rotation decks (e.g., `data/ships/somnus/deckplan.yaml`, deck `rotation: 90`, grep-observed) keep their screen-rotated iso axes today, and the GM offset steps are grid-space. See Open Question 1.

### Rotation consistency checklist (D-09) — what changes and what does not

| Concern | Under grid-space offset | Action |
|---|---|---|
| Rooms, doors, details, hull, POIs, vents, tokens | Projected via `view` → correct automatically | None beyond passing `view` |
| `view.bbox` / viewBox / `GRID_MARGIN_MULTIPLIER` | Computed from projected corners → correct | None; but see MapPreview aspect (P9) |
| Background grid | `bgGridLines` is built from projected lines (comment at `EncounterMapRenderer.tsx` ~lines 283-292) → rotates with the offset | None |
| Door glyph orientation | `doorTransform` built from projected axis vectors (`mapView.ts` ~lines 85-118 comment) → correct | None |
| Circle rooms/details | `circleTransform` ellipse via `view` (Phase 33 Pitfall 3 resolved; grep-observed `CircleTransform` in `mapView.ts`) | None |
| Token glyph and labels upright | Token counter-rotates only `mapRotation` (`Token.tsx` ~lines 132, 174, 182; `RoomsLayer.tsx` ~line 76) — offset is not a screen rotation, so labels stay upright (D-05) | None; do not add offset to these counter-rotations |
| Token/POI/editor hit-testing | `screenToSVG` → `inverseRotatePoint(mapRotation)` → `getGridCellViaView(view)` (`TokenLayer.tsx` ~line 216, `useTokenPlacement.ts` ~line 56, `PoiLayer.tsx` ~lines 101, 122, `EncounterMapRenderer.tsx` ~line 450) → includes offset automatically | None; ordering is correct because the authored rotation is outermost |
| `view.unitSize` | Invariant across 90° offsets under iso (table above) and trivially under top-down | Add a regression test |

## Renderer Modes and Mount Sites

Six real mount points (grep-observed JSX; confirm imports before editing):

| # | Mount | Chain | Recommended `viewControl` | Why |
|---|---|---|---|---|
| 1 | Player terminal ENCOUNTER | `src/entries/SharedConsole.tsx:1046` → domain `EncounterView.tsx:214` → `EncounterMapDisplay.tsx` (four render branches, ~lines 140/150/164/190) → renderer | `readonly` (value from `activeView`) | D-03: no controls; mirrors broadcast |
| 2 | GM tactical map | `src/components/gm/views/EncounterView.tsx:420` → `MapPreview` (`fill`) → renderer; mounted from `src/entries/GMConsole.tsx:242` | `broadcast` | D-02: overlay controls; D-01 |
| 3 | GM side panel | `src/components/gm/EncounterPanel.tsx:439` → `MapPreview` (`isGM`) → renderer | `readonly` | **Not named in CONTEXT.md.** D-02 says not duplicated in the side panel; mirror the broadcast |
| 4 | Deckplan editor | `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx:230` → `MapPreview` (`editable`) → renderer | `local` | D-04: private, never POSTs |
| 5 | GM ship thumbnail | `src/components/gm/views/BridgeView.tsx:756` → `EncounterMapDisplay` | `readonly` | Phase 33 Open Question 1 becomes moot: no toggle on thumbnails |
| 6 | Dashboard thumbnail | `src/components/domain/dashboard/sections/StatusSection.tsx:448` → `EncounterMapDisplay` | `readonly` | Same |

**Phase 33 Open Question 1 resolution:** the Phase 33 research assumed the toggle appears on every mount. With `viewControl` defaulting to `readonly`, the thumbnails and side panel show the broadcast view with no buttons, and only mounts 2 and 4 expose controls.

### Uncontrolled mode location (D-04 vs. aspect ratio)

D-04 says `EncounterMapRenderer` itself needs an uncontrolled mode. The complication is `MapPreview` (grid branch, `src/components/gm/MapPreview.tsx` ~lines 173-212, read this session) sizes its outer box from a **grid-space** bounding box. Under iso or a 90° offset the projected aspect differs, and the editor (which passes neither `fill` nor `height`) uses that `aspectRatio`. If the editor's rotation lives inside the renderer, `MapPreview` cannot see it.

Recommendation: hold the `local` state in `MapPreview` (or `DeckplanPreviewPane`), pass it down as controlled props with `viewControl={{ mode: 'local' }}` semantics, and compute the aspect from the projected bbox using the effective projection. This is a deliberate reading of D-04: the renderer stays controlled-with-optional-controls, and the uncontrolled half lives one level up where the aspect is sized. If the planner keeps uncontrolled state inside the renderer, the editor aspect must come from the renderer's own `containerSize`/projected bbox instead. Either way, extract the bbox math that `MapPreview` duplicates (lines ~175-203, which re-implements room/circle/hull extents) into one helper rather than maintaining two copies.

## Fade and Reset (D-08, D-13, D-14)

### Mechanism

- Use GSAP (already a dependency) on a **wrapper element** around the map `<svg>`, not on the `<svg>` itself. The `<svg>` already carries a CSS `transform` for pan/zoom (`transform` style, `EncounterMapRenderer.tsx` ~lines 526-549), and a React-managed inline `opacity` on the same element would fight GSAP. Keep opacity out of React's `style` on the wrapper.
- Sequence for a rotation-only change: `opacity 1→0` (~200 ms) → **snap** `displayedOffset = requestedOffset` and `resetView()` → `opacity 0→1` (~200 ms). The snap is in the `onComplete`/`.add()` callback, so `resetView` lands while the map is invisible (D-13 without a visible jump).
- Projection-only change, or a combined projection+offset change (e.g., location switch): **cut** — set displayed immediately, `resetView()`, no fade (D-08).
- Rapid repeated rotates: kill the running timeline, start a new one from the current opacity, and read the latest requested value through a ref inside the callback (not a stale closure).
- Unmount: kill the timeline in the effect cleanup.
- Reduced motion: no `prefers-reduced-motion` handling exists in `src/` (grep: none). Recommend `matchMedia('(prefers-reduced-motion: reduce)')` → cut. Mark as a convention decision for the planner.

Skeleton (GSAP API usage is [ASSUMED], see Assumptions Log):
```ts
// requested = props from broadcast; displayed = what is drawn
const tl = gsap.timeline();
tl.to(wrapRef.current, { opacity: 0, duration: 0.2, ease: 'power1.in' })
  .add(() => { setDisplayedOffset(requestedRef.current); handleResetView(); })
  .to(wrapRef.current, { opacity: 1, duration: 0.2, ease: 'power1.out' });
fadeRef.current = tl;   // kill() in cleanup and before starting a new one
```

### Change detection (the pan/zoom reset rule)

```ts
const prev = useRef({ projection, rotationOffset });
const first = useRef(true);
useEffect(() => {
  if (first.current) { first.current = false; prev.current = { projection, rotationOffset }; return; }
  // compare primitives; on projection change → cut + reset; on offset change → fade + reset-at-snap
}, [projection, rotationOffset]);   // primitives only, never the activeView object
```

Do not reset on initial mount or SSE reconnect (same values → no reset).

## Broadcast Path (end to end)

1. **Store:** add keys to `_DEFAULT_STATE` (`core/active_view_store.py`, lines 12-38; `encounter_vents_visible` at line 35).
2. **Mutations:** `core/encounter_state.py` — `set_projection`, `rotate_view` (pattern above). Both go through `_sync` → `sync_state` → `update_state` (persist) → `build_active_view_payload` → `broadcaster.announce` (`core/views/active_view.py` lines 33-40, read this session: `new_state = update_state(**kwargs)` … `broadcaster.announce(payload)`).
3. **Endpoints:** `core/views/encounter.py` (new functions beside `api_encounter_set_vents_visible`), `core/urls.py` (new paths beside line 77), `core/views/__init__.py` (export beside line 68).
4. **Payload:** `core/payload_builder.py` `build()` returns an explicit dict. Add (beside line 98, read this session: `'encounter_vents_visible': state.get('encounter_vents_visible', False),`):
   `'encounter_projection': state.get('encounter_projection', 'top-down'),` and `'encounter_rotation_offset': state.get('encounter_rotation_offset', 0),`. Without this, the SSE event and `get_active_view_json` never carry the fields (Pitfall P1).
5. **Initial load / reconnect:** `api_active_view_stream` sends `build_active_view_payload(...)` first (`core/views/active_view.py`), so reloads get the persisted value (D-12).
6. **Frontend types:** `src/entries/SharedConsole.tsx` activeView interface (`encounter_vents_visible?: boolean;` at line 83 — read this session via grep; add beside it) and `src/types/gmConsole.ts` `ActiveView` (`encounter_vents_visible: boolean;` at line 74; add beside it).
7. **Frontend prop threading:** SharedConsole → domain `EncounterView` (add `projection`, `rotationOffset` next to `ventsVisible`, which already flows at `SharedConsole.tsx:1055`) → `EncounterMapDisplay` (`commonProps`, ~line 130) → renderer. GM: `activeView` from `GMConsole.tsx` → `gm/views/EncounterView.tsx` → `MapPreview` → renderer.
8. **Client API:** `src/services/encounterApi.ts` — add `setProjection` and `rotateView` next to `setVentsVisible` (lines ~226-233 pattern: `api.post('/gm/encounter/set-vents-visible/', { visible })`).

## Schema and Loader (D-11)

### Field shape (Claude's discretion — recommendation)

```yaml
# deckplan.yaml — location root (optional)
default_view:
  projection: iso        # top-down | iso   (default: top-down)
  rotation_offset: 90    # 0 | 90 | 180 | 270 (default: 0), added to each deck's authored rotation
```

**Recommend `rotation_offset`, not `rotation`.** The per-deck key `rotation` already exists with absolute semantics (`data/ships/somnus/deckplan.yaml`, read this session: `rotation: 90` under deck `id: main_deck`, `level: 1`, `default: true`). A location-level `rotation` meaning an *offset* would be a silent collision. The schema change is "costly to reverse" (D-11), so pick the unambiguous name now.

### Loader

`core/data_loader.py::load_deckplan` (read this session, lines 690-715) returns **only** `decks`, `hull`, `total_decks`. It is not a verbatim passthrough at the top level, so `default_view` must be added explicitly:
```python
        return {
            'decks': decks_sorted,
            'hull': hull,
            'total_decks': len(decks_sorted),
            'default_view': _parse_default_view(data.get('default_view')),  # NEW
        }
```
`_parse_default_view` returns `{'projection': 'top-down'|'iso', 'rotation_offset': 0|90|180|270}`, falling back per field to the defaults and logging (not raising) on unknown values. Also return the default dict from the early-return branch (`if not deckplan_path.exists()`, line 702) so no-deckplan locations get defaults.

Note: `tests/test_deckplan_passthrough.py` pins the "thin passthrough" contract for deck-level keys; adding a new top-level key does not violate it, but add a test asserting `default_view` survives the loader.

### Reset hook (D-11)

`core/views/navigation.py::api_switch_view` (read this session, lines 56-73). The existing block is:
```python
    # When switching to a new ENCOUNTER location, initialize all rooms as hidden
    if is_new_encounter_location:
        # Clear portrait overlays when switching to a new encounter location
        update_kwargs['encounter_active_portraits'] = []
        loader = get_loader()
        location = loader.find_location_by_slug(new_location_slug)
        if location and location.get('directory'):
```
Add the view reset in the `if is_new_encounter_location:` body, **outside** the `if location and location.get('directory')` guard, so that locations without a deckplan also reset to top-down/0:
```python
        default_view = DEFAULT_VIEW
        if location and location.get('directory'):
            deckplan = loader.load_deckplan(Path(location['directory']))
            default_view = deckplan.get('default_view', DEFAULT_VIEW)
        update_kwargs['encounter_projection'] = default_view['projection']
        update_kwargs['encounter_rotation_offset'] = default_view['rotation_offset']
```
(`DEFAULT_VIEW` is a module constant; the existing code loads the deckplan again inside its own guard. Avoid a second `load_deckplan` call by hoisting the load, but keep the existing room-visibility behavior unchanged.)

**Predicate question (Open Question 2):** `is_new_encounter_location` is true whenever the new view is ENCOUNTER with a slug **and** either the slug changed **or** the previous view was not ENCOUNTER (the predicate reads `(current.get('location_slug') != new_location_slug or current.get('view_type') != 'ENCOUNTER')`, from the same file, read this session). So re-entering the same map from BRIDGE also resets the view. D-11 says "a different location." Recommend gating the view reset on `current.get('location_slug') != new_location_slug` only, leaving room-visibility behavior unchanged.

### Documentation (CLAUDE.md schema sync)

`docs/schemas/schema-encounters.md` (read this session, lines 57-62 and 78-92):
- **Top-level Fields** table currently has `hull` and `decks` only → add `default_view` (mapping, optional, note projection/rotation_offset defaults).
- **Deck entry fields** table (lines ~78-92) has no `rotation` row → document it (absolute, degrees, 0/90/180/270; currently undocumented per CONTEXT).
- **Deck entry fields** `unit_size` row reads "Pixels per grid cell (default 30)" (read this session, line 86), but the renderer falls back to 40 (`const unitSize = mapData.unit_size ?? 40;` in `EncounterMapRenderer.tsx`, read this session at line 196; `MapPreview.tsx` line 173 also `?? 40`). Fix the doc while editing the file.
- Add a pitfall note (`P#` style per CLAUDE.md) that `rotation` (deck, absolute) and `default_view.rotation_offset` (location, relative) are different things.

`src/types/encounterMap.ts`: no change is required on the frontend for `default_view` unless the editor displays it. Add shared types `ViewProjection` and `RotationOffset` in a domain-free location (recommended: `geometry/viewOrientation.ts`, not `encounterMap.ts`, to keep `gridProjection` free of domain imports per its invariant comment).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Rotated iso projection | Manual 2×2 rotation matrices in layers | `isoProjection({ rotation: 45 + offset })` / `topDownProjection({ rotation })` via `buildProjection` | Single source; inverse (`unproject`) comes with it |
| Inverse for hit-testing after rotation | New inverse-rotation helpers | Existing `inverseRotatePoint(mapRotation)` (authored, screen) then `getGridCellViaView(view)` (offset, grid) | Already correct; just don't add a third inverse |
| Pan/zoom reset | Manual `setState({panX:0,…})` | `usePanZoom`'s `resetView` (`src/hooks/usePanZoom.ts`) | Existing |
| Fade sequencing | `requestAnimationFrame` loop or nested `setTimeout` | GSAP timeline with `.add()` callback (dependency already present) | Kill/restart semantics for rapid clicks |
| Map extents for aspect ratio | A second copy of room/circle/hull bbox math in `MapPreview` | `view.bbox(rooms, hull, pad)` with the effective projection | Projection-aware; removes duplication (CLAUDE.md: avoid duplication) |
| Request validation | Ad-hoc `if` chains per endpoint | `@post_json` plus enum checks in `encounter_state.py`, raising `ValueError` like `set_door_status` | Matches existing `VALID_DOOR_STATUSES` pattern |

**Key insight:** the seam already exists; the risk is not new geometry but accidentally bypassing `view` (raw `unitSize`/`rotate`) in a new code path, or adding state where the broadcast value should be the single source.

## Common Pitfalls

### P1: New store keys silently absent from the payload
**What goes wrong:** Clients never receive `encounter_projection`/`encounter_rotation_offset`.
**Why:** `payload_builder.build()` returns an explicit dict (`core/payload_builder.py`, read this session), not a copy of `state`.
**How to avoid:** Add both keys there and add a `test_payload_builder.py` assertion. Also check `get_active_view_json`, which uses the same builder.
**Warning sign:** GM rotates, DB/JSON file changes, players never move.

### P2: `default_view` dropped by the loader
**What goes wrong:** Authored default is ignored; every location loads top-down/0.
**Why:** `load_deckplan` returns three keys only (`core/data_loader.py` lines 711-715, read this session).
**How to avoid:** Add the key explicitly; test with a fixture deckplan.

### P3: Reset gated on the wrong predicate
**What goes wrong:** Locations without a deckplan keep the previous view; or a GM returning from the bridge loses their rotation.
**Why:** The reset is inside `if location and location.get('directory')` in the current code path, and `is_new_encounter_location` also fires on view-type changes.
**How to avoid:** Set defaults outside the guard; gate on slug change (Open Question 2).

### P4: `rotation` name collision
**What goes wrong:** Authors set `rotation: 90` at location level expecting an absolute orientation (or set deck `rotation` expecting an offset).
**How to avoid:** Use `rotation_offset` for the location-level key (recommended) and document both in the schema.

### P5: Screen-space rotation of the offset breaks the iso invariant
**What goes wrong:** Offset 90 gives axes at 120°/240° (60° from horizontal); D-01's 30° test fails at offset 90.
**How to avoid:** Implement the offset as grid azimuth (`rotation: 45 + offset`); add the four-azimuth test.

### P6: Pan/zoom reset on every SSE tick
**What goes wrong:** Players lose zoom when anyone moves a token or toggles a room.
**Why:** SSE re-sends the whole activeView; an effect keyed on the object reruns every time.
**How to avoid:** Compare primitives `(projection, rotationOffset)` against a ref; skip on mount.

### P7: GSAP opacity fights React
**What goes wrong:** Fade flickers or sticks at 0.
**How to avoid:** Animate a wrapper with no React-managed `opacity`; kill tweens in cleanup.

### P8: Concurrent rotate clicks lose a step
**What goes wrong:** Two GMs or a double-click on a stale client yield one net step.
**How to avoid:** Server-side `delta` (Pattern 1 `rotate_view`).

### P9: MapPreview aspect ratio is grid-space
**What goes wrong:** Editor preview box is the wrong shape after a 90° offset or under iso (letterboxing, not clipping, because the `<svg>` uses `meet`).
**Why:** `MapPreview.tsx` ~lines 173-212 compute `naturalW/H` from grid rects/polygons/circles/hull without a projection.
**How to avoid:** Compute from `view.bbox` under the effective projection; extract one helper.
**Phase 33 status:** this existed for iso already; Phase 34 makes it reachable for the offset as well.

### P10: Authored-rotation decks under iso are not "a rotation of the same picture"
**What goes wrong:** Somnus (authored 90) under iso shows screen-rotated axes (120°/240°) at offset 0; each GM step then changes the grid azimuth. A GM may read the step as inconsistent.
**How to avoid:** Confirm Open Question 1. Do not silently re-express authored rotation as grid azimuth, since that changes Phase 33 iso output for every rotated deck.

### P11: Controls leak onto the legacy MapPreview branch
**What goes wrong:** Non-grid (legacy) maps get broken or unprojected controls.
**Why:** `MapPreview.tsx` line ~250 onward is a separate legacy renderer with raw `unitSize` (e.g., token at ~882-883). Phase 33's note on "legacy branch is a different, untouched renderer" still applies.
**How to avoid:** Put controls only in the grid branch (`isGridEncounterMap`). Do not extend the legacy branch.

### P12: Mixed changes animate when they should cut
**What goes wrong:** A location switch (projection and offset change together) fades through the wrong projection.
**How to avoid:** If projection changed in the same tick, cut.

### P13: Drag in progress during a SSE-driven geometry change
**What goes wrong:** A token drag ghost jumps or lands in a stale cell after the view changes mid-drag.
**How to avoid:** Either ignore broadcast view changes while `isDraggingRef` is set (apply on pointer up), or cancel the drag. Pick one and test it. Low frequency; flag, do not over-engineer.

### P14: Schema doc drift
**What goes wrong:** Docs say `unit_size` default 30; code uses 40; deck `rotation` undocumented.
**How to avoid:** Fix both rows in the same commit (CLAUDE.md schema sync).

### P15: Bottom-left control cluster on phones
**What goes wrong:** Three buttons at 11px with 16px horizontal padding overflow a narrow map on a phone.
**How to avoid:** Use compact padding for the cluster, or put the rotate pair in one button group; verify on a narrow viewport during human verification (CLAUDE.md: mobile-first players).

## Code Examples

### Grid-space topDown rotation (exact for multiples of 90)

```ts
// gridProjection.ts — extend, keep unitSize guard, default rotation = 0 (identity)
export interface TopDownProjectionOptions {
  unitSize: number;
  /** Grid azimuth in degrees (multiples of 90 used by the view; default 0). */
  rotation?: number;
}
export function topDownProjection(opts: TopDownProjectionOptions): Projection {
  const us = opts.unitSize;
  if (!(us > 0) || !Number.isFinite(us)) throw new Error(/* existing message */);
  const q = (((opts.rotation ?? 0) % 360) + 360) % 360;
  // exact for 0/90/180/270; general trig otherwise
  const cos = q === 0 ? 1 : q === 90 ? 0 : q === 180 ? -1 : q === 270 ? 0 : Math.cos((q * Math.PI) / 180);
  const sin = q === 0 ? 0 : q === 90 ? 1 : q === 180 ? 0 : q === 270 ? -1 : Math.sin((q * Math.PI) / 180);
  // project: x = us*(cos*gx - sin*gy), y = us*(sin*gx + cos*gy); unproject = inverse rotation / us
  return {
    project({ gx, gy }) { return { x: us * (cos * gx - sin * gy), y: us * (sin * gx + cos * gy) }; },
    unproject({ x, y }) { return { gx: (cos * x + sin * y) / us, gy: (-sin * x + cos * y) / us }; },
  };
}
```
Check: for `rotation: 0` this reduces to `x = us·gx`, `y = us·gy` (identity, byte-identical to today). Verify the `unproject` inverse in a unit test (round-trip at ~1e-10).

### Test: the four iso azimuths stay true isometric (pins D-01 under the offset)

```ts
describe('isoProjection under 90° view offsets (Phase 34 D-07/D-09)', () => {
  for (const offset of [0, 90, 180, 270]) {
    it(`keeps both axes 30° from horizontal and unit length constant at offset ${offset}`, () => {
      const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 + offset });
      const ux = proj.project({ gx: 1, gy: 0 }), uy = proj.project({ gx: 0, gy: 1 });
      const ang = (p: { x: number; y: number }) => ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
      // each axis lies on a 30°-from-horizontal line: angle mod 180 is 30 or 150
      expect([30, 150]).toContain(Math.round(ang(ux) % 180 * 1e6) / 1e6);
      expect(Math.hypot(ux.x, ux.y)).toBeCloseTo(28.2843, 3);
      expect(Math.hypot(uy.x, uy.y)).toBeCloseTo(28.2843, 3);
    });
  }
});
```
(Numbers from the executed check above: x-axis at 30/150/210/330 and y-axis at 150/210/330/30, all `|u|` = 28.2843. Tests should assert the mod-180 lattice, not a particular axis index.)

### Fade + reset state machine (framework-free core, testable)

Keep the transition decision as a pure function so vitest covers it without a DOM:
```ts
// viewTransition.ts
export type ViewChange = 'none' | 'cut' | 'fade';
export function classifyChange(prev: { projection: ViewProjection; rotationOffset: number },
                               next: { projection: ViewProjection; rotationOffset: number }): ViewChange {
  if (prev.projection === next.projection && prev.rotationOffset === next.rotationOffset) return 'none';
  if (prev.projection !== next.projection) return 'cut';   // D-08 + P12
  return 'fade';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Per-viewer local projection toggle (Phase 33 D-03) | GM-owned broadcast (Phase 34 D-01) | This phase | `EncounterMapRenderer` loses the local `useState` for player and GM mounts |
| Authored rotation only (Phase 25 `mapRotation`, screen-space `rotate()`) | Authored screen rotation + GM grid-azimuth offset | This phase | Two rotation sources; documented asymmetry under iso (P10) |

**Deprecated/outdated:**
- The Phase 33 "toggle on every mount" design (Phase 33 OQ1) is superseded by `viewControl` defaulting to `readonly`.
- `ISO-02` (players toggle) is superseded by D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GSAP `timeline()`, `.to()`, `.add()`, and `kill()` behave as in GSAP 3.x (training knowledge; not fetched this session) | Fade and Reset | Low — long-standing API; confirm against installed `node_modules/gsap` types during implementation |
| A2 | `ruff` is available for Python lint (CLAUDE.md names Ruff; availability not probed) | Validation Architecture | Low — probe with `.venv/bin/ruff --version` before relying on it |
| A3 | Reduced-motion should cut instead of fade (no in-repo convention found) | Fade and Reset | Low — a product choice; confirm with user |
| A4 | Thumbnail/side-panel mounts (5, 6, 3) should be read-only mirrors, not hidden | Renderer Modes | Medium — if the user wants the side panel to be interactive, the `broadcast` mode applies there too |
| A5 | Somnus-style authored rotation under iso is acceptable as screen-space (P10) | Rotation Math | Medium — see Open Question 1 |
| A6 | Phase 33 Pitfall 4 (`RoomsLayer` label_offset raw `unitSize`) is already fixed | Rotation Math | Low — not re-read this session; grep before planning. Phase 33 VERIFICATION reports PASSED |

## Open Questions (RESOLVED)

1. **Authored rotation under iso: keep screen-space or re-express as grid azimuth?** — *RESOLVED → D-15: fold into grid (re-express)*
   - What we know: Phase 33 D-06 locked the authored rotate as a post-projection SVG `rotate()`. Under iso that yields 120°/240° axes for a 90° deck today. D-07 requires offset 0 to equal today's rendering. The GM offset is grid-space.
   - What's unclear: whether the GM expects a 90° step to look identical to a 90° authored rotation.
   - Recommendation: keep the authored rotate as is (no change to shipped Phase 33 output). Document the asymmetry in the schema and the phase summary. If the user prefers uniform semantics, the change is to fold `mapRotation` into the iso azimuth as well, which changes Somnus's iso rendering — that needs an explicit decision.

2. **D-11 reset predicate: slug change only, or any entry into ENCOUNTER?** — *RESOLVED → D-16: location change only*
   - What we know: `is_new_encounter_location` also fires on view-type changes. Room visibility resets on that predicate today.
   - Recommendation: reset the view on slug change only, so returning from the bridge keeps the GM's rotation. Leave room visibility unchanged.

3. **Location-level key name: `rotation_offset` or `rotation`?** — *RESOLVED → D-19: `rotation_offset`*
   - Recommendation: `rotation_offset` (avoids the deck-`rotation` collision, P4). CONTEXT lists `rotation` as an example only, under Claude's discretion.

4. **Editor initial local view: top-down/0, or the deckplan's `default_view`?** — *RESOLVED → D-17: top-down/0*
   - What we know: the editor parses deckplan YAML, and `default_view` is top-level.
   - Recommendation: start at top-down/0 (simpler; matches "private local state"). Starting from `default_view` is nicer for authoring and requires passing the top-level key into `DeckplanPreviewPane`.

5. **Uncontrolled state location (MapPreview vs. renderer)** — *RESOLVED → D-04: renderer `local` viewControl mode (plans 34-04/34-05)* — see Renderer Modes. Recommendation: `MapPreview`-owned.

6. **Drag during broadcast change (P13)** — *RESOLVED → D-18: cancel the drag* — apply on pointer-up, or cancel the drag?

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | vitest, typecheck, build | ✓ | v24.19.0 | — |
| pnpm | `pnpm run test`, `pnpm run typecheck` | ✓ | `/home/gjohnson/.npm-global/bin/pnpm` (probed via `command -v`) | `npx vitest run` (CONTEXT's form) also works |
| node_modules | tests | ✓ | present (probed) | — |
| Python venv | Django tests | ✓ | `.venv/bin/python` present (probed) | — |
| ruff | Python lint (CLAUDE.md) | not probed | — | Skip lint; note in summary (A2) |
| janus-skills checkout | schema sync (CLAUDE.md) | ✓ | `/home/gjohnson/src/janus-skills` (directory present) | Sync is done by CI on push to main; no local action required |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Vitest ^2.1.9 (`package.json`, grep-observed); `environment: 'jsdom'`, include `src/**/__tests__/**/*.test.{ts,tsx}` (per Phase 33 research, `vitest.config.ts`) |
| Backend framework | Django `TestCase` (`core/tests/*.py`), run via `.venv/bin/python manage.py test` |
| Frontend quick run | `pnpm exec vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` |
| Frontend full | `pnpm run test` and `pnpm run typecheck` |
| Backend quick run | `.venv/bin/python manage.py test core.tests.test_encounter_state core.tests.test_active_view_store core.tests.test_payload_builder core.tests.test_data_loader core.tests.test_deckplan_passthrough` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| ISO-04 | `set_projection` rejects unknown values; persists; broadcasts | unit (Django) | `manage.py test core.tests.test_encounter_state` | ❌ Wave 0 (extend file) |
| ISO-04 | `encounter_projection` and `encounter_rotation_offset` are in the SSE payload | unit (Django) | `manage.py test core.tests.test_payload_builder` | ❌ Wave 0 (extend) |
| ISO-04 | Defaults merge over an old `active_view.json` without new keys (D-12 upgrade) | unit (Django) | `manage.py test core.tests.test_active_view_store` | ❌ Wave 0 (extend) |
| ISO-05 | `rotate_view(±90)` wraps: 0→90→180→270→0; −90 from 0 → 270; rejects other deltas | unit (Django) | `manage.py test core.tests.test_encounter_state` | ❌ Wave 0 |
| ISO-05 | `topDownProjection({unitSize, rotation:0})` identical to today; round-trip at 90/180/270 | unit (vitest) | `pnpm exec vitest run .../gridProjection.test.ts` | ❌ Wave 0 (extend) |
| ISO-05/07 | Iso axes at 30° lattice and |u| constant across four offsets (D-01 under D-07) | unit (vitest) | same | ❌ Wave 0 (add block above) |
| ISO-06 | `load_deckplan` returns normalized `default_view`; absent → defaults; invalid value → defaults | unit (Django) | `manage.py test core.tests.test_data_loader` | ❌ Wave 0 (extend) |
| ISO-06 | `api_switch_view` into a new location sets projection/offset from `default_view`; same-location re-entry keeps it; no-deckplan location resets to defaults | integration (Django) | `manage.py test core.tests.test_encounter_view_state` (new file) | ❌ Wave 0 |
| ISO-06 | Deck switch (`switch_level`) keeps projection/offset (D-10) | unit (Django) | `manage.py test core.tests.test_encounter_state` | ❌ Wave 0 |
| ISO-07 | Token/POI/editor cell from pointer equals the projected cell at offsets 0/90/180/270 under iso (Pitfall P5/hit-testing) | unit (vitest) — pure helper over `getGridCellViaView` + `makeMapView` | `pnpm exec vitest run src/utils/__tests__/svgCoordinates.test.ts` (extend) | ❌ Wave 0 |
| ISO-07 | `classifyChange` returns cut for projection changes, fade for offset-only, none for identical values | unit (vitest) | `pnpm exec vitest run .../viewTransition.test.ts` | ❌ Wave 0 (new) |
| ISO-07 | Fade/reset timing and pan reset on SSE-only changes do not fire | manual-only (no existing renderer test harness) | Human verify checkpoint | manual — justified: DOM+GSAP timing; test the pure classifier instead |
| ISO-04/05 | Players see no controls (D-03); GM sees controls (D-02); editor controls never POST (D-04) | manual-only (mount-level DOM assertion would need a new harness) | Human verify checkpoint | manual |

### Sampling Rate

- **Per task commit:** the relevant `pnpm exec vitest run <file>` or `manage.py test <module>`
- **Per wave merge:** `pnpm run test` plus `pnpm run typecheck`, and the Django quick-run list above
- **Phase gate:** full suites green plus the human-verify checkpoint: open the player terminal, GM tactical map, GM side panel, and deckplan editor; rotate at all four steps in both projections; click/drag a token and drop a POI at each step; confirm the editor's local toggle does not change the player view.

### Wave 0 Gaps

- [ ] `geometry/__tests__/gridProjection.test.ts` — topDown `rotation` tests; iso four-azimuth block
- [ ] `geometry/__tests__/viewOrientation.test.ts` — `normalizeRotationOffset`, `buildProjection` offset-0 identity
- [ ] `src/components/domain/encounter/viewTransition.ts` + `__tests__/viewTransition.test.ts` — `classifyChange`
- [ ] `src/utils/__tests__/svgCoordinates.test.ts` — extend with projection-aware cell resolution at each offset (file exists per `find`)
- [ ] `core/tests/test_encounter_state.py` — `set_projection`, `rotate_view`, D-10 deck-switch retention
- [ ] `core/tests/test_active_view_store.py` — defaults merge for the new keys (file exists)
- [ ] `core/tests/test_payload_builder.py` — new keys present (file exists)
- [ ] `core/tests/test_data_loader.py` — `default_view` normalization (file exists)
- [ ] `core/tests/test_encounter_view_state.py` (new) — `api_switch_view` reset semantics, including no-deckplan location and same-location re-entry (no `test_navigation` exists today)

## Security Domain

`security_enforcement` is `true` in `.planning/config.json` (read this session: `"security_enforcement": true`, `"security_asvs_level": 1`), so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | Unchanged; endpoints use the existing `@login_required` decorator pattern |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (existing pattern) | Mirror `api_encounter_set_vents_visible`'s decorators: `@login_required` + `@post_json`. Players are read-only by CLAUDE.md; the GM endpoints must not be callable by a player *UI* — there is no player control (D-03). Note that the existing `/api/gm/…` routes are protected by `@login_required` only, not by a GM role check; this phase does not change that. |
| V5 Input Validation | Yes | Server-side enum checks: `projection in ('top-down','iso')`; `delta in (90, -90)`; `default_view` normalization in the loader (unknown values fall back, never raise into the request path) |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Arbitrary `rotation` value (e.g., 45) stored and used in trig | Tampering | Reject at endpoint; normalize in loader; client `normalizeRotationOffset` throws on non-multiples of 90 |
| Malformed `default_view` in an authored YAML breaks location load | Denial of service (of one request) | Loader returns defaults and logs on bad values; never raises from `load_deckplan` |
| Concurrent rotate race | Integrity | Server-side relative `delta` |

## Sources

### Primary (HIGH confidence — read or executed this session)
- `.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-CONTEXT.md` — locked decisions D-01…D-14 (read in full)
- `.planning/phases/33-isometric-view/33-RESEARCH.md` — prior seam, pitfalls, Phase 33 OQ1 (read in full)
- `core/active_view_store.py` — `_DEFAULT_STATE` (lines 12-38), persistence (read in full)
- `core/encounter_state.py` — `set_vents_visible` (lines 66-68), `_sync` (read in full)
- `core/views/active_view.py` — `sync_state` (lines 33-40), SSE stream (grep + partial read)
- `core/views/navigation.py` — `api_switch_view` (lines 38-73, read)
- `core/data_loader.py` — `load_deckplan` (lines 690-715, read)
- `core/payload_builder.py` — builder key list (lines 96-98, read)
- `data/ships/somnus/deckplan.yaml` — lines 40-47 (read): deck `rotation: 90`, `unit_size: 30`
- `docs/schemas/schema-encounters.md` — lines 57-62, 78-92 (read in part)
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — lines 55-305 (read): props, projection, bbox, rotation
- `src/components/gm/MapPreview.tsx` — lines 60-250 (read): grid branch, `isGM ?? true`, aspect math
- `src/components/domain/encounter/geometry/gridProjection.ts` — `isoProjection` and `topDownProjection` (read via shell)
- `src/utils/svgCoordinates.ts` — `snapToGrid`, `getGridCell`, `getGridCellViaView` (read via shell)
- `src/hooks/usePanZoom.ts` — lines 29-40 (read): `resetView`

### Executed this session
- `python3 -I` axis-angle and unit-length check for `isoProjection` at azimuths 45/135/225/315 and the screen-rotation counterexample (output reproduced in Rotation Math)
- Toolchain probe: `pnpm`, `node v24.19.0`, `.venv/bin/python`, `node_modules` present

### Secondary (MEDIUM — grep-observed; re-Read before editing)
- JSX mount sites (`src/components/gm/EncounterPanel.tsx:439`, `src/components/gm/views/BridgeView.tsx:756`, `src/components/domain/dashboard/sections/StatusSection.tsx:448`, `src/entries/GMConsole.tsx:242`, `src/entries/SharedConsole.tsx:1046`)
- `src/types/gmConsole.ts:74`, `src/entries/SharedConsole.tsx:83`, `src/services/encounterApi.ts:226-233`
- `core/urls.py:77`, `core/views/encounter.py:87-96`, `core/views/__init__.py:68`
- `.planning/REQUIREMENTS.md` lines 37-39 and 74-76 (ISO-02 rows)

### Tertiary (LOW — training knowledge)
- GSAP timeline API (Assumptions A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions grep-observed from `package.json`
- Rotation math: HIGH — derived from the existing `isoProjection` formula and executed this session
- Architecture / broadcast path: HIGH — every touchpoint read or grep-confirmed
- Mount sites: MEDIUM-HIGH — grep-observed JSX; confirm imports before editing
- Fade/reset UX: MEDIUM — mechanism sound; timing and feel need human verification
- Pitfalls: HIGH for P1-P4, P6, P8, P11 (read-confirmed); MEDIUM for P9, P13 (inferred from code shape)

**Research date:** 2026-10-14
**Valid until:** 2026-11-14 (static analysis of current source; re-grep `unitSize`, `projectionMode`, `set-vents-visible`, and the mount sites before planning if the encounter renderer changes further)
