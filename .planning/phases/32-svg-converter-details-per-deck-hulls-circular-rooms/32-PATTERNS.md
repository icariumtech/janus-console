# Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 2 (1 code file with 3 new call sites + refactor, 1 doc file)
**Analogs found:** 2 / 2 (both analogs are within the same file being modified)

This phase is unusual: there are no "new files" in the typical multi-file sense. All
new code is added to a single existing 1030-line script, `tools/svg_to_map.py`, and the
tightest analogs for every new function are *other functions already in that same file*.
The doc file (`docs/schemas/schema-encounters.md`) is updated, not created, per the
schema-sync rule.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `tools/svg_to_map.py` — `get_layer_shapes()` (new, generalizes `get_layer_paths`) | utility | transform | `get_layer_paths()` (same file, lines 426-431) | exact |
| `tools/svg_to_map.py` — `_extract_hull_layer()` (new; also used to refactor root-Hull inline code at ~869-885) | service/transform | transform (SVG→dict) | `_extract_areas()`'s hole-via-largest-subpath logic (same file, lines 506-564) | exact |
| `tools/svg_to_map.py` — `_extract_details_layer()` (new) | service/transform | transform (SVG→list[dict]) | `_extract_vents_layer()` (same file, lines 704-740) | exact |
| `tools/svg_to_map.py` — circle/ellipse room detection (new, called from inside `_extract_areas`) | service/transform | transform (SVG→dict) | `_extract_doors_layer()`'s room-adjacency probe (same file, lines 623-701) for the containment call; `_extract_areas` itself as the call-site host | role-match |
| `tools/svg_to_map.py` — `_write_deckplan_yaml()` extension: shared hull-emit helper + `details:` emission block | utility (YAML writer) | transform (dict→text) | existing `vents:` emission block (same file, lines 823-830) and existing `hull:`/`polygon:` emission (lines 759-762) | exact |
| `tools/test_svg_to_map.py` (new file, Wave 0 gap) | test | unit/fixture | `core/tests/test_gm_api.py` / `core/tests/test_upload_image.py` (stdlib `unittest.TestCase` pattern, NOT Django's `manage.py test` since this is not an installed app) | role-match |
| `docs/schemas/schema-encounters.md` | config/docs | — | itself (existing Hull/Detail Fields tables from Phase 31, to be extended not replaced) | exact (self-analog, already Phase-31-shaped) |

## Pattern Assignments

### `get_layer_shapes()` (new utility, generalizes `get_layer_paths`)

**Analog:** `get_layer_paths()` — `tools/svg_to_map.py:426-431`

**Full existing pattern to generalize (do not duplicate — refactor `get_layer_paths` to call this, or make `get_layer_paths` a thin wrapper):**
```python
def get_layer_paths(parent: ET.Element, layer_label: str) -> list[ET.Element]:
    """Return all <path> elements from the named layer within parent."""
    for g in parent.iter(f"{{{SVG}}}g"):
        if g.get(f"{{{INK}}}label") == layer_label:
            return list(g.iter(f"{{{SVG}}}path"))
    return []
```
**New generalized form** (per RESEARCH.md Pattern 1, needed for CIRC-01's `<circle>`/`<ellipse>` detection inside Rooms/Corridors):
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

**Namespace constants to extend** — `tools/svg_to_map.py:90-91`:
```python
SVG = "http://www.w3.org/2000/svg"
INK = "http://www.inkscape.org/namespaces/inkscape"
```
Add a third constant for Pitfall 1 (sodipodi arc paths):
```python
SODIPODI = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"
```
`sodipodi:type`, `sodipodi:cx/cy/rx/ry` are then read via `elem.get(f"{{{SODIPODI}}}type")` etc. — same attribute-access convention as `f"{{{INK}}}label"`.

---

### `_extract_hull_layer()` (new; refactors root-Hull + adds per-deck Hull)

**Analog:** `_extract_areas()`'s hole-via-largest-subpath block — `tools/svg_to_map.py:506-541` (full function read: 506-564)

**Core pattern to mirror** (largest-subpath = outer, remaining subpaths = holes):
```python
subpaths = parse_path_d(path.get("d", ""), label=label)
if not subpaths:
    continue
# Outer polygon = largest area subpath (Inkscape may place inner holes first)
outer_idx = max(range(len(subpaths)), key=lambda i: _polygon_area(subpaths[i]))
outer_sp = subpaths[outer_idx]
hole_sps = [sp for i, sp in enumerate(subpaths) if i != outer_idx]
poly = remove_collinear(verts_to_grid(_apply_translate(outer_sp, tx, ty), unit))
room: dict = {"id": rid, "name": display_name, "polygon": poly}
if hole_sps:
    room["holes"] = [
        remove_collinear(verts_to_grid(_apply_translate(sp, tx, ty), unit))
        for sp in hole_sps
    ]
```
**D-02 extension:** run this per-`<path>`-element loop (not just `hull_paths[0]`), accumulating one outer polygon per path into `polygons:` and flattening ALL holes from ALL paths in the layer into one combined `holes:` list.

**Current root-Hull code being replaced/generalized** — `tools/svg_to_map.py:869-885` (verified this session, full text):
```python
# Hull
hull_poly: list[tuple[float, float]] | None = None
hull_paths = get_layer_paths(root, "Hull")
if hull_paths:
    hull_layer = next(
        (g for g in root if g.get(f"{{{INK}}}label") == "Hull"), None
    )
    htx, hty = _parse_translate(hull_layer) if hull_layer is not None else (0.0, 0.0)
    hull_subpaths = parse_path_d(hull_paths[0].get("d", ""), label="Hull")
    if hull_subpaths:
        hull_poly = remove_collinear(
            verts_to_grid(_apply_translate(hull_subpaths[0], htx, hty), unit)
        )
    if hull_poly:
        print(f"Hull: {len(hull_poly)} vertices")
else:
    print("Hull: (none)")
```
This is the exact code that reads only `hull_paths[0]`/`hull_subpaths[0]` (the gap D-02 closes). Per RESEARCH.md Summary finding #2, write ONE shared `_extract_hull_layer(parent, unit) -> dict | None` returning `{"polygons": [...], "holes": [...]}`, call it for BOTH `root` (top-level `hull:`) and each `deck_elem` (per-deck `hull:`), and thread the new dict type through `convert()` → `_write_deckplan_yaml()` in place of the current bare `list[tuple] | None` signature (Pitfall 2 — update every call site in one task, verify byte-identical output on `ship_template.svg`/`ship_template_multideck.svg` since neither fixture has extra Hull paths or holes today).

---

### `_extract_details_layer()` (new)

**Analog:** `_extract_vents_layer()` — `tools/svg_to_map.py:704-740` (full text, verified this session)
```python
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
**Follow this exact shape** for `_extract_details_layer(parent, unit, tx, ty, all_areas)`: id derivation (`to_snake(label)` else `f"detail_{i+1}"`, matching the `vent_{i+1}` fallback — Claude's Discretion item resolved this way per RESEARCH.md), warn-and-skip on malformed shapes, per-item print, summary print. Two additions beyond the vents template:
1. **Closed/filled detection (D-04)** — do NOT trust `parse_path_d()`'s subpath list for this (it discards `Z`/no-`Z` information, RESEARCH.md Pattern 4). Check the raw `d` string directly:
   ```python
   closed = path.get("d", "").rstrip().endswith(("Z", "z"))
   ```
   If `closed`, set `detail["closed"] = True` and `detail["filled"] = True`. Otherwise omit both keys.
2. **Room association via containment (D-03)** — reuse `_find_room_at` exactly as `_extract_doors_layer` does (see next section), probing the detail's first vertex (`points[0]`) as its "authored position" per RESEARCH.md Pattern 2 (A2 assumption — first vertex, not centroid, for consistency with straightforward polylines; document this choice in schema-encounters.md).
3. **Circle details** — a literal `<circle>`/`<ellipse>` element inside `Details` becomes `{"circle": {"cx": ..., "cy": ..., "r": ...}}` instead of `points:` — shares circle-parsing code with the Rooms/Corridors circle detection (D-05), attribute-based (`elem.get("cx")` etc.), no `parse_path_d()` involved (Don't Hand-Roll table row 2).

---

### Circle/ellipse room detection (CIRC-01, called from `_extract_areas`)

**Analog for room-association pattern (containment probe):** `_extract_doors_layer()` — `tools/svg_to_map.py:623-701` (full text, verified this session). Relevant excerpt (room-adjacency probing via `_find_room_at`):
```python
room_a = _find_room_at(probe_a, all_areas)
room_b = _find_room_at(probe_b, all_areas)
```

**`_find_room_at`/`_point_in_polygon`** already exist as standalone module functions (confirmed by RESEARCH.md, not re-read here since research quoted them in full at lines 228-259) — call directly, do not reimplement.

**New circle/ellipse detection itself has no existing in-file analog** (RESEARCH.md: "zero existing circle/ellipse handling anywhere in the file" — this is genuinely new code, not a refactor of anything). Build it as a new helper called from inside `_extract_areas()` for both the `"Rooms"` and `"Corridors"` layer labels, using `get_layer_shapes(parent, layer_label, "circle", "ellipse")` plus a second pass detecting `<path>` elements with `elem.get(f"{{{SODIPODI}}}type") == "arc"` (Pitfall 1 — Inkscape's actual default ellipse serialization). For literal elements read `cx`, `cy`, `r` (circle) or `cx`, `cy`, `rx`, `ry` (ellipse, reject if `rx != ry` per D-06) directly off attributes — no `d`-string parsing. For `sodipodi:type="arc"` paths, read `sodipodi:cx/cy/rx/ry` off the path element the same way.

**Warn-and-skip message style to match** (from `_extract_doors_layer`, lines 644-648, and `_extract_vents_layer`, lines 489-492):
```python
print(
    f"  WARNING: door path {path.get('id', '?')} has <2 vertices — skipping.",
    file=sys.stderr,
)
```
and `parse_path_d`'s curve-command warning (`tools/svg_to_map.py:118-125`):
```python
print(
    f"WARNING: SVG path{ctx} contains unsupported curve command "
    f"'{curve_match.group()}' — skipping. "
    "Re-export with straight segments only (Path > Object to Path, "
    "then Extensions > Generate from Path > ... or Inkscape 'Flatten Beziers').",
    file=sys.stderr,
)
```
D-06's non-circular-ellipse rejection should follow this exact two-space-indent, `WARNING:`-prefixed, "-- skipping" phrasing, naming the room/layer.

---

### `_write_deckplan_yaml()` extension — hull-emit helper + `details:` block

**Analog 1 (existing hull emission, to be replaced by the shared helper):** `tools/svg_to_map.py:759-762`
```python
if hull_poly:
    f.write("hull:\n  polygon:\n")
    for x, y in hull_poly:
        f.write(f"  - [{fv(x)}, {fv(y)}]\n")
```
**Analog 2 (existing holes emission inside rooms loop — nested-list flow style to mirror for hull `holes:`):** `tools/svg_to_map.py:786-793`
```python
if room.get("holes"):
    f.write("    holes:\n")
    for hole in room["holes"]:
        for j, (x, y) in enumerate(hole):
            if j == 0:
                f.write(f"    - - [{fv(x)}, {fv(y)}]\n")
            else:
                f.write(f"      - [{fv(x)}, {fv(y)}]\n")
```
**Analog 3 (existing vents emission — direct template for `details:` block):** `tools/svg_to_map.py:823-830`
```python
vents = d.get("vents", [])
if vents:
    f.write("  vents:\n")
    for vent in vents:
        pts = ", ".join(f"[{fv(x)}, {fv(y)}]" for x, y in vent["points"])
        label_str = f'\n    label: "{vent["label"]}"' if vent.get("label") else ""
        f.write(f"  - id: {vent['id']}{label_str}\n")
        f.write(f"    points: [{pts}]\n")
```
**Required new code:**
1. A **single shared hull-emit helper** function (e.g. `_write_hull_block(f, hull_data, indent)`) called once for the top-level `hull:` and once per deck for the deck's `hull:`, using `polygons:`/`holes:` nested-list format (mirroring Analog 2's flow style) — NOT two near-duplicate inline blocks (RESEARCH.md Anti-Pattern, Summary finding #2).
2. A `details:` emission block modeled on Analog 3, adding conditional `room:`, `closed:`, `filled:` keys, and either `points: [[x,y], ...]` (polyline) or an inline `circle: {cx: .., cy: .., r: ..}` (circle detail) per detail item.
3. **fv()** (line ~758, `def fv(v: float) -> str`) is the existing number formatter used everywhere in this writer — reuse as-is for all new coordinate output, do not reformat numbers a new way.

---

### `parse_path_d()` — read-only reference, no signature change

**Full function** — `tools/svg_to_map.py:103-211` (read in full this session). Key facts for the new code to respect:
- Rejects curve/arc commands (`CcSsQqTtAa`) with a stderr warning and returns `[]` — this is WHY raw `<circle>`/`<ellipse>` element detection (D-05) is needed rather than expecting Inkscape's Object→Path output for circles.
- Returns only cleaned vertex lists — no closed/open flag survives (Pitfall 3). Do NOT extend this function's return signature for D-04's closed-detection; check the raw `d` string directly in the new Details extractor instead (keeps every existing caller — rooms, corridors, doors, vents, hull — unaffected).

---

### `tools/test_svg_to_map.py` (new test file, Wave 0 gap)

**Analog:** `core/tests/test_gm_api.py` / `core/tests/test_upload_image.py` — stdlib `unittest.TestCase` style (NOT `django.test.TestCase`, since `tools/` is not a Django app and `manage.py test` will not discover it). Read pattern: import target module, build small inline SVG fixture strings (or a tiny fixture `.svg` file), call the extractor functions directly, assert on the returned dict/list shape.

**Run command:** `python -m unittest tools.test_svg_to_map -v` (per RESEARCH.md Validation Architecture — NOT `python manage.py test`).

**Required coverage per RESEARCH.md Wave 0 Gaps:**
- `parse_path_d` closed-detection (new raw-`d`-string check, not a `parse_path_d` change)
- `_extract_hull_layer` — multi-polygon + holes
- `_extract_details_layer` — room association + closed/exterior + circle details
- Circle/ellipse detection — both literal-element and `sodipodi:type="arc"` forms
- Fixture: a multi-path Hull layer with one hole, a Details layer with one open + one closed polyline + one circle, a Rooms layer with a `<circle>` and a `sodipodi:type="arc"` `<path>` (none of `tools/ship_template.svg` / `tools/ship_template_multideck.svg` currently contain any of this — verified via grep, zero matches for `sodipodi:type`, `<circle`, `<ellipse`).

---

## Shared Patterns

### Layer discovery by exact `inkscape:label` string match
**Source:** `get_layer_paths()`, `tools/svg_to_map.py:426-431`
**Apply to:** All three new extractors (`"Hull"` per-deck, `"Details"`, and the Rooms/Corridors circle scan). No new lookup mechanism — same `g.get(f"{{{INK}}}label") == layer_label` convention, generalized via `get_layer_shapes()` above.

### Per-layer-group `translate()` normalization
**Source:** `_parse_translate()` / `_apply_translate()`, `tools/svg_to_map.py:99-110`
```python
def _parse_translate(elem: ET.Element) -> tuple[float, float]:
    m = _TRANSLATE_RE.search(elem.get("transform", ""))
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)

def _apply_translate(
    verts: list[tuple[float, float]], tx: float, ty: float
) -> list[tuple[float, float]]:
    if tx == 0.0 and ty == 0.0:
        return verts
    return [(x + tx, y + ty) for x, y in verts]
```
**Apply to:** Every new geometry extractor (hull, details, circle rooms) — call `_parse_translate(deck_elem)` once per deck and pass `tx, ty` through, exactly as `_extract_areas`/`_extract_doors_layer`/`_extract_vents_layer` already do. No changes needed to these two functions themselves.

### Warn-and-skip, never hard-fail on a malformed individual shape
**Source:** `_extract_doors_layer` (lines 644-648), `_extract_vents_layer` (lines 489-492), `parse_path_d`'s curve-command warning (lines 118-125)
**Apply to:** D-06's non-circular-ellipse rejection, malformed Details shapes, any other new per-element validation. The two existing `sys.exit()` hard failures in the file are pre-conversion setup errors only (missing SVG file, missing `inkscape:grid`) — never extend hard-fail to per-shape validation.

### id/slug generation and collision handling
**Source:** `to_snake()` (referenced at line 475-476 region) + `_unique_id()` (referenced at line 497-503 region), both used throughout `_extract_areas`
**Apply to:** Detail `id:` generation (`to_snake(label)` else `f"detail_{i+1}"` fallback, matching `_extract_vents_layer`'s `vent_{i+1}` convention) and any per-path hull-piece naming if needed. Do not write a new slug/uniqueness scheme.

### Hand-written flow-style YAML (no `yaml.dump()`)
**Source:** Entire `_write_deckplan_yaml()`, `tools/svg_to_map.py:743-832`
**Apply to:** All new `hull:`/`details:` emission — output via f-strings and `fv()`, matching existing inline-dict (door) and unindented-polygon-list (room) conventions exactly. Never introduce `yaml.dump()` as a competing code path.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Circle/ellipse geometry detection itself (both literal-element and `sodipodi:type="arc"` forms) | service/transform | transform | RESEARCH.md confirms zero existing circle/ellipse handling anywhere in the file — genuinely new code, though it reuses existing coordinate primitives (`to_grid`/`verts_to_grid`) once `cx,cy,r` are extracted from attributes. Model on the *shape* of neighboring extractors (per-item loop, warn-and-skip, print summary) even though there's no direct prior circle-specific code to copy. |

## Metadata

**Analog search scope:** `tools/svg_to_map.py` (full file, 1030 lines, read across this session and RESEARCH.md); `core/tests/*.py` (test-style analog only); `docs/schemas/schema-encounters.md` (target doc, not re-read here — already read in full by RESEARCH.md this session).
**Files scanned:** 1 primary source file (single target of all changes) + 2 existing test files (style reference) + 1 schema doc.
**Pattern extraction date:** 2026-08-24
