# Roadmap: Mothership GM Terminal

## Milestones

- ✅ **v1.0 MVP** — Phases 1–20 (shipped 2026-05-07)
- ✅ **v2.0 AI Tooling** — Phases 21–28 + 28.1 (shipped 2026-06-12)
- 🚧 **v3.0 Better Deckplans** — Phase 29, 31–35 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–20) — SHIPPED 2026-05-07</summary>

- [x] **Phase 1: Campaign Logs Tab** (2/2 plans) — completed 2026-02-12
- [x] **Phase 2: Ship Status Dashboard** (3/3 plans) — completed 2026-02-12
- [x] **Phase 3: Encounter Tokens** (4/4 plans) — completed 2026-02-21
- [x] **Phase 4: NPC Portrait System** (4/4 plans) — completed 2026-02-21
- [x] **Phase 5: Real-Time Push Architecture** (4/4 plans) — completed 2026-03-01
- [x] **Phase 6: UI Audio System** — DEFERRED
- [x] **Phase 7: Grid-Based Encounter Map Redesign** (4/4 plans) — completed 2026-03-16
- [x] **Phase 8: Rework GM Console UI** (4/4 plans) — completed 2026-03-16
- [x] **Phase 9: Integration + GM Bridge Polish** (2/2 plans) — completed 2026-03-20
- [x] **Phase 10: Player Ship Map View** (3/3 plans) — completed 2026-03-24
- [x] **Phase 11: Close Functional + Security Gaps** (1/1 plan) — completed 2026-03-24
- [x] **Phase 12: Requirements Tracking + Dead Code Cleanup** (1/1 plan) — completed 2026-04-17
- [x] **Phase 13: Atmospheric UI Animations** (5/5 plans) — completed 2026-03-28
- [x] **Phase 14: Rework Bridge STATUS Tab** (3/3 plans) — completed 2026-04-07
- [x] **Phase 15: Data Directory Audit + Bug Fixes** (1/1 plan) — completed 2026-04-18
- [x] **Phase 16: Ship Data Consolidation** (1/1 plan) — completed 2026-04-18
- [x] **Phase 17: Characters Per-Entity Files** (1/1 plan) — completed 2026-04-18
- [x] **Phase 18: Locations Flat Directory** (2/2 plans) — completed 2026-04-20
- [x] **Phase 19: DATA_DIRECTORY_GUIDE.md Rewrite** (1/1 plan) — completed 2026-05-06
- [x] **Phase 20: Audit Closure — Security + Requirements Tracking** (3/3 plans) — completed 2026-05-07

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0 AI Tooling (Phases 21–28 + 28.1) — SHIPPED 2026-06-12</summary>

- [x] **Phase 21: Encounter Geometry Deepening** (5/5 plans) — completed 2026-05-11
- [x] **Phase 22: Renderer Interaction Seams** (3/3 plans) — completed 2026-05-14
- [x] **Phase 23: Containerization — Docker + MCP server** (7/7 plans) — completed 2026-05-18
- [x] **Phase 24: JANUS Skills — Claude Code skill library** (7/7 plans) — completed 2026-05-22
- [x] **Phase 25: Map Rotation Controls** (5/5 plans) — completed 2026-05-24
- [x] **Phase 26: Map Polish — labels, hit targets, centering** (ad-hoc, commit `33e3e07`) — completed 2026-05-25
- [x] **Phase 27: MCP Image Upload** (3/3 plans) — completed 2026-05-27
- [x] **Phase 28: GM Console Data Directory File Editor** (3/3 plans) — completed 2026-06-01
- [x] **Phase 28.1: Close Gap D-10 + Phase 28 UAT + VERIFICATION ×3 (INSERTED)** (3/3 plans) — completed 2026-06-05

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

</details>

### 🚧 v3.0 Better Deckplans (Phase 31–35)

- [x] **Phase 29: Interactive deckplan map editor with live preview, YAML sync, and POI placement** — completed 2026-06-30
  - **Goal:** Give the GM a visual way to author deckplan maps — consolidate on `deckplan.yaml` as the sole format, then extend the GM Console file editor with a live map preview, deck selector, click-to-jump, and POI placement/move via surgical text edits.
  - **Depends on:** Phase 28
  - **Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
  - **Success Criteria** (what must be TRUE):
    1. Every location's deckplan loads from `deckplan.yaml` only — somnus migrated, legacy `map/manifest.yaml` + per-deck `map/*.yaml` loaders and fallback branches removed
    2. GM opens a `deckplan.yaml` in the file editor and sees a live rendered map preview below Monaco
    3. GM can switch which deck the preview renders via a deck selector
    4. GM clicks a room or POI on the preview and Monaco reveals + highlights the corresponding YAML line
    5. GM can drag a POI to move it or click an empty cell to add a POI stub, with both written back as surgical text patches (no reserialize)
  - **Plans:** 4 plans
    - [x] 29-01-PLAN.md — Consolidate on deckplan.yaml: migrate somnus, remove legacy loaders/fallbacks, schema doc + Django test (Wave 1)
    - [x] 29-02-PLAN.md — Pure YAML model + surgical edit builders (buildIdRangeMap/buildPositionEdit/buildAddPoiEdit) + vitest fixture/tests (Wave 2)
    - [x] 29-03-PLAN.md — Renderer POI editor props + DeckSelector + DeckplanPreviewPane mounted below Monaco (Wave 3)
    - [x] 29-04-PLAN.md — Wire click-to-jump, POI drag-to-move, click-to-add into Monaco + human-verify checkpoint (Wave 4)
  - Context: `.planning/phases/29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-/29-CONTEXT.md`

- [x] **Phase 30: AI map editing — element resolver + targeted edit MCP tools** (3/3 plans) — completed 2026-06-06 (executed out of order, ahead of Phase 29; ad-interim, not v3.0 scope)
  - **Goal:** Let the JANUS AI edit a single deckplan element (room/corridor/door) and add/remove POIs without reading or rewriting the whole `deckplan.yaml`. Adds a server-side element resolver (id / slugified label / glob / fuzzy), an atomic targeted-edit endpoint (`set` field-merge + `add_poi`/`remove_poi` list verbs) with `data-changed` SSE, two MCP tools (`find_map_element`, `edit_map_element`), and deterministic human-readable element ids from `svg_to_map.py`. Independent of Phase 29's GUI editor but provides a resolution layer it can reuse.
  - **Requirements**: E-01–E-07 (defined in 30-CONTEXT.md)
  - Plans:
    - [x] 30-01-PLAN.md — Backend: `_resolve_map_element` + `api_gm_data_map_edit` endpoint + tests (Wave 1)
    - [x] 30-02-PLAN.md — Stable element ids — already satisfied (slug+unique exists; doors use derived id) (Wave 1)
    - [x] 30-03-PLAN.md — MCP tools `find_map_element`/`edit_map_element` + schema docs (Wave 2)

- [x] **Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework**
  - **Goal:** Extend the `deckplan.yaml` schema and `EncounterMapRenderer` so decks can declare their own hull geometry and decorative detail linework, with interior details gated by room reveal.
  - **Depends on:** Phase 29 (deckplan.yaml is the sole format; editor preview benefits from but does not require this)
  - **Requirements**: HULL-01, HULL-02, DET-01, DET-03
  - **Success Criteria** (what must be TRUE):
    1. A deck in `deckplan.yaml` can declare its own hull polygon that overrides the location-level hull when present
    2. A deck hull can consist of multiple disjoint polygons (pods, nacelles, detached modules), and the renderer draws each correctly
    3. `deckplan.yaml` supports decorative detail linework attached to a room and to the deck exterior, and `EncounterMapRenderer` draws it
    4. Players viewing an unrevealed room do not see its interior detail linework; once revealed, the details appear
    5. Exterior/hull detail linework is always visible regardless of room reveal state
  - **Plans:** 3 plans
    - [x] 31-01-PLAN.md — Per-deck additive hulls: hullNormalizer + multi-polygon/holes rendering + patrol_gunboat two-deck testbed + hull schema doc (Wave 1)
    - [x] 31-02-PLAN.md — Detail linework: DetailEntry + detailNormalizer gating + DetailsLayer + interior details inside the room reveal group + details schema doc (Wave 2)
    - [x] 31-03-PLAN.md — Backend thin-passthrough regression guard + human visual verification of all five success criteria (Wave 3)
  - **Note:** success criterion 1's "overrides" is refined to **additive** semantics per 31-CONTEXT.md D-02 — a deck hull adds geometry to the shared silhouette and never replaces it.
  - **UI hint**: yes
  - Context: `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-CONTEXT.md`

- [x] **Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms** (completed 2026-08-25)
  - **Goal:** Extend `tools/svg_to_map.py` to emit the new Phase 31 schema fields and circular rooms, so Inkscape-authored decks convert directly into richer `deckplan.yaml` output.
  - **Depends on:** Phase 31 (emits the format Phase 31 defines)
  - **Requirements**: DET-02, HULL-03, CIRC-01
  - **Success Criteria** (what must be TRUE):
    1. Running `svg_to_map.py` on an SVG with a "Details" sublayer produces detail linework entries in the output `deckplan.yaml`, correctly associated with their room or the deck exterior
    2. Running `svg_to_map.py` on an SVG with per-deck "Hull" sublayers produces per-deck hull polygons (including multi-polygon hulls) in the output
    3. Running `svg_to_map.py` on an SVG containing `<circle>`/`<ellipse>` elements in a room layer produces `circle` room entries in the output, renderable by the existing renderer
    4. Converted output remains valid per `docs/schemas/schema-encounters.md`, updated in the same commit as the format change
  - **Plans:** 3 plans
    - [x] 32-01-PLAN.md — Circular rooms: get_layer_shapes generalization, literal/sodipodi-arc circle+ellipse detection in Rooms/Corridors, non-circular rejection (D-06), schema doc (Wave 1)
    - [x] 32-02-PLAN.md — Per-deck hulls: shared _extract_hull_layer/_write_hull_block, root-Hull multi-path/holes refactor, per-deck Hull sublayer, schema doc (Wave 2)
    - [x] 32-03-PLAN.md — Details layer: _extract_details_layer (closed/open, room association, circle details), details: emission, schema doc, phase-gate regression (Wave 3)
  - Context: `.planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-CONTEXT.md`

#### Phase 33: Isometric View

- **Status:** Complete (2026-09-07)
- **Goal:** Add an isometric projection alongside the existing top-down view, with a live toggle on both the player encounter view and the GM console map.
- **Depends on:** Phase 31 (details/hulls must project correctly in iso)
- **Requirements**: ISO-01, ISO-02, ISO-03
- **Success Criteria** (what must be TRUE):
  1. Any deckplan can render in an isometric projection via the existing `gridProjection`/`mapView` seam — rooms, doors, vents, POIs, tokens, and detail linework all appear correctly positioned
  2. Players can toggle the encounter view between top-down and isometric, with the change applying live (a cut, not an animated transition)
  3. The GM can independently toggle the GM console map between top-down and isometric, live
- **Plans:** 3/3 plans complete
  - [x] 33-01-PLAN.md — isoProjection + toggle wiring (tracer) + circle-room/detail ellipse fix via view.circleTransform() (Wave 1)
  - [x] 33-02-PLAN.md — Token/TokenLayer render migration + getGridCellViaView mouse-inversion fix across all 4 drag/drop call sites (Wave 2)
  - [x] 33-03-PLAN.md — Full regression + structural bypass audit + phase-closing human-check (Wave 3)
- **UI hint**: yes
- Context: `.planning/phases/33-isometric-view/33-CONTEXT.md`

#### Phase 34: GM-Controlled Projection and Iso Rotation

- **Status:** Not started
- **Goal:** Make the map view (top-down vs. isometric, and iso rotation) a GM-owned setting broadcast to players, and let the GM rotate the iso view in 90° steps.
- **Depends on:** Phase 33
- **Requirements**: TBD
- **Success Criteria** (what must be TRUE):
  1. The player terminal no longer has a projection toggle; it renders whatever projection the GM console has selected, updating live
  2. The GM can rotate the view left/right in 90° steps (offset on top of the deck's authored `rotation`, in both top-down and iso), e.g. bringing the bridge to the lower-left corner, and players follow
  3. At every rotation, rooms, doors, POIs, tokens, details and the background grid render correctly, and clicks/drags hit the correct grid cell
  4. A `deckplan.yaml` can author its default view (projection + rotation); loading a location applies it, and the broadcast view persists across reloads
- **Plans:** 0 plans
  - [ ] TBD (run /gsd-plan-phase 34 to break down)
- **UI hint**: yes

#### Phase 35: Stacked Deck View with Animated Transitions

- **Status:** Not started
- **Goal:** In iso view, show the location's other decks stacked above and below the selected deck as semi-transparent layers, and animate deck switches.
- **Depends on:** Phase 34
- **Requirements**: TBD
- **Success Criteria** (what must be TRUE):
  1. In iso view, decks above and below the active deck render stacked in vertical order, semi-transparent
  2. Selecting a different deck animates the stack: the current deck slides up/down and fades to semi-transparent while the new deck fades to opaque
  3. Only the active deck receives pointer interaction; top-down view shows the active deck only
- **Open questions (for discuss-phase):** cross-deck coordinate alignment (may need per-deck offset/elevation schema field), deck spacing, fog-of-war on ghost decks for players, mobile performance
- **Plans:** 0 plans
  - [ ] TBD (run /gsd-plan-phase 35 to break down)
- **UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–20 (see v1.0 archive) | v1.0 | 49/49 | ✓ Complete | 2026-05-07 |
| 21. Encounter Geometry Deepening | v2.0 | 5/5 | ✓ Complete | 2026-05-11 |
| 22. Renderer Interaction Seams | v2.0 | 3/3 | ✓ Complete | 2026-05-14 |
| 23. Containerization | v2.0 | 7/7 | ✓ Complete | 2026-05-18 |
| 24. JANUS Skills | v2.0 | 7/7 | ✓ Complete | 2026-05-22 |
| 25. Map Rotation Controls | v2.0 | 5/5 | ✓ Complete | 2026-05-24 |
| 26. Map Polish (ad-hoc) | v2.0 | — | ✓ Complete (ad-hoc) | 2026-05-25 |
| 27. MCP Image Upload | v2.0 | 3/3 | ✓ Complete | 2026-05-27 |
| 28. GM Console File Editor | v2.0 | 3/3 | ✓ Complete | 2026-06-01 |
| 28.1. Audit Gap Closure (INSERTED) | v2.0 | 3/3 | ✓ Complete | 2026-06-05 |
| 29. Deckplan Map Editor | v3.0 | 4/4 | ✓ Complete | 2026-06-30 |
| 30. AI Map Editing MCP Tools | (ad-interim) | 3/3 | Complete    | 2026-06-06 |
| 31. Deckplan Format — Hulls & Details | v3.0 | 3/3 | Complete    | 2026-08-04 |
| 32. SVG Converter — Details/Hulls/Circles | v3.0 | 3/3 | Complete    | 2026-08-25 |
| 33. Isometric View | v3.0 | 3/3 | Complete    | 2026-09-07 |
| 34. GM-Controlled Projection & Iso Rotation | v3.0 | 0/? | Not started | — |
| 35. Stacked Deck View | v3.0 | 0/? | Not started | — |
