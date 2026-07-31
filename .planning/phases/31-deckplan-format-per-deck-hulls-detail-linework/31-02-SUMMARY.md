---
phase: 31-deckplan-format-per-deck-hulls-detail-linework
plan: 02
subsystem: ui
tags: [react, typescript, svg, vitest, deckplan, encounter-map]

requires:
  - phase: 31-01
    provides: "hullNormalizer/mergeHulls precedent (drop-and-warn normalizer pattern, patrol_gunboat upper_deck testbed with rooms obs_deck/sensor_pod)"
provides:
  - "DetailEntry type (polyline or circle primitive) + GridEncounterMapData.details"
  - "detailNormalizer.ts — partitionDetails, the single reveal-gating seam for detail linework"
  - "DetailsLayer.tsx — fixed-style SVG rendering (DetailShape, DetailsLayer)"
  - "Interior detail mounting inside RoomsLayer's three room reveal groups (circle/polygon/rect)"
  - "patrol_gunboat upper_deck details testbed — interior/exterior/circle/filled/id-less entries"
  - "useDeckplanModel details passthrough — GM console editor preview parity"
affects: [32-deckplan-svg-converter]

tech-stack:
  added: []
  patterns:
    - "Frontend validation-gate normalizer (detailNormalizer mirrors hullNormalizer/doorNormalizer) — pure module, drop-and-warn instead of throw"
    - "Structural reveal gating: interior details are children of the room's existing SVG group, not a second gating mechanism"

key-files:
  created:
    - src/components/domain/encounter/details/detailNormalizer.ts
    - src/components/domain/encounter/details/__tests__/detailNormalizer.test.ts
    - src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts
    - src/components/domain/encounter/renderer/DetailsLayer.tsx
  modified:
    - src/types/encounterMap.ts
    - src/components/domain/encounter/renderer/mapColors.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/renderer/RoomsLayer.tsx
    - src/components/gm/views/deckplan/useDeckplanModel.ts
    - data/ships/patrol_gunboat/deckplan.yaml
    - docs/schemas/schema-encounters.md

key-decisions:
  - "detailNormalizer is deliberately NOT reveal-aware — it never reads room-visibility state; reveal gating is purely structural (interior DetailShape children live inside RoomsLayer's existing reveal <g>), so there is exactly one visibility mechanism per room, not two that could drift apart"
  - "D-14 fail-safe: dangling room: ref is dropped entirely for players (absent from both exterior AND every byRoom value) but shown in exterior for the GM, with a console.warn deduplicated per unknown room id"
  - "deckplanDetails.test.ts (not useDeckplanModel.test.ts) hosts the two deckToMapData details-passthrough cases, per Task 3's file list"

patterns-established:
  - "One normalizer (partitionDetails), reused for every deck's detail list, mirroring hullNormalizer's one-normalizer-for-both-levels precedent"
  - "DetailShape is a single-primitive renderer dropped into two different mount points (top-level exterior group, per-room interior group) with zero special-casing between them"

requirements-completed: [DET-01, DET-03]

coverage:
  - id: D1
    description: "partitionDetails splits a deck's details into always-visible exterior entries and per-room byRoom entries; malformed primitives (too few vertices, non-finite coordinate, non-positive circle radius) are dropped with a warning while siblings survive"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/details/__tests__/detailNormalizer.test.ts#partitionDetails"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dangling room: reference fails closed for players (absent from exterior AND every byRoom value) and fails open only for the GM (shown in exterior), with console.warn deduplicated per unknown room id"
    requirement: DET-03
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/details/__tests__/detailNormalizer.test.ts#partitionDetails dangling room ref cases + warn-dedup case"
        status: pass
    human_judgment: false
  - id: D3
    description: "DetailsLayer/DetailShape render fixed-style SVG (thin stroke, dimmer teal, no per-detail styling fields) for both polyline (open/closed) and circle primitives, never intercepting pointer events, projecting vertices via view.project (not raw unitSize multiply)"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "pnpm run typecheck + grep-based acceptance criteria (pointerEvents=\"none\" present, no onClick/onPointerDown/onPointerUp/onContextMenu handlers, view.project used, no unitSize * for vertices)"
        status: pass
    human_judgment: true
    rationale: "Visual rendering of detail linework in the actual SVG (patrol_gunboat upper_deck) is not covered by a rendered-DOM/snapshot test in this plan — flagged as a phase-level backstop truth in PLAN.md must_haves.truths, same pattern as 31-01's hull rendering."
  - id: D4
    description: "Interior details mount inside all three RoomsLayer room-shape branches (circle, freeform polygon, rect) as children of the same <g> carrying roomGroupClass/opacity/animationDelay — the entire reveal gate and GM-dim treatment, with no separate visibility/opacity/animation logic for details"
    requirement: DET-03
    verification:
      - kind: unit
        ref: "grep -c 'detailEls' src/components/domain/encounter/renderer/RoomsLayer.tsx (returns 4: one definition + one insertion per branch) + pnpm test -- --run (no pre-existing test regressed)"
        status: pass
    human_judgment: true
    rationale: "The CRT flicker-in cascade and GM-dim opacity applying identically to detail linework as to walls/floor (D-13) is a runtime SVG-animation behavior not covered by a DOM/animation-timing test in this plan — same backstop-truth pattern as D3."
  - id: D5
    description: "patrol_gunboat upper_deck testbed carries 4 detail entries exercising every branch: interior open polyline w/ id (obs_console/obs_deck), interior closed+filled shape w/ no id (sensor_pod), exterior polyline w/ id (pod_strut), exterior circle w/ no id"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "node -e yaml parse assertion (details.length=4, 2 with room, 2 without, has circle, has closed+filled, has an id-less entry) + src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every authored detail room: value on the shipped testbed resolves to a real room id, and injecting a synthetic dangling-room entry yields zero additional entries for players and exactly one additional exterior entry for the GM"
    requirement: DET-03
    verification:
      - kind: integration
        ref: "src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts#patrol_gunboat upper_deck details (real YAML)"
        status: pass
    human_judgment: false
  - id: D7
    description: "useDeckplanModel.deckToMapData forwards deck.details (defaulted to [] like doors/vents) so the GM console editor preview renders detail linework live; a deck with no details key returns an empty array, not undefined"
    requirement: DET-01
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts#deckToMapData details passthrough"
        status: pass
    human_judgment: false
  - id: D8
    description: "schema-encounters.md documents the Detail Fields section (id/room/points/closed/circle/filled) and the deck-entry details row, with no styling fields present in the format"
    verification:
      - kind: unit
        ref: "grep -n '## Detail Fields' + grep -n details row in docs/schemas/schema-encounters.md"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-31
status: complete
---

# Phase 31 Plan 02: Detail Linework — Room-Gated + Always-Visible Exterior Summary

**A deck-level `details:` list in `deckplan.yaml` draws consoles, machinery blocks, struts, and hull greebles in one fixed blueprint-grade SVG style, with interior details riding inside the room's own reveal group (structural gating, D-12/D-13) and a dangling `room:` reference failing closed for players via `partitionDetails`'s D-14 fail-safe.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-31
- **Tasks:** 3/3 completed
- **Files modified:** 11 (4 new, 7 modified)

## Accomplishments

- New `DetailEntry` type (exactly one of `points`/`circle`, optional `id`/`room`/`closed`/`filled`) and `GridEncounterMapData.details` — the deck-level detail list, mirroring the existing `VentPath`/`vents` precedent.
- New `detailNormalizer.ts` module (`partitionDetails`) — the single gating seam that splits a deck's authored details into always-visible `exterior` entries and per-room `byRoom` entries. Deliberately not reveal-aware: it never reads room-visibility state, because reveal gating is achieved structurally (interior details mount inside the room's own SVG reveal group), leaving exactly one visibility mechanism per room instead of two that could drift out of sync.
- D-14 fail-safe implemented and unit-tested: a `room:` value matching no room on the deck is dropped entirely for players (absent from both `exterior` and every `byRoom` value) but still shown to the GM (routed to `exterior`), with a `console.warn` naming the unknown id, deduplicated so repeated bad references warn only once per call.
- New `DetailsLayer.tsx` (`DetailShape`, `DetailsLayer`) renders one fixed blueprint-grade style for both variants: thin stroke (`COLORS.detail`, `DETAIL_STROKE_WIDTH = WALL_THICKNESS / 4`), faint fill only for closed shapes with `filled: true` (`DETAIL_FILL_OPACITY`), `pointerEvents="none"` on every variant so detail linework never intercepts a click. Vertices project through `view.project` (never a raw `unitSize` multiply), so the future isometric projection (Phase 33) works for free.
- `EncounterMapRenderer` computes `partitionDetails(mapData.details, mapData.rooms, isGM)` once via `useMemo`, mounts the always-visible exterior group on the hull plate (above the hull fill, below `RoomsLayer`), and passes `detailsByRoom` down to `RoomsLayer`.
- `RoomsLayer` mounts interior `DetailShape` children inside all three room-shape branches (circle, freeform polygon, rect) as children of the exact same `<g>` that already carries `roomGroupClass`, `opacity`, and the CRT-flicker `animationDelay` — that placement is the entire reveal gate and the entire GM-dim treatment; no separate visibility/opacity/animation logic exists for details anywhere in the renderer.
- `patrol_gunboat/deckplan.yaml`'s `upper_deck` gained a 4-entry `details:` list exercising every branch: an interior open polyline with an id (`obs_console`, in `obs_deck`), an interior closed+filled shape with no id (in `sensor_pod`), an exterior polyline with an id (`pod_strut`, spanning the gap between the deck's two hull polygons), and an exterior circle with no id (a sensor dish near the pod).
- `useDeckplanModel.deckToMapData` now forwards `deck.details` (defaulted to `[]`, matching the existing `doors`/`vents` defaulting style) so the GM console's live Monaco preview renders detail linework immediately as it's typed.
- `docs/schemas/schema-encounters.md` gained a `## Detail Fields` section (mirroring the `## Vent Fields` shape) plus a `details` row in the Deck entry fields table, documenting that there are no styling fields in the format — `filled` is the only appearance flag.
- Zero changes to `data/ships/somnus/deckplan.yaml`, `data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml`, or `data/campaign/ship/deckplan.yaml`; zero changes to `package.json`/`pnpm-lock.yaml` (no new dependencies).

## Task Commits

1. **Task 1: DetailEntry contract + the reveal-gating partition seam + fixed style tokens** - `11b63e6` (feat)
2. **Task 2: Draw the linework — exterior always-visible group + interior details inside the room reveal group** - `73c340c` (feat)
3. **Task 3: Editor-preview parity + real-deckplan integration coverage of the reveal gate** - `8978b59` (feat)

_All three tasks were `type="auto"` (Task 1 was `tdd="true"` — the 14 unit tests were written alongside `partitionDetails`'s implementation within Task 1's single commit, per this plan's task granularity, matching 31-01's precedent)._

## Files Created/Modified

- `src/types/encounterMap.ts` - new `DetailEntry` interface; `GridEncounterMapData.details?: DetailEntry[]`
- `src/components/domain/encounter/details/detailNormalizer.ts` - new: `partitionDetails`, the D-14 fail-safe gating seam
- `src/components/domain/encounter/details/__tests__/detailNormalizer.test.ts` - new: 14 unit tests covering every `<behavior>` case
- `src/components/domain/encounter/details/__tests__/deckplanDetails.test.ts` - new: 7 integration tests against the real `patrol_gunboat` upper_deck testbed + `deckToMapData` passthrough
- `src/components/domain/encounter/renderer/mapColors.ts` - `COLORS.detail`, `DETAIL_STROKE_WIDTH`, `DETAIL_FILL_OPACITY`
- `src/components/domain/encounter/renderer/DetailsLayer.tsx` - new: `DetailShape`, `DetailsLayer`
- `src/components/domain/encounter/EncounterMapRenderer.tsx` - `partitionDetails` useMemo; `DetailsLayer` mounted between hull and `RoomsLayer`; `detailsByRoom` prop passed to `RoomsLayer`
- `src/components/domain/encounter/renderer/RoomsLayer.tsx` - `detailsByRoom` prop; `detailEls` computed once per room, inserted in all three room-shape branches
- `data/ships/patrol_gunboat/deckplan.yaml` - `upper_deck.details:` — 4-entry testbed (interior/exterior/circle/filled/id-less)
- `docs/schemas/schema-encounters.md` - `## Detail Fields` section + deck-entry `details` row
- `src/components/gm/views/deckplan/useDeckplanModel.ts` - `DeckplanDeck.details`; `deckToMapData` forwards `details: deck.details ?? []`

## Decisions Made

- **Structural-only gating, never re-implemented:** `partitionDetails` contains zero references to room-visibility state (`grep -c 'roomVisibility' detailNormalizer.ts` returns 0) — the only gate is where `RoomsLayer` mounts the returned `byRoom` entries. This was verified as an explicit acceptance criterion, not just a design intent.
- **`deckplanDetails.test.ts` hosts the `deckToMapData` details-passthrough cases**, not `useDeckplanModel.test.ts` — Task 3's file list named only `useDeckplanModel.ts` and the new integration test file, so both new deliverables landed together in the new file rather than touching an out-of-scope existing test file.
- **No deliberately-dangling `room:` reference was authored into the shipped `patrol_gunboat` testbed** (per the plan's explicit instruction) — the D-14 fail-safe is covered by the Task 1 unit fixture and the Task 3 synthetic-injection integration test instead, keeping shipped campaign data free of intentional errors.

## Deviations from Plan

None — plan executed exactly as written. The only mid-implementation correction was a self-caught acceptance-criteria issue (see below), not a deviation from the plan's design.

**Note (not a deviation, a verification-gate catch):** Task 1's own acceptance criteria required `grep -c 'roomVisibility' detailNormalizer.ts` to return `0`. My first draft of the file-header comment used the literal string `roomVisibility` when explaining why the function is not reveal-aware, which the grep (correctly) flagged. Reworded the comment to describe the same fact without using that identifier string, re-verified the grep returns `0`, and re-ran `pnpm run typecheck` — no behavior change, no additional commit needed (caught before Task 1's commit).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `DetailEntry` shape (`points`/`circle`/`closed`/`filled`/`id`/`room`) is now the shipped output contract Phase 32's `svg_to_map.py` converter must emit from Inkscape "Details" sublayers.
- `detailNormalizer.partitionDetails` and the `DetailsLayer`/`DetailShape` renderer are fully committed and unit+integration tested — no blockers for Plan 31-03 (backend passthrough test), which can confirm `core/data_loader.py`/`payload_builder.py` already forward the new `details:` key unchanged (thin-passthrough pattern, same as `hull`/`vents`).
- `data/ships/patrol_gunboat/deckplan.yaml`'s `upper_deck` now carries both the per-deck hull (31-01) and detail linework (31-02) testbeds together — a complete example for Phase 32's converter output and for any future visual/UAT pass.

---
*Phase: 31-deckplan-format-per-deck-hulls-detail-linework*
*Completed: 2026-07-31*

## Self-Check: PASSED
