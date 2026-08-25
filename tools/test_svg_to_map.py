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


if __name__ == "__main__":
    unittest.main()
