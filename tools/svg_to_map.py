#!/usr/bin/env python3
"""
svg_to_map.py — Convert Inkscape SVG maps to YAML encounter map format.

Usage:
    python tools/svg_to_map.py <svg_file> [options]

Options:
    --out-dir DIR    Location directory (default: <svg_dir>/<stem>_out/)
                     Map files are written to <out-dir>/map/.
                     A stub location.yaml is created if none exists.
    --deck NAME      Deck YAML filename stem (default: main_deck).
                     Ignored in multi-deck mode (deck IDs come from layer labels).
    --name NAME      Map/location name (default: derived from SVG filename)
    --type TYPE      Location type for stub location.yaml (default: ship)
    --unit-size N    Pixels per grid cell written to deck YAML (default: 30).
    --grid-scale N   Group N Inkscape grid cells into 1 output cell (default: 1).
                     Use this when rooms have too many cells and tokens/text
                     look tiny. Run once without it; the script prints room
                     dimensions — aim for rooms ~5-12 cells wide.
                     Example: if Engineering is 40 cells wide, use --grid-scale 5
                     to output it as 8 cells wide.
    --no-detect-doors  Skip door detection (doors are detected by default).

SVG layer convention — single-deck (backwards compatible):
    Hull       — ship outer hull polygon (optional, single path)
    Rooms      — room polygons; each path has inkscape:label = room name
    Corridors  — corridor polygons (name="" in output)
    Doors      — optional manual door lines (see below)
    Vents      — optional ventilation paths (see below)

SVG layer convention — multi-deck:
    Hull           — ship outer hull polygon (optional, single path)
    <Deck label>   — one layer per deck (e.g. "Main Deck", "Engineering Deck")
      Rooms        — room polygons within this deck
      Corridors    — corridor polygons within this deck
      Doors        — optional manual door lines within this deck
      Vents        — optional ventilation paths within this deck
    <Deck label 2>
      Rooms
      Corridors
    (etc.)
    Multi-deck is auto-detected: if any top-level layer contains Rooms or
    Corridors sublayers, multi-deck mode is used; otherwise single-deck mode.
    Deck IDs in output are derived from the layer label (snake_cased).
    Decks are ordered by their document order; the first deck is the default.

Vents layer (optional):
    Each path is a ventilation route polyline (open or closed). Vertices are
    converted to grid coords and written as a `points:` list.
    inkscape:label on the path → vent id (snake_cased) and optional label.
    If no label, id is auto-generated as vent_1, vent_2, etc.
    Output: `vents: [{id, points: [[x,y],...], label?}, ...]` on the deck.
    Vent visibility is controlled at runtime by the GM (hidden by default).

Doors layer (optional — overrides --detect-doors when present):
    Each path in the Doors layer is a single line segment (2 vertices).
    The tool reads:
      position  — midpoint of the line → door center (x, y in grid cells)
      angle     — line direction: horizontal line = 0 (N/S wall),
                  vertical line = 90 (E/W wall)
      width     — length of the line in grid cells (default 1)
      rooms     — auto-detected by probing 0.5 cells to each side of the door
    inkscape:label on the path sets door type (default "standard"):
      airlock / blast / emergency
    Append a status keyword to override CLOSED default:
      locked / sealed / open / damaged
    Examples: "airlock", "blast locked", "standard sealed"
    If a Doors layer is found, it replaces auto-detection for that deck.

Grid unit:
    Read from inkscape:grid spacingx attribute (px per cell).
    All SVG px coordinates are divided by this unit (then by --grid-scale).
    Output values are rounded to the nearest 0.5 grid cell.

Output files:
    location.yaml         Created once if missing; never overwritten
    deckplan.yaml         Canonical single-file deckplan; overwritten on each run
"""

import argparse
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

# ── Namespaces ──────────────────────────────────────────────────────────────

SVG = "http://www.w3.org/2000/svg"
INK = "http://www.inkscape.org/namespaces/inkscape"
SODIPODI = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"

# ── SVG path parser ──────────────────────────────────────────────────────────

_TOKEN_RE = re.compile(
    r"[MmLlHhVvZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?"
)

# SVG curve/arc commands that parse_path_d does not handle.
_CURVE_CMD_RE = re.compile(r"[CcSsQqTtAa]")


def parse_path_d(d: str, *, label: str = "") -> list[list[tuple[float, float]]]:
    """Parse SVG path 'd' attribute into a list of subpaths (polygons).

    Returns a list where each element is the cleaned vertex list for one closed
    subpath. Compound paths (M...Z M...Z) yield multiple entries — the first is
    the outer boundary, subsequent ones are holes. Simple paths yield a
    single-element list.

    Supports M m L l H h V v Z z commands.
    After 'm', subsequent implicit pairs are treated as 'l' (relative lineto).
    Closing duplicate vertex and consecutive duplicates are removed per subpath.

    Emits a warning to stderr and returns an empty list if the path contains
    curve or arc commands (C c S s Q q T t A a). Re-export from Inkscape with
    "Object to Path" + straight segments only.
    """
    curve_match = _CURVE_CMD_RE.search(d)
    if curve_match:
        ctx = f" (label: {label!r})" if label else ""
        print(
            f"WARNING: SVG path{ctx} contains unsupported curve command "
            f"'{curve_match.group()}' — skipping. "
            "Re-export with straight segments only (Path > Object to Path, "
            "then Extensions > Generate from Path > ... or Inkscape 'Flatten Beziers').",
            file=sys.stderr,
        )
        return []
    tokens = _TOKEN_RE.findall(d)
    subpaths: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    cx = cy = 0.0
    start_x = start_y = 0.0
    cmd: str | None = None
    i = 0

    def _flush() -> None:
        if current:
            subpaths.append(current[:])
            current.clear()

    while i < len(tokens):
        t = tokens[i]

        if t in "MmLlHhVvZz":
            cmd = t
            i += 1
            if cmd in ("Z", "z"):
                _flush()
                cx, cy = start_x, start_y
            continue

        v = float(t)

        if cmd == "M":
            _flush()  # save previous open subpath if any
            cx, cy = v, float(tokens[i + 1]); i += 2
            start_x, start_y = cx, cy
            current.append((cx, cy))
            cmd = "L"  # subsequent pairs are implicit lineto

        elif cmd == "m":
            _flush()
            cx += v; cy += float(tokens[i + 1]); i += 2
            start_x, start_y = cx, cy
            current.append((cx, cy))
            cmd = "l"  # subsequent pairs are implicit relative lineto

        elif cmd == "L":
            cx, cy = v, float(tokens[i + 1]); i += 2
            current.append((cx, cy))

        elif cmd == "l":
            cx += v; cy += float(tokens[i + 1]); i += 2
            current.append((cx, cy))

        elif cmd == "H":
            cx = v; i += 1
            current.append((cx, cy))

        elif cmd == "h":
            cx += v; i += 1
            current.append((cx, cy))

        elif cmd == "V":
            cy = v; i += 1
            current.append((cx, cy))

        elif cmd == "v":
            cy += v; i += 1
            current.append((cx, cy))

        else:
            i += 1  # unknown token

    _flush()  # trailing subpath without closing Z

    # Clean each subpath: remove closing duplicate, then consecutive duplicates
    result: list[list[tuple[float, float]]] = []
    for sp in subpaths:
        if len(sp) > 1 and _approx_eq(sp[-1], sp[0]):
            sp = sp[:-1]
        deduped: list[tuple[float, float]] = []
        for pt in sp:
            if not deduped or not _approx_eq(pt, deduped[-1]):
                deduped.append(pt)
        if deduped:
            result.append(deduped)

    return result


def _approx_eq(a: tuple[float, float], b: tuple[float, float], tol: float = 1e-4) -> bool:
    return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol


def _polygon_area(pts: list[tuple[float, float]]) -> float:
    """Shoelace formula — unsigned area."""
    n = len(pts)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
    return abs(area) / 2.0


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


def _parse_door_label(label: str) -> tuple[str, str]:
    """Parse inkscape label → (door_type, status). Defaults: standard, CLOSED."""
    tokens = label.strip().lower().split()
    type_map = {"airlock": "airlock", "blast": "blast_door", "emergency": "emergency"}
    status_map = {"locked": "LOCKED", "sealed": "SEALED", "open": "OPEN", "damaged": "DAMAGED"}
    door_type = "standard"
    door_status = "CLOSED"
    for t in tokens:
        if t in type_map:
            door_type = type_map[t]
        if t in status_map:
            door_status = status_map[t]
    return door_type, door_status


# ── Coordinate conversion ────────────────────────────────────────────────────

def to_grid(px: float, unit: float) -> float:
    """Convert px to grid cells, rounded to the nearest 0.25."""
    return round(px / unit * 4) / 4


def verts_to_grid(
    verts: list[tuple[float, float]], unit: float
) -> list[tuple[float, float]]:
    return [(to_grid(x, unit), to_grid(y, unit)) for x, y in verts]


# ── Polygon utilities ────────────────────────────────────────────────────────

def centroid(pts: list[tuple[float, float]]) -> tuple[float, float]:
    n = len(pts)
    return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)


def remove_collinear(
    pts: list[tuple[float, float]], tol: float = 1e-6
) -> list[tuple[float, float]]:
    """Remove collinear middle points from a polygon."""
    if len(pts) < 3:
        return pts
    result = []
    n = len(pts)
    for i in range(n):
        a = pts[(i - 1) % n]
        b = pts[i]
        c = pts[(i + 1) % n]
        cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(cross) > tol:
            result.append(b)
    return result


# ── Door detection ───────────────────────────────────────────────────────────

def segments_overlap(
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    p4: tuple[float, float],
    tol: float = 0.01,
) -> tuple[tuple[float, float], float] | None:
    """Check if two line segments are collinear and share a sub-segment.

    Returns (midpoint_of_overlap, overlap_length) or None.
    """
    dx12, dy12 = p2[0] - p1[0], p2[1] - p1[1]
    len12 = math.hypot(dx12, dy12)
    dx34, dy34 = p4[0] - p3[0], p4[1] - p3[1]
    len34 = math.hypot(dx34, dy34)
    if len12 < tol or len34 < tol:
        return None

    # Collinearity: p3 and p4 must lie on the line through p1–p2
    cross1 = dx12 * (p3[1] - p1[1]) - dy12 * (p3[0] - p1[0])
    cross2 = dx12 * (p4[1] - p1[1]) - dy12 * (p4[0] - p1[0])
    if abs(cross1) > tol * len12 or abs(cross2) > tol * len12:
        return None

    # Project onto the line direction
    def proj(pt: tuple[float, float]) -> float:
        return (pt[0] - p1[0]) * dx12 / len12 + (pt[1] - p1[1]) * dy12 / len12

    t3, t4 = proj(p3), proj(p4)
    if t3 > t4:
        t3, t4 = t4, t3

    lo = max(0.0, t3)
    hi = min(len12, t4)
    if hi - lo < tol:
        return None

    tmid = (lo + hi) / 2
    mid = (p1[0] + dx12 / len12 * tmid, p1[1] + dy12 / len12 * tmid)
    return (mid, hi - lo)


def _shared_edges_with_segments(
    poly_a: list[tuple[float, float]],
    poly_b: list[tuple[float, float]],
) -> list[tuple[tuple[tuple[float, float], float], tuple[tuple[float, float], tuple[float, float]]]]:
    """Like find_shared_edges but also returns the edge segment (p1, p2) that was hit."""
    results = []
    na, nb = len(poly_a), len(poly_b)
    for i in range(na):
        p1, p2 = poly_a[i], poly_a[(i + 1) % na]
        for j in range(nb):
            p3, p4 = poly_b[j], poly_b[(j + 1) % nb]
            result = segments_overlap(p1, p2, p3, p4)
            if result:
                results.append((result, (p1, p2)))
    return results


def find_shared_edges(
    poly_a: list[tuple[float, float]],
    poly_b: list[tuple[float, float]],
) -> list[tuple[tuple[float, float], float]]:
    """Find all overlapping edges between two polygons."""
    shared = []
    na, nb = len(poly_a), len(poly_b)
    for i in range(na):
        p1, p2 = poly_a[i], poly_a[(i + 1) % na]
        for j in range(nb):
            p3, p4 = poly_b[j], poly_b[(j + 1) % nb]
            result = segments_overlap(p1, p2, p3, p4)
            if result:
                shared.append(result)
    return shared


def edge_slot_angle(
    p1: tuple[float, float], p2: tuple[float, float]
) -> int:
    """Door slot orientation from the shared edge direction.
    Returns 0 for horizontal slot (N/S wall), 90 for vertical slot (E/W wall).
    For diagonal edges returns the nearest of 0 or 90.
    """
    dx = abs(p2[0] - p1[0])
    dy = abs(p2[1] - p1[1])
    return 90 if dy > dx else 0


# ── SVG layer extraction ─────────────────────────────────────────────────────

_TRANSLATE_RE = re.compile(
    r"translate\(\s*([-+]?\d*\.?\d+)\s*[,\s]\s*([-+]?\d*\.?\d+)\s*\)"
)


def _parse_translate(elem: ET.Element) -> tuple[float, float]:
    """Return (tx, ty) from a translate() transform attribute, or (0, 0)."""
    m = _TRANSLATE_RE.search(elem.get("transform", ""))
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


def _apply_translate(
    verts: list[tuple[float, float]], tx: float, ty: float
) -> list[tuple[float, float]]:
    if tx == 0.0 and ty == 0.0:
        return verts
    return [(x + tx, y + ty) for x, y in verts]


def get_layer_shapes(
    parent: ET.Element, layer_label: str, *tag_names: str
) -> list[ET.Element]:
    """Return all elements matching any of tag_names from the named layer within parent."""
    for g in parent.iter(f"{{{SVG}}}g"):
        if g.get(f"{{{INK}}}label") == layer_label:
            out: list[ET.Element] = []
            for tag in tag_names:
                out.extend(g.iter(f"{{{SVG}}}{tag}"))
            return out
    return []


def get_layer_paths(parent: ET.Element, layer_label: str) -> list[ET.Element]:
    """Return all <path> elements from the named layer within parent."""
    return get_layer_shapes(parent, layer_label, "path")


def get_ink_label(elem: ET.Element) -> str:
    return elem.get(f"{{{INK}}}label", "")


def find_deck_groups(root: ET.Element) -> list[tuple[str, ET.Element]]:
    """Find top-level layer groups that contain Rooms or Corridors sublayers.

    Only examines direct children of the SVG root element to avoid false
    positives from nested groups. Returns [(label, element)] in document
    order. An empty list means single-deck mode should be used.
    """
    decks = []
    for g in root:
        if g.tag != f"{{{SVG}}}g":
            continue
        label = g.get(f"{{{INK}}}label", "")
        if not label:
            continue
        child_labels = {
            child.get(f"{{{INK}}}label", "")
            for child in g
            if child.tag == f"{{{SVG}}}g"
        }
        if "Rooms" in child_labels or "Corridors" in child_labels:
            decks.append((label, g))
    return decks


# ── YAML formatting ──────────────────────────────────────────────────────────

def fv(v: float) -> str:
    """Format a grid value as int when whole, else as float."""
    if v == int(v):
        return str(int(v))
    return str(v)


def fmt_polygon(pts: list[tuple[float, float]]) -> str:
    return "[" + ", ".join(f"[{fv(x)},{fv(y)}]" for x, y in pts) + "]"


def to_snake(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


# ── Location scaffold ────────────────────────────────────────────────────────

def ensure_location_yaml(location_dir: str, map_name: str, location_type: str) -> None:
    """Create a stub location.yaml if one does not already exist."""
    path = os.path.join(location_dir, "location.yaml")
    if os.path.exists(path):
        print(f"Existing: {path}  (not modified)")
        return
    with open(path, "w") as f:
        f.write(f'name: "{map_name}"\n')
        f.write(f'type: "{location_type}"\n')
        f.write('description: ""\n')
        f.write('status: "OPERATIONAL"\n')
    print(f"Created:  {path}")


# ── Processing helpers ───────────────────────────────────────────────────────

def _unique_id(base_id: str, seen: dict[str, int]) -> str:
    """Return a unique id by appending _2, _3, … on collision."""
    if base_id not in seen:
        seen[base_id] = 1
        return base_id
    seen[base_id] += 1
    return f"{base_id}_{seen[base_id]}"


def _extract_circle_shape(
    elem: ET.Element, unit: float, tx: float, ty: float, *, ctx: str
) -> dict | None:
    """Extract a circle/ellipse shape element into grid-space {cx, cy, r}.

    Handles literal <circle> elements. A non-circular <ellipse> (rx != ry) or a
    non-circular sodipodi:type="arc" path is rejected — warn to stderr and
    return None, never approximated (D-06).
    """
    if elem.tag == f"{{{SVG}}}circle":
        cx = float(elem.get("cx", "0"))
        cy = float(elem.get("cy", "0"))
        r = float(elem.get("r", "0"))
    elif elem.tag == f"{{{SVG}}}ellipse":
        cx = float(elem.get("cx", "0"))
        cy = float(elem.get("cy", "0"))
        rx = float(elem.get("rx", "0"))
        ry = float(elem.get("ry", "0"))
        if abs(rx - ry) > 1e-4:
            print(
                f"  WARNING: {ctx} is not circular (rx={rx:.2f} != ry={ry:.2f}) "
                "— skipping. Use a true circle (rx == ry) or fix the shape in "
                "Inkscape.",
                file=sys.stderr,
            )
            return None
        r = rx
    elif elem.tag == f"{{{SVG}}}path" and elem.get(f"{{{SODIPODI}}}type") == "arc":
        cx = float(elem.get(f"{{{SODIPODI}}}cx", "0"))
        cy = float(elem.get(f"{{{SODIPODI}}}cy", "0"))
        rx = float(elem.get(f"{{{SODIPODI}}}rx", "0"))
        ry = float(elem.get(f"{{{SODIPODI}}}ry", "0"))
        if abs(rx - ry) > 1e-4:
            print(
                f"  WARNING: {ctx} is not circular (rx={rx:.2f} != ry={ry:.2f}) "
                "— skipping. Use a true circle (rx == ry) or fix the shape in "
                "Inkscape.",
                file=sys.stderr,
            )
            return None
        r = rx
    else:
        return None

    (gcx, gcy), = verts_to_grid(_apply_translate([(cx, cy)], tx, ty), unit)
    gr = to_grid(r, unit) - to_grid(0.0, unit)
    return {"cx": gcx, "cy": gcy, "r": gr}


def _get_circle_shape_elements(
    parent: ET.Element, layer_label: str
) -> list[ET.Element]:
    """Collect literal <circle>/<ellipse> and sodipodi:type="arc" <path>
    elements from the named layer."""
    circles_and_ellipses = get_layer_shapes(parent, layer_label, "circle", "ellipse")
    arc_paths = [
        p
        for p in get_layer_shapes(parent, layer_label, "path")
        if p.get(f"{{{SODIPODI}}}type") == "arc"
    ]
    return circles_and_ellipses + arc_paths


def _extract_hull_layer(parent: ET.Element, unit: float) -> dict | None:
    """Extract a 'Hull' sublayer (direct child of parent) into grid-space
    polygons + holes.

    Collects ALL <path> elements in the layer (not just the first) — each
    path's largest-area subpath becomes one outer polygon (Inkscape may place
    inner holes first); any remaining subpaths in that same path become
    holes, flattened into one combined holes list across every path in the
    layer (not paired to any specific outer polygon), matching
    schema-encounters.md's existing hull holes semantics.

    Used identically for both the top-level Hull layer (parent=root) and a
    per-deck Hull sublayer (parent=deck_elem) — one shared implementation.

    Returns None if no 'Hull' <g> direct child exists, or if it exists but
    contains no usable <path> geometry.
    """
    hull_group = next(
        (g for g in parent if g.get(f"{{{INK}}}label") == "Hull"), None
    )
    if hull_group is None:
        return None
    tx, ty = _parse_translate(hull_group)
    hull_paths = list(hull_group.iter(f"{{{SVG}}}path"))
    if not hull_paths:
        return None

    polygons: list[list[tuple[float, float]]] = []
    holes: list[list[tuple[float, float]]] = []
    for path in hull_paths:
        subpaths = parse_path_d(path.get("d", ""), label="Hull")
        if not subpaths:
            continue
        outer_idx = max(range(len(subpaths)), key=lambda i: _polygon_area(subpaths[i]))
        outer_sp = subpaths[outer_idx]
        hole_sps = [sp for i, sp in enumerate(subpaths) if i != outer_idx]
        polygons.append(
            remove_collinear(verts_to_grid(_apply_translate(outer_sp, tx, ty), unit))
        )
        holes.extend(
            remove_collinear(verts_to_grid(_apply_translate(sp, tx, ty), unit))
            for sp in hole_sps
        )

    if not polygons:
        return None
    return {"polygons": polygons, "holes": holes}


def _write_hull_block(f, hull_data: dict, indent: str = "") -> None:
    """Write a hull mapping's polygon(s)/holes fields, shared by both the
    top-level `hull:` key and every deck's nested `hull:` key.

    Single polygon, no holes: compact `polygon:` flat list — byte-identical
    to the pre-refactor single-polygon inline form. Otherwise: `polygons:`
    (plural) nested-list form, with a `holes:` nested list if any holes.
    """
    polygons = hull_data["polygons"]
    holes = hull_data["holes"]
    if len(polygons) == 1 and not holes:
        f.write(f"{indent}polygon:\n")
        for x, y in polygons[0]:
            f.write(f"{indent}- [{fv(x)}, {fv(y)}]\n")
        return

    f.write(f"{indent}polygons:\n")
    for poly in polygons:
        for j, (x, y) in enumerate(poly):
            if j == 0:
                f.write(f"{indent}- - [{fv(x)}, {fv(y)}]\n")
            else:
                f.write(f"{indent}  - [{fv(x)}, {fv(y)}]\n")
    if holes:
        f.write(f"{indent}holes:\n")
        for hole in holes:
            for j, (x, y) in enumerate(hole):
                if j == 0:
                    f.write(f"{indent}- - [{fv(x)}, {fv(y)}]\n")
                else:
                    f.write(f"{indent}  - [{fv(x)}, {fv(y)}]\n")


def _extract_areas(
    parent: ET.Element, unit: float
) -> tuple[list[dict], list[dict]]:
    """Extract rooms and corridors from a layer element (root or deck group).

    Applies the layer group's translate() transform so that decks placed at
    different SVG canvas positions (common Inkscape workflow) are normalized
    into the same coordinate space as the hull.
    """
    tx, ty = _parse_translate(parent)
    seen_ids: dict[str, int] = {}
    rooms: list[dict] = []
    for path in get_layer_paths(parent, "Rooms"):
        if path.get(f"{{{SODIPODI}}}type") == "arc":
            # Handled by the circle/ellipse shape loop below — skip here to
            # avoid a spurious "unsupported curve command" warning from
            # parse_path_d on a shape that converts successfully as a circle.
            continue
        label = get_ink_label(path) or path.get("id", "room")
        # Label "-" means: no display name; use SVG element id for the room id.
        if label == "-":
            display_name = ""
            base_id = to_snake(path.get("id", "") or "room")
        else:
            display_name = label.upper()
            base_id = to_snake(label)
        subpaths = parse_path_d(path.get("d", ""), label=label)
        if not subpaths:
            continue
        # Outer polygon = largest area subpath (Inkscape may place inner holes first)
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
        rooms.append(room)
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        w = max(xs) - min(xs)
        h = max(ys) - min(ys)
        suffix = f" → id: {rid}" if rid != base_id else ""
        no_label = " (no label)" if label == "-" else ""
        holes_note = f"  ({len(room['holes'])} hole(s))" if room.get("holes") else ""
        print(f"  Room '{label}': {len(poly)} vertices  ({w:.1f}×{h:.1f} cells){suffix}{no_label}{holes_note}")

    for i, elem in enumerate(_get_circle_shape_elements(parent, "Rooms")):
        label = get_ink_label(elem)
        if label == "-":
            display_name = ""
            base_id = to_snake(elem.get("id", "") or "circle_room")
        else:
            display_name = label.upper() if label else ""
            base_id = to_snake(label) if label else f"circle_room_{i + 1}"
        circle_data = _extract_circle_shape(
            elem, unit, tx, ty, ctx=f"circle/ellipse in Rooms (label: {label!r})"
        )
        if circle_data is None:
            continue
        rid = _unique_id(base_id, seen_ids)
        room = {"id": rid, "name": display_name, "circle": circle_data}
        rooms.append(room)
        print(
            f"  Room '{label or rid}' (circle): cx={fv(circle_data['cx'])} "
            f"cy={fv(circle_data['cy'])} r={fv(circle_data['r'])}"
        )

    corridors: list[dict] = []
    for i, path in enumerate(get_layer_paths(parent, "Corridors")):
        if path.get(f"{{{SODIPODI}}}type") == "arc":
            # Handled by the circle/ellipse shape loop below — skip here to
            # avoid a spurious "unsupported curve command" warning from
            # parse_path_d on a shape that converts successfully as a circle.
            continue
        label = get_ink_label(path)
        base_id = to_snake(label) if label else f"corridor_{i + 1}"
        cid = _unique_id(base_id, seen_ids)
        subpaths = parse_path_d(path.get("d", ""), label=cid)
        if not subpaths:
            continue
        poly = remove_collinear(verts_to_grid(_apply_translate(subpaths[0], tx, ty), unit))
        corridors.append({"id": cid, "polygon": poly})
        print(f"  Corridor '{cid}': {len(poly)} vertices")

    for i, elem in enumerate(_get_circle_shape_elements(parent, "Corridors")):
        label = get_ink_label(elem)
        base_id = to_snake(label) if label else f"circle_corridor_{i + 1}"
        cid = _unique_id(base_id, seen_ids)
        circle_data = _extract_circle_shape(
            elem, unit, tx, ty, ctx=f"circle/ellipse in Corridors (label: {label!r})"
        )
        if circle_data is None:
            continue
        corridors.append({"id": cid, "circle": circle_data})
        print(
            f"  Corridor '{cid}' (circle): cx={fv(circle_data['cx'])} "
            f"cy={fv(circle_data['cy'])} r={fv(circle_data['r'])}"
        )

    return rooms, corridors


def _build_doors(rooms: list[dict], corridors: list[dict]) -> list[dict]:
    """Run door detection for a set of rooms and corridors."""
    # Circle rooms/corridors have no "polygon" key and are excluded from
    # polygon-based door adjacency — they cannot be edge-tested for shared
    # walls with the existing geometry.
    all_areas = {r["id"]: r["polygon"] for r in rooms + corridors if "polygon" in r}
    seen_pairs: set[tuple[str, str]] = set()
    ordered_ids = [r["id"] for r in rooms if "polygon" in r] + [
        c["id"] for c in corridors if "polygon" in c
    ]
    doors: list[dict] = []

    for a_id in ordered_ids:
        poly_a = all_areas[a_id]
        for b_id in ordered_ids:
            if a_id == b_id:
                continue
            pair = tuple(sorted([a_id, b_id]))
            if pair in seen_pairs:
                continue
            shared = _shared_edges_with_segments(poly_a, all_areas[b_id])
            if not shared:
                continue
            seen_pairs.add(pair)
            # If there's exactly one shared edge, emit B-rel (along: 0.5).
            # If multiple, emit B-pos for each so positions stay distinct.
            if len(shared) == 1:
                doors.append(
                    {
                        "rooms": [a_id, b_id],
                        "along": 0.5,
                        "type": "standard",
                        "status": "CLOSED",
                    }
                )
            else:
                for (mid, _length), (p1, p2) in shared:
                    doors.append(
                        {
                            "rooms": [a_id, b_id],
                            "position": {
                                "x": round(mid[0] * 4) / 4,
                                "y": round(mid[1] * 4) / 4,
                                "angle": edge_slot_angle(p1, p2),
                            },
                            "type": "standard",
                            "status": "CLOSED",
                        }
                    )

    def sort_key(d: dict):
        pair = tuple(sorted(d["rooms"]))
        if "along" in d:
            return (pair, 0, d["along"], 0.0)
        p = d["position"]
        return (pair, 1, p["y"], p["x"])

    doors.sort(key=sort_key)
    return doors


def _extract_doors_layer(
    parent: ET.Element,
    unit: float,
    tx: float,
    ty: float,
    all_areas: dict[str, list[tuple[float, float]]],
) -> list[dict]:
    """Parse manually placed doors from a 'Doors' sublayer.

    Each path must be a 2-vertex line segment. Midpoint → (x, y), direction →
    angle, length → width. Rooms on each side found via point-in-polygon probe.
    """
    paths = get_layer_paths(parent, "Doors")
    if not paths:
        return []

    doors: list[dict] = []
    for path in paths:
        label = get_ink_label(path) or ""
        subpaths = parse_path_d(path.get("d", ""), label=f"door")
        if not subpaths or len(subpaths[0]) < 2:
            print(
                f"  WARNING: door path {path.get('id', '?')} has <2 vertices — skipping.",
                file=sys.stderr,
            )
            continue

        verts = verts_to_grid(_apply_translate(subpaths[0][:2], tx, ty), unit)
        p1, p2 = verts[0], verts[1]

        mx = (p1[0] + p2[0]) / 2
        my = (p1[1] + p2[1]) / 2
        angle = edge_slot_angle(p1, p2)

        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        width_raw = math.sqrt(dx * dx + dy * dy)
        width = round(width_raw * 2) / 2  # nearest 0.5 cell
        if width < 0.5:
            width = 1.0

        # Probe 0.5 cells to each side of the door to find adjacent rooms
        offset = 0.5
        if angle == 90:  # vertical slot — probe left/right
            probe_a = (mx - offset, my)
            probe_b = (mx + offset, my)
        else:            # horizontal slot — probe above/below
            probe_a = (mx, my - offset)
            probe_b = (mx, my + offset)

        room_a = _find_room_at(probe_a, all_areas)
        room_b = _find_room_at(probe_b, all_areas)
        door_type, door_status = _parse_door_label(label)

        door: dict = {
            "position": {
                "x": round(mx * 4) / 4,
                "y": round(my * 4) / 4,
                "angle": angle,
            },
            "type": door_type,
            "status": door_status,
        }
        if width != 1.0:
            door["width"] = width
        rooms_found = [r for r in (room_a, room_b) if r is not None]
        if rooms_found:
            door["rooms"] = rooms_found

        doors.append(door)

        rooms_str = f"{room_a or '?'} ↔ {room_b or 'exterior'}"
        width_str = f"  w={fv(width)}" if width != 1.0 else ""
        print(
            f"  Door: ({fv(mx)}, {fv(my)}) angle={angle}°{width_str}  "
            f"{door_type}/{door_status}  {rooms_str}"
        )

    print(f"  Doors layer: {len(doors)} doors placed.")
    return doors


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


def _extract_details_layer(
    parent: ET.Element,
    unit: float,
    tx: float,
    ty: float,
    all_areas: dict[str, list[tuple[float, float]]],
) -> list[dict]:
    """Parse decorative detail linework from a 'Details' sublayer.

    Each <path> becomes a polyline detail entry (open → stroke-only, closed →
    closed+filled per D-04); each <circle>/<ellipse>/sodipodi:arc element
    becomes a circle detail entry. Every entry's authored position (first
    vertex for polylines, center for circles) is probed against all_areas via
    _find_room_at — the containing room's id becomes `room:` (interior); no
    match means exterior (no `room:` key). Mirrors _extract_vents_layer's
    id-derivation, warn-and-skip, and print conventions.
    """
    paths = get_layer_paths(parent, "Details")
    details: list[dict] = []

    for i, path in enumerate(paths):
        label = get_ink_label(path) or ""
        detail_id = to_snake(label) if label else f"detail_{i + 1}"
        closed = path.get("d", "").rstrip().endswith(("Z", "z"))
        subpaths = parse_path_d(path.get("d", ""), label=f"detail {detail_id}")
        if not subpaths or len(subpaths[0]) < 2:
            print(
                f"  WARNING: detail path '{detail_id}' has <2 vertices — skipping.",
                file=sys.stderr,
            )
            continue
        grid_pts = verts_to_grid(_apply_translate(subpaths[0], tx, ty), unit)
        points = [[round(x * 4) / 4, round(y * 4) / 4] for x, y in grid_pts]

        room_id = _find_room_at(tuple(points[0]), all_areas)

        detail: dict = {"id": detail_id, "points": points}
        if room_id is not None:
            detail["room"] = room_id
        if closed:
            detail["closed"] = True
            detail["filled"] = True
        details.append(detail)
        print(
            f"  Detail '{detail_id}': {len(points)} points"
            f"{'  (closed, filled)' if closed else ''}"
            f"{f'  → room {room_id}' if room_id else '  (exterior)'}"
        )

    for j, elem in enumerate(_get_circle_shape_elements(parent, "Details")):
        label = get_ink_label(elem)
        detail_id = to_snake(label) if label else f"detail_{len(paths) + j + 1}"
        circle_data = _extract_circle_shape(
            elem, unit, tx, ty, ctx=f"circle detail in Details (id: {detail_id!r})"
        )
        if circle_data is None:
            continue
        room_id = _find_room_at((circle_data["cx"], circle_data["cy"]), all_areas)
        detail = {"id": detail_id, "circle": circle_data}
        if room_id is not None:
            detail["room"] = room_id
        details.append(detail)
        print(
            f"  Detail '{detail_id}' (circle): cx={fv(circle_data['cx'])} "
            f"cy={fv(circle_data['cy'])} r={fv(circle_data['r'])}"
            f"{f'  → room {room_id}' if room_id else '  (exterior)'}"
        )

    print(f"  Details layer: {len(details)} items.")
    return details


def _write_deckplan_yaml(
    location_dir: str,
    map_name: str,
    location_type: str,
    unit_size: int,
    hull_data: dict | None,
    decks_data: list[dict],
    detect_doors: bool,
) -> None:
    deckplan_path = os.path.join(location_dir, "deckplan.yaml")
    with open(deckplan_path, "w") as f:
        f.write(f"name: {map_name}\n")
        f.write(f"facility_type: {location_type}\n")
        f.write(f"total_decks: {len(decks_data)}\n")
        f.write(f"unit_size: {unit_size}\n")

        if hull_data:
            f.write("hull:\n")
            _write_hull_block(f, hull_data, indent="  ")

        f.write("decks:\n")
        for level, d in enumerate(decks_data, start=1):
            f.write(f"- id: {d['id']}\n")
            f.write(f"  name: {d['label']}\n")
            f.write(f"  level: {level}\n")
            f.write(f"  default: {'true' if level == 1 else 'false'}\n")
            f.write(f"  unit_size: {unit_size}\n")
            if d.get("hull"):
                f.write("  hull:\n")
                _write_hull_block(f, d["hull"], indent="    ")
            f.write("  rooms:\n")

            for room in d["rooms"]:
                f.write(f"  - id: {room['id']}\n")
                f.write(f"    name: {room['name']}\n")
                if room.get("circle"):
                    c = room["circle"]
                    f.write(
                        f"    circle: {{cx: {fv(c['cx'])}, cy: {fv(c['cy'])}, "
                        f"r: {fv(c['r'])}}}\n"
                    )
                else:
                    f.write("    polygon:\n")
                    for x, y in room["polygon"]:
                        f.write(f"    - [{fv(x)}, {fv(y)}]\n")
                    if room.get("holes"):
                        f.write("    holes:\n")
                        for hole in room["holes"]:
                            for j, (x, y) in enumerate(hole):
                                if j == 0:
                                    f.write(f"    - - [{fv(x)}, {fv(y)}]\n")
                                else:
                                    f.write(f"      - [{fv(x)}, {fv(y)}]\n")
                f.write('    # description: ""\n')
                f.write('    # type: ""\n')

            for corr in d["corridors"]:
                f.write(f"  - id: {corr['id']}\n")
                f.write("    name: ''\n")
                if corr.get("circle"):
                    c = corr["circle"]
                    f.write(
                        f"    circle: {{cx: {fv(c['cx'])}, cy: {fv(c['cy'])}, "
                        f"r: {fv(c['r'])}}}\n"
                    )
                else:
                    f.write("    polygon:\n")
                    for x, y in corr["polygon"]:
                        f.write(f"    - [{fv(x)}, {fv(y)}]\n")
                f.write("    type: corridor\n")

            doors = d["doors"]
            has_door_source = detect_doors or d.get("doors_from_layer", False)
            if doors:
                f.write("  doors:\n")
                for door in doors:
                    rooms = door.get("rooms", [])
                    rooms_str = f"[{', '.join(str(r) for r in rooms)}]" if rooms else "[]"
                    width_str = (
                        f", width: {fv(door['width'])}" if door.get("width") else ""
                    )
                    if "along" in door:
                        f.write(
                            f"  - {{rooms: {rooms_str}, along: {door['along']},"
                            f" type: {door['type']}, status: {door['status']}{width_str}}}\n"
                        )
                    else:
                        p = door["position"]
                        f.write(
                            f"  - {{rooms: {rooms_str},"
                            f" position: {{x: {fv(p['x'])}, y: {fv(p['y'])}, angle: {p['angle']}}},"
                            f" type: {door['type']}, status: {door['status']}{width_str}}}\n"
                        )
            elif has_door_source:
                f.write("  # doors: []\n")

            vents = d.get("vents", [])
            if vents:
                f.write("  vents:\n")
                for vent in vents:
                    pts = ", ".join(f"[{fv(x)}, {fv(y)}]" for x, y in vent["points"])
                    label_str = f'\n    label: "{vent["label"]}"' if vent.get("label") else ""
                    f.write(f"  - id: {vent['id']}{label_str}\n")
                    f.write(f"    points: [{pts}]\n")

    print(f"Written: {deckplan_path}")


# ── Main conversion ──────────────────────────────────────────────────────────

def convert(
    svg_path: str,
    location_dir: str,
    deck_id: str,
    map_name: str,
    location_type: str,
    unit_size: int,
    grid_scale: int,
    detect_doors: bool,
) -> None:
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Grid unit — use major grid (spacingx × empspacing) when empspacing is set
    raw_unit: float | None = None
    for g in root.iter(f"{{{INK}}}grid"):
        s = g.get("spacingx")
        if s:
            raw_unit = float(s)
            emp = g.get("empspacing")
            if emp and int(emp) > 1:
                raw_unit *= int(emp)
                print(f"Major grid: spacingx={float(s)} × empspacing={emp} = {raw_unit} px/cell")
            break
    if raw_unit is None:
        sys.exit("ERROR: No inkscape:grid element found — cannot determine grid unit.")
    unit = raw_unit * grid_scale
    if grid_scale == 1:
        print(f"Grid unit: {raw_unit:.7f} px/cell")
    else:
        print(f"Grid unit: {raw_unit:.7f} px/cell  ×  grid-scale {grid_scale}  =  {unit:.7f} px/output-cell")

    # Hull
    hull_data = _extract_hull_layer(root, unit)
    if hull_data:
        msg = (
            f"Hull: {sum(len(p) for p in hull_data['polygons'])} vertices across "
            f"{len(hull_data['polygons'])} polygon(s)"
        )
        if hull_data["holes"]:
            msg += f", {len(hull_data['holes'])} hole(s)"
        print(msg)
    else:
        print("Hull: (none)")

    # Detect multi-deck vs single-deck
    deck_groups = find_deck_groups(root)

    if deck_groups:
        print(f"\nMulti-deck mode: {len(deck_groups)} decks found.\n")
        decks_data = []
        for deck_label, deck_elem in deck_groups:
            deck_id_local = to_snake(deck_label)
            print(f"[{deck_label}]")
            rooms, corridors = _extract_areas(deck_elem, unit)
            all_areas = {
                r["id"]: r["polygon"] for r in rooms + corridors if "polygon" in r
            }
            dtx, dty = _parse_translate(deck_elem)
            manual_doors = _extract_doors_layer(deck_elem, unit, dtx, dty, all_areas)
            doors_from_layer = bool(manual_doors)
            if manual_doors:
                doors = manual_doors
            elif detect_doors:
                doors = _build_doors(rooms, corridors)
                print(f"  Door detection: {len(doors)} doors emitted.")
            else:
                doors = []
            vents = _extract_vents_layer(deck_elem, unit, dtx, dty)
            details = _extract_details_layer(deck_elem, unit, dtx, dty, all_areas)
            deck_hull_data = _extract_hull_layer(deck_elem, unit)
            if deck_hull_data:
                print(
                    f"  Hull (per-deck): {sum(len(p) for p in deck_hull_data['polygons'])} "
                    f"vertices across {len(deck_hull_data['polygons'])} polygon(s)"
                )
            decks_data.append(
                {
                    "id": deck_id_local,
                    "label": deck_label,
                    "rooms": rooms,
                    "corridors": corridors,
                    "doors": doors,
                    "doors_from_layer": doors_from_layer,
                    "vents": vents,
                    "details": details,
                    "hull": deck_hull_data,
                }
            )
            print()
    else:
        print("\nSingle-deck mode.")
        rooms, corridors = _extract_areas(root, unit)
        all_areas = {
            r["id"]: r["polygon"] for r in rooms + corridors if "polygon" in r
        }
        manual_doors = _extract_doors_layer(root, unit, 0.0, 0.0, all_areas)
        doors_from_layer = bool(manual_doors)
        if manual_doors:
            doors = manual_doors
        elif detect_doors:
            doors = _build_doors(rooms, corridors)
            print(f"\nDoor detection complete: {len(doors)} doors emitted.")
        else:
            doors = []
        vents = _extract_vents_layer(root, unit, 0.0, 0.0)
        decks_data = [
            {
                "id": deck_id,
                "label": "Main Deck",
                "rooms": rooms,
                "corridors": corridors,
                "doors": doors,
                "doors_from_layer": doors_from_layer,
                "vents": vents,
            }
        ]

    # Write output
    os.makedirs(location_dir, exist_ok=True)

    ensure_location_yaml(location_dir, map_name, location_type)

    _write_deckplan_yaml(
        location_dir, map_name, location_type, unit_size, hull_data, decks_data, detect_doors
    )


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Convert Inkscape SVG map to YAML encounter map format."
    )
    ap.add_argument("svg", help="Input SVG file path")
    ap.add_argument(
        "--out-dir",
        metavar="DIR",
        help="Location directory (default: <svg_dir>/<stem>_out/); map files go to <DIR>/map/",
    )
    ap.add_argument(
        "--deck",
        default="main_deck",
        metavar="NAME",
        help="Deck YAML filename stem for single-deck mode (default: main_deck); ignored in multi-deck mode",
    )
    ap.add_argument(
        "--name",
        metavar="NAME",
        help="Map/location name (default: derived from SVG filename)",
    )
    ap.add_argument(
        "--type",
        default="ship",
        metavar="TYPE",
        help="Location type for stub location.yaml (default: ship)",
    )
    ap.add_argument(
        "--unit-size",
        default=30,
        type=int,
        metavar="N",
        help="Pixels per grid cell in deck YAML (default: 30)",
    )
    ap.add_argument(
        "--grid-scale",
        default=1,
        type=int,
        metavar="N",
        help="Group N Inkscape cells into 1 output cell (default: 1); use when rooms have too many cells",
    )
    ap.add_argument(
        "--no-detect-doors",
        action="store_true",
        help="Skip door detection (default: doors are always detected from shared edges)",
    )
    args = ap.parse_args()

    svg_path = os.path.abspath(args.svg)
    if not os.path.exists(svg_path):
        sys.exit(f"ERROR: File not found: {svg_path}")

    stem = os.path.splitext(os.path.basename(svg_path))[0]
    map_name = args.name or stem.replace("_", " ").replace("-", " ").title()
    location_dir = args.out_dir or os.path.join(os.path.dirname(svg_path), f"{stem}_out")

    print(f"Converting:    {svg_path}")
    print(f"Map name:      {map_name}")
    print(f"Location dir:  {location_dir}")
    print(f"Unit size:     {args.unit_size} px/cell")
    print(f"Grid scale:    {args.grid_scale}\n")

    convert(svg_path, location_dir, args.deck, map_name, args.type, args.unit_size, args.grid_scale, not args.no_detect_doors)
    print("\nDone.")


if __name__ == "__main__":
    main()
