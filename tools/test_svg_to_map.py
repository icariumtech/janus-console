"""
test_svg_to_map.py — stdlib unittest coverage for tools/svg_to_map.py.

Run: python -m unittest tools.test_svg_to_map -v
(NOT `python manage.py test` — tools/ is not a Django app.)
"""

import contextlib
import io
import os
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import svg_to_map

SVG_NS = "http://www.w3.org/2000/svg"
INK_NS = "http://www.inkscape.org/namespaces/inkscape"
SODIPODI_NS = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"


def _svg(body: str) -> str:
    """Wrap a fragment of layer groups in a minimal but complete SVG document
    with an inkscape:grid (spacingx=30) and the namespaces the converter
    expects."""
    return (
        f'<svg xmlns="{SVG_NS}" xmlns:inkscape="{INK_NS}" '
        f'xmlns:sodipodi="{SODIPODI_NS}">\n'
        f'  <inkscape:grid spacingx="30"/>\n'
        f"{body}\n"
        f"</svg>\n"
    )


class CircleRoomTests(unittest.TestCase):
    def test_literal_circle_in_rooms_layer(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <circle cx="150" cy="90" r="45"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        self.assertEqual(len(rooms), 1)
        self.assertEqual(rooms[0]["circle"], {"cx": 5, "cy": 3, "r": 1.5})

    def test_literal_circle_pipeline_end_to_end(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <circle cx="150" cy="90" r="45"/>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()
        self.assertIn("circle:", written_text)
        self.assertIn("cx: 5", written_text)

    def test_circle_and_rect_rooms_door_detection_no_crash(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <circle cx="150" cy="90" r="45"/>
    <path inkscape:label="Bridge" d="M 195,60 L 285,60 L 285,120 L 195,120 Z"/>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            # detect_doors=True matches the CLI default (auto door-detection).
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()

        self.assertIn("circle:", written_text)
        self.assertIn("BRIDGE", written_text)
        if "doors:" in written_text:
            doors_section = written_text.split("doors:", 1)[1]
            self.assertNotIn("circle_room", doors_section)

    def test_sodipodi_arc_circle_in_rooms_layer(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path sodipodi:type="arc" sodipodi:cx="150" sodipodi:cy="90"
          sodipodi:rx="45" sodipodi:ry="45"
          d="M 195,90 A 45,45 0 1 1 105,90 A 45,45 0 1 1 195,90 Z"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        self.assertEqual(len(rooms), 1)
        self.assertEqual(rooms[0]["circle"], {"cx": 5, "cy": 3, "r": 1.5})

    def test_noncircular_ellipse_rejected(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <ellipse cx="150" cy="90" rx="60" ry="30"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        self.assertEqual(len(rooms), 0)
        self.assertIn("not circular", stderr.getvalue())

    def test_sodipodi_arc_noncircular_rejected(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path sodipodi:type="arc" sodipodi:cx="150" sodipodi:cy="90"
          sodipodi:rx="60" sodipodi:ry="30"
          d="M 210,90 A 60,30 0 1 1 90,90 A 60,30 0 1 1 210,90 Z"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        self.assertEqual(len(rooms), 0)
        self.assertIn("not circular", stderr.getvalue())

    def test_circle_in_corridors_layer(self):
        svg = _svg(
            """
  <g inkscape:label="Corridors">
    <circle cx="90" cy="60" r="30"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        self.assertEqual(len(corridors), 1)
        self.assertEqual(corridors[0]["circle"], {"cx": 3, "cy": 2, "r": 1.0})


class HullTests(unittest.TestCase):
    def test_root_hull_multi_path_with_hole(self):
        # Path A: compound path — outer subpath + one hole subpath.
        # Path B: simple single-subpath outer shape.
        svg = _svg(
            """
  <g inkscape:label="Hull">
    <path d="M 0,0 L 300,0 L 300,300 L 0,300 Z
             M 100,100 L 200,100 L 200,200 L 100,200 Z"/>
    <path d="M 400,0 L 600,0 L 600,150 L 400,150 Z"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        result = svg_to_map._extract_hull_layer(root, unit=30.0)
        self.assertIsNotNone(result)
        self.assertEqual(len(result["polygons"]), 2)
        self.assertEqual(len(result["holes"]), 1)

    def test_root_hull_no_layer_returns_none(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path inkscape:label="Bridge" d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        result = svg_to_map._extract_hull_layer(root, unit=30.0)
        self.assertIsNone(result)

    def test_root_hull_regression_ship_template(self):
        # NOTE: both real fixture SVGs ship a placeholder "DELETE ME" <rect>
        # (not a <path>) in their Hull layer — get_layer_paths only matches
        # <path> tags, so hull_paths is empty and pre-refactor behavior emits
        # NO hull: key at all ("Hull: (none)" on stdout). This is the true
        # pre-refactor output (verified against the unmodified code before
        # this task's edits) — the byte-identical regression bar for these
        # two specific files is "still no hull: key, never a polygons: key",
        # not "compact polygon: form" as originally assumed.
        tools_dir = os.path.dirname(os.path.abspath(__file__))
        for fixture in ("ship_template.svg", "ship_template_multideck.svg"):
            svg_path = os.path.join(tools_dir, fixture)
            with tempfile.TemporaryDirectory() as tmp:
                out_dir = os.path.join(tmp, "out")
                svg_to_map.convert(
                    svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
                )
                with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                    written_text = f.read()
            self.assertNotIn("hull:", written_text, msg=f"fixture: {fixture}")
            self.assertNotIn("polygons:", written_text, msg=f"fixture: {fixture}")

    def test_root_hull_single_path_compact_form(self):
        # Controlled fixture (real repo fixtures have no actual Hull <path>,
        # see test_root_hull_regression_ship_template) proving the
        # single-path/no-holes case still emits the pre-refactor compact
        # `polygon:` list form, byte-identical to the old inline
        # `if hull_poly: f.write("hull:\n  polygon:\n")` code.
        svg = _svg(
            """
  <g inkscape:label="Hull">
    <path d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
  </g>
  <g inkscape:label="Rooms">
    <path inkscape:label="Bridge" d="M 30,30 L 90,30 L 90,90 L 30,90 Z"/>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()
        self.assertIn("hull:\n  polygon:\n", written_text)
        self.assertNotIn("polygons:", written_text)
        self.assertNotIn("holes:", written_text.split("decks:")[0])

    def test_per_deck_hull_multi_polygon(self):
        svg = _svg(
            """
  <g inkscape:label="Main Deck">
    <g inkscape:label="Rooms">
      <path inkscape:label="Bridge" d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
    </g>
    <g inkscape:label="Hull">
      <path d="M 0,0 L 90,0 L 90,90 L 0,90 Z"/>
      <path d="M 200,0 L 290,0 L 290,90 L 200,90 Z"/>
    </g>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()

        # Per-deck hull block should be nested under the deck (indented under
        # decks:, not at document top-level) and contain polygons: (plural).
        self.assertIn("  hull:\n", written_text)
        deck_hull_idx = written_text.index("  hull:\n")
        after = written_text[deck_hull_idx:]
        self.assertIn("polygons:", after.split("\n\n")[0] if "\n\n" in after else after)

    def test_single_deck_mode_no_per_deck_hull(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path inkscape:label="Bridge" d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()

        # No per-deck hull key anywhere under decks: (no root Hull layer in
        # this fixture, so no hull: at all should be present).
        self.assertNotIn("hull:", written_text)


class DetailsTests(unittest.TestCase):
    def test_open_polyline_exterior(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path inkscape:label="Bridge" d="M 0,0 L 90,0 L 90,90 L 0,90 Z"/>
  </g>
  <g inkscape:label="Details">
    <path d="M 500,500 L 560,500"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        all_areas = {r["id"]: r["polygon"] for r in rooms + corridors if "polygon" in r}
        details = svg_to_map._extract_details_layer(root, unit=30.0, tx=0.0, ty=0.0, all_areas=all_areas)
        self.assertEqual(len(details), 1)
        entry = details[0]
        self.assertIn("points", entry)
        self.assertNotIn("room", entry)
        self.assertNotIn("closed", entry)
        self.assertNotIn("filled", entry)

    def test_closed_polyline_interior_filled(self):
        svg = _svg(
            """
  <g inkscape:label="Rooms">
    <path inkscape:label="Bridge" d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
  </g>
  <g inkscape:label="Details">
    <path d="M 30,30 L 90,30 L 90,90 L 30,90 Z"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        rooms, corridors = svg_to_map._extract_areas(root, unit=30.0)
        all_areas = {r["id"]: r["polygon"] for r in rooms + corridors if "polygon" in r}
        details = svg_to_map._extract_details_layer(root, unit=30.0, tx=0.0, ty=0.0, all_areas=all_areas)
        self.assertEqual(len(details), 1)
        entry = details[0]
        self.assertTrue(entry["closed"])
        self.assertTrue(entry["filled"])
        self.assertEqual(entry["room"], "bridge")

    def test_circle_detail(self):
        svg = _svg(
            """
  <g inkscape:label="Details">
    <circle cx="150" cy="90" r="15"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        details = svg_to_map._extract_details_layer(root, unit=30.0, tx=0.0, ty=0.0, all_areas={})
        self.assertEqual(len(details), 1)
        entry = details[0]
        self.assertEqual(entry["circle"], {"cx": 5, "cy": 3, "r": 0.5})
        self.assertNotIn("points", entry)

    def test_detail_id_autogenerated(self):
        svg = _svg(
            """
  <g inkscape:label="Details">
    <path d="M 0,0 L 60,0"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        details = svg_to_map._extract_details_layer(root, unit=30.0, tx=0.0, ty=0.0, all_areas={})
        self.assertEqual(len(details), 1)
        self.assertEqual(details[0]["id"], "detail_1")

    def test_detail_2_vertex_minimum(self):
        svg = _svg(
            """
  <g inkscape:label="Details">
    <path d="M 0,0"/>
  </g>
"""
        )
        root = ET.fromstring(svg)
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            details = svg_to_map._extract_details_layer(root, unit=30.0, tx=0.0, ty=0.0, all_areas={})
        self.assertEqual(details, [])
        self.assertIn("vertices", stderr.getvalue())

    def test_full_fixture_details_end_to_end(self):
        svg = _svg(
            """
  <g inkscape:label="Main Deck">
    <g inkscape:label="Rooms">
      <path inkscape:label="Bridge" d="M 0,0 L 300,0 L 300,300 L 0,300 Z"/>
    </g>
    <g inkscape:label="Details">
      <path d="M 500,500 L 560,500"/>
      <path d="M 30,30 L 90,30 L 90,90 L 30,90 Z"/>
      <circle cx="60" cy="60" r="15"/>
    </g>
  </g>
"""
        )
        with tempfile.TemporaryDirectory() as tmp:
            svg_path = os.path.join(tmp, "fixture.svg")
            with open(svg_path, "w") as f:
                f.write(svg)
            out_dir = os.path.join(tmp, "out")
            svg_to_map.convert(
                svg_path, out_dir, "main_deck", "Fixture", "ship", 30, 1, True
            )
            with open(os.path.join(out_dir, "deckplan.yaml")) as f:
                written_text = f.read()

        self.assertIn("details:\n", written_text)
        details_block = written_text[written_text.index("details:\n"):]
        entries = details_block.split("  - id: ")[1:]
        self.assertEqual(len(entries), 3)

        exterior_entry = next(e for e in entries if "points:" in e and "room:" not in e)
        self.assertNotIn("room:", exterior_entry)

        interior_entry = next(e for e in entries if "room:" in e)
        self.assertIn("closed: true", interior_entry)
        self.assertIn("filled: true", interior_entry)

        circle_entry = next(e for e in entries if "circle:" in e)
        self.assertNotIn("points:", circle_entry)


if __name__ == "__main__":
    unittest.main()
