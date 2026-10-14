# Requirements: Mothership GM Terminal — v3.0 Better Deckplans

**Defined:** 2026-06-12
**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.

## v3.0 Requirements

### Deckplan Editor (EDIT)

- [ ] **EDIT-01**: All locations load from `deckplan.yaml` only — legacy `map/manifest.yaml` + per-deck `map/*.yaml` loaders removed, somnus migrated to `deckplan.yaml`
- [ ] **EDIT-02**: GM sees a live rendered map preview below Monaco when a `deckplan.yaml` is open in FileEditorView
- [ ] **EDIT-03**: GM can switch which deck the preview renders
- [ ] **EDIT-04**: GM can click a room or POI on the preview to jump to (reveal + highlight) its YAML line in Monaco
- [ ] **EDIT-05**: GM can drag a POI on the preview to move it — written as a surgical `position: {x, y}` text patch into the Monaco buffer
- [ ] **EDIT-06**: GM can click an empty cell on the preview to add a POI stub to the selected deck's `poi:` list

*Constraints (from 29-CONTEXT.md):* map-driven writes are surgical text edits, never a YAML reserialize (D-12); save reuses `PUT /api/gm/data/{path}` (D-15); preview lives inside FileEditorView, not a new GMViewType (D-07); map→YAML sync is one-way for v1 (D-09); POI rename/type/icon/delete stay text-only (D-13).

### Map Detail Linework (DET)

- [x] **DET-01**: `deckplan.yaml` supports decorative detail linework attached to rooms and to the deck exterior (hull greebles, consoles, beds, furniture)
- [x] **DET-02**: `svg_to_map.py` converts Inkscape "Details" sublayers into detail linework in the output YAML
- [x] **DET-03**: Players see a room's interior details only when that room is revealed; exterior/hull details are always visible

### Hull Geometry (HULL)

- [x] **HULL-01**: A deck can declare its own hull polygon, overriding the location-level hull
- [x] **HULL-02**: A deck hull can consist of multiple disjoint polygons (pods, nacelles, detached modules)
- [x] **HULL-03**: `svg_to_map.py` emits per-deck hulls from per-deck Hull sublayers

### Circular Rooms (CIRC)

- [x] **CIRC-01**: `svg_to_map.py` detects SVG `<circle>`/`<ellipse>` elements in room layers and emits `circle` rooms (renderer support already exists)

### Isometric View (ISO)

- [x] **ISO-01**: An isometric projection renders any deckplan via the existing `gridProjection`/`mapView` seam — rooms, doors, vents, POIs, tokens, and details all project correctly
- [x] **ISO-02**: Players can toggle the encounter view between top-down and isometric live — *superseded by ISO-04 (Phase 34 D-01)*
- [x] **ISO-03**: GM can toggle the GM console map between top-down and isometric live
- [ ] **ISO-04**: Projection is a single GM-owned setting broadcast to all players live; the GM map mirrors players; the player terminal has no view controls; the deckplan editor keeps a private, non-broadcast view
- [ ] **ISO-05**: GM can rotate the view in 90° steps in both projections as an offset on top of the deck's authored `rotation`; iso keeps true 30° angles at every step, including authored-rotation decks
- [ ] **ISO-06**: `deckplan.yaml` can author a location-level `default_view`; it applies on location change only, deck switches keep the view, and the broadcast view persists across reloads
- [ ] **ISO-07**: At every projection/rotation, all map elements render and hit-test correctly; rotation fades, projection cuts, pan/zoom resets to fit, and an in-progress drag is cancelled

## Future Requirements (deferred)

- Dedicated map-editor GMViewType with property/widget forms (Phase 29 "v2" idea)
- Bidirectional Monaco caret → map highlight sync
- Room/hull geometry reshaping (polygon vertex drag)
- POI rename/type/icon/delete via UI
- UI audio — AUDI-01..03 (deferred since v1.0)

## Out of Scope

- Token editing in the authoring tool — tokens are runtime encounter state, not map data
- Animated isometric transitions — toggle is a cut, not a tween (CRT aesthetic, avoid RAF competition)
- Per-map projection lock — projection is a live view preference, not YAML data

## Traceability

*(Filled by roadmap)*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| EDIT-01 | Phase 29 | Pending |
| EDIT-02 | Phase 29 | Pending |
| EDIT-03 | Phase 29 | Pending |
| EDIT-04 | Phase 29 | Pending |
| EDIT-05 | Phase 29 | Pending |
| EDIT-06 | Phase 29 | Pending |
| HULL-01 | Phase 31 | Complete |
| HULL-02 | Phase 31 | Complete |
| DET-01 | Phase 31 | Complete |
| DET-03 | Phase 31 | Complete |
| DET-02 | Phase 32 | Complete |
| HULL-03 | Phase 32 | Complete |
| CIRC-01 | Phase 32 | Complete |
| ISO-01 | Phase 33 | Complete |
| ISO-02 | Phase 33 | Superseded by ISO-04 |
| ISO-03 | Phase 33 | Complete |
| ISO-04 | Phase 34 | Pending |
| ISO-05 | Phase 34 | Pending |
| ISO-06 | Phase 34 | Pending |
| ISO-07 | Phase 34 | Pending |
