# Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 8 (2 modified type/renderer files, 1 new normalizer, 2 backend files unchanged-by-design, 2 YAML testbeds, 1 schema doc)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/encounterMap.ts` (`HullDef`, new `DetailEntry`) | model (type defs) | transform | same file, `VentPath`/`GridRoom.polygon+holes` (lines 255-280) | exact (extend in place) |
| `src/components/domain/encounter/hull/hullNormalizer.ts` **(new)** | utility (normalizer) | transform | `src/components/domain/encounter/doors/doorNormalizer.ts` | role-match (frontend validation-gate pattern) |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` (hull block, ~477-493) | component (SVG orchestration) | request-response (props → SVG) | same file's existing hull + vent rendering blocks | exact (extend in place) |
| `src/components/domain/encounter/renderer/RoomsLayer.tsx` (interior details mount) | component (SVG layer) | request-response | same file's polygon-room-with-holes block (lines 144-190) | exact (extend in place) |
| `src/components/domain/encounter/renderer/DetailsLayer.tsx` **(new, optional split)** | component (SVG layer) | request-response | `src/components/domain/encounter/renderer/RoomsLayer.tsx` (extraction precedent) | role-match |
| `core/data_loader.py` `load_deckplan()` (~670-715) | service (YAML loader) | file-I/O | same function — already thin passthrough, likely **no change needed** | exact |
| `core/payload_builder.py` (lines ~56-75, ~155-163) | service (payload assembly) | request-response | same file — deck dict spread (`{**deck, ...}`) already passes through unknown keys | exact |
| `data/ships/patrol_gunboat/deckplan.yaml` | config/data (YAML testbed) | file-I/O | `data/ships/somnus/deckplan.yaml` (canonical single-hull form to keep valid) | exact |
| `docs/schemas/schema-encounters.md` | config (schema doc) | transform | same file's "Top-level Fields" / "GridRoom Fields" tables | exact |

## Pattern Assignments

### `src/types/encounterMap.ts` (model)

**Analog:** same file — `HullDef`, `GridRoom.polygon`/`holes`, `VentPath` (lines 255-280)

**Existing shape to extend (D-01/D-03/D-04 — `polygon:`/`polygons:`/`holes:` on one `HullDef`)**:
```typescript
// lines 258-273 (current)
export interface GridRoom {
  id: string;
  name: string;
  rects?: GridRect[];
  circle?: { cx: number; cy: number; r: number };
  polygon?: [number, number][];
  holes?: [number, number][][];   // <-- D-04 precedent: holes already exist on rooms
  description?: string;
  type?: string;
  label_offset?: [number, number];
}

/** Ship hull outline — optional outer frame polygon for the deck */
export interface HullDef {
  polygon: [number, number][];  // <-- extend: add optional `polygons?` + `holes?`, normalize both to a list
}
```

**Polyline precedent to model `DetailEntry` polyline variant on (D-07)**:
```typescript
// lines 276-280 (current)
export interface VentPath {
  id: string;
  points: [number, number][];
  label?: string;
}
```

**`GridEncounterMapData` — where `hull?: HullDef` lives today (line 290)** — deck-level `hull?: HullDef` and `details?: DetailEntry[]` (D-06) should be added to the **deck** shape used inside `decks:` (currently deck dicts are loosely typed pass-through in `core/data_loader.py`/`payload_builder.py`; on the frontend, check `MultiDeckMapData`/`DeckInfo` near line 158-210 for where a `GridEncounterMapData`-like per-deck shape is consumed, since deck-level hull/details attach there, not to the top-level manifest hull).

---

### `src/components/domain/encounter/hull/hullNormalizer.ts` (new utility)

**Analog:** `src/components/domain/encounter/doors/doorNormalizer.ts` (lines 1-70)

This is the established "frontend owns shape validation, backend is thin passthrough" pattern (Established Pattern in CONTEXT.md). Follow the same file-header/contract style:

```typescript
// doorNormalizer.ts lines 1-19 — pattern to mirror for hullNormalizer
/**
 * doorNormalizer — convert authored YAML door shapes (B-rel / B-pos) into
 * the canonical `Door` model defined in `types/encounterMap.ts`.
 *
 * The normalizer is the *only* validation gate between authored map data
 * and the renderer. Every YAML mistake — human, AI-generated, or
 * tool-emitted — is caught here with a useful, attributable error.
 * ...
 * High-level contract:
 *
 *   normalizeDoor(authored, rooms, index) → Door
 *   normalizeDoors(authored[], rooms)     → Door[]
 *
 * Both throw `DoorNormalizationError` (with the authored input attached)
 * on any validation failure.
 */
```

For `hullNormalizer.ts`, model a `normalizeHull(authored: AuthoredHullDef): HullDef` that:
- Accepts either `polygon:` (single) or `polygons:` (list) — normalizes to `polygons: [][]` internally (D-01, D-03).
- Passes `holes:` through unchanged (list of polygons, not paired to an outer polygon — D-04).
- Reused identically for both the top-level (location) hull and any deck-level hull (D-03: "one `HullDef` type, one normalizer").
- Should NOT throw hard for detail `room:` dangling refs (that's separate, D-14 — see below); doors normalizer throwing `DoorNormalizationError` is the *validation-failure* pattern, but D-14 explicitly wants fail-safe (warn + render-nothing-for-players), which is closer to the `EncounterMapRenderer.tsx` doors fallback pattern (lines ~189-199, catch-and-drop-bad-entries) than to a hard throw.

**Fail-safe/drop-bad-entries precedent (D-14 — dangling `room:` ref)**:
```typescript
// EncounterMapRenderer.tsx lines ~189-199
try {
  return normalizeDoors(authored, mapData.rooms);
} catch (err) {
  // Defensive: a single bad authored entry should not blank the map.
  // Fall back to per-door normalization, dropping bad entries.
  const out: Door[] = [];
  for (let i = 0; i < authored.length; i++) {
    try {
      out.push(normalizeDoor(authored[i], mapData.rooms, i));
    } catch { /* drop + (add) console.warn here for D-14 */ }
  }
  return out;
}
```

---

### `src/components/domain/encounter/EncounterMapRenderer.tsx` — hull rendering (extend in place)

**Analog:** same file, lines 159-244 (effectiveHull memo + bbox) and 477-493 (hull SVG block)

**Current single-polygon hull resolution (extend to iterate a normalized list per D-01/D-02)**:
```typescript
// lines 159-160
// Hull override (manifest-level) takes precedence over per-deck hull
const effectiveHull = hullProp ?? mapData.hull;
```
D-02 changes this from "override" to **additive**: the top-level/manifest hull renders on every deck AND the current deck's own `hull` (if present) renders additional polygons on top. So this becomes something like `[effectiveTopHull, ...currentDeckHull]` merged into one normalized polygon list before the bbox/SVG steps below — not a single override.

**bbox computation to extend (currently one hull polygon list)**:
```typescript
// lines 213-222
const bb = view.bbox(mapData.rooms, effectiveHull, viewPadding);
```
Update `view.bbox` (in `renderer/geometry/mapView.ts`) and this call site to accept multiple hull polygons (top-level + deck) so the bbox covers detached pods/nacelles too.

**Hull SVG rendering block to extend for `polygons:`/`holes:` (D-01/D-04)**:
```typescript
// lines 236-244 — hullSvgPoints memo (currently single polygon)
const hullSvgPoints = useMemo(() => {
  if (!effectiveHull) return null;
  return effectiveHull.polygon
    .map(([x, y]) => { const p = view.project({ gx: x, gy: y }); return `${p.x},${p.y}`; })
    .join(' ');
}, [effectiveHull, view]);

// lines 473-493 — hull SVG block (fill + outline via <polygon>)
{hullSvgPoints && (
  <g className="encounter-map__hull">
    <polygon points={hullSvgPoints} fill={COLORS.hullFill} className="encounter-map__hull-fill" />
    <polygon points={hullSvgPoints} fill="none" stroke={COLORS.hullFill} strokeWidth={4}
      strokeLinejoin="miter" className="encounter-map__hull-outline" />
  </g>
)}
```
For multiple polygons + holes (evenodd), follow the **exact** technique already used for room holes in `RoomsLayer.tsx` (see below) — swap `<polygon>` for a single `<path fillRule="evenodd">` built from `M...Z` per polygon/hole, one path per hull, unioned across all hull polygons+holes in one `<path d="...">` (D-04's "Exact hull-hole rendering technique" left to implementer's discretion — this is the established codebase precedent to reuse).

---

### `src/components/domain/encounter/renderer/RoomsLayer.tsx` — hole rendering precedent (reuse technique for hull holes, D-04)

**Analog:** same file, lines 144-190 (freeform polygon room with holes)

```typescript
// lines 144-171 — exact evenodd + holes technique to mirror for hull holes
if (room.polygon && room.polygon.length > 0) {
  const toSvgPts = (verts: [number, number][]) =>
    verts.map(([x, y]) => { const sp = view.project({ gx: x, gy: y }); return `${sp.x},${sp.y}`; }).join(' ');

  const outerPts = toSvgPts(room.polygon);
  const hasHoles = room.holes && room.holes.length > 0;
  const holesPts = hasHoles ? room.holes!.map(toSvgPts) : [];
  const floorPath = hasHoles
    ? `M ${outerPts} Z ` + holesPts.map(hp => `M ${hp} Z`).join(' ')
    : null;

  // ...
  {hasHoles ? (
    <path d={floorPath!} fillRule="evenodd" fill={COLORS.bgRoom} className="encounter-map__floor" />
  ) : (
    <polygon points={outerPts} fill={COLORS.bgRoom} className="encounter-map__floor" />
  )}
  <polygon points={outerPts} fill="none" stroke={COLORS.hullFill} strokeWidth={WALL_THICKNESS}
    strokeLinejoin="miter" className="encounter-map__wall" />
  {holesPts.map((hp, i) => (
    <polygon key={`hole-wall-${i}`} points={hp} fill="none" stroke={COLORS.hullFill}
      strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" className="encounter-map__wall" />
  ))}
}
```
This is exactly the `evenodd` + `holesPts.map(...)` outline pattern to reuse for multi-polygon hulls with holes (D-04), scaled up to iterate N outer hull polygons (not just 1 outer + N holes).

---

### Interior detail linework — mount inside room reveal group (D-12, D-13)

**Analog:** same file, lines 43-64 (room group class + reveal state) and 156-171 (the `<g>` wrapper details should nest inside)

```typescript
// RoomsLayer.tsx lines 43-64
const renderRoom = (room: GridRoom) => {
  const visible = isRoomVisible(room.id);
  const animEntry = roomAnimState.get(room.id);
  const animState = animEntry?.anim;  // 'revealing' | 'hiding' | undefined
  if (!isGM && !visible && !animEntry) return null;
  const roomOpacity = isGM && !visible ? 0.25 : 1.0;
  const staggerDelay = animEntry ? animEntry.delayMs : 0;
  const svgOpacity = animEntry ? undefined : roomOpacity;

  const roomGroupClass = [
    'encounter-map__room-group',
    animState === 'revealing' ? 'room-revealing' : '',
    animState === 'hiding' ? 'room-hiding' : '',
    (isGM && !animState && !visible) ? 'room-gm-dim' : '',
  ].filter(Boolean).join(' ');
  // ...
```

```typescript
// lines 156-171 — the <g> that interior details (room: <id>) must render INSIDE
<g
  key={room.id}
  className={roomGroupClass}
  opacity={svgOpacity}
  style={animState ? { animationDelay: `${staggerDelay}ms` } : undefined}
>
  {/* floor/wall polygons here — add detail polylines/circles for this room here too,
      after walls, so they inherit roomGroupClass's CRT flicker cascade for free (D-12/D-13) */}
</g>
```
Per D-06, `details:` live at the **deck level**, not nested under `GridRoom` — so `RoomsLayer` (or a new `DetailsLayer`) needs to group `mapData.details` by `detail.room` and inject the matching entries into each room's `<g>` here, keyed by `room.id`. Exterior details (no `room:`) render in a separate always-visible group at the top level (see vent-group pattern below) rather than inside any room group.

---

### Detail polyline/circle rendering — reuse the vent "decorative polyline over the map" pattern (D-07, exterior details always-visible)

**Analog:** `EncounterMapRenderer.tsx` lines 509-545 (`mapData.vents` block) — closest existing precedent for a deck-level list of polyline/point-array entries projected via `view`/`unitSize` and rendered as SVG, independent of room membership.

```typescript
// lines 509-545 — pattern for exterior details (no room: ref, always visible)
{mapData.vents && mapData.vents.length > 0 && (isGM || ventsVisible) && (
  <g className="encounter-map__vents">
    {mapData.vents.map((vent) => {
      const pts = vent.points.map(([x, y]) => `${x * unitSize},${y * unitSize}`).join(' ');
      return (
        <g key={vent.id}>
          <polyline points={pts} fill="none" stroke={ventsVisible ? COLORS.vent : COLORS.ventHidden}
            strokeWidth={unitSize * 0.18} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={`${unitSize * 0.3} ${unitSize * 0.15}`} pointerEvents="none" />
        </g>
      );
    })}
  </g>
)}
```
For exterior detail entries (D-08: no `room:` = always visible), drop the `ventsVisible`/GM-only gating entirely (details are always-visible, not GM-toggle-gated like vents) and use `view.project()` (not raw `x * unitSize`) to stay consistent with the polygon-room projection helper already used elsewhere in this file (`toSvgPts` in `RoomsLayer.tsx`). Use a plain `<polyline>` (open) or `<polygon>` (closed, D-11 `filled: true`) for the polyline variant, and `<circle cx cy r>` (projected) for the circle variant. Fixed style (D-10): thin stroke ~1/4 of `WALL_THICKNESS` (currently `5`, so ~1.25px), dimmer teal — use a new `COLORS.detail` token in `mapColors.ts` (e.g. derived from `COLORS.teal`/`COLORS.borderSubtle`, dimmer than `COLORS.hullFill`'s outline stroke).

---

### `core/data_loader.py` `load_deckplan()` — likely no change needed

**Analog:** same function, lines 690-715

```python
# lines 690-715 — already a thin, generic passthrough
def load_deckplan(self, location_dir) -> Dict[str, Any]:
    deckplan_path = Path(location_dir) / 'deckplan.yaml'
    if not deckplan_path.exists():
        return {'decks': [], 'hull': None, 'total_decks': 0}
    with open(deckplan_path) as f:
        data = yaml.safe_load(f)
    decks = data.get('decks', [])
    decks_sorted = sorted(decks, key=lambda d: d.get('level', 0))
    hull = data.get('hull', None)
    return {'decks': decks_sorted, 'hull': hull, 'total_decks': len(decks_sorted)}
```
Deck dicts pass through `yaml.safe_load` unmodified — new `hull:`/`details:` keys on a deck dict flow through this function with zero code changes (confirms CONTEXT.md's "Backend is a thin passthrough" established pattern).

---

### `core/payload_builder.py` — deck dict spread already forwards new keys

**Analog:** same file, lines ~56-75 (`_load_ship_deck`) and ~155-163 (`get_encounter_payload`)

```python
# lines ~65-70 (representative — verify exact lines when implementing)
'ship_deck_data': {
    'is_multi_deck': True,
    'current_deck': normalize_deck_poi({**default_deck, 'deck_id': default_deck['id']}),
    'current_deck_id': default_deck['id'],
    'slug': 'deckplan',
},
```
`normalize_deck_poi()` (in `core/encounter_utils.py`, lines 7-47) receives the **full deck dict** via `{**default_deck, ...}` spread and returns a dict built by copying/mutating that same structure — it does NOT strip unknown keys. New `hull:`/`details:` keys on a deck dict will already flow through `normalize_deck_poi()` and into the payload without modification, UNLESS `normalize_deck_poi` is later found to construct a fresh dict with an explicit allow-list of keys (verify by reading the full function body, lines 7-90+, before assuming zero backend changes).

---

### `data/ships/patrol_gunboat/deckplan.yaml` — testbed to extend (D-05)

**Analog:** `data/ships/somnus/deckplan.yaml` (canonical single-hull form, MUST stay valid unchanged per D-01)

```yaml
# somnus/deckplan.yaml lines 3-8 — existing single-polygon top-level hull form
total_decks: 1
hull:
  polygon:
  - [2, 35]
  - [5, 32]
  - [5, 28]
  ...
```

```yaml
# patrol_gunboat/deckplan.yaml lines 3-45 — existing shape: top-level hull + decks: list w/ level, default, unit_size, rotation
total_decks: 1
hull:
  polygon:
  ...
decks:
- id: main_deck
  name: "Main Deck"
  level: 1
  default: true
  unit_size: 30
  rotation: 90
  rooms:
  - id: engineering
    name: ENGINEERING
    polygon:
    - [7.0, 10.0]
    ...
```
Extend `patrol_gunboat` to add: (1) a second deck with its own `hull: polygons: [...]` including a detached pod polygon (HULL-01/02, D-01/D-02/D-05), (2) a deck-level `details:` list (D-06) with at least one interior polyline (`room: <id>`), one exterior polyline (no `room:`), and one `circle` entry, exercising DET-01/03.

---

### `docs/schemas/schema-encounters.md` — update in same commit (schema-sync rule)

**Analog:** same file, "Top-level Fields" table (line ~61) and "Deck entry fields" table

```markdown
| Field | Type | Required | Note |
|---|---|---|---|
| `hull` | mapping | no | Hull outline: `polygon: [[x,y],...]` in grid cells |
| `decks` | list | yes | List of deck entries |
```
Update the `hull` row to document `polygons:` (plural, list-of-polygon-lists) and `holes:` alongside `polygon:` (D-01/D-04), and add a new row to "Deck entry fields" for deck-level `hull` (additive, D-02) and `details` (D-06-D-09) mirroring the existing style of the `doors`/`vents` deck-entry rows just below it.

---

## Shared Patterns

### Frontend validation-gate normalizer
**Source:** `src/components/domain/encounter/doors/doorNormalizer.ts`
**Apply to:** `hullNormalizer.ts` (new) — single normalizer for both top-level and deck-level `HullDef` (D-03); optionally a `detailNormalizer.ts` for `DetailEntry` gating/id handling.

### Fail-safe dropped-entry handling
**Source:** `EncounterMapRenderer.tsx` lines ~189-199 (doors try/catch fallback)
**Apply to:** dangling `room:` refs on detail entries (D-14) — catch, `console.warn`, omit for players, still render for GM.

### Color palette / wall thickness tokens
**Source:** `src/components/domain/encounter/renderer/mapColors.ts`
**Apply to:** new `COLORS.detail` (dimmer teal) token for fixed detail-linework style (D-10); reuse `WALL_THICKNESS` scaled to ~1/4 for detail stroke width.

### `evenodd` holes technique
**Source:** `src/components/domain/encounter/renderer/RoomsLayer.tsx` lines 144-171
**Apply to:** hull holes rendering (D-04) — `<path fillRule="evenodd">` built from `M...Z` segments per polygon.

### Backend thin passthrough
**Source:** `core/data_loader.py::load_deckplan()`, `core/payload_builder.py`
**Apply to:** confirms no backend schema/validation code needed for D-01/D-04/D-06-D-09 — frontend owns shape validation per the established pattern.

## No Analog Found

None — every file in scope has a strong existing analog in the codebase (hull/vent/room-hole rendering, door normalizer, thin backend passthrough all directly precedent this phase's additions).

## Metadata

**Analog search scope:** `src/types/encounterMap.ts`, `src/components/domain/encounter/**`, `core/data_loader.py`, `core/payload_builder.py`, `core/encounter_utils.py`, `data/ships/{somnus,patrol_gunboat}/deckplan.yaml`, `docs/schemas/schema-encounters.md`
**Files scanned:** 9
**Pattern extraction date:** 2026-07-27
