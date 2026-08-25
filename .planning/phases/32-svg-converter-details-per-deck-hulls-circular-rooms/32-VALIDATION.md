---
phase: 32
slug: svg-converter-details-per-deck-hulls-circular-rooms
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | stdlib `unittest` (pytest not installed; existing `core/tests/*.py` use `django.test.TestCase`/`unittest.TestCase`) |
| **Config file** | none — no `pytest.ini`/`pyproject.toml` test config in repo root |
| **Quick run command** | `python -m unittest tools.test_svg_to_map -v` (new file — Wave 0) |
| **Full suite command** | `python -m unittest discover -s tools -p "test_*.py"` |
| **Estimated runtime** | ~2 seconds |

**Note:** `tools/svg_to_map.py` is a standalone CLI script, not a Django app — `python manage.py test` will **not** discover `tools/test_svg_to_map.py` (Django's test runner only walks `INSTALLED_APPS`). Use plain `python -m unittest`, independent of the Django test suite.

---

## Sampling Rate

- **After every task commit:** Run `python -m unittest tools.test_svg_to_map -v`
- **After every plan wave:** Same command, plus a manual `python tools/svg_to_map.py <fixture.svg> --out-dir /tmp/svgtest` smoke run to eyeball printed summary output
- **Before `/gsd-verify-work`:** Full suite must be green; also re-run against `tools/ship_template.svg`/`tools/ship_template_multideck.svg` (existing fixtures, no Hull/Details/circle content) to confirm **zero output change** for pre-existing SVGs — regression-safety check for the `hull_poly` type refactor
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 0 | DET-02/HULL-03/CIRC-01 | — | N/A | scaffold | `python -m unittest tools.test_svg_to_map -v` | ❌ W0 | ⬜ pending |
| 32-0X-0X | TBD | TBD | HULL-03 | — | warn-and-skip on malformed hull path | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.HullTests -v` | ❌ W0 | ⬜ pending |
| 32-0X-0X | TBD | TBD | DET-02 | — | warn-and-skip on malformed detail shape | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.DetailsTests -v` | ❌ W0 | ⬜ pending |
| 32-0X-0X | TBD | TBD | CIRC-01 | — | warn-and-skip on non-circular ellipse (D-06) | unit + fixture-SVG integration | `python -m unittest tools.test_svg_to_map.CircleRoomTests -v` | ❌ W0 | ⬜ pending |
| 32-0X-0X | TBD | TBD | (schema doc) | — | N/A | manual/doc review | N/A — verify updated `docs/schemas/schema-encounters.md` against emitted YAML | ❌ W0 (doc) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Planner fills in exact Task ID/Plan/Wave when tasks are broken down.*

---

## Wave 0 Requirements

- [ ] `tools/test_svg_to_map.py` — stdlib `unittest` test file (no Django dependency) covering: closed/open (`Z`) detection helper (new), `_extract_hull_layer` (multi-polygon + holes), `_extract_details_layer` (room association via `_find_room_at` + closed/exterior), circle/ellipse detection (both literal `<circle>`/`<ellipse>` elements and `sodipodi:type="arc"` paths per Open Question 2)
- [ ] Fixture SVG content (inline strings in the test file or a new small `.svg` fixture) exercising: a multi-path Hull layer with one path having a hole, a Details layer with one open polyline + one closed polyline + one circle, and a Rooms layer with a `<circle>` and a `<path sodipodi:type="arc">` — none of the existing `tools/*.svg` fixtures contain this content
- [ ] Framework install: none — `unittest` is stdlib

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Inkscape ellipse/circle authoring produces detectable output | CIRC-01 | Open Question 2 — whether Inkscape emits literal `<circle>`/`<ellipse>` or `sodipodi:type="arc"` paths cannot be resolved from the repo alone; needs a live Inkscape check | Draw a circle in Inkscape, save, inspect the raw SVG for `<circle>`/`<ellipse>` vs `<path sodipodi:type="arc">`; confirm the converter's detection covers whichever form is produced |
| Converted deckplan.yaml renders correctly in the existing renderer | HULL-03, CIRC-01 | Visual correctness (hull shape, circle room shape) is not mechanically checkable from YAML alone | Convert a fixture SVG, load the resulting `deckplan.yaml` in the GM console map view, visually confirm hull/circle geometry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
