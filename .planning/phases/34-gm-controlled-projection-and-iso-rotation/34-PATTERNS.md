# Phase 34: GM-Controlled Projection and Iso Rotation - Pattern Map

**Mapped:** 2026-10-14
**Files analyzed:** 22 (new or modified)
**Analogs found:** 22 / 22 (3 files have no direct analog; see bottom)

All analog paths below are git-tracked (verified with `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `core/active_view_store.py` | store / config | CRUD (persisted JSON) | `core/active_view_store.py` line 35 (`encounter_vents_visible`) | exact |
| `core/encounter_state.py` | service | CRUD | `set_vents_visible` (line 66-68), `set_door_status` (line 50-58) | exact |
| `core/views/encounter.py` | controller | request-response | `api_encounter_set_vents_visible` (lines 86-96) | exact |
| `core/urls.py` | route | request-response | `api/gm/encounter/set-vents-visible/` (line 77) | exact |
| `core/views/__init__.py` | config (exports) | n/a | existing export of `api_encounter_set_vents_visible` (line 68) | exact |
| `core/payload_builder.py` | transform | transform | `'encounter_vents_visible': ...` (line 98) | exact |
| `core/data_loader.py` (`load_deckplan` + `_parse_default_view`) | service / loader | file-I/O | `load_deckplan` (lines 690-715) | exact |
| `core/views/navigation.py` (`api_switch_view`) | controller | request-response | new-location block (lines 26-29, 56-73) | exact |
| `core/tests/test_encounter_view_state.py` (new) | test | CRUD | `core/tests/test_encounter_state.py` | role-match |
| `core/tests/test_payload_builder.py` (extend) | test | transform | existing payload builder tests | exact |
| `core/tests/test_deckplan_passthrough.py` (extend) | test | file-I/O | existing passthrough tests | exact |
| `src/components/domain/encounter/geometry/gridProjection.ts` | utility | transform | `topDownProjection` / `isoProjection` (lines 48-120) | exact |
| `src/components/domain/encounter/geometry/viewOrientation.ts` (new) | utility | transform | `gridProjection.ts` factory style | role-match |
| `src/components/domain/encounter/geometry/viewTransition.ts` (new, optional) | utility | event-driven | none (pure function) | no analog |
| `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` (extend) | test | transform | same file | exact |
| `src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts` (new) | test | transform | `gridProjection.test.ts` | exact |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | component | event-driven | itself: `projectionMode` useState (line 200-210), overlay buttons (lines 846-866) | exact |
| `src/components/gm/MapPreview.tsx` | component | request-response | itself: grid branch `EncounterMapRenderer` call (line 222-227), bbox math (lines 173-212) | exact |
| `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` | component | request-response | `MapPreview` mount (line 230) | role-match |
| `src/components/domain/encounter/EncounterMapDisplay.tsx` / `EncounterView.tsx` | component | request-response | `ventsVisible` prop threading | role-match |
| `src/entries/SharedConsole.tsx` | component / entry | event-driven | `encounter_vents_visible?: boolean` (line 83), `ventsVisible={activeView?.encounter_vents_visible}` (line 1055) | exact |
| `src/types/gmConsole.ts` | model (types) | n/a | `encounter_vents_visible: boolean` (line 74) | exact |
| `src/services/encounterApi.ts` | service | request-response | `setVentsVisible` (lines 226-232) | exact |
| `docs/schemas/schema-encounters.md` | config (docs) | n/a | existing top-level and deck field tables | exact |

## Pattern Assignments

### `core/active_view_store.py` (store, CRUD)

**Analog:** same file, `encounter_vents_visible` (line 35).

**Core pattern** (line 35):
```python
    'encounter_vents_visible': False,
```
Add beside it:
```python
    'encounter_projection': 'top-down',
    'encounter_rotation_offset': 0,
```
Persistence is free: `_load_from_disk` (line 47-54) merges stored keys over `_DEFAULT_STATE` key by key, so old `var/active_view.json` files load with defaults (D-12).

---

### `core/encounter_state.py` (service, CRUD)

**Analog:** same file, `set_vents_visible` (lines 66-68) and `set_door_status` (lines 50-58).

**Imports** (lines 9, 12-14): `from core.active_view_store import get_state`; `_sync(**kwargs)` calls `core.views.active_view.sync_state` (persist + broadcast).

**Validation + mutation pattern** (`set_door_status`, lines 50-58):
```python
def set_door_status(connection_id: str, door_status: str) -> dict:
    """Set a door's runtime status. Raises ValueError for unrecognized statuses."""
    if door_status not in VALID_DOOR_STATUSES:
        raise ValueError(
            f"Invalid door_status '{door_status}'. Must be one of: {', '.join(sorted(VALID_DOOR_STATUSES))}"
        )
```

**Simple setter pattern** (`set_vents_visible`, lines 66-68):
```python
def set_vents_visible(visible: bool) -> dict:
    """Show or hide all vents for players."""
    return _sync(encounter_vents_visible=bool(visible))
```

**Add:**
```python
PROJECTIONS = ('top-down', 'iso')

def set_projection(projection: str) -> dict:
    if projection not in PROJECTIONS:
        raise ValueError(f"Invalid projection '{projection}'. Must be one of: {', '.join(PROJECTIONS)}")
    return _sync(encounter_projection=projection)

def rotate_view(delta: int) -> dict:
    """Relative ±90 step, computed server-side (avoids stale-client races, P8)."""
    if delta not in (90, -90):
        raise ValueError(f"Invalid rotation delta {delta}. Must be 90 or -90.")
    offset = (get_state().get('encounter_rotation_offset', 0) + delta) % 360
    return _sync(encounter_rotation_offset=offset)
```

---

### `core/views/encounter.py` (controller, request-response)

**Analog:** `api_encounter_set_vents_visible` (lines 86-96).

**Endpoint pattern** (verbatim):
```python
@login_required
@post_json
def api_encounter_set_vents_visible(request, data):
    """
    Show or hide all vents for players.
    POST: { visible: boolean }
    """
    visible = bool(data.get('visible', False))
    enc.set_vents_visible(visible)

    return JsonResponse({'success': True, 'vents_visible': visible})
```

**Add two endpoints with the same decorators.** Validation errors (`ValueError` from `encounter_state`) should map to HTTP 400 (ASVS V5). Do not add stricter auth than existing `/api/gm/` routes.
- `api_encounter_set_projection`: `POST { projection }` → `{ success, projection }`
- `api_encounter_rotate_view`: `POST { delta }` → `{ success, rotation_offset }`

### `core/urls.py` and `core/views/__init__.py`

**Analog:** `api/gm/encounter/set-vents-visible/` (`core/urls.py` line 77) and its export (`core/views/__init__.py` line 68).
Add `api/gm/encounter/set-projection/` and `api/gm/encounter/rotate-view/` beside it, and export the two new view functions in the same style.

---

### `core/payload_builder.py` (transform)

**Analog:** line 98. `build()` returns an explicit allow-list dict, so new store keys are invisible unless added.
```python
            'encounter_vents_visible': state.get('encounter_vents_visible', False),
```
Add beside it:
```python
            'encounter_projection': state.get('encounter_projection', 'top-down'),
            'encounter_rotation_offset': state.get('encounter_rotation_offset', 0),
```
Add an assertion in `core/tests/test_payload_builder.py`. `get_active_view_json` uses the same builder.

---

### `core/data_loader.py` (`load_deckplan`, file-I/O)

**Analog:** `load_deckplan` (lines 690-715). It returns only three keys, so `default_view` must be added explicitly:
```python
        if not deckplan_path.exists():
            return {'decks': [], 'hull': None, 'total_decks': 0}
        ...
        return {
            'decks': decks_sorted,
            'hull': hull,
            'total_decks': len(decks_sorted),
        }
```
Change to:
```python
        default_view = _parse_default_view(data.get('default_view'))   # after yaml load
        ...
            'default_view': default_view,
```
and return `'default_view': DEFAULT_VIEW` (a copy) in the early-return branch. `_parse_default_view` normalizes each field independently (`projection` in `('top-down','iso')`, `rotation_offset` in `{0,90,180,270}`), falls back per field, and logs rather than raises (UI spec: partial invalid never blocks load).

Extend `core/tests/test_deckplan_passthrough.py` with a test that `default_view` survives the loader; the existing thin-passthrough contract for deck keys is unaffected.

---

### `core/views/navigation.py` (`api_switch_view`, request-response)

**Analog:** the existing new-location block (lines 26-29 predicate, lines 56-73 body):
```python
    is_new_encounter_location = (
        new_view_type == 'ENCOUNTER' and
        new_location_slug and
        (current.get('location_slug') != new_location_slug or current.get('view_type') != 'ENCOUNTER')
    )
    ...
    if is_new_encounter_location:
        update_kwargs['encounter_active_portraits'] = []
        loader = get_loader()
        location = loader.find_location_by_slug(new_location_slug)
        if location and location.get('directory'):
```
**Add** the view reset inside the body, outside the directory guard, gated on **slug change only** (D-16; research Open Question 2, so returning from BRIDGE keeps the GM's rotation):
```python
        default_view = DEFAULT_VIEW
        if location and location.get('directory'):
            default_view = loader.load_deckplan(Path(location['directory']))['default_view']
        update_kwargs['encounter_projection'] = default_view['projection']
        update_kwargs['encounter_rotation_offset'] = default_view['rotation_offset']
```
Hoist the load so `load_deckplan` runs once. Keep room-visibility behavior unchanged.

---

### `src/components/domain/encounter/geometry/gridProjection.ts` (utility, transform)

**Analog:** same file. `isoProjection` (lines 85-120) already takes `rotation` in degrees and builds the matrix `us · diag(cos t, sin t) · R(r)`. `topDownProjection` (lines 48-67) has no rotation today.

**Extend** `topDownProjection` with `rotation?: number` (default 0). Use exact `0/±1` values for multiples of 90 so `toBe` assertions and offset-0 output stay byte-identical:
```ts
export interface TopDownProjectionOptions {
  unitSize: number;
  /** Grid azimuth in degrees; default 0 (identity). */
  rotation?: number;
}
// q = normalized degrees in [0,360); cos/sin exact for q in {0,90,180,270}
// project:   x = us*(cos*gx - sin*gy), y = us*(sin*gx + cos*gy)
// unproject: gx = (cos*x + sin*y)/us,  gy = (-sin*x + cos*y)/us
```
Keep the existing `unitSize` guard and error message.

### `src/components/domain/encounter/geometry/viewOrientation.ts` (new)

**Analog:** `gridProjection.ts` factory style. Put shared types here, not in `encounterMap.ts`, so `gridProjection` stays free of domain imports.
```ts
export type ViewProjection = 'top-down' | 'iso';
export type RotationOffset = 0 | 90 | 180 | 270;

export function buildProjection(p: ViewProjection, offset: RotationOffset, unitSize: number): Projection {
  return p === 'iso'
    ? isoProjection({ unitSize, tilt: 30, rotation: 45 + offset })  // 45 base unchanged from Phase 33
    : topDownProjection({ unitSize, rotation: offset });
}
```
Also here: `normalizeRotationOffset`. Authored deck `rotation` is NOT passed into this projection under top-down (screen `rotate()` stays). Under iso it is folded in per D-15: pass `rotation: 45 + offset + authored`, and drop the screen `rotate()` for the iso branch. Decide this in one place (`buildProjection`) and cover it in tests.

### `src/components/domain/encounter/geometry/viewTransition.ts` (new, optional)

No direct analog. Pure function so vitest can cover it without a DOM:
```ts
export type ViewChange = 'none' | 'cut' | 'fade';
export function classifyChange(prev: { projection: ViewProjection; rotationOffset: number },
                               next: { projection: ViewProjection; rotationOffset: number }): ViewChange {
  if (prev.projection === next.projection && prev.rotationOffset === next.rotationOffset) return 'none';
  if (prev.projection !== next.projection) return 'cut';   // D-08 + P12
  return 'fade';
}
```

### Tests (`geometry/__tests__/`)

**Analog:** `gridProjection.test.ts` and `mapView.test.ts` in the same folder. Add:
- topDown `rotation` 0 identity, 90/180/270 exact, and `unproject(project(p)) ≈ p` round trip.
- Four-azimuth iso check: for offsets 0/90/180/270, both axes lie on the 30° lattice (angle mod 180 is 30 or 150) and `|u| ≈ 28.2843` at unitSize 40, tilt 30.
- `buildProjection` offset 0 equals today's `isoProjection({rotation:45})` and `topDownProjection({unitSize})`.

---

### `src/components/domain/encounter/EncounterMapRenderer.tsx` (component, event-driven)

**Analog:** same file. It currently owns projection locally.

**Current state** (lines 196-210):
```tsx
  const unitSize = mapData.unit_size ?? 40;
  const [projectionMode, setProjectionMode] = useState<'top-down' | 'iso'>('top-down');
  const projection = useMemo(
    () =>
      projectionMode === 'iso'
        ? isoProjection({ unitSize, tilt: 30, rotation: 45 })
        : topDownProjection({ unitSize }),
    [unitSize, projectionMode]
  );
```
Replace with `buildProjection(effectiveProjection, effectiveOffset, unitSize)`. Use one `useState` for local values and select `effective = viewControl.mode === 'local' ? local : props` (hooks run unconditionally). Recommended discriminated prop:
```ts
type ViewControl =
  | { mode: 'readonly' }                                   // players, side panel, thumbnails
  | { mode: 'broadcast'; onProjectionChange: (p: ViewProjection) => void;
                         onRotate: (delta: 90 | -90) => void }   // GM tactical map
  | { mode: 'local' };                                     // deckplan editor (D-04)
```
Keep the existing `isGM` prop for interaction (door/room click), separate from view controls.

**Authored rotation** (line 257, `const mapRotation = mapData.rotation ?? 0;`) stays a screen `rotate()` under top-down. Keep it outermost for hit-testing (`inverseRotatePoint(mapRotation)` then `getGridCellViaView(view)`).

**Overlay button pattern** (lines 846-866): the existing RESET VIEW and projection button share one inline style. Refactor to one shared style object and add the cluster per UI-SPEC:
```tsx
        <button
          className="encounter-map__projection-toggle"
          onClick={() => setProjectionMode((m) => (m === 'iso' ? 'top-down' : 'iso'))}
          title={projectionMode === 'iso' ? 'Switch to top-down view' : 'Switch to isometric view'}
          aria-label="Toggle map projection between top-down and isometric"
          aria-pressed={projectionMode === 'iso'}
          style={{
            gridArea: 'bottom-left',
            alignSelf: 'end',
            justifySelf: 'start',
            pointerEvents: 'auto',
            background: 'rgba(15, 21, 21, 0.95)',
            border: projectionMode === 'iso' ? '1px solid #c9a050' : '1px solid #4a6b6b',
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
Wrap the projection button and the two rotate buttons (`⟲` = -90, `⟳` = +90) in one flex `div` with `gridArea: 'bottom-left'`, `gap: 8px`, `pointerEvents: 'none'`. Add `minWidth`/`minHeight: 44px` to the shared style. Render only for `broadcast` and `local` modes, and only in the grid branch.

**Fade and reset:** wrap the `<svg>` (line 524) in a wrapper `div` that GSAP drives (no React `opacity`). Compare primitive `projection` and `offset` against a ref; never key effects on the activeView object. Rotation fades (200ms out, snap plus `resetView()` from `usePanZoom`, 200ms in). Projection change cuts.

---

### `src/components/gm/MapPreview.tsx` (component)

**Analog:** same file. Grid branch delegates to the renderer (lines 222-227):
```tsx
          <EncounterMapRenderer
            ...
            isGM={isGM ?? true}
```
Aspect ratio (lines 173-212) computes `naturalW/H` from grid rects, circles and hull with `unit_size` default 40. Under iso or a 90° offset the aspect changes, so extract one projection-aware bbox helper (`view.bbox`) and remove the duplicate math.

**Local view state (D-04):** own the `local` projection and offset here (opens at top-down/0, D-17). Pass them as controlled props with `viewControl={{ mode: 'local', ... }}`. Show controls only in the grid branch (`isGridEncounterMap`); never add them to the legacy branch (research P11).

### `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx`

**Analog:** its existing `MapPreview` mount (line 230, `editable`). Mount with local view control; it never POSTs.

---

### `src/entries/SharedConsole.tsx` and domain `EncounterView.tsx` / `EncounterMapDisplay.tsx` (prop threading)

**Analog:** the `ventsVisible` prop chain.
```ts
  encounter_vents_visible?: boolean;      // SharedConsole.tsx line 83
  ...
          ventsVisible={activeView?.encounter_vents_visible}   // SharedConsole.tsx line 1055
```
Add `encounter_projection?: 'top-down' | 'iso';` and `encounter_rotation_offset?: number;` beside line 83. Thread `projection` and `rotationOffset` the same way to `EncounterMapDisplay` (`commonProps`) and then to the renderer with `viewControl={{ mode: 'readonly' }}`. Players get no controls.

### `src/types/gmConsole.ts`

**Analog:** line 74 `encounter_vents_visible: boolean;`. Add the two new fields beside it.

### `src/services/encounterApi.ts`

**Analog:** `setVentsVisible` (lines 226-232):
```ts
async function setVentsVisible(visible: boolean): Promise<{ success: boolean; vents_visible: boolean }> {
  const response = await api.post<{ success: boolean; vents_visible: boolean }>(
    '/gm/encounter/set-vents-visible/',
    { visible }
  );
  return response.data;
}
```
Add `setProjection(projection)` → `/gm/encounter/set-projection/` and `rotateView(delta)` → `/gm/encounter/rotate-view/` (`{ delta }`) beside it, and export them in the object at lines 254-262.

### `docs/schemas/schema-encounters.md` (Schema Sync, CLAUDE.md)

**Analog:** the existing top-level Fields table (lines ~57-62) and Deck entry fields table (lines ~78-92).
- Add top-level `default_view` (mapping, optional): `projection` (`top-down` | `iso`, default `top-down`), `rotation_offset` (`0 | 90 | 180 | 270`, default `0`, grid-space offset added to each deck's authored `rotation`).
- Document the existing deck `rotation` row (absolute, degrees, 0/90/180/270). It is currently undocumented.
- Fix `unit_size` default from 30 to 40 (the renderer falls back to 40, `EncounterMapRenderer.tsx` line 196).
- Add a pitfall (`P#`) that `rotation` (deck, absolute) and `default_view.rotation_offset` (location, relative) are different.

Also update REQUIREMENTS.md: ISO-02 is superseded by D-01 (ISO-04).

---

## Shared Patterns

### Authentication / validation on GM endpoints
**Source:** `core/views/encounter.py` lines 86-88
**Apply to:** `api_encounter_set_projection`, `api_encounter_rotate_view`
```python
@login_required
@post_json
def api_encounter_set_vents_visible(request, data):
```

### State mutation and broadcast
**Source:** `core/encounter_state.py` lines 12-14 (`_sync`) and 66-68
**Apply to:** `set_projection`, `rotate_view` (never write `var/active_view.json` directly; `_sync` persists and announces via SSE)

### Projection seam (never bypass)
**Source:** `gridProjection.ts` lines 48-120 and `mapView.ts` (`makeMapView`)
**Apply to:** all new coordinate code. Route through `view`; do not add raw `unitSize * gx` or inline `rotate()` for the GM offset.

### Overlay button style
**Source:** `EncounterMapRenderer.tsx` lines 846-866
**Apply to:** all cluster buttons and `RESET VIEW` (one shared style object, per UI-SPEC).

### Reset on primitive change only
**Source:** pattern from `RESEARCH.md` (Change detection), no existing analog
**Apply to:** renderer effect keyed on `[projection, rotationOffset]` with a first-mount ref.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `viewTransition.ts` | utility | event-driven | No existing pure state machine for view transitions. Use the snippet in this map. |
| Fade wrapper and GSAP timeline in renderer | component | event-driven | GSAP is used only in `SharedConsole.tsx`; the timeline/kill pattern is new. Use RESEARCH.md skeleton (GSAP API is assumed; confirm against `node_modules/gsap` types). |
| `prefers-reduced-motion` handling | utility | event-driven | No match in `src/`. Use `matchMedia('(prefers-reduced-motion: reduce)')` → cut. |

## Metadata

**Analog search scope:** `core/` (active_view_store, encounter_state, views/encounter, views/navigation, payload_builder, data_loader, urls), `src/components/domain/encounter/`, `src/components/gm/`, `src/entries/SharedConsole.tsx`, `src/services/encounterApi.ts`, `src/types/`, `docs/schemas/`
**Files scanned:** ~20 (targeted greps and line-range reads)
**Pattern extraction date:** 2026-10-14
