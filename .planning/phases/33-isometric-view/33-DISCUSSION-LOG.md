# Phase 33: Isometric View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 33-isometric-view
**Areas discussed:** Isometric visual style, Toggle placement & control, Token/label readability in iso, Interaction with per-ship authored rotation

---

## Isometric visual style

| Option | Description | Selected |
|--------|-------------|----------|
| True isometric (30°, root-3 ratio) | Classic architectural/blueprint isometric — all three axes foreshortened equally. Matches the "blueprint-grade" aesthetic already established for hull/detail linework (Phase 31). | ✓ |
| "2:1" dimetric (26.57°, game-style) | The XCOM/SimCity/RollerCoaster Tycoon look — 2 pixels across for every 1 down, cheap to pixel-align, very recognizable as "tactical game grid." | |
| Flat 45° diamond (no vertical foreshortening) | Simplest transform — just rotates the grid 45° into a diamond, no separate vertical scale. Reads more like a rotated top-down than a true 3D-ish view. | |

**User's choice:** True isometric (30°)
**Notes:** User asked which option would be easier for still being able to select rooms/tokens. Clarified that both true isometric and 2:1 dimetric are equally exact for hit-testing (both are affine transforms with an exact `unproject()` inverse already required by the `Projection` interface) — the difference is purely aesthetic. Recommended true isometric for consistency with the "blueprint-grade" language from Phase 31. User agreed.

| Option | Description | Selected |
|--------|-------------|----------|
| Flat re-projection only | Walls/hulls/details render exactly as today, just through the new projection — no new geometry or shading code needed. Matches D-10's fixed-style philosophy (Phase 31). | ✓ |
| Add wall-height extrusion/shading | Walls get a drawn vertical face (shaded polygon) to sell a 3D look. Bigger scope — new geometry per wall segment. | |

**User's choice:** Flat re-projection only
**Notes:** None.

---

## Toggle placement & control

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-left overlay slot | Reuses the existing overlay grid's empty slot — same button styling as RESET VIEW, no new layout work. | ✓ |
| Next to RESET VIEW (top-left) | Groups both view-control buttons together in one corner. | |
| Something else | Freeform. | |

**User's choice:** Bottom-left overlay slot
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Button only | No existing encounter-map control has a keyboard shortcut today — stays consistent, avoids conflicts on mobile/tablet. | ✓ |
| Add a keyboard shortcut | Faster for GM at the table on a laptop/desktop. | |

**User's choice:** Button only
**Notes:** None.

---

## Token/label readability in iso

| Option | Description | Selected |
|--------|-------------|----------|
| Stay upright/billboarded | Text and icons render at their projected position but keep normal orientation. Only wall/hull/detail linework follows the iso transform. | ✓ |
| Tilt with the iso plane | Everything, including text/icons, renders through the same skewed transform. | |

**User's choice:** Stay upright/billboarded
**Notes:** None.

---

## Interaction with per-ship authored rotation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, keep applying it | mapRotation is authoring metadata orthogonal to which projection is active — same reasoning applies in iso as in top-down. | ✓ |
| Ignore mapRotation when iso is active | Isometric view always shows the ship in its "natural" grid orientation. | |
| Not sure / let Claude decide during planning | Small enough detail to defer to planner with a sensible default. | |

**User's choice:** Yes, keep applying it
**Notes:** None.

---

## Claude's Discretion

- Exact `isoProjection` parameter shape/defaults (`tilt`, `rotation` values) beyond "30° true isometric."
- Whether `mapRotation`'s SVG `rotate()` transform composes cleanly with the iso-skewed coordinate space, or needs adjustment.
- Whether other call sites beyond tokens/vents bypass `view` and need the same `view.project()` migration.

## Deferred Ideas

None — discussion stayed within phase scope.
