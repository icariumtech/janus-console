---
phase: 31-deckplan-format-per-deck-hulls-detail-linework
plan: 01
subsystem: ui
tags: [react, typescript, svg, vitest, deckplan, encounter-map]

requires: []
provides:
  - "HullDef extended with optional polygon/polygons/holes; NormalizedHull canonical shape"
  - "hullNormalizer.ts — normalizeHull/mergeHulls/hullPathD, the single hull validation gate"
  - "Additive per-deck hull rendering (D-02) in EncounterMapRenderer with evenodd holes"
  - "patrol_gunboat upper_deck testbed — two disjoint hull polygons + one hole"
  - "deckToMapData and MapPreview both merge document + deck hulls additively"
affects: [32-deckplan-svg-converter, 31-02-detail-linework]

tech-stack:
  added: []
  patterns:
    - "Frontend validation-gate normalizer (hullNormalizer mirrors doorNormalizer) — pure module, drop-and-warn instead of throw"
    - "Additive multi-source merge with reference-identity dedupe (mergeHulls)"
    - "evenodd fill-rule path built from per-polygon M...Z subpaths (reused from RoomsLayer's room-hole technique)"

key-files:
  created:
    - src/components/domain/encounter/hull/hullNormalizer.ts
    - src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts
  modified:
    - src/types/encounterMap.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/geometry/roomGeometry.ts
    - src/components/gm/views/deckplan/useDeckplanModel.ts
    - src/components/gm/MapPreview.tsx
    - data/ships/patrol_gunboat/deckplan.yaml
    - docs/schemas/schema-encounters.md
    - src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts
    - src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts

key-decisions:
  - "HullDef.polygon made optional (add-alongside polygons, not promoted) — zero migration of somnus/base_alpha/campaign ship data"
  - "hullNormalizer never throws — malformed polygons/holes are dropped with console.warn so one bad pod never blanks the whole map"
  - "mergeHulls dedupes by reference identity, not deep equality, so the same hull object passed twice (prop + mapData.hull) never double-draws"

patterns-established:
  - "One normalizer, reused for both the shared/location hull and every per-deck hull (D-03)"
  - "roomBBoxGrid/EncounterMapRenderer/MapPreview all route through normalizeHull/mergeHulls instead of touching HullDef.polygon directly"

requirements-completed: [HULL-01, HULL-02]

coverage:
  - id: D1
    description: "normalizeHull converts singular polygon, plural polygons, combined singular+plural, and unpaired holes into one NormalizedHull; malformed entries (too few vertices, non-finite coordinate) are dropped with a warning while siblings survive"
    requirement: HULL-02
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts#normalizeHull"
        status: pass
    human_judgment: false
  - id: D2
    description: "mergeHulls concatenates shared + deck hull polygons additively, dedupes same-object-reference inputs, and returns null for empty/all-null input"
    requirement: HULL-01
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts#mergeHulls"
        status: pass
    human_judgment: false
  - id: D3
    description: "hullPathD builds evenodd M...Z subpaths — one per polygon, one per hole — reused by EncounterMapRenderer's hull SVG block"
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts#hullPathD"
        status: pass
    human_judgment: false
  - id: D4
    description: "roomBBoxGrid normalizes the hull before iterating so a detached pod polygon widens the bbox and is never clipped"
    requirement: HULL-02
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts#roomBBoxGrid widens the bbox to cover a second hull polygon sitting far outside the first"
        status: pass
    human_judgment: false
  - id: D5
    description: "EncounterMapRenderer merges hullProp + mapData.hull additively and renders every outer polygon plus evenodd-cut holes with per-polygon outline strokes"
    requirement: HULL-01
    verification:
      - kind: unit
        ref: "pnpm run typecheck (HullDef.polygon optional forces every consumer through the normalizer) + src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts (unchanged, proves no regression)"
        status: pass
    human_judgment: true
    rationale: "Visual rendering of the additive hull fill/outline/hole-cutout in the actual SVG (patrol_gunboat upper_deck) is not covered by a rendered-DOM/snapshot test in this plan — flagged as a phase-level backstop truth in PLAN.md must_haves.truths."
  - id: D6
    description: "patrol_gunboat upper_deck testbed: two disjoint hull polygons (spine + detached sensor pod) and one hole, three rooms, doors omitted"
    requirement: HULL-02
    verification:
      - kind: unit
        ref: "node -e yaml parse assertion (total_decks=2, hull.polygons.length=2, hull.holes.length=1, rooms.length=3)"
        status: pass
    human_judgment: false
  - id: D7
    description: "somnus, base_alpha, and campaign/ship deckplan.yaml files are byte-identical — no migration"
    verification:
      - kind: unit
        ref: "git diff --stat data/ships/somnus/deckplan.yaml data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml data/campaign/ship/deckplan.yaml (empty output)"
        status: pass
    human_judgment: false
  - id: D8
    description: "deckToMapData and MapPreview both merge document-level and deck-level hulls additively (sum of polygon counts), matching the renderer's contract"
    requirement: HULL-01
    verification:
      - kind: unit
        ref: "src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts#deckToMapData additive hull merge (D-02)"
        status: pass
    human_judgment: false
  - id: D9
    description: "schema-encounters.md documents polygon/polygons/holes on hull and the deck-entry hull row (additive, in addition to top-level)"
    verification:
      - kind: unit
        ref: "grep -c polygons docs/schemas/schema-encounters.md (>=1) + manual review of Deck entry fields table"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-30
status: complete
---

# Phase 31 Plan 01: Per-Deck Additive Hull Geometry Summary

**A deck in `deckplan.yaml` can declare its own `hull:` with multiple disjoint polygons and holes, rendered additively on top of the shared location silhouette, via one new `hullNormalizer` validation gate reused by the renderer, the bbox math, and the GM editor preview.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-30
- **Tasks:** 2/2 completed
- **Files modified:** 10 (2 new, 8 modified)

## Accomplishments

- New `hullNormalizer.ts` module (`normalizeHull`, `mergeHulls`, `hullPathD`) is the single validation gate for both the shared/location hull and any per-deck hull — drops malformed polygons/holes with a warning instead of throwing, so one bad authored pod can never blank the map.
- `HullDef` gained optional `polygon?`/`polygons?`/`holes?` (add-alongside, not promoted) plus a new `NormalizedHull` canonical shape, structurally assignable to `HullDef` with zero signature churn on `mapView.bbox`.
- `EncounterMapRenderer` now merges the shared hull prop and the deck's own hull additively (D-02), rendering every outer polygon and every hole via one `<path fillRule="evenodd">` plus per-polygon outline strokes.
- `roomBBoxGrid` normalizes the hull before iterating polygons, so a detached pod polygon (or nacelle) correctly widens the SVG viewBox instead of being clipped.
- `patrol_gunboat/deckplan.yaml` gained a second deck (`upper_deck`) with a deck-level hull carrying two disjoint polygons (a spine + a detached sensor pod entirely outside the shared hull's x-range) and one hole, plus three rooms — the hand-authored testbed proving HULL-01/HULL-02 end-to-end.
- `useDeckplanModel.deckToMapData` and `MapPreview` both now merge document-level and deck-level hulls additively instead of the old "deck wins" fallback, so the GM console editor preview matches the renderer's contract exactly.
- `docs/schemas/schema-encounters.md` documents the `polygon`/`polygons`/`holes` hull fields and the deck-entry `hull` row (additive), per the CLAUDE.md Schema Sync rule, in the same commit as the data-format change.
- Zero bytes changed in `data/ships/somnus/deckplan.yaml`, `data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml`, or `data/campaign/ship/deckplan.yaml` — confirmed via `git diff --stat`.

## Task Commits

1. **Task 1: End-to-end per-deck additive hull — one deck, two disjoint polygons, one hole** - `44c385e` (feat)
2. **Task 2: Additive hull parity in the GM editor preview and MapPreview aspect-ratio path** - `1689e39` (feat)

_Both tasks were straightforward `type="auto"`/`type="tracer"` implementations — no separate RED/GREEN/REFACTOR commits (tdd="true" tests were written alongside the implementation within each task's single commit, per the plan's task granularity)._

## Files Created/Modified

- `src/types/encounterMap.ts` - `HullDef` extended with optional `polygon`/`polygons`/`holes`; new `NormalizedHull` interface
- `src/components/domain/encounter/hull/hullNormalizer.ts` - new: `normalizeHull`, `mergeHulls`, `hullPathD`
- `src/components/domain/encounter/hull/__tests__/hullNormalizer.test.ts` - new: 17 unit tests covering every `<behavior>` case
- `src/components/domain/encounter/EncounterMapRenderer.tsx` - additive `effectiveHull` memo via `mergeHulls`; evenodd hull SVG block
- `src/components/domain/encounter/geometry/roomGeometry.ts` - `roomBBoxGrid` normalizes hull before iterating polygons
- `data/ships/patrol_gunboat/deckplan.yaml` - `total_decks: 2`; new `upper_deck` with deck-level `hull.polygons`/`hull.holes` and 3 rooms
- `docs/schemas/schema-encounters.md` - `Hull fields` subsection (polygon/polygons/holes) + deck-entry `hull` row
- `src/components/gm/views/deckplan/useDeckplanModel.ts` - `deckToMapData` uses `mergeHulls(document, deck)` instead of deck-wins fallback
- `src/components/gm/views/deckplan/__tests__/useDeckplanModel.test.ts` - retargeted hull-fallback test + 4 new additive-merge cases
- `src/components/gm/MapPreview.tsx` - local bbox loop uses `mergeHulls` across every polygon; raw `hull` prop passed through to the renderer unchanged
- `src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts` - 2 new `roomBBoxGrid` cases (far-offset second polygon, holes-only)

## Decisions Made

- **Add-alongside, not promote** (per PLAN.md's `assumption_delta_decision`): `HullDef.polygon` stays valid forever; `polygons`/`holes` are added next to it. This avoided touching any of the three live production deckplan files.
- **Drop-and-warn, not throw**, diverging deliberately from `doorNormalizer`'s throw-based contract — a single malformed pod polygon must never blank the entire map (T-31-03 mitigation).
- **Reference-identity dedupe in `mergeHulls`**, not deep-equality — cheap, correct for the "same object passed twice" case (prop + `mapData.hull`), and avoids a spurious dependency on a deep-equal utility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking compile error] `MapPreview.tsx` direct `.polygon` access broke typecheck after `HullDef.polygon` became optional**
- **Found during:** Task 1 (running `pnpm run typecheck` as the task's own verification gate)
- **Issue:** Task 1's type change (`HullDef.polygon?`) is a breaking change for any consumer that reads `.polygon` directly without narrowing. `MapPreview.tsx`'s local bbox loop (owned by Task 2, not Task 1's file list) directly accessed `effectiveHull.polygon`, which is now `undefined`-possible and failed `tsc --noEmit`. Task 1's own `<verify>` step runs whole-project `pnpm run typecheck`, so this had to be resolved before Task 1 could be considered done.
- **Fix:** Applied a minimal `?? []` guard (`effectiveHull.polygon ?? []`) to restore compile-safety without pre-empting Task 2's fuller rewrite. Task 2 (committed separately, `1689e39`) then replaced this entire block with the full `mergeHulls`/`NormalizedHull.polygons` iteration as originally scoped.
- **Files modified:** `src/components/gm/MapPreview.tsx` (further replaced in Task 2's commit)
- **Verification:** `pnpm run typecheck` exits 0 after the minimal fix (Task 1 commit), and again after Task 2's full rewrite.
- **Committed in:** `44c385e` (minimal guard, part of Task 1); superseded by `1689e39` (Task 2's full mergeHulls integration)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking compile error, direct consequence of Task 1's own type change)
**Impact on plan:** No scope creep — the deviation was strictly a type-safety patch required to keep Task 1's own verification gate (whole-project typecheck) green; Task 2 fully absorbed and superseded it with the planned `mergeHulls` integration.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `hullNormalizer` module, `NormalizedHull` type, and additive merge contract are the stable foundation Phase 32's `svg_to_map.py` converter must emit into (`polygons:`/`holes:` are now the shipped output contract).
- `data/ships/patrol_gunboat/deckplan.yaml`'s `upper_deck` is available as a second-deck, per-deck-hull, multi-room testbed for Plan 31-02's detail-linework work in the same phase.
- No blockers for Plan 31-02 (Detail linework) or Plan 31-03 (backend passthrough test) — both can proceed independently; `hullNormalizer` and the additive rendering path are fully committed and tested.

---
*Phase: 31-deckplan-format-per-deck-hulls-detail-linework*
*Completed: 2026-07-30*

## Self-Check: PASSED

All 12 claimed files found on disk; both task commits (`44c385e`, `1689e39`) confirmed present in `git log --oneline --all`.
