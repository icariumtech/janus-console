# Phase 34: GM-Controlled Projection and Iso Rotation - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the encounter map's view — projection (top-down / isometric) and a 90°-step view
rotation — a **single GM-owned setting broadcast to all players**, and give the GM
rotate-left/right controls. The player terminal loses its Phase 33 toggle and renders
whatever the GM has selected, live. A deckplan can author its default view.

Out of scope: stacked/ghost decks and deck-switch animation (Phase 35); animating the
top-down ↔ iso toggle; any new height/extrusion rendering.

</domain>

<decisions>
## Implementation Decisions

### Ownership & broadcast
- **D-01:** **One shared, GM-owned view setting; the GM console map always mirrors what
  players see.** The GM's map controls *are* the broadcast controls — no private
  preview / "send to players" step. Follow the `encounter_vents_visible` pattern: state
  in `core/active_view_store.py`, a GM API endpoint in `core/views/encounter.py` (via
  `core/encounter_state.py`), delivered to clients on the existing active-view/SSE path.
  This **supersedes Phase 33 D-03's per-viewer independence and requirement ISO-02**
  (players toggling) — update REQUIREMENTS.md accordingly.
- **D-02:** GM controls live in the **map overlay**: the existing bottom-left
  projection button (Phase 33 D-03 slot) plus new ⟲ ⟳ rotate buttons beside it, same
  button styling as RESET VIEW. Not duplicated in the GM encounter side panel.
- **D-03:** **Player terminal shows no view controls at all** — no toggle, no
  read-only orientation badge. Players keep pan/zoom and RESET VIEW only.
- **D-04:** The **deckplan editor preview** (`DeckplanPreviewPane` → `MapPreview`) keeps
  a **private, local** projection toggle + rotate controls that never broadcast —
  authoring a map must not change what players see mid-session. `EncounterMapRenderer`
  therefore needs both modes: controlled (broadcast value + GM callbacks / read-only for
  players) and uncontrolled (local state, editor).

### Rotation
- **D-05:** Rotation applies in **both projections as one shared view angle**, stepping
  0/90/180/270. Toggling top-down ↔ iso preserves "which way is up." (Rotate buttons are
  visible in both projections.)
- **D-06:** Direction: **⟳ turns the ship clockwise on screen** (and ⟲
  counter-clockwise) — like turning a physical model on the table.
- **D-07:** GM rotation is an **offset added on top of the deck's authored YAML
  `rotation`** (Phase 25 `mapRotation`, per-deck). Offset 0 = exactly today's rendering
  in both projections. Under iso this composes with the existing iso base rotation (45°).
- **D-08:** Rotation change is presented as a **quick fade** (brief fade-out → snap to
  new angle → fade-in), not an animated spin. The **top-down ↔ iso toggle stays an
  instant cut** (unchanged from Phase 33).
- **D-09:** Rendering, hit-testing (`unproject` / `getGridCellViaView`), background grid,
  door/POI/token placement, and billboarded labels (Phase 33 D-05) must all be correct at
  every rotation in both projections.

### Defaults, reset & persistence
- **D-10:** **Deck switch within the same location keeps** projection + rotation offset
  (spatial consistency across decks; sets up Phase 35 stacking).
- **D-11:** **Loading a different location/map resets to that map's authored default
  view.** `deckplan.yaml` gains an optional location-level default view (projection +
  rotation offset); absent → top-down, offset 0. Schema change: update
  `docs/schemas/schema-encounters.md` in the same commit (CLAUDE.md Schema Sync), and
  the loader/typing in `core/data_loader.py` / `src/types/encounterMap.ts` as needed.
  — **Reversibility:** costly — published schema field consumed via `janus-skills`
  sync; removing/renaming later means a schema doc change + data migration.
- **D-12:** The broadcast view setting **persists** like other encounter state (survives
  server restart / client reload).

### Player-side transition
- **D-13:** On any GM view change (projection toggle or rotation), **pan/zoom resets to
  fit** (same as RESET VIEW) — on players **and** on the GM map (one rule everywhere).
- **D-14:** **No extra on-screen cue** (no JANUS text flash); the fade / cut is the cue.

### Claude's Discretion
- Exact YAML field name/shape for the authored default view (e.g. `default_view:
  { projection: iso, rotation: 90 }`) — keep it at deckplan/location level, not per-deck.
- Store shape for the broadcast value (single combined field vs. two fields) and the API
  endpoint shape.
- Fade duration (short — ~150–250ms each way) and whether it uses GSAP or CSS.
- How rotation is applied under top-down (projection parameter vs. composing with the
  existing post-projection SVG `rotate()`), provided D-07/D-09 hold.
- Rotate-button glyphs/labels within the existing overlay button style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions
- `.planning/phases/33-isometric-view/33-CONTEXT.md` — iso projection decisions (D-01 true iso, D-02 flat, D-03 toggle slot now superseded, D-05 billboarding, D-06 mapRotation composition)
- `.planning/REQUIREMENTS.md` — ISO-01..03 (ISO-02 superseded by D-01 here)

### Schema
- `docs/schemas/schema-encounters.md` — deckplan schema; add the default-view field (D-11). Note: the existing per-deck `rotation` field (used in `data/ships/somnus/deckplan.yaml`) is currently **undocumented** here — document it alongside.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isoProjection({ unitSize, tilt, rotation })` (`src/components/domain/encounter/geometry/gridProjection.ts`): already supports arbitrary rotation; currently called with `rotation: 45` in `EncounterMapRenderer.tsx` (~line 208).
- `makeMapView` / `MapView` (`geometry/mapView.ts`): single source of projected coordinates incl. `doorTransform`, `circleTransform`, `unproject` — rotation flows through automatically if applied at the projection.
- `usePanZoom` `resetView` — reuse for D-13.
- GSAP already in stack for the fade.

### Established Patterns
- GM-toggled broadcast encounter state: `encounter_vents_visible` → `core/active_view_store.py` defaults, `core/encounter_state.py` `set_vents_visible`, `core/views/encounter.py` `api_encounter_set_vents_visible`, consumed via `activeView` in `src/entries/SharedConsole.tsx`.
- Authored per-deck `rotation` (`GridEncounterMapData.rotation`, `src/types/encounterMap.ts:348`) applied as a post-projection SVG `rotate()` with viewBox W↔H swap for 90/270 (`EncounterMapRenderer.tsx`, `rotViewBox*`).

### Integration Points
- `EncounterMapRenderer.tsx`: currently owns `projectionMode` via local `useState` (~line 200) and renders the toggle (~line 848) — becomes controlled/uncontrolled per D-04.
- Callers: player `src/components/domain/encounter/EncounterView.tsx` (via `EncounterMapDisplay`), GM `src/components/gm/views/EncounterView.tsx` → `MapPreview`, editor `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` → `MapPreview`.

</code_context>

<specifics>
## Specific Ideas

- Motivating example: by default the ship's stern sits in the lower-left of the iso view; the GM wants to rotate so the **bridge** is in the lower-left.

</specifics>

<deferred>
## Deferred Ideas

- Stacked semi-transparent decks + animated deck transitions — already Phase 35.
- Animated top-down ↔ iso "tip back" transition — considered, rejected for this phase.
- Read-only orientation badge / JANUS "VIEW REORIENTED" flash for players — considered, rejected.

</deferred>

---

*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Context gathered: 2026-10-14*
