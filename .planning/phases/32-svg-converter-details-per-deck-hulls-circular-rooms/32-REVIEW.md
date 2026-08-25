---
phase: 32-svg-converter-details-per-deck-hulls-circular-rooms
reviewed: 2026-08-25T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - tools/svg_to_map.py
  - tools/test_svg_to_map.py
  - docs/schemas/schema-encounters.md
findings:
  critical: 3
  warning: 6
  info: 1
  total: 10
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `tools/svg_to_map.py` (SVG→deckplan converter, extended this phase with per-deck hulls,
circular rooms/corridors, and a new `Details` sublayer), its unit tests, and the schema doc it
implements. The 19 existing unit tests pass (`python3 -m unittest tools.test_svg_to_map -v`).

Three id-uniqueness/data-integrity bugs were found and reproduced live against the actual code
(not just read-through speculation): duplicate deck ids when two layer labels collide, a
room/corridor id-uniqueness check that can itself produce a duplicate id, and silent geometry
loss (plus a mis-set `closed` flag) when a `Details` path is a compound (multi-subpath) path.
All three violate documented invariants in `docs/schemas/schema-encounters.md` (deck ids must be
unique; room/corridor ids get numeric-suffixed on collision, implying no *further* collision) and
produce corrupted YAML with no diagnostic output — a GM would have no idea their map converted
incorrectly.

Additional warnings cover stale/incomplete top-of-file documentation (the docstring undersells or
misdescribes phase-32 features and grid rounding), an unhandled `ZeroDivisionError` for
`--grid-scale 0`, an id-generation edge case that can emit an empty `id:` field, and one piece of
dead code.

## Critical Issues

### CR-01: Duplicate deck `id`s when two deck layer labels collide (or normalize to the same slug)

**File:** `tools/svg_to_map.py:1204`
**Issue:** In multi-deck mode, `deck_id_local = to_snake(deck_label)` is computed per deck with no
check against ids already assigned to earlier decks in the same document. Two Inkscape layers
named identically (a realistic copy/paste mistake when duplicating a deck template) — or two
labels that merely *normalize* to the same slug, e.g. `"Cargo Deck"` and `"Cargo-Deck"` — silently
produce two deck entries with the same `id:` in `deckplan.yaml`. Reproduced: two top-level layers
both labeled `"Main Deck"` produce:
```yaml
decks:
- id: main_deck
  name: Main Deck
  level: 1
  ...
- id: main_deck   # <-- duplicate, second deck's rooms are now unreachable by id
  name: Main Deck
  level: 2
  ...
```
`docs/schemas/schema-encounters.md` documents deck `id` as `Required | Unique deck identifier`.
A duplicate breaks any downstream lookup-by-id (MCP deck navigation, `edit_map_element`'s deck
addressing, frontend deck-tab selection) with no warning printed during conversion.
**Fix:**
```python
seen_deck_ids: dict[str, int] = {}
for deck_label, deck_elem in deck_groups:
    deck_id_local = _unique_id(to_snake(deck_label), seen_deck_ids)
    ...
```
Reuse the existing `_unique_id()` helper (fixing CR-02 first) or at minimum print a warning to
stderr when a collision is detected so the GM knows to rename a layer.

---

### CR-02: `_unique_id()` tracks previously-seen *base labels*, not previously-*emitted* ids — can itself manufacture a duplicate id

**File:** `tools/svg_to_map.py:508-514` (consumers: `tools/svg_to_map.py:696, 726, 743, 754`)
**Issue:** `_unique_id()` disambiguates by remembering how many times a given `base_id` string has
been requested, then appends `_N` on repeat. It never checks whether the resulting suffixed id
already coincides with an id that arose independently from a *different* base label. Reproduced:
```python
seen = {}
_unique_id("coolant_tanks_2", seen)  # -> "coolant_tanks_2"  (e.g. a room literally labeled "Coolant Tanks 2")
_unique_id("coolant_tanks", seen)    # -> "coolant_tanks"    (a room labeled "Coolant Tanks")
_unique_id("coolant_tanks", seen)    # -> "coolant_tanks_2"  <-- COLLIDES with the first room's id
```
This is exactly the naming pattern `docs/schemas/schema-encounters.md` calls out as the intended
disambiguation scheme (`"colliding names get a numeric suffix (coolant_tanks, coolant_tanks_2)"`),
so it's a realistic ship-naming scenario (e.g. "Coolant Tanks", "Coolant Tanks 2", "Coolant Tanks"
again for a third physically-separate tank room). The result is two rooms sharing `id:
coolant_tanks_2` in the same deck — door generation (`_build_doors`, which keys off `r["id"]`) and
any `edit_map_element` target resolution downstream become ambiguous/wrong, silently.
**Fix:** Track the set of ids actually emitted so far and keep incrementing until the candidate is
free:
```python
def _unique_id(base_id: str, seen: dict[str, int]) -> str:
    n = seen.get(base_id, 0) + 1
    candidate = base_id if n == 1 else f"{base_id}_{n}"
    while candidate in seen:  # seen now also stores emitted ids -> True
        n += 1
        candidate = f"{base_id}_{n}"
    seen[base_id] = n
    seen[candidate] = 1
    return candidate
```
(Or simpler: maintain a separate `emitted: set[str]` alongside `seen` and loop-bump `n` until
`f"{base_id}_{n}" not in emitted`.)

---

### CR-03: `Details` layer silently drops every subpath after the first, and mis-reports `closed`/`filled` for compound paths

**File:** `tools/svg_to_map.py:970-997` (specifically `closed = path.get("d", "").rstrip().endswith(("Z", "z"))` at line 973, and `grid_pts = verts_to_grid(_apply_translate(subpaths[0], tx, ty), unit)` at line 981)
**Issue:** `_extract_details_layer` computes `closed` by checking whether the raw `d` attribute
string ends in `Z`/`z`, then only ever emits `subpaths[0]` — the first of potentially several
subpaths `parse_path_d` returns for a compound path (Inkscape happily lets a user select two
disjoint polylines and do Path > Combine, producing one `<path>` with an `M...(Z) M...` `d`
string, exactly like the Hull/Rooms layers explicitly support for holes). Reproduced:
```python
# d = closed 2x2 square THEN a second, entirely separate open 2-vertex line
d = "M 0,0 L 60,0 L 60,60 L 0,60 Z M 200,200 L 260,200"
# -> only ONE detail is emitted (the square) instead of two, no warning,
# -> and it is emitted WITHOUT "closed"/"filled" even though it IS the closed subpath
#    (the trailing open second subpath is what makes the whole `d` string not end in "Z")
```
This is a genuine data-loss + mis-tagged-output bug: the second linework element vanishes from
the output with zero diagnostic, and the first element's fill/closure flag is derived from the
wrong scope (whole-string tail instead of the actually-emitted subpath's own shape). Unlike the
Hull/Rooms extraction (which explicitly walks every subpath and treats the largest as outer +
the rest as holes), Details has no equivalent handling and no warning path for "path has N>1
subpaths, only using the first."
**Fix:** Either (a) reject/warn on multi-subpath Details paths the way holes-with-no-slot cases
do elsewhere, or (b) emit one detail entry per subpath (auto-suffixing the id), and compute
`closed` per-subpath from the parsed vertex list (`_approx_eq` first/last vertex before dedup, or
track closure inside `parse_path_d` itself) rather than string-sniffing the raw `d` attribute:
```python
subpaths = parse_path_d(path.get("d", ""), label=f"detail {detail_id}")
if len(subpaths) > 1:
    print(f"  WARNING: detail path '{detail_id}' has {len(subpaths)} disconnected "
          "subpaths — only the first is used. Split into separate paths in Inkscape.",
          file=sys.stderr)
```

## Warnings

### WR-01: `Details` entries have no id-uniqueness enforcement (unlike Rooms/Corridors)

**File:** `tools/svg_to_map.py:972, 1001`
**Issue:** `detail_id = to_snake(label) if label else f"detail_{i + 1}"` (and the equivalent for
circle details) is never passed through `_unique_id()`. Two Details paths/circles sharing a label
(e.g. two consoles both labeled `"Console"`) silently get the identical `id: console` in the
output. Reproduced — two `<path inkscape:label="Console">` elements both emit `id: console`.
Rooms and Corridors guard against exactly this with `_unique_id(base_id, seen_ids)`; Details,
added this phase, does not.
**Fix:** Thread a `seen_ids` dict through `_extract_details_layer` and call `_unique_id()` for
both the path-detail and circle-detail loops, mirroring `_extract_areas`.

### WR-02: `to_snake()` can produce an empty string, yielding an invalid/empty `id:` field

**File:** `tools/svg_to_map.py:486-487` (consumers include `tools/svg_to_map.py:687, 742, 753, 1204`)
**Issue:** `to_snake("-")` and `to_snake("***")` both return `""` (confirmed). Rooms special-case
a literal `"-"` label (fall back to the SVG element id) but every *other* symbol-only label (e.g.
an inkscape:label of `"???"`, `"—"`, or `"..."`) falls straight through `to_snake()` to an empty
base id everywhere else it's used: corridors, deck labels, details, vents. `_unique_id("", seen)`
happily returns `""` as a "unique" id, and `_write_deckplan_yaml` then writes a bare
`- id: \n` — almost certainly invalid/unparseable downstream given the schema requires `id` to be
a non-empty unique string.
**Fix:** After computing a `base_id` via `to_snake()`, fall back to `to_snake(elem.get("id", ""))`
or an index-based placeholder when the result is empty:
```python
base_id = to_snake(label) or to_snake(path.get("id", "")) or f"room_{i + 1}"
```

### WR-03: `--grid-scale 0` (or negative) crashes with an unhandled `ZeroDivisionError` instead of a clear error

**File:** `tools/svg_to_map.py:1316-1322` (argparse definition), `tools/svg_to_map.py:1178` (`unit = raw_unit * grid_scale`), `tools/svg_to_map.py:280-282` (`to_grid`)
**Issue:** `--grid-scale` is declared `type=int` with no minimum/validation. `--grid-scale 0`
makes `unit = raw_unit * 0 == 0`, and the very first `to_grid()` call
(`round(px / unit * 4) / 4`) raises `ZeroDivisionError`, confirmed:
```
>>> to_grid(30, 0)
ZeroDivisionError: division by zero
```
A negative `--grid-scale` doesn't crash but silently mirrors all output coordinates (garbage,
unusable map). Neither case gives the user an actionable message — they get a raw Python
traceback.
**Fix:**
```python
ap.add_argument("--grid-scale", default=1, type=int, metavar="N", ...)
...
if args.grid_scale < 1:
    sys.exit(f"ERROR: --grid-scale must be >= 1 (got {args.grid_scale}).")
```

### WR-04: Module docstring says rounding is "to the nearest 0.5 grid cell"; actual code rounds to the nearest 0.25

**File:** `tools/svg_to_map.py:74` (docstring) vs. `tools/svg_to_map.py:280-282` (`to_grid`)
**Issue:** The top-of-file usage docstring states `Output values are rounded to the nearest 0.5
grid cell.` The actual implementation, `round(px / unit * 4) / 4`, rounds to the nearest **0.25**
cell (confirmed: `to_grid(37.5, 30) == 1.25`). This mismatch is user-visible: GMs reading the
script's own documented behavior (e.g. to predict output coordinates or debug an off-grid room)
will be misled.
**Fix:** Update line 74 to `Output values are rounded to the nearest 0.25 grid cell.`

### WR-05: Module docstring's SVG layer convention sections don't document three of this phase's own features

**File:** `tools/svg_to_map.py:25-46`
**Issue:** The `SVG layer convention` sections (single-deck lines 25-30, multi-deck lines 32-46)
are the tool's primary usage documentation. They still list only `Hull, Rooms, Corridors, Doors,
Vents` and make no mention of:
- the per-deck `Hull` sublayer (implemented at `_extract_hull_layer(deck_elem, unit)`, called from
  `convert()` at line 1222, and exercised by `HullTests.test_per_deck_hull_multi_polygon`),
- the new `Details` sublayer (`_extract_details_layer`, lines 950-1019), and
- circle/ellipse/`sodipodi:type="arc"` support inside `Rooms`/`Corridors`
  (`_extract_circle_shape`, `_get_circle_shape_elements`).

`docs/schemas/schema-encounters.md` was correctly updated with all three (Detail Fields section,
per-deck Hull note, circle-room notes) — the script's own docstring was not, leaving two
documentation sources for the same tool out of sync.
**Fix:** Add `Hull` (per-deck) and `Details` lines under the multi-deck convention block, and a
one-line note under both blocks that `Rooms`/`Corridors` accept `<circle>`, true `<ellipse>`, or
`sodipodi:type="arc"` shapes in addition to `<path>`.

### WR-06: `_extract_circle_shape`'s radius conversion subtracts a value that is always zero — dead/confusing code

**File:** `tools/svg_to_map.py:562`
**Issue:**
```python
gr = to_grid(r, unit) - to_grid(0.0, unit)
```
`to_grid(0.0, unit)` is `round(0.0 / unit * 4) / 4`, which is always `0` for any non-zero `unit`.
The subtraction does nothing; it reads as if it's compensating for some origin offset (the way
`_apply_translate` compensates coordinates), but `to_grid` is a pure linear scale with no offset,
so this is misleading dead code.
**Fix:**
```python
gr = to_grid(r, unit)
```

## Info

### IN-01: `xml.etree.ElementTree.parse` has no hardening against entity-expansion DoS

**File:** `tools/svg_to_map.py:86, 1162` (`import xml.etree.ElementTree as ET`, `tree = ET.parse(svg_path)`)
**Issue:** `xml.etree.ElementTree` is documented upstream as not hardened against maliciously
crafted XML (e.g. "billion laughs" entity-expansion DoS). `docs/schemas/schema-encounters.md`
notes this script's SVG parsing convention is also what the MCP `upload_svg_map` tool and
`/janus-import-deckplan` skill rely on for multi-deck SVG import, and separately says the script
itself is "a manual GM workflow" not run by skills — the two statements leave the actual trust
boundary of SVG input ambiguous from this file alone. If any network-reachable path feeds
uploaded (not GM-authored-locally) SVG content through this parser or equivalent logic, prefer
`defusedxml.ElementTree.parse` instead of the stdlib parser.
**Fix:** Low priority given the documented manual-workflow framing; worth a one-line comment or a
follow-up check of the `upload_svg_map` implementation to confirm it doesn't reuse this exact
parse call on untrusted input.

---

_Reviewed: 2026-08-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
