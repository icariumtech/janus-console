---
phase: 32-svg-converter-details-per-deck-hulls-circular-rooms
fixed_at: 2026-08-25T15:35:03Z
review_path: .planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-08-25T15:35:03Z
**Source review:** .planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical, 6 Warning — `fix_scope: critical_warning`; IN-01 excluded by scope)
- Fixed: 9
- Skipped: 0

**Note on ordering:** CR-02 was fixed before CR-01, deviating from document order, because CR-01's
own suggested fix explicitly depends on CR-02's corrected `_unique_id()` helper ("Reuse the
existing `_unique_id()` helper (fixing CR-02 first)"). All other findings were applied in document
order (CR-03, WR-01 → WR-06).

## Fixed Issues

### CR-02: `_unique_id()` tracks previously-seen base labels, not previously-emitted ids

**Files modified:** `tools/svg_to_map.py`
**Commit:** `2423103`
**Applied fix:** Rewrote `_unique_id()` to loop-bump the numeric suffix until the candidate id is
absent from `seen` (which now also records every id actually emitted, not just base labels
requested), matching the reviewer's suggested implementation exactly. Verified the review's own
repro (`coolant_tanks_2`, `coolant_tanks`, `coolant_tanks` again) no longer produces a duplicate —
the third call now returns `coolant_tanks_3` instead of colliding with the first call's
`coolant_tanks_2`.

### CR-01: Duplicate deck `id`s when two deck layer labels collide

**Files modified:** `tools/svg_to_map.py`
**Commit:** `9e455b1`
**Applied fix:** Added a `seen_deck_ids` dict in the multi-deck branch of `convert()` and routed
`deck_id_local` through the now-fixed `_unique_id()`. Verified end-to-end with two top-level
layers both labeled "Main Deck": output now emits `id: main_deck` and `id: main_deck_2` instead of
two `id: main_deck` entries.

### CR-03: `Details` layer silently drops subpaths after the first, mis-reports `closed`

**Files modified:** `tools/svg_to_map.py`
**Commit:** `124ecab`
**Applied fix:** Added a `_first_subpath_closed()` helper that inspects only the first subpath's
own source text (splitting on the second `M`/`m` occurrence) instead of string-sniffing the whole
`d` attribute's tail. Added a stderr warning when `parse_path_d()` returns more than one subpath
for a Details path (data loss is now diagnosed, matching reviewer's option (a)). Verified with the
review's exact repro `d` string (closed square + separate open line): the tool now prints
`WARNING: detail path 'console' has 2 disconnected subpaths — only the first is used...` and
correctly emits `closed: true, filled: true` for the square (previously it silently dropped the
warning and the closed/filled flags were unset due to the trailing open subpath).

### WR-01: `Details` entries have no id-uniqueness enforcement

**Files modified:** `tools/svg_to_map.py`
**Commit:** `68c2085`
**Applied fix:** Threaded a `seen_ids: dict[str, int]` through `_extract_details_layer()` and
routed both the path-detail and circle-detail id computations through `_unique_id()`, mirroring
`_extract_areas()`. Verified two `<path inkscape:label="Console">` elements now emit
`id: console` and `id: console_2` instead of two `id: console` entries.

### WR-02: `to_snake()` can produce an empty string, yielding an invalid `id:` field

**Files modified:** `tools/svg_to_map.py`
**Commit:** `fac2e11`
**Applied fix:** Applied the reviewer's fallback chain (`to_snake(label) or to_snake(elem.get("id",
"")) or f"<placeholder>_{i+1}"`) at every consumer site: rooms (path + circle variants),
corridors (path + circle variants), vents, both Details loops, and the deck-id computation
(enumerated `deck_groups` to get an index for the placeholder). This is broader than the four
lines explicitly cited in the finding's **File:** line, but matches the Issue text, which names
"corridors, deck labels, details, vents" as affected, and additionally covers the circle-shape
variants of rooms/corridors which have the identical latent bug pattern. Verified with symbol-only
labels (`"???"`, `"..."`) on a room and a corridor: output now falls back to the SVG element's own
`id` attribute (`path123`, `corr456`) instead of emitting a bare `id:`. Verified a deck with no
usable label or SVG id falls back to `deck_1` instead of an empty id.

### WR-03: `--grid-scale 0` (or negative) crashes with `ZeroDivisionError`

**Files modified:** `tools/svg_to_map.py`
**Commit:** `5092857`
**Applied fix:** Added a validation check immediately after `args = ap.parse_args()`:
`if args.grid_scale < 1: sys.exit(...)`. Verified `--grid-scale 0` now prints
`ERROR: --grid-scale must be >= 1 (got 0).` and exits 1 instead of raising an unhandled
`ZeroDivisionError` traceback.

### WR-04: Module docstring says rounding is "to the nearest 0.5 grid cell"; actual is 0.25

**Files modified:** `tools/svg_to_map.py`
**Commit:** `8de5dc3`
**Applied fix:** Updated the docstring line to read "Output values are rounded to the nearest
0.25 grid cell," matching `to_grid()`'s actual `round(px / unit * 4) / 4` behavior.

### WR-05: Module docstring doesn't document three of this phase's own features

**Files modified:** `tools/svg_to_map.py`
**Commit:** `b1368de`
**Applied fix:** Added a per-deck `Hull` line and a `Details` line to the multi-deck SVG layer
convention block; added a one-line circle/ellipse/`sodipodi:type="arc"` shape-support note to both
the single-deck and multi-deck convention blocks; added new "Hull layer (per-deck, optional)" and
"Details layer (multi-deck only, optional)" documentation sections mirroring the existing
Vents/Doors section style, so the script's own usage docs now match
`docs/schemas/schema-encounters.md`.

### WR-06: `_extract_circle_shape`'s radius conversion subtracts a value that is always zero

**Files modified:** `tools/svg_to_map.py`
**Commit:** `1f44c1f`
**Applied fix:** Simplified `gr = to_grid(r, unit) - to_grid(0.0, unit)` to `gr = to_grid(r,
unit)`. All 19 existing unit tests still pass (`to_grid(0.0, unit)` was always `0`, so this is a
pure no-op removal with no behavior change).

## Skipped Issues

None — all 9 in-scope findings were fixed.

## Out of Scope

IN-01 (`xml.etree.ElementTree.parse` has no entity-expansion DoS hardening) was excluded because
`fix_scope: critical_warning` does not include Info-tier findings. No action taken.

## Verification

All fixes were verified inline during application (not deferred to a separate pass):
- `python3 -m py_compile tools/svg_to_map.py` passed after every commit.
- `python3 -m unittest tools.test_svg_to_map -v` (19 tests) passed after every commit — no
  regressions introduced.
- Each Critical and Warning fix was additionally verified against a live repro (either the
  reviewer's own reproduction snippet or an equivalent synthetic SVG run through `convert()`)
  confirming the specific bug no longer occurs.
- Verification ran in the main checkout (`workflow.use_worktrees` is `false` in
  `.planning/config.json`, so no isolated worktree was created for this run — see
  `setup_worktree`/#2825 in the fixer agent contract). All commit hashes above are reachable from
  the current branch (`gsd/phase-32-svg-converter-details-per-deck-hulls-circular-rooms`) and
  reproducible by checking out this same branch.

---

_Fixed: 2026-08-25T15:35:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
