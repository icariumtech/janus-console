# Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `tools/svg_to_map.py` (the Inkscape-SVG-to-`deckplan.yaml` converter) to emit the
schema fields Phase 31 defined — per-deck hulls (multi-polygon + holes) and decorative
detail linework — plus a new circular-room primitive, so Inkscape-authored ships convert
directly into richer `deckplan.yaml` output without hand-editing.

**In scope:** per-deck `Hull` sublayer parsing (multi-polygon + holes); new `Details`
sublayer parsing (polyline + circle primitives, room association, closed/filled
detection); `<circle>`/`<ellipse>` detection in `Rooms`/`Corridors` layers for circular
rooms; schema-doc update in the same commit as any output-shape change (schema-sync rule).

**Out of scope (deferred, see below):** any renderer/frontend change (Phase 31 already
shipped this); any GUI/editor change (Phase 29/30 territory); new CLI flags beyond what's
needed to convert the new layers; multi-deck auto-detection logic itself (unchanged).

</domain>

<decisions>
## Implementation Decisions

### Per-deck hull layer
- **D-01:** A new **`"Hull"` sublayer nested inside each deck's `<g>`** (sibling to
  `Rooms`/`Corridors`/`Doors`/`Vents`) is parsed for that deck's own hull. The existing
  **root-level `"Hull"` layer is unchanged** and continues to mean the shared/location
  hull. This mirrors Phase 31's additive-merge design (D-02 in 31-CONTEXT.md): the
  converter's two-layer split (root Hull = shared, per-deck Hull = additive) is the
  authoring-side counterpart of the renderer's `mergeHulls(shared, deck)`.
  — **Reversibility:** reversible — this is a parsing convention in a CLI tool; changing
    the sublayer name/location later only affects new conversions, not existing
    `deckplan.yaml` output already on disk.
- **D-02:** The per-deck Hull layer collects **all `<path>` elements** in the layer (not
  just the first) into `polygons:`, and treats a compound path's non-outer subpaths as
  `holes:` — mirroring `_extract_areas`'s existing room-hole detection (largest subpath =
  outer, remaining subpaths in the same `<path>` = holes). This closes the gap the
  codebase scan found: current root-Hull code only reads `hull_paths[0]` and
  `hull_subpaths[0]`, silently dropping extra paths and all holes.
  — **Reversibility:** reversible.

### Details layer
- **D-03:** A new **`"Details"` sublayer per deck** (same nesting convention as Hull/Vents)
  is parsed for decorative linework. **Room association is geometric containment**: each
  detail's authored position is tested against every room's polygon; the containing room's
  id becomes `room:` on the emitted entry, and a detail outside every room polygon becomes
  exterior (no `room:` key). This reuses the same kind of point-in-polygon probing
  `_extract_doors_layer` already does via `_find_room_at` for door-to-room adjacency — no
  new authoring convention (sub-grouping, labeling) for the artist to learn.
  — **Reversibility:** reversible.
- **D-04:** For each detail path: a **closed subpath (ends in `Z`) maps to `closed: true`
  AND `filled: true`** by default — matching Phase 31's D-11 intent that closed shapes get
  a faint fill (e.g. solid machinery blocks). An open subpath maps to a plain polyline
  (`closed` omitted, stroke-only). A **literal `<circle>`/`<ellipse>` element** inside the
  `Details` layer becomes a `circle: {cx, cy, r}` entry — same element-type detection as
  D-05 below (shared circle-parsing code path).
  — **Reversibility:** reversible.

### Circular rooms (CIRC-01)
- **D-05:** `svg_to_map.py` gains detection for raw `<circle>` and `<ellipse>` SVG elements
  (not path-converted — Inkscape's Object→Path conversion emits Bezier/arc commands, which
  the existing `parse_path_d` already rejects with a warning) inside `Rooms`/`Corridors`
  layers, emitting a `circle: {cx, cy, r}` room entry. This is genuinely new code — the
  codebase scan confirmed zero existing circle/ellipse handling anywhere in the file.
- **D-06:** A **non-circular `<ellipse>` (rx ≠ ry) is rejected**, not approximated — warn to
  stderr naming the room/layer and skip it, matching the tool's existing pattern for
  malformed shapes (e.g. paths with curve commands, doors/vents with fewer than 2 vertices).
  Rationale (user's explicit choice, overriding Claude's recommendation to average rx/ry):
  `GridRoom.circle` in the renderer only supports a true single-radius circle: silently
  approximating an intentionally-drawn ellipse into a circle would produce a visibly wrong
  room shape with no error surfaced anywhere — better to force the artist to fix the shape
  in Inkscape.
  — **Reversibility:** reversible — the warn-and-skip choice can be loosened to
    warn-and-approximate later without affecting any already-converted output.

### Claude's Discretion
- Exact stderr warning message wording for the new rejection/skip cases (D-06, malformed
  Details shapes) — follow the existing per-item message style (see `parse_path_d`'s
  curve-command warning and `_extract_doors_layer`/`_extract_vents_layer`'s
  fewer-than-2-vertices warnings for the established phrasing pattern).
- Whether a detail's `id:` is auto-generated (`detail_1`, `detail_2`, ...) when the artist
  didn't set an `inkscape:label`, mirroring `_extract_vents_layer`'s `vent_{i+1}` fallback,
  or left unset entirely — Phase 31 D-09 already established `id:` is optional on
  `DetailEntry`, so either is valid; pick whichever keeps the emitted YAML closest to the
  existing vents convention.
- Whether the `# description: ""` / `# type: ""` commented-placeholder convention
  (currently applied to emitted rooms) is also worth applying to emitted hull/detail
  entries — cosmetic, not required by any success criterion.
- Tie-breaking / rounding details when a detail's geometric-containment test lands exactly
  on a room boundary (ambiguous containment) — pick a reasonable deterministic rule (e.g.
  containment test is inclusive of the boundary; ties broken by first-matching room in
  document order) and document it in the schema doc.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The file this phase modifies
- `tools/svg_to_map.py` — the whole converter. Key existing anchors (verified against the
  current file, not stale line numbers):
  - `get_layer_paths()` / `find_deck_groups()` (~426–459) — layer discovery by
    `inkscape:label`; per-deck grouping detection (triggers on `Rooms`/`Corridors`
    sublayers).
  - Root-level Hull parsing (~869–885) — `hull_paths[0]`/`hull_subpaths[0]` only, no holes;
    this is the code the per-deck Hull sublayer parsing (D-01/D-02) should be modeled on
    AND the code that needs extending to stop dropping extra paths/holes for consistency.
  - `_extract_areas()` (~506–564) — room/corridor `<path>` extraction; the existing
    holes-via-compound-path pattern to mirror for hull holes (D-02).
  - `_extract_doors_layer()` (~623–701) — includes `_find_room_at`-style room-adjacency
    probing; the pattern to mirror for detail-to-room geometric containment (D-03).
  - `_extract_vents_layer()` (~704–740) — closest existing template for a polyline-emitting
    decorative-layer converter; mirror its per-item id derivation, warn-and-skip pattern,
    and progress/summary print convention for the new Details converter.
  - `to_grid()` / `verts_to_grid()` / `_apply_translate()` / `_parse_translate()`
    (~279–423) — shape-agnostic coordinate/translate primitives, reusable as-is for hull
    and detail geometry.
  - `parse_path_d()` (~103–211) — path-data parser; already rejects curve/arc commands with
    a warning (relevant to why raw `<circle>`/`<ellipse>` element detection is needed
    rather than expecting Object→Path output for circles, D-05).
  - `_write_deckplan_yaml()` (~743–832) — hand-written flow-style YAML output (no
    `yaml.dump`); the per-deck `hull:`/`details:` emission must follow this file's existing
    inline-dict/flow-list formatting conventions, not introduce a different YAML style.
- `docs/schemas/schema-encounters.md` — hull `polygon`/`polygons`/`holes` and `details:`
  fields (added by Phase 31); update in the SAME commit as any converter output-shape
  change (schema-sync rule, CLAUDE.md).

### Phase 31 (defines the schema this phase emits)
- `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-CONTEXT.md` —
  D-01 (hull `polygon`/`polygons` both valid, add-alongside), D-02 (additive semantics —
  the reason D-01 above splits root-Hull vs per-deck-Hull rather than replacing one with
  the other), D-04 (holes not paired to a specific outer polygon), D-06 through D-09
  (`DetailEntry` shape: polyline OR circle, `room:` presence = interior gating, optional
  `id:`), D-14 (dangling `room:` ref fail-safe — not applicable to the converter itself
  since containment-derived `room:` refs can never dangle, but relevant if a future
  hand-edit breaks the association).
- `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-PATTERNS.md` —
  concrete `HullDef`/`DetailEntry`/`NormalizedHull` type shapes this converter's output
  must satisfy.

### Phase 30 (established svg_to_map.py conventions this phase must stay consistent with)
- `.planning/phases/30-ai-map-editing-element-resolver-targeted-edit-mcp-tools/30-CONTEXT.md`
  — D-05 (stable, human-readable element ids from `svg_to_map.py`; numeric-suffix
  collision handling) — any new `id:` this phase emits (details) should follow the same
  slug/uniqueness convention already established for rooms/corridors/doors.

### Schema sync
- `CLAUDE.md` "Schema Sync" table — the rule requiring `docs/schemas/schema-encounters.md`
  to update in the same commit as any `data/galaxy/**`/`data/ships/**` YAML shape change,
  which extends to the converter that produces that YAML.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_extract_vents_layer()` — direct template for the new Details polyline converter:
  per-item id derivation (label → `to_snake`, else auto-generate), warn-and-skip on
  malformed shapes, per-item + summary print lines, flow-style `points: [[x,y], ...]`
  output.
- `_find_room_at`-style adjacency probing (used inside `_extract_doors_layer`) — direct
  template for D-03's geometric-containment room association.
- `to_grid`/`verts_to_grid`/`_apply_translate`/`_parse_translate` — unit-agnostic,
  shape-agnostic coordinate primitives; no changes needed, just new call sites for hull
  and detail geometry.
- `_extract_areas()`'s hole-via-largest-subpath logic — direct template for hull holes
  (D-02).

### Established Patterns
- **Warn-and-skip, never hard-fail** on a malformed/unrecognized individual shape (curve
  commands, too-few vertices) — the two hard `sys.exit` cases are pre-conversion setup
  failures only (missing SVG file, missing `inkscape:grid`). New Details/circle handling
  must follow the same per-element warn-and-continue philosophy, which is why D-06 chose
  "reject and warn" over "silently approximate" for non-circular ellipses.
- **Hand-written flow-style YAML** (no `yaml.dump()` anywhere in the file) — output
  formatting is fully manual via f-strings to preserve a specific compact style (inline
  door dicts, unindented polygon lists). New hull/details output must match this by hand,
  not introduce a `yaml.dump()`-based code path.
- **Layer discovery is by literal `inkscape:label` string match**, not group depth/id —
  `"Hull"`, `"Rooms"`, `"Corridors"`, `"Doors"`, `"Vents"` are the exact current sublayer
  names; `"Details"` (D-03) and the per-deck `"Hull"` (D-01) reuse this exact-string-match
  convention rather than inventing a new lookup mechanism.
- **Per-layer-group `translate()` normalization** — every layer group can carry its own SVG
  transform, applied before grid conversion; this already works per-deck for
  Rooms/Corridors/Doors/Vents and will work identically for a per-deck Hull/Details
  sublayer without any change to the transform-handling code itself.

### Integration Points
- `find_deck_groups()` — unchanged; per-deck Hull/Details sublayers are discovered *within*
  an already-identified deck group, not part of the deck-detection heuristic itself.
- `_write_deckplan_yaml()` — needs new `hull:` (nested under each deck entry, in addition
  to the existing top-level `hull:`) and `details:` emission blocks, following the same
  `if vents:` / `if hull_poly:`-style conditional-emission pattern already used for vents
  and the root hull.

</code_context>

<specifics>
## Specific Ideas

- The GM's mental model (carried over from Phase 31's discussion): the root/top-level Hull
  layer is "the ship silhouette you always see," and per-deck Hull layers are "pods/nacelles
  that only exist on this deck" — the SVG authoring split (root vs per-deck sublayer)
  should read the same way to the artist in Inkscape as it does to the GM in the rendered
  map.
- Blueprint-grade aesthetic consistency: since Phase 31 fixed the detail-linework *render*
  style (no styling fields in YAML, D-10), the converter's job is purely geometry + gating
  metadata extraction — it never needs to emit or infer any visual style field.

</specifics>

<deferred>
## Deferred Ideas

- **New CLI flags for per-deck control** (e.g. selecting which deck's Hull/Details layer to
  convert, or disabling detail/hull detection independently) — not raised during discussion;
  the existing auto-detect-everything philosophy (no flag currently gates Rooms/Doors/Vents
  either) extends naturally to Hull/Details without a new flag.
- **Non-circular ellipse auto-approximation** — Claude's recommended option (average rx/ry
  into r with a warning) was considered and explicitly rejected in favor of strict
  rejection (D-06). Worth revisiting only if real-world SVG authoring shows artists
  frequently drawing near-circular (not exact) ellipses and getting frustrated by the
  rejection.
- **Editor-side (GM Console) changes** for authoring per-deck hulls/details visually —
  Phase 29/30 territory; this phase is converter-only, one-way SVG → YAML.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-svg-converter-details-per-deck-hulls-circular-rooms*
*Context gathered: 2026-08-07*
