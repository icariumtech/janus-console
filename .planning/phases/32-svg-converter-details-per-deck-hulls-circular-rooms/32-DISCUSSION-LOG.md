# Phase 32: SVG Converter — Details, Per-Deck Hulls, Circular Rooms - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 32-svg-converter-details-per-deck-hulls-circular-rooms
**Areas discussed:** Hull layer placement, Hull holes, Detail-room association, Detail closed/filled/circle authoring, Non-circular ellipse handling

---

## Hull layer

| Option | Description | Selected |
|--------|-------------|----------|
| Nested per-deck, additive with top-level | New "Hull" sublayer inside each deck's group; root-level "Hull" layer keeps meaning the shared/location hull. Matches Phase 31's additive semantics (D-02). | ✓ |
| Per-deck Hull layer replaces the root one | Drop the root-level Hull convention; every deck must define its own. Breaks backward compatibility, loses the "shared silhouette" concept. | |

**User's choice:** Nested per-deck, additive with top-level (Claude's recommendation).
**Notes:** Grounded in Phase 31's D-02 additive-merge design — the converter's two-layer split is the authoring-side mirror of the renderer's `mergeHulls(shared, deck)`.

---

## Hull holes

| Option | Description | Selected |
|--------|-------------|----------|
| Support holes now | Mirror room-extraction's largest-subpath-outer / remaining-subpaths-holes pattern for Hull layers too. | ✓ |
| Defer holes — polygons only | Emit only the multi-polygon list per HULL-03's literal wording; hand-author holes if needed. | |

**User's choice:** Support holes now (Claude's recommendation).
**Notes:** Phase 31's renderer/schema already support hull holes; leaving the converter unable to emit them would be a visible, easily-hit gap.

---

## Detail-room link

| Option | Description | Selected |
|--------|-------------|----------|
| Geometric containment | Detail's position tested against each room's polygon automatically; containing room gets the `room:` ref. Mirrors existing door-to-room adjacency probing. | ✓ |
| Explicit sub-grouping by room name | Artist nests detail shapes inside a room-named sub-group. Unambiguous for overlapping details, but requires manual layer organization. | |

**User's choice:** Geometric containment (Claude's recommendation).
**Notes:** No new authoring convention for the artist to learn; reuses the existing `_find_room_at`-style pattern already in the codebase for doors.

---

## Detail shapes

| Option | Description | Selected |
|--------|-------------|----------|
| Path Z-close → closed, raw <circle>/<ellipse> → circle detail | Closed subpath (ends in Z) maps to `closed: true` and `filled: true` by default (matches D-11's faint-fill intent). Literal circle/ellipse elements become `circle:` entries. | ✓ |
| Closed defaults to stroke-only; filled needs a label suffix | Same Z-close → `closed: true`, but `filled: true` only fires on an explicit label marker. | |

**User's choice:** Path Z-close → closed, raw <circle>/<ellipse> → circle detail (Claude's recommendation).
**Notes:** No extra authoring step needed; matches Phase 31's D-11 default treatment for closed shapes.

---

## Ellipse room

| Option | Description | Selected |
|--------|-------------|----------|
| Average rx/ry into r, warn if they differ | `r = (rx + ry) / 2`, shape still converts with a stderr warning. | |
| Reject non-circular ellipses, warn and skip | Only accept `<circle>` or `rx == ry` ellipses; anything else skipped with a warning, matching the existing curve-command rejection pattern. | ✓ |

**User's choice:** Reject non-circular ellipses, warn and skip (overrode Claude's recommendation).
**Notes:** `GridRoom.circle` only supports a true single-radius circle — silently approximating an intentionally-drawn ellipse would produce a visibly wrong room shape with no error surfaced anywhere. Better to force the artist to fix the shape in Inkscape than silently distort geometry.

---

## Claude's Discretion

- Exact stderr warning message wording for new rejection/skip cases — follow the file's existing per-item message style.
- Whether an unlabeled detail's `id:` is auto-generated (`detail_1`, ...) or left unset — Phase 31 already made `id:` optional on `DetailEntry`.
- Whether the `# description: ""` / `# type: ""` commented-placeholder convention (currently on rooms) also applies to hull/detail entries.
- Tie-breaking rule when a detail's position lands exactly on a room boundary during containment testing.

## Deferred Ideas

- New CLI flags for per-deck Hull/Details control — not raised; existing auto-detect-everything philosophy extends naturally.
- Non-circular ellipse auto-approximation — considered and explicitly rejected (see Ellipse room above); worth revisiting only if real-world SVG authoring shows frequent near-circular-but-not-exact ellipses.
- Editor-side (GM Console) authoring UI for per-deck hulls/details — Phase 29/30 territory, out of scope for this converter-only phase.
