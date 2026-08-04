---
phase: 31-deckplan-format-per-deck-hulls-detail-linework
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - core/tests/test_deckplan_passthrough.py
  - data/ships/patrol_gunboat/deckplan.yaml
  - docs/schemas/schema-encounters.md
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts
  - src/components/domain/encounter/details/__tests__/detailNormalizer.test.ts
  - src/components/domain/encounter/details/detailNormalizer.ts
  - src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts
  - src/components/domain/encounter/geometry/roomGeometry.ts
  - src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts
  - src/components/domain/encounter/hull/hullNormalizer.ts
  - src/components/domain/encounter/renderer/DetailsLayer.tsx
  - src/components/domain/encounter/renderer/RoomsLayer.tsx
  - src/components/domain/encounter/renderer/mapColors.ts
  - src/components/gm/MapPreview.tsx
  - src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts
  - src/components/gm/views/deckplan/useDeckplanModel.ts
  - src/types/encounterMap.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: fixed
---

**Resolution (2026-08-04):** WR-01 and WR-02 fixed in commit `3db711d` (both-primitives-present
rejection in `detailNormalizer.ts`; `mergeHulls` aggregate-level holes-with-no-polygon guard in
`hullNormalizer.ts`), with regression tests added to both `__tests__` files — 239/239 tests pass,
typecheck clean. WR-03 (MapPreview bbox duplication) deferred — maintainability observation, not
a correctness bug; worth a follow-up if `roomGeometry.roomBBoxGrid` changes again. IN-01/IN-02 are
pre-existing and out of this phase's scope, left as-is.

# Phase 31: Code Review Report

**Reviewed:** 2026-08-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the per-deck hull geometry and detail-linework feature (plans 31-01/31-02):
`hullNormalizer.ts` (normalize/merge/render hull polygons+holes), `detailNormalizer.ts`
(partition deck `details:` into exterior/interior with the D-14 dangling-room fail-safe),
the corresponding renderer layers (`DetailsLayer.tsx`, `RoomsLayer.tsx`), the
`useDeckplanModel`/`MapPreview` editor-preview integration, the backend passthrough test,
and the schema doc.

The core contracts (additive hull merge, D-14 unknown-room fail-safe, malformed-primitive
drop-and-warn) are implemented correctly and are well covered by unit tests. No BLOCKER-tier
defects were found — nothing crashes, and no player-facing content leaks past the reveal
gate. Three WARNING-tier correctness/maintainability defects were found, both in genuinely
untested edge cases: a validation/render precedence mismatch in `DetailEntry` handling when
an entry carries both `points` and `circle`, and a hull-fill rendering bug when a hull ends
up with `holes` but no `polygon`/`polygons` (contradicts the schema's own documented
contract). A third finding flags duplicated bounding-box logic introduced in `MapPreview.tsx`
that could drift from `roomGeometry.roomBBoxGrid`. Two INFO items are noted for completeness.

## Warnings

### WR-01: `DetailEntry` validation and render use different points-vs-circle precedence

**File:** `src/components/domain/encounter/details/detailNormalizer.ts:50-91`
**File:** `src/components/domain/encounter/renderer/DetailsLayer.tsx:34-57`

**Issue:** `DetailEntry.points` and `DetailEntry.circle` are documented as mutually
exclusive ("Exactly one of `points` or `circle` must be present" — schema-encounters.md
line 260), but nothing enforces that, and the two places that inspect a `DetailEntry` pick
a different field when both are present:

- `isValidPrimitive` (detailNormalizer.ts:51-77) checks `hasPoints` **first** — if
  `entry.points` is a valid ≥2-vertex array, the function returns `true` immediately and
  never inspects `entry.circle` at all, even if `entry.circle` is malformed (e.g.
  `{ cx: NaN, r: -1 }`).
- `DetailShape` (DetailsLayer.tsx:39) checks `if (detail.circle)` **first** — if a
  `circle` object is present (even one that failed validation, because validation never
  looked at it), it renders using the circle's `cx/cy/r`, ignoring the valid `points`.

Net effect: an entry authored (or corrupted by a bad edit) with both a valid `points`
array and a malformed `circle` object passes `partitionDetails` silently (no
`console.warn`, unlike every other malformed-primitive case in this file), then renders as
a broken/invisible circle (negative or NaN radius) instead of the intended, valid polyline.
This is the one gap in an otherwise thorough drop-and-warn contract — every other malformed
shape in this file is caught and logged.

**Fix:** Make the two call sites agree, and treat "both present" as a validation error
consistent with the "exactly one" contract:

```ts
// detailNormalizer.ts
function isValidPrimitive(entry: DetailEntry, index: number): boolean {
  const hasPoints = Array.isArray(entry.points);
  const hasCircle = entry.circle !== undefined && entry.circle !== null;

  if (hasPoints && hasCircle) {
    console.warn(`[detailNormalizer] dropped entry at index ${index}: both points and circle present, exactly one expected`);
    return false;
  }
  if (!hasPoints && !hasCircle) { /* ...unchanged... */ }
  ...
}
```

### WR-02: Hull with `holes` but no `polygon`/`polygons` renders as a solid filled shape

**File:** `src/components/domain/encounter/hull/hullNormalizer.ts:87, 98-117, 125-140`
**Cross-reference:** `docs/schemas/schema-encounters.md:75` — "At least one of
`polygon`/`polygons` must be present for the hull to render."

**Issue:** `normalizeHull` only returns `null` when *both* `polygons` and `holes` end up
empty (line 87: `if (polygons.length === 0 && holes.length === 0) return null;`). A hull
authored with only `holes:` (no `polygon`/`polygons`) — or a `mergeHulls` result where
every source contributed holes but no source contributed a polygon — therefore returns a
non-null `NormalizedHull` with `polygons: []` and a non-empty `holes` array.

`hullPathD` (lines 129-138) then builds `parts = [...hull.polygons.map(subpath), ...hull.holes.map(subpath)]`.
With `polygons` empty, `parts` is just the hole subpath(s). `EncounterMapRenderer.tsx` renders
this with `fillRule="evenodd" fill={COLORS.hullFill}` — for a single closed subpath with no
outer polygon to subtract from, `evenodd` fills the *inside* of that subpath. The result is
the opposite of the intended behavior: a "hole" with nothing to punch renders as a **solid
filled hull shape** at the hole's location, instead of rendering nothing, directly
contradicting the schema's documented rule quoted above.

This is a genuine edge case (no current production deckplan hits it — `patrol_gunboat`'s
hole is always paired with an enclosing polygon), and `roomBBoxGrid`'s bbox math already
correctly ignores holes-only hulls (see the "does not shrink or widen..." test in
`roomGeometry.test.ts`), but the render path (`hullPathD`) was never given the same
guard, and no test exercises it.

**Fix:** The guard must live in `mergeHulls`'s *final* result, not in the per-source
`normalizeHull` call — a deck-level hull that legitimately authors only `holes:` (to punch
a hatch into the shared top-level silhouette) must still contribute its holes when merged
with a top-level hull that *does* have polygons. Collapse the final merged result instead:

```ts
// hullNormalizer.ts — mergeHulls, after the loop
if (polygons.length === 0) return null; // holes with nothing to punch never render
return { polygons, holes };
```

### WR-03: `MapPreview.tsx` duplicates `roomGeometry.roomBBoxGrid`'s bounding-box logic

**File:** `src/components/gm/MapPreview.tsx:172-204`

**Issue:** This phase's `1689e39` commit taught `MapPreview.tsx` to compute a hull-aware,
room-aware bounding box for the aspect-ratio calculation (rects/polygon/circle rooms +
merged hull polygons, skipping holes) — but hand-rolls the entire loop inline instead of
calling `roomGeometry.roomBBoxGrid`, which was purpose-built for exactly this
(`EncounterMapRenderer.tsx` already delegates to it via `view.bbox`). The two
implementations are functionally near-identical today, but now exist as two independently
maintained copies of the same room/hull bounding-box algorithm — a future fix to one (e.g.
correctly handling a new room shape, or the WR-02 holes-only fix above) is not guaranteed
to be applied to the other.

**Fix:** Reuse the shared helper:

```ts
import { roomBBoxGrid } from '@/components/domain/encounter/geometry/roomGeometry';
...
const bbox = roomBBoxGrid(gridMap.rooms, mergedHull, pad);
const naturalW = bbox.gw * us;
const naturalH = bbox.gh * us;
```

## Info

### IN-01: Leftover empty `poi:` keys in `patrol_gunboat/deckplan.yaml` main_deck rooms

**File:** `data/ships/patrol_gunboat/deckplan.yaml:50, 58, 66`
**Issue:** `engineering`, `steerage`, and `cargo_bay` each carry a trailing `poi:` key with
no value (parses as `poi: null`), while `lounge`, `computer`, and `bridge` do not. This
predates phase 31 (present since before `44c385e`) and is harmless at runtime
(`normalize_deck_poi`'s `if not room_poi: continue` skips it), but it's dead YAML noise
worth cleaning up next time this file is touched.
**Fix:** Remove the three stray `poi:` lines.

### IN-02: `AuthoredDoorRel`/`AuthoredDoorPos` declare `type`/`status`/`along` as required, but schema documents them as optional

**File:** `src/types/encounterMap.ts:438-465`
**Issue:** `schema-encounters.md`'s Door Fields table marks `type`, `status`, and `along`
as `Required: no` (with defaults), but the TS interfaces declare all three without `?`.
Pre-existing from phase 21-02, not introduced by this phase, and since these types are only
used as compile-time hints over `yaml.parse()` output (no runtime validation depends on
them), it doesn't cause a runtime defect — but it will force any future code that
constructs an `AuthoredDoorRel`/`AuthoredDoorPos` object literal (tests, editor tooling) to
supply fields the format itself treats as optional.
**Fix:** Mark `type?`, `status?`, `along?` on both interfaces, matching the schema doc.

---

_Reviewed: 2026-08-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
