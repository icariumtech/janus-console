# Phase 33: Isometric View - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an isometric projection to the existing 2D grid-based encounter map renderer
(`EncounterMapRenderer.tsx`, shared by the player `EncounterView` and the GM console's
`EncounterMapDisplay`), with a live top-down↔isometric toggle each viewer (player, GM)
controls independently. Built on the `Projection`/`MapView` seam
(`geometry/gridProjection.ts`, `geometry/mapView.ts`) that today only implements
`topDownProjection` — the seam was explicitly designed in Phase 31/prior work to accept
an `isoProjection({ unitSize, tilt, rotation })` swap without touching callers.

**In scope:** a new `isoProjection()` implementing the `Projection` interface; a
top-down/iso toggle UI control on both player and GM map views; ensuring rooms, doors,
vents, POIs, tokens, and detail linework all project correctly through the existing
`view` (`MapView`) facade in iso mode.

**Out of scope:** animated transition between projections (toggle is a cut — see
REQUIREMENTS.md "Out of Scope"); per-map projection lock in YAML (it's a live view
preference, not map data); any new fake-3D/extrusion rendering (this phase stays a flat
re-projection — see D-02 below).

</domain>

<decisions>
## Implementation Decisions

### Isometric projection math
- **D-01:** Use **true isometric** projection — 30° angle, equal foreshortening on all
  three axes (the architectural/blueprint-drafting convention), not the 26.57° "2:1"
  pixel-game dimetric convention. Rationale: the renderer is SVG (vector), so the 2:1
  convention's original purpose (crisp raster pixel alignment) doesn't apply here, and
  true isometric matches the "blueprint-grade" aesthetic language already established
  for Phase 31's hull/detail linework.
  — **Reversibility:** reversible — `isoProjection`'s tilt/rotation are just parameters;
    changing the angle later is a local change inside the projection function, not a
    contract change (the `Projection` interface itself doesn't encode a specific angle).
- **D-02:** **Flat re-projection only — no fake depth/height cues.** Walls, hulls, and
  detail linework render exactly as they do today, just through the new projection; no
  new wall-extrusion, shading, or height geometry. Matches Phase 31's D-10 philosophy
  (one fixed baked-in style, no new rendering pipeline) and keeps this phase scoped to
  the projection seam rather than a new rendering system.
  — **Reversibility:** reversible.

### Toggle UI
- **D-03:** The top-down/iso toggle lives in the **bottom-left slot of
  `EncounterMapRenderer`'s existing overlay grid** (`encounter-map__overlays`,
  `gridTemplateAreas` in `EncounterMapRenderer.tsx` ~line 712) — currently empty
  (top-left = RESET VIEW, top-right = LevelIndicator, bottom-right = LegendPanel). Reuses
  the same button styling as RESET VIEW. Because both `EncounterView` (player) and
  `EncounterMapDisplay` (GM) render through this same component, the toggle and its
  independent-per-viewer state come for free from each viewer's own render of the shared
  component — no new prop plumbing needed to satisfy ISO-02/ISO-03's "independently"
  requirement.
  — **Reversibility:** reversible.
- **D-04:** **Button only — no keyboard shortcut.** No existing encounter-map control
  (reset view, legend, deck selector) has a keyboard shortcut today; adding one for just
  this toggle would be inconsistent, and players are mobile-first (CLAUDE.md) where
  keyboard shortcuts don't apply anyway.
  — **Reversibility:** reversible.

### Token/label readability
- **D-05:** Room labels, door/POI icons, and token glyphs **stay upright and
  horizontal (billboarded)** when iso is active — only wall/hull/detail *linework*
  follows the iso transform. Text and icons render at their projected position but keep
  normal orientation, the same way isometric tactics games keep unit markers/labels
  legible regardless of camera angle.
  — **Reversibility:** reversible.
  — **Implementation note for planner/researcher:** `EncounterMapRenderer.tsx` currently
    computes token SVG position via direct `token.x * unitSize` / `token.y * unitSize`
    arithmetic in at least one place (~line 658), bypassing the `view` (`MapView`) facade
    that Interface Invariant 2 says should be the *only* producer of SVG coordinates. This
    call site (and any sibling ones, e.g. vent polyline points ~line 567) must be migrated
    to `view.project()` as part of this phase, or tokens/vents will not move correctly when
    `isoProjection` is active — this is a prerequisite for ISO-01, not an optional cleanup.

### Interaction with authored `mapRotation`
- **D-06:** The existing per-ship authored `mapRotation` (0/90/180/270, from Phase 25,
  applied as an SVG `rotate()` transform after projection) **still applies when iso is
  active**. It's authoring metadata about the ship's grid orientation and is orthogonal to
  which projection is in effect — the same reasoning that applies it in top-down applies
  in iso.
  — **Reversibility:** reversible.

### Claude's Discretion
- Exact `isoProjection` parameter shape/defaults (`tilt`, `rotation` values) beyond "30°
  true isometric" — the researcher/planner should pick concrete numbers that satisfy D-01.
- Whether `mapRotation`'s SVG `rotate()` transform composes cleanly with the iso-skewed
  coordinate space visually, or needs adjustment to still read correctly (D-06 locks the
  intent — "keep applying it" — not the exact composition mechanics).
- Whether other call sites beyond tokens/vents bypass `view` and need the same migration
  called out in D-05's implementation note — the researcher should audit for all direct
  `unitSize` multiplication in `EncounterMapRenderer.tsx` and layer files.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The projection seam (this phase's core extension point)
- `src/components/domain/encounter/geometry/gridProjection.ts` — the `Projection`
  interface and `topDownProjection()`; explicit code comment already sketches the
  `isoProjection({ unitSize, tilt, rotation })` shape this phase should implement.
- `src/components/domain/encounter/geometry/mapView.ts` — `MapView` facade
  (`makeMapView`); the `unitSize` field's doc comment already discusses iso's "projected
  horizontal cell extent" caveat — read before touching `unitSize`-derived sizing (e.g.
  `doorBounds`).
- `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — existing
  test shape/conventions for the projection module.

### The renderer (toggle placement + migration prerequisite)
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — overlay grid
  (`encounter-map__overlays`, ~line 700–762) for the D-03 toggle placement; projection
  instantiation (~line 188, `topDownProjection({ unitSize })` via `useMemo`) is the swap
  point; token position computation (~line 658) and vent polyline points (~line 567) are
  the `view`-bypass call sites flagged in D-05's implementation note.
- `src/components/domain/encounter/EncounterView.tsx` — player-facing caller of
  `EncounterMapRenderer`.
- `src/components/domain/encounter/EncounterMapDisplay.tsx` — GM-console caller of
  `EncounterMapRenderer` (routes multiple map formats; the grid/SVG path is what's
  relevant here).

### Phase 31 (established the seam and the "iso deferred to Phase 33" boundary)
- `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-CONTEXT.md` —
  D-10 (fixed renderer style, no per-element styling — precedent for D-02's "flat
  re-projection only"); explicitly lists "isometric projection (Phase 33)" as out of
  scope for Phase 31.

### Requirements
- `.planning/REQUIREMENTS.md` — ISO-01/02/03; "Out of Scope" section (no animated
  transitions, no per-map projection lock — both already locked, do not re-litigate).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Projection` / `MapView` interfaces — purpose-built seam for exactly this swap;
  `makeMapView(isoProjection({...}))` is the intended integration point per the code's
  own doc comments.
- `EncounterMapRenderer`'s overlay grid (`encounter-map__overlays`) — empty bottom-left
  slot ready for the new toggle button, styled to match `RESET VIEW`.
- Single shared renderer for both player and GM views — the "independently toggle"
  requirement (ISO-02/03) is satisfied by each caller holding its own local toggle state;
  no cross-viewer sync mechanism needs to be built.

### Established Patterns
- Interface Invariant 2 (documented in `mapView.ts`): `MapView` is the ONLY producer of
  SVG coordinates; the renderer never multiplies by `unitSize` directly. Currently
  violated at token/vent call sites (see D-05 note) — this phase must close that gap for
  those elements to project correctly.
- Fixed, baked-in visual style with no per-element styling fields (Phase 31 D-10) — this
  phase's D-02 follows the same philosophy for the projection itself.

### Integration Points
- `topDownProjection({ unitSize })` instantiation in `EncounterMapRenderer.tsx` (~line
  188) is where a projection-mode toggle state would switch between `topDownProjection`
  and the new `isoProjection`.
- `doorBounds`, `bbox`, and other `MapView` methods derive from `unitSize` /
  `projection.project` — these should continue working unchanged under iso since they're
  already routed through the seam correctly (only the token/vent bypasses need fixing).

</code_context>

<specifics>
## Specific Ideas

- Blueprint-grade aesthetic consistency (carried from Phase 31): true 30° isometric was
  chosen specifically to read as an architectural blueprint rendering, not a retro tactics
  game.
- The GM and players are expected to independently choose top-down vs. iso for their own
  screens at the same time — e.g. GM might stay top-down for easier token placement while
  players see iso, or vice versa.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-isometric-view*
*Context gathered: 2026-09-05*
