# Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms - Research

**Researched:** 2026-08-24
**Domain:** Python SVG parsing (stdlib `xml.etree.ElementTree`), Inkscape authoring conventions, hand-written YAML emission
**Confidence:** HIGH (codebase is fully read; two MEDIUM-confidence external-authoring risks flagged below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Per-deck hull layer**
- **D-01:** A new **`"Hull"` sublayer nested inside each deck's `<g>`** (sibling to
  `Rooms`/`Corridors`/`Doors`/`Vents`) is parsed for that deck's own hull. The existing
  **root-level `"Hull"` layer is unchanged** and continues to mean the shared/location
  hull. This mirrors Phase 31's additive-merge design (D-02 in 31-CONTEXT.md): the
  converter's two-layer split (root Hull = shared, per-deck Hull = additive) is the
  authoring-side counterpart of the renderer's `mergeHulls(shared, deck)`.
  — Reversibility: reversible.
- **D-02:** The per-deck Hull layer collects **all `<path>` elements** in the layer (not
  just the first) into `polygons:`, and treats a compound path's non-outer subpaths as
  `holes:` — mirroring `_extract_areas`'s existing room-hole detection. Closes the gap
  where root-Hull code only reads `hull_paths[0]` and `hull_subpaths[0]`, silently
  dropping extra paths and all holes. — Reversibility: reversible.

**Details layer**
- **D-03:** A new **`"Details"` sublayer per deck** (same nesting convention as Hull/Vents)
  is parsed for decorative linework. **Room association is geometric containment**: each
  detail's authored position is tested against every room's polygon; the containing room's
  id becomes `room:` on the emitted entry, and a detail outside every room polygon becomes
  exterior (no `room:` key). Reuses the same point-in-polygon probing `_extract_doors_layer`
  already does via `_find_room_at`. — Reversibility: reversible.
- **D-04:** For each detail path: a **closed subpath (ends in `Z`) maps to `closed: true`
  AND `filled: true`** by default. An open subpath maps to a plain polyline (`closed`
  omitted, stroke-only). A **literal `<circle>`/`<ellipse>` element** inside the `Details`
  layer becomes a `circle: {cx, cy, r}` entry — same element-type detection as D-05.
  — Reversibility: reversible.

**Circular rooms (CIRC-01)**
- **D-05:** `svg_to_map.py` gains detection for raw `<circle>` and `<ellipse>` SVG elements
  (not path-converted) inside `Rooms`/`Corridors` layers, emitting a `circle: {cx, cy, r}`
  room entry. Genuinely new code — zero existing circle/ellipse handling anywhere in the file.
- **D-06:** A **non-circular `<ellipse>` (rx ≠ ry) is rejected**, not approximated — warn to
  stderr naming the room/layer and skip it, matching the tool's existing pattern for
  malformed shapes. User's explicit choice, overriding Claude's recommendation to average
  rx/ry: `GridRoom.circle` in the renderer only supports a true single-radius circle.
  — Reversibility: reversible.

### Claude's Discretion
- Exact stderr warning message wording for the new rejection/skip cases (D-06, malformed
  Details shapes) — follow the existing per-item message style (`parse_path_d`'s curve-command
  warning, `_extract_doors_layer`/`_extract_vents_layer`'s fewer-than-2-vertices warnings).
- Whether a detail's `id:` is auto-generated (`detail_1`, `detail_2`, ...) when the artist
  didn't set an `inkscape:label`, mirroring `_extract_vents_layer`'s `vent_{i+1}` fallback,
  or left unset entirely — Phase 31 D-09 already established `id:` is optional on
  `DetailEntry`.
- Whether the `# description: ""` / `# type: ""` commented-placeholder convention
  (currently applied to emitted rooms only) is also worth applying to emitted hull/detail
  entries — cosmetic, not required by any success criterion.
- Tie-breaking / rounding details when a detail's geometric-containment test lands exactly
  on a room boundary (ambiguous containment) — pick a reasonable deterministic rule and
  document it in the schema doc.

### Deferred Ideas (OUT OF SCOPE)
- **New CLI flags for per-deck control** — not raised during discussion; the existing
  auto-detect-everything philosophy extends naturally to Hull/Details without a new flag.
- **Non-circular ellipse auto-approximation** — considered and explicitly rejected in favor
  of strict rejection (D-06). Worth revisiting only if real-world SVG authoring shows
  artists frequently drawing near-circular (not exact) ellipses and getting frustrated.
- **Editor-side (GM Console) changes** for authoring per-deck hulls/details visually —
  Phase 29/30 territory; this phase is converter-only, one-way SVG → YAML.
</user_constraints>

## Summary

This phase extends a single, dependency-free, ~1030-line Python script (`tools/svg_to_map.py`)
that already has every pattern this phase needs as a working template: `_extract_areas()` for
path+hole extraction, `_extract_vents_layer()` for polyline-emitting decorative layers,
`_find_room_at()`/`_point_in_polygon()` for point-in-polygon room association (these two helpers
**already exist as standalone functions**, contrary to the CONTEXT.md framing that a helper
"should be written from scratch" — they just need to be called from new code, not written), and
`get_layer_paths()`/`find_deck_groups()` for the `inkscape:label`-based layer-discovery
convention. All anchors in 32-CONTEXT.md were re-verified against the current file and are
accurate (line numbers below are exact, re-read 2026-08-24).

Three things go beyond what 32-CONTEXT.md's codebase scan surfaced, and materially affect how
the planner should scope tasks:

1. **`parse_path_d()` throws away closed/open information.** It returns cleaned vertex lists
   only — there is no signal left over for whether a subpath ended in `Z`/`z` or just ran out of
   tokens. D-04 ("closed subpath → `closed: true` + `filled: true`") cannot be implemented by
   inspecting `parse_path_d()`'s return value; the Details extractor needs its own closed-check
   against the raw `d` string (or `parse_path_d` needs a new return channel). This is a required
   design decision for the plan, not a detail to leave to the executor.

2. **Root-level Hull's `hull_poly` type is single-polygon throughout the call chain.** `convert()`
   passes `hull_poly: list[tuple[float,float]] | None` into `_write_deckplan_yaml()`, and the
   writer only emits a flat `polygon:` list (lines 759-762). D-02 requires the root-level Hull
   parsing to *also* stop dropping extra paths/holes "for consistency" with the new per-deck Hull
   parsing — meaning this phase is not additive-only, it requires **refactoring `hull_poly`'s
   shape** (to something like `{"polygons": [[...]], "holes": [[...]]}`) through `convert()` →
   `_write_deckplan_yaml()`'s signature, and writing a single shared hull-emission helper used by
   both the top-level `hull:` key and each deck's new `hull:` key. Plan this as one shared
   function, not two near-duplicate code paths.

3. **Inkscape's ellipse/circle tool does not, by default, emit `<circle>`/`<ellipse>` SVG
   elements.** [CITED: inkscape-ltlnx.readthedocs.io, wiki.inkscape.org] Inkscape stores
   hand-drawn ellipses as `<path sodipodi:type="arc" sodipodi:cx=.. sodipodi:cy=.. sodipodi:rx=..
   sodipodi:ry=..>` with an arc-based `d` attribute (containing `A` commands) — the *same*
   `sodipodi:type="arc"` path form regardless of Inkscape version through at least 1.x. A literal
   `<circle>`/`<ellipse>` SVG element is only produced by specific export/optimization paths
   (e.g., "Optimized SVG" output, or another tool). D-05/D-06 as scoped in 32-CONTEXT.md
   ("detection for raw `<circle>` and `<ellipse>` SVG elements") will silently detect **zero**
   circles on a freshly hand-drawn Inkscape file unless the plan also parses
   `sodipodi:type="arc"` paths (reading the `sodipodi:cx/cy/rx/ry` attributes, which Inkscape
   keeps authoritative over the arc `d` string). This is flagged as MEDIUM confidence (web search,
   not verified against a live Inkscape 1.x save) but is a high-impact gap: without it, CIRC-01's
   success criterion ("Running `svg_to_map.py` on an SVG containing `<circle>`/`<ellipse>`
   elements...") is satisfiable only by an artist manually hand-editing XML tags, defeating the
   phase's stated goal of "Inkscape-authored decks convert directly." See Open Questions.

**Primary recommendation:** Model all three new extractors (`_extract_hull_layer`,
`_extract_details_layer`, circle/ellipse detection) directly on the three existing templates
already in the file (`_extract_areas`'s hole-splitting, `_extract_vents_layer`'s per-item
id/warn/print scaffold, `_find_room_at`'s containment probe) — no new parsing library, no new
containment algorithm, and no `yaml.dump()`. Resolve finding #3 (sodipodi arc paths) explicitly
in the plan, and resolve finding #2 (hull type refactor) as a single shared emit-hull helper
before writing task breakdowns, since it affects both root and per-deck code paths.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SVG layer/shape parsing (Hull, Details, circle/ellipse) | CLI / build tooling (`tools/svg_to_map.py`) | — | Single-process, offline, stdlib-only converter; no server or client tier involved |
| Point-in-polygon detail→room association | CLI / build tooling | — | Pure geometry computed at conversion time, baked into `room:` key in output YAML — not runtime logic |
| `deckplan.yaml` schema documentation | Docs (`docs/schemas/schema-encounters.md`) | — | Schema-sync rule (CLAUDE.md) — must update in the same commit as any output-shape change |
| Rendering circle rooms / hull polygons / detail linework | Frontend (React/SVG renderer) | — | **Already shipped in Phase 31** — this phase produces YAML that the existing `RoomsLayer.tsx`/`EncounterMapRenderer.tsx` already consume unchanged (confirmed: `RoomsLayer.tsx:120-126` already renders `room.circle`) |
| Backend deckplan load/serve | Django (`core/data_loader.py`, `core/payload_builder.py`) | — | Confirmed thin passthrough in Phase 31 (31-PATTERNS.md) — no changes expected or in scope this phase |

## Standard Stack

### Core
This phase adds **zero new dependencies**. `tools/svg_to_map.py` uses only Python 3 stdlib:
`argparse`, `math`, `os`, `re`, `sys`, `xml.etree.ElementTree` [VERIFIED: tools/svg_to_map.py:81-86 — `import argparse`, `import math`, `import os`, `import re`, `import sys`, `import xml.etree.ElementTree as ET`]. No `lxml`, no third-party XML/SVG library. All new parsing code (Hull, Details, circle/ellipse) must use `xml.etree.ElementTree` (`ET`), matching the existing namespace-qualified tag convention (`f"{{{SVG}}}path"`, `f"{{{INK}}}label"`).

Python version available in this environment: 3.14.4 [VERIFIED: `python3 --version` output this session].

### Supporting
None — no YAML library is used for writing (`_write_deckplan_yaml` is 100% hand-written f-string
output, confirmed at tools/svg_to_map.py:743-832) and none should be introduced.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `xml.etree.ElementTree` | `lxml` | Would gain XPath and namespace ergonomics, but adds a dependency to a previously dependency-free script and diverges from every existing helper's namespace-tuple convention (`get_layer_paths`, `get_ink_label`) — not worth it for 3 new extractors that fit the existing pattern |
| Hand-written f-string YAML | `yaml.dump()` | Would break the file's established hand-formatted flow-style output (inline door dicts, unindented polygon lists) that Phase 31/earlier phases deliberately chose to preserve exact diff-friendly formatting — explicitly called out as an anti-pattern to avoid in 32-CONTEXT.md |

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase introduces no external packages. `tools/svg_to_map.py` remains
stdlib-only after this change (verified above). No `npm install` / `pip install` step is needed.

## Architecture Patterns

### System Architecture Diagram

```
Inkscape SVG file (.svg)
  │
  │  ET.parse(svg_path) → root element
  ▼
find_deck_groups(root)  ──► multi-deck? ──► per top-level <g> with Rooms/Corridors sublayer
  │                                              │
  │ (single-deck: root itself is "the deck")     │
  ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ per-deck extraction (existing + new, called once per deck elem) │
│                                                                   │
│  _extract_areas(deck_elem, unit)                                │
│    ├─ get_layer_paths(deck_elem, "Rooms")   → <path> per room   │
│    ├─ NEW: get_layer_shapes(deck_elem, "Rooms", "circle"/"ellipse")│
│    │        → circle/ellipse (or sodipodi:type=arc <path>) rooms │
│    └─ get_layer_paths(deck_elem, "Corridors") → <path> per corridor│
│                                                                   │
│  _extract_doors_layer(...) ─┐                                   │
│  _extract_vents_layer(...) ─┤ unchanged, run after rooms exist  │
│  NEW _extract_hull_layer(deck_elem, unit) ─┐                    │
│      (mirrors root Hull parsing, D-01/D-02: multi-path +holes)  │
│  NEW _extract_details_layer(deck_elem, unit, all_areas) ─┐      │
│      (mirrors _extract_vents_layer scaffold; each item probed   │
│       via _find_room_at(pt, all_areas) for room: association)   │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
decks_data: list[dict]  (adds "hull" and "details" keys per deck)
  │
  ▼
_write_deckplan_yaml(...)
  ├─ shared hull-emit helper (NEW, used for BOTH top-level `hull:` AND each
  │   deck's `hull:` — polygons:/holes: nested-list format)
  ├─ existing rooms/corridors/doors/vents blocks (unchanged)
  └─ NEW details: block (flow-style, mirrors vents: block)
  │
  ▼
deckplan.yaml  ──validated against──►  docs/schemas/schema-encounters.md
                                        (update in same commit — schema-sync rule)
```

### Recommended Project Structure
No new files — all changes land in the single existing `tools/svg_to_map.py`. New top-level
functions to add, grouped by section comment (matching the file's existing `# ── Section ──`
banner convention):

```
tools/svg_to_map.py
├── # ── SVG layer extraction ── (existing section, ~405-459)
│     └── NEW: get_layer_shapes(parent, layer_label, *tags) -> list[ET.Element]
│             (generalizes get_layer_paths to accept "circle"/"ellipse"/sodipodi-arc <path>)
├── # ── Processing helpers ── (existing section, ~495-...)
│     ├── NEW: _extract_hull_layer(parent, unit) -> dict | None
│     │         ({"polygons": [...], "holes": [...]}) — used for BOTH root Hull (refactored)
│     │         and per-deck Hull (new)
│     ├── NEW: _extract_circle_rooms(parent, unit, layer_label) -> list[dict]
│     │         (called from inside _extract_areas for "Rooms" and "Corridors")
│     └── NEW: _extract_details_layer(parent, unit, tx, ty, all_areas) -> list[dict]
│               (mirrors _extract_vents_layer; adds room: via _find_room_at)
└── _write_deckplan_yaml(...)  (existing, ~743-832) — extended, not replaced
      ├── NEW: shared hull-emit helper (polygon:/polygons:/holes: nested-list writer)
      └── NEW: details: emission block (mirrors vents: block, ~823-830)
```

### Pattern 1: Layer-scoped shape extraction (existing convention to extend)
**What:** Every SVG layer extractor takes a `parent` element (root or deck `<g>`) and looks up a
named sublayer by exact `inkscape:label` string match, returning the shape elements inside it.
**When to use:** For all three new extractors (Hull-per-deck, Details, circle/ellipse rooms).
**Example:**
```python
# Source: tools/svg_to_map.py:426-431 (existing, verified this session)
def get_layer_paths(parent: ET.Element, layer_label: str) -> list[ET.Element]:
    """Return all <path> elements from the named layer within parent."""
    for g in parent.iter(f"{{{SVG}}}g"):
        if g.get(f"{{{INK}}}label") == layer_label:
            return list(g.iter(f"{{{SVG}}}path"))
    return []
```
Generalize this (do not duplicate it) to also yield `<circle>`/`<ellipse>` for the Rooms/Corridors
circle-detection case:
```python
def get_layer_shapes(parent: ET.Element, layer_label: str, *tag_names: str) -> list[ET.Element]:
    """Return all elements matching any of tag_names from the named layer within parent."""
    for g in parent.iter(f"{{{SVG}}}g"):
        if g.get(f"{{{INK}}}label") == layer_label:
            out = []
            for tag in tag_names:
                out.extend(g.iter(f"{{{SVG}}}{tag}"))
            return out
    return []
```

### Pattern 2: Point-in-polygon room association (existing, directly reusable — not "write from scratch")
**What:** `_point_in_polygon` (ray-casting) and `_find_room_at` (smallest-containing-room
tie-break) already exist as standalone module-level functions and are called today from
`_extract_doors_layer` for door-to-room probing.
**When to use:** D-03's Details room association should call `_find_room_at` directly — no new
containment algorithm needed.
**Example:**
```python
# Source: tools/svg_to_map.py:228-259 (existing, verified this session — full text)
def _point_in_polygon(
    pt: tuple[float, float], poly: list[tuple[float, float]]
) -> bool:
    """Ray-casting point-in-polygon test."""
    x, y = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _find_room_at(
    pt: tuple[float, float],
    all_areas: dict[str, list[tuple[float, float]]],
) -> str | None:
    # Return the smallest containing room so inner rooms (room-within-room)
    # win over the outer room whose outer polygon also contains the probe point.
    best_rid = None
    best_area = float("inf")
    for rid, poly in all_areas.items():
        if _point_in_polygon(pt, poly):
            area = _polygon_area(poly)
            if area < best_area:
                best_area = area
                best_rid = rid
    return best_rid
```
**Tie-break note (for the "Claude's Discretion" boundary-ambiguity item in 32-CONTEXT.md):** the
existing convention is **smallest-area-wins**, not "first match in document order." Reuse this
convention as-is for Details room association rather than inventing a new tie-break rule — it's
already the established, working pattern for doors.

**What "authored position" means for a detail (needed to call `_find_room_at`):** the codebase
has no precedent for "a representative point for an arbitrary polyline." Recommend using the
first vertex of the polyline (`points[0]`) or the circle's `(cx, cy)` — this is a genuinely new
decision point 32-CONTEXT.md's Claude's Discretion section does not cover; centroid is also
defensible for closed shapes but inconsistent for open polylines. Document whichever is chosen in
the schema doc per D-06's tie-break documentation requirement.

### Pattern 3: Hole-via-largest-subpath (existing, template for Hull holes)
**What:** A compound `<path>` (multiple `M...Z` subpaths) has its largest-area subpath treated as
the outer boundary; all other subpaths in the *same path element* become holes.
**When to use:** Per-deck (and refactored root) Hull parsing, D-02.
**Example:**
```python
# Source: tools/svg_to_map.py:530-541 (existing, verified this session, room case)
outer_idx = max(range(len(subpaths)), key=lambda i: _polygon_area(subpaths[i]))
outer_sp = subpaths[outer_idx]
hole_sps = [sp for i, sp in enumerate(subpaths) if i != outer_idx]
poly = remove_collinear(verts_to_grid(_apply_translate(outer_sp, tx, ty), unit))
rid = _unique_id(base_id, seen_ids)
room: dict = {"id": rid, "name": display_name, "polygon": poly}
if hole_sps:
    room["holes"] = [
        remove_collinear(verts_to_grid(_apply_translate(sp, tx, ty), unit))
        for sp in hole_sps
    ]
```
For Hull, this per-path logic must run **once per `<path>` element in the layer** (not just the
first, per D-02), accumulating one outer polygon per path into `polygons:` and flattening *all*
holes from *all* paths in the layer into one combined `holes:` list — matching
schema-encounters.md's statement that hull holes are "not paired to any specific outer polygon."

### Pattern 4: Closed/open detection is NOT available from `parse_path_d()` — new logic required
**What:** `parse_path_d()` returns only cleaned vertex lists; it discards whether a subpath ended
via `Z`/`z` or simply ran out of path tokens (open polyline).
**When to use:** D-04 requires `closed: true` + `filled: true` only for subpaths that end in `Z`.
**Example — verified gap (read in full this session):**
```python
# Source: tools/svg_to_map.py:143-152 — the only place Z/z is handled
while i < len(tokens):
    t = tokens[i]
    if t in "MmLlHhVvZz":
        cmd = t
        i += 1
        if cmd in ("Z", "z"):
            _flush()                 # <-- same _flush() as every other subpath boundary
            cx, cy = start_x, start_y
        continue
    ...
# ... and the unconditional trailing flush for an open path:
    _flush()  # trailing subpath without closing Z   (line 197)
```
Both code paths call the same `_flush()` — there is no flag differentiating them in the returned
`subpaths` list. **Recommendation:** for the Details extractor (which processes one `<path>` per
detail item, not compound multi-subpath paths like Rooms), determine `closed` by checking the raw
`d` string directly: `d.rstrip().endswith(("Z", "z"))`. This sidesteps needing to touch
`parse_path_d()`'s signature/callers at all (avoids risk to every existing caller: rooms,
corridors, doors, vents, hull).

### Anti-Patterns to Avoid
- **Introducing `lxml` or any XML/YAML library:** the whole file is deliberately dependency-free
  stdlib + hand-written output; adding a dependency here is scope creep with no functional need.
- **Approximating non-circular ellipses:** D-06 is explicit and user-locked — warn and skip, do
  not average `rx`/`ry`.
- **Treating `parse_path_d()`'s subpath list as carrying closed/open information:** it does not
  (Pattern 4 above) — do not assume `subpaths[i]` tells you anything about `Z`.
- **Duplicating the root-Hull-only-single-polygon writer for per-deck Hull:** write one shared
  hull-emit helper (Summary finding #2) — a second near-copy invites format drift between root
  and per-deck output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Point-in-polygon containment | A new ray-casting or winding-number implementation | `_point_in_polygon()` / `_find_room_at()` (tools/svg_to_map.py:228-259, existing) | Already correct, already used by doors; a second implementation risks subtly different edge-case behavior (e.g. different boundary-inclusive rule) between doors and details |
| SVG path tokenizing/parsing | A regex or state-machine rewrite for circle/ellipse geometry | `to_grid()`/`verts_to_grid()`/`_apply_translate()` for the numeric conversion once `cx,cy,r` are pulled off the element's attributes directly (`elem.get("cx")` etc. — no path `d` parsing needed for true `<circle>`/`<ellipse>` elements at all) | Circles/ellipses are attribute-based, not path-based — do not route them through `parse_path_d()` |
| id/slug generation | A new snake-case or uniqueness scheme for detail/hull-piece ids | `to_snake()` + `_unique_id()` (existing, tools/svg_to_map.py:475-476, 497-503) | Already handles the exact fallback-id and collision-suffix convention this phase's discretion items ask for |

**Key insight:** this phase's entire job is "wire three new call sites into extraction/emission
functions that already exist as working templates in this file." The risk is not algorithmic
complexity — it's silently reinventing a slightly-different version of an existing helper (point-
in-polygon, id generation) or missing a real-world Inkscape output quirk (sodipodi arc paths,
Z-detection) that the existing file never had to handle before.

## Common Pitfalls

### Pitfall 1: Circle/ellipse detection misses real Inkscape output (sodipodi:type="arc")
**What goes wrong:** CIRC-01 is implemented to scan for literal `<circle>`/`<ellipse>` SVG tags
only; an artist draws a circle with Inkscape's ellipse tool and saves; the converter finds zero
circle rooms.
**Why it happens:** Inkscape's default SVG serialization for the ellipse/circle tool is
`<path sodipodi:type="arc" sodipodi:cx=".." sodipodi:cy=".." sodipodi:rx=".." sodipodi:ry=".."
d="M.. A.. Z"/>`, not a bare `<circle>`/`<ellipse>` element [CITED:
inkscape-ltlnx.readthedocs.io/en/latest/create/shapes/ellipses-and-arcs.html, MEDIUM confidence —
web search, not verified against a live Inkscape save this session].
**How to avoid:** Detect both forms: (1) literal `<circle>`/`<ellipse>` elements (read `cx`,`cy`,`r`
or `cx`,`cy`,`rx`,`ry` directly off the element), and (2) `<path>` elements carrying the
`{INK-adjacent "sodipodi"}` namespace attribute `sodipodi:type="arc"` (read `sodipodi:cx`,
`sodipodi:cy`, `sodipodi:rx`, `sodipodi:ry` off the path element instead of parsing `d`). This
needs a `SODIPODI` namespace constant (`http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd`)
alongside the existing `SVG`/`INK` constants.
**Warning signs:** A test SVG with a hand-drawn Inkscape ellipse produces zero circle rooms even
though the shape visibly exists in the file — check with `grep -o 'sodipodi:type="arc"' file.svg`.

### Pitfall 2: `hull_poly`'s type change breaks every existing call site silently
**What goes wrong:** `hull_poly: list[tuple[float,float]] | None` is threaded through `convert()`
→ `_write_deckplan_yaml(...)` as a positional parameter (tools/svg_to_map.py:748, 759-762,
952-953). Changing its shape to support `polygons:`/`holes:` without updating every reference
(the `if hull_poly:` truthiness check, the `for x, y in hull_poly:` iteration) produces a
`TypeError` or silently-wrong YAML rather than a clean error.
**Why it happens:** the parameter is untyped as a dataclass/TypedDict — it's a bare
`list[tuple]`, so the type checker (if any) won't catch a shape mismatch, and the truthiness
check `if hull_poly:` on an empty-list-vs-dict changes meaning.
**How to avoid:** introduce an explicit small structure (e.g. `HullData = TypedDict("HullData",
{"polygons": list[list[tuple[float,float]]], "holes": list[list[tuple[float,float]]]})` or a
plain dict with a documented shape) and update every call site in one task, verified by running
the tool against the existing `ship_template.svg`/`ship_template_multideck.svg` fixtures before
and after to confirm root-hull-only output (no per-deck Hull layers in those fixtures) is
byte-identical.
**Warning signs:** `_write_deckplan_yaml` raises on `for x, y in hull_poly:` (unpacking a dict) or
silently emits `hull:\n  polygon:\n` with garbage values.

### Pitfall 3: `parse_path_d()`'s closed/open information is lost by the time Details code sees it
**What goes wrong:** Implementer assumes `parse_path_d()` returning one subpath list vs. more
than one, or the last vertex looking "close" to the first, indicates the path was authored closed.
**Why it happens:** dedup logic (tools/svg_to_map.py:200-209) already strips a closing duplicate
vertex whether it came from an explicit `Z` or an artist accidentally clicking back near the start
point — visually and structurally indistinguishable after `parse_path_d()` runs.
**How to avoid:** Check the raw `d` attribute string directly (`d.rstrip().endswith(("Z","z"))`)
for the Details extractor, which processes one `<path>` per detail (not compound multi-hole
paths) — see Pattern 4 above.
**Warning signs:** All Details entries come out `closed: false` (or all `true`) regardless of how
they were actually drawn in Inkscape.

### Pitfall 4: Per-deck Hull/Details in single-deck mode has no `<g>` to nest inside
**What goes wrong:** Single-deck mode (`find_deck_groups(root)` returns `[]`) has no per-deck
`<g>` element — Rooms/Corridors/Doors/Vents/Hull/Details would all have to be direct children of
`root`, at the exact same nesting depth as the existing top-level `Hull` layer that already means
"the whole ship's hull." A second `"Hull"`-labeled layer at the same level is not distinguishable
by the existing exact-string-match layer lookup (`get_layer_paths` returns the *first* group
matching the label it finds via `g.iter()`, so a second same-named layer is invisible, not an
error).
**Why it happens:** D-01's "sibling to Rooms/Corridors/Doors/Vents, nested inside each deck's
`<g>`" framing implicitly assumes multi-deck mode, where the per-deck `<g>` already exists and is
a different element than root.
**How to avoid:** Scope per-deck Hull/Details extraction to multi-deck mode only (call the new
extractors with `deck_elem`, never with `root` as the "deck" in single-deck mode) — for
single-deck SVGs, the existing root-level `Hull` layer already is that single deck's hull; there
is no meaningful "per-deck Hull" distinct from it. Document this scoping decision explicitly
(it is not covered by 32-CONTEXT.md's Decisions and should be confirmed with the user or made an
explicit planner call, not left implicit).
**Warning signs:** A single-deck SVG with layers literally named `Hull` (root) and a second
group also literally named `Hull` produces confusing or silently-merged output.

## Code Examples

### Existing vents extractor — direct template for Details polyline items
```python
# Source: tools/svg_to_map.py:704-740 (existing, verified this session — full text)
def _extract_vents_layer(
    parent: ET.Element,
    unit: float,
    tx: float,
    ty: float,
) -> list[dict]:
    """Parse ventilation paths from a 'Vents' sublayer.

    Each path becomes one vent entry with an id and a list of grid-coord points.
    Open polylines and closed polygons are both accepted; the closing duplicate
    vertex is dropped. The path's inkscape:label becomes the optional label.
    """
    paths = get_layer_paths(parent, "Vents")
    if not paths:
        return []

    vents: list[dict] = []
    for i, path in enumerate(paths):
        label = get_ink_label(path) or ""
        vent_id = to_snake(label) if label else f"vent_{i + 1}"
        subpaths = parse_path_d(path.get("d", ""), label=f"vent {vent_id}")
        if not subpaths or len(subpaths[0]) < 2:
            print(
                f"  WARNING: vent path '{vent_id}' has <2 vertices — skipping.",
                file=sys.stderr,
            )
            continue
        grid_pts = verts_to_grid(_apply_translate(subpaths[0], tx, ty), unit)
        points = [[round(x * 4) / 4, round(y * 4) / 4] for x, y in grid_pts]
        vent: dict = {"id": vent_id, "points": points}
        if label:
            vent["label"] = label
        vents.append(vent)
        print(f"  Vent '{vent_id}': {len(points)} points")

    print(f"  Vents layer: {len(vents)} paths.")
    return vents
```
`_extract_details_layer` should follow this exact shape (id derivation, warn-and-skip, per-item
print, summary print) with two additions: a `closed`/`filled` check (Pattern 4) and a `room:`
lookup via `_find_room_at()` (Pattern 2) using `all_areas` — the same dict already built at each
call site as `{r["id"]: r["polygon"] for r in rooms + corridors}` (tools/svg_to_map.py:897, 924).

### Existing YAML vents emission — template for details: emission block
```python
# Source: tools/svg_to_map.py:823-830 (existing, verified this session — full text)
vents = d.get("vents", [])
if vents:
    f.write("  vents:\n")
    for vent in vents:
        pts = ", ".join(f"[{fv(x)}, {fv(y)}]" for x, y in vent["points"])
        label_str = f'\n    label: "{vent["label"]}"' if vent.get("label") else ""
        f.write(f"  - id: {vent['id']}{label_str}\n")
        f.write(f"    points: [{pts}]\n")
```
Mirror this for `details:` — flow-style `points: [[x,y], ...]` for polyline details, a single
inline `circle: {cx: .., cy: .., r: ..}` line for circle details, plus conditional `room:`,
`closed:`, `filled:` keys per schema-encounters.md's Detail Fields table.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Root-only Hull (single polygon, first path only, no holes) | Per-deck hulls, multi-polygon, holes (schema defined) | Phase 31 (schema), this phase (converter) | Converter must catch up to a schema the renderer already fully supports |
| No decorative linework in deckplan.yaml | `details:` deck-level list (polyline or circle, room-gated reveal) | Phase 31 (schema + renderer), this phase (converter) | Converter is the last unimplemented leg of the DET-01/02/03 requirement chain |
| Rooms limited to `rects`/`polygon` | `circle: {cx, cy, r}` room shape (renderer support already existed pre-Phase-31 per schema doc's existing GridRoom table) | Predates this milestone — renderer already supports it | This phase is purely "generate the YAML the renderer already reads" |

**Deprecated/outdated:** none within this phase's scope — no format is being removed, only
additively extended (per the schema-sync rule and Phase 31's additive-merge philosophy).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Inkscape's ellipse/circle tool defaults to `<path sodipodi:type="arc">` output rather than literal `<circle>`/`<ellipse>` elements, across Inkscape 1.x versions | Pitfall 1, Summary finding #3 | If wrong (i.e., this project's actual Inkscape/export workflow always yields literal `<circle>`/`<ellipse>`), the sodipodi-arc detection code is unnecessary extra surface — low cost if built defensively (try both, whichever matches wins), but worth a 2-minute manual check (export one ellipse from the project's actual Inkscape install and `grep` the saved SVG) before committing to build both code paths |
| A2 | A representative "authored position" for a Details polyline (for room-containment probing) should be the first vertex, not centroid | Pattern 2 | If wrong, details drawn as a long line straddling a room boundary could probe a point outside the intended room and get assigned `room:` incorrectly (or exterior when interior was intended) — low blast radius since it's warn-visible in the printed summary, not a silent data-integrity bug |

## Open Questions

1. **Does per-deck Hull/Details parsing apply to single-deck-mode SVGs at all?**
   - What we know: multi-deck mode has a per-deck `<g>` to nest a new `Hull`/`Details` sublayer
     inside, cleanly distinct from the existing top-level `Hull` layer. Single-deck mode has no
     such per-deck grouping element — Rooms/Corridors/Doors/Vents are already direct children of
     `root`.
   - What's unclear: whether the plan should explicitly document "per-deck Hull/Details only
     activate in multi-deck mode" or attempt some other convention for single-deck files.
   - Recommendation: scope to multi-deck mode only (Pitfall 4) and state this explicitly in the
     schema doc and script docstring update — do not leave it to implicit behavior.

2. **Does Inkscape's actual default ellipse output in this project's authoring environment match
   the web-search finding (`sodipodi:type="arc"`), or does the artist's workflow already produce
   literal `<circle>`/`<ellipse>` elements (e.g. via a specific export setting)?**
   - What we know: general Inkscape documentation and bug trackers describe `sodipodi:type="arc"`
     as the default/native storage format for the ellipse tool, persisting across versions.
   - What's unclear: no test SVG in this repo (`tools/ship_template.svg`,
     `tools/ship_template_multideck.svg`) currently contains a circle/ellipse/sodipodi-arc
     element to verify against directly — this claim is web-search-only (MEDIUM confidence).
   - Recommendation: the planner should include a task to draw a real ellipse in the project's
     actual Inkscape install, save, and inspect the XML — 5-minute check that resolves A1/A2
     definitively before or during implementation, cheaper than guessing wrong and finding out
     via a failed acceptance test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Running/testing `svg_to_map.py` | ✓ | 3.14.4 | — |
| Inkscape (for manual verification of real SVG output, Open Question 2) | Confirming sodipodi:type="arc" behavior | Not probed this session (GUI app, not CLI-detectable in this environment) | — | Manual check by a human with Inkscape installed; do not block the plan on this — build defensively for both circle-element and sodipodi-arc-path forms |
| pytest | Running any new tests | ✗ (not installed — `ModuleNotFoundError: No module named 'pytest'`) | — | Use stdlib `unittest` — see Validation Architecture below |

**Missing dependencies with no fallback:** none — pytest absence has a clean stdlib fallback.

**Missing dependencies with fallback:** pytest → `unittest` (already the pattern for
`core/tests/test_gm_api.py`, `core/tests/test_upload_image.py`, run via `python manage.py test
core`; a new `tools/`-scoped test file for a stdlib-only script is not a Django app and should
use plain `python -m unittest` rather than `manage.py test`, since `manage.py test` only
discovers tests inside `INSTALLED_APPS`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | stdlib `unittest` [VERIFIED: `python3 -c "import pytest"` fails this session — pytest not installed; existing `core/tests/*.py` use `django.test.TestCase`/`unittest.TestCase`, confirmed by reading `core/tests/test_gm_api.py:1-16`] |
| Config file | none — no `pytest.ini`/`pyproject.toml` test config found in repo root this session |
| Quick run command | `python -m unittest tools.test_svg_to_map -v` (new file, does not exist yet — Wave 0 gap) |
| Full suite command | `python -m unittest discover -s tools -p "test_*.py"` |

**Note:** `tools/svg_to_map.py` is a standalone CLI script, not a Django app — `python manage.py
test` will **not** discover a `tools/test_svg_to_map.py` file since Django's test runner only
walks `INSTALLED_APPS`. Use plain `python -m unittest` for this phase's tests, run independently
of the Django test suite.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-02 | Details sublayer → detail linework entries, room-associated or exterior | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.DetailsTests -v` | ❌ Wave 0 |
| HULL-03 | Per-deck Hull sublayer → per-deck hull polygons (incl. multi-polygon) | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.HullTests -v` | ❌ Wave 0 |
| CIRC-01 | `<circle>`/`<ellipse>` in Rooms/Corridors → `circle` room entries | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.CircleRoomTests -v` | ❌ Wave 0 |
| (schema doc) | Converted output valid per schema-encounters.md | manual/doc review | N/A — verify by reading updated doc alongside emitted YAML | ❌ Wave 0 (doc, not test) |

### Sampling Rate
- **Per task commit:** `python -m unittest tools.test_svg_to_map -v` (fast — no I/O beyond small
  fixture SVGs)
- **Per wave merge:** same command (full suite = quick run for a file this small) plus a manual
  `python tools/svg_to_map.py <fixture.svg> --out-dir /tmp/svgtest` smoke run to eyeball printed
  summary output
- **Phase gate:** full suite green before `/gsd-verify-work`; also re-run against
  `tools/ship_template.svg`/`tools/ship_template_multideck.svg` (existing fixtures, no
  Hull/Details/circle content) to confirm **zero output change** for pre-existing SVGs — a
  regression-safety check specific to the `hull_poly` type refactor (Pitfall 2)

### Wave 0 Gaps
- [ ] `tools/test_svg_to_map.py` — does not exist; needs creation (stdlib `unittest`, no Django
  dependency) covering: `parse_path_d` closed-detection helper (new), `_extract_hull_layer`
  (multi-polygon + holes), `_extract_details_layer` (room association + closed/exterior), circle/
  ellipse detection (both literal-element and sodipodi-arc forms per Open Question 2)
- [ ] A small fixture SVG (or several small inline SVG strings built in the test file) exercising:
  a multi-path Hull layer with one path having a hole, a Details layer with one open polyline, one
  closed polyline, and one circle, and a Rooms layer with a `<circle>` and a `<path
  sodipodi:type="arc">` — none of the existing `tools/*.svg` fixtures contain any of this content
  (verified via grep this session — zero matches for `sodipodi:type`, `<circle`, `<ellipse` in
  both existing template SVGs)
- [ ] Framework install: none — `unittest` is stdlib, no install step needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Local CLI tool, GM-run manually, no auth surface |
| V3 Session Management | no | N/A — no session |
| V4 Access Control | no | N/A — filesystem-local, GM's own machine |
| V5 Input Validation | yes | Already-established warn-and-skip pattern (malformed paths, curve commands, <2-vertex doors/vents) — extend identically to malformed Hull/Details/circle input rather than hard-failing |
| V6 Cryptography | no | N/A — no crypto in this tool |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| XML entity expansion / XXE via `ET.parse()` on an untrusted SVG | Denial of Service | Low real-world risk here — `xml.etree.ElementTree` does not resolve external entities by default (unlike `lxml` with certain flags), and this is a GM-run local tool operating on files the GM authored themselves, not attacker-supplied network input. No mitigation code needed this phase; note only if the tool's threat model ever expands to accept SVGs from untrusted third parties (e.g., a future upload feature — out of scope here, and the existing `upload_svg_map` MCP tool referenced in schema-encounters.md already exists as a separate code path not touched by this phase) |

## Sources

### Primary (HIGH confidence)
- `tools/svg_to_map.py` (full file read this session, 1027 lines) — every line-numbered anchor
  and code excerpt above verified against current content
- `docs/schemas/schema-encounters.md` (full file read this session) — Hull fields, Detail Fields,
  Deck entry fields tables quoted verbatim above
- `.planning/phases/31-deckplan-format-per-deck-hulls-detail-linework/31-PATTERNS.md` — confirms
  backend thin-passthrough (no changes needed in `core/data_loader.py`/`core/payload_builder.py`
  for this phase) and frontend renderer already consumes the target schema shape
- `src/components/domain/encounter/renderer/RoomsLayer.tsx:120-126` (grep-confirmed this session)
  — `room.circle` rendering already implemented, confirming CIRC-01's "renderer support already
  exists" claim in the phase description

### Secondary (MEDIUM confidence)
- [inkscape-ltlnx.readthedocs.io/en/latest/create/shapes/ellipses-and-arcs.html](https://inkscape-ltlnx.readthedocs.io/en/latest/create/shapes/ellipses-and-arcs.html) — `sodipodi:type="arc"` path-based storage for ellipse tool
- [wiki.inkscape.org/wiki/Inkscape-specific_XML_attributes](https://wiki.inkscape.org/wiki/Inkscape-specific_XML_attributes) — sodipodi namespace attribute reference
- [gitlab.com/inkscape/inkscape/-/issues/2879](https://gitlab.com/inkscape/inkscape/-/issues/2879) — bug report corroborating sodipodi:type="arc" as the default serialization, with edge cases where literal `<ellipse>` can appear instead

### Tertiary (LOW confidence)
None used as the basis for any claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, fully verified against the actual file
- Architecture: HIGH — every extractor/writer function read in full this session, all line
  numbers current as of 2026-08-24
- Pitfalls: HIGH for pitfalls 2-4 (all read directly from source); MEDIUM for pitfall 1 (web
  search only, not verified against a live Inkscape save in this environment)

**Research date:** 2026-08-24
**Valid until:** No expiry driver — `tools/svg_to_map.py` only changes when this project's own
phases touch it; re-verify line numbers if any other phase modifies this file before Phase 32
executes. The Inkscape-behavior claim (Pitfall 1/Open Question 2) should be manually confirmed
before implementation regardless of research age.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DET-02 | `svg_to_map.py` converts Inkscape "Details" sublayers into detail linework in the output YAML | Pattern 1 (layer discovery), Pattern 2 (room association via `_find_room_at`), Pattern 4 (closed/open detection gap — new logic required), Code Examples (vents-layer template), Pitfall 3 |
| HULL-03 | `svg_to_map.py` emits per-deck hulls from per-deck Hull sublayers | Pattern 1, Pattern 3 (hole-via-largest-subpath), Summary finding #2 (hull_poly type refactor spans root+per-deck), Pitfall 2, Pitfall 4 (single-deck-mode scoping question) |
| CIRC-01 | `svg_to_map.py` detects SVG `<circle>`/`<ellipse>` elements in room layers and emits `circle` rooms | Pattern 1 (`get_layer_shapes` generalization), Pitfall 1 (sodipodi:type="arc" real-world gap), Open Question 2, Don't Hand-Roll row 2 (no path parsing needed for true circle/ellipse elements) |
</phase_requirements>
