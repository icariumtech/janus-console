---
phase: 34-gm-controlled-projection-and-iso-rotation
verified: 2026-10-16T20:08:18Z
status: human_needed
score: 11/13 must-haves verified
covered_files:
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-01-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-01-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-02-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-02-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-03-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-03-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-04-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-04-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-05-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-05-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-06-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-06-SUMMARY.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-07-PLAN.md"
  - ".planning/phases/34-gm-controlled-projection-and-iso-rotation/34-07-SUMMARY.md"
  - "codemaps/frontend.md"
  - "core/active_view_store.py"
  - "core/data_loader.py"
  - "core/encounter_state.py"
  - "core/encounter_view.py"
  - "core/payload_builder.py"
  - "core/tests/test_active_view_store.py"
  - "core/tests/test_data_loader.py"
  - "core/tests/test_encounter_state.py"
  - "core/tests/test_encounter_view_state.py"
  - "core/tests/test_payload_builder.py"
  - "core/urls.py"
  - "core/views/__init__.py"
  - "core/views/active_view.py"
  - "core/views/encounter.py"
  - "core/views/navigation.py"
  - "docs/schemas/schema-encounters.md"
  - "src/components/domain/dashboard/BridgeView.tsx"
  - "src/components/domain/dashboard/sections/StatusSection.tsx"
  - "src/components/domain/encounter/EncounterMapDisplay.tsx"
  - "src/components/domain/encounter/EncounterMapRenderer.css"
  - "src/components/domain/encounter/EncounterMapRenderer.tsx"
  - "src/components/domain/encounter/EncounterView.tsx"
  - "src/components/domain/encounter/TokenLayer.tsx"
  - "src/components/domain/encounter/__tests__/EncounterMapRenderer.viewControls.test.tsx"
  - "src/components/domain/encounter/__tests__/viewTransition.test.ts"
  - "src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts"
  - "src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts"
  - "src/components/domain/encounter/geometry/gridProjection.ts"
  - "src/components/domain/encounter/geometry/viewOrientation.ts"
  - "src/components/domain/encounter/renderer/PoiLayer.tsx"
  - "src/components/domain/encounter/useOrientationTransition.ts"
  - "src/components/domain/encounter/viewTransition.ts"
  - "src/components/gm/EncounterPanel.tsx"
  - "src/components/gm/MapPreview.tsx"
  - "src/components/gm/views/BridgeView.tsx"
  - "src/components/gm/views/EncounterView.tsx"
  - "src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx"
  - "src/components/gm/views/deckplan/DeckplanPreviewPane.tsx"
  - "src/components/gm/views/useLocationMapBundle.ts"
  - "src/entries/SharedConsole.tsx"
  - "src/hooks/useTokenPlacement.ts"
  - "src/services/encounterApi.ts"
  - "src/types/gmConsole.ts"
  - "src/utils/__tests__/svgCoordinates.test.ts"
  - "vitest.config.ts"
covered_digest: "v3:sha256:d8eeaea985ba72fe5a3781306279d53b9f8d1078ff011aa109371fa44abac246"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/11
  gaps_closed:
    - "G-34-5: rotate buttons flank the projection toggle, rotate glyphs at 18px, cluster order [ccw][projection][cw] (plan 34-06)"
    - "G-34-6: GM tactical map binds deck map, hull and view to one slug-keyed unit; no mixed frame on location change (plan 34-07)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Every map element renders correctly at every projection x rotation, and a pending or active token/POI drag is cancelled when a broadcast projection or offset change arrives"
    test: "Two consoles open; cycle the GM map through all 8 projection x rotation combinations; drag a token and a POI in one window while rotating or switching projection in the other"
    expected: "Elements stay on their grid cells; the dragged token/POI snaps back with no move and no toast; no ghost remains"
    why_human: "No DOM test covers the TokenLayer/PoiLayer cancel effects or SVG paint. shouldCancelDrag is unit-tested only as a predicate. Human UAT (34-UAT.md tests 1 and 3) recorded pass, but on pre-gap-closure code"
  - truth: "Rotation fades, snaps and resets pan/zoom once at opacity 0, then fades in; projection and location changes cut; reduced motion cuts; unmount never leaves opacity 0"
    test: "On the GM map press rotate-cw several times, switch projection, then repeat with prefers-reduced-motion enabled; leave and re-enter the encounter view"
    expected: "Short fade on rotation with pan/zoom re-fit at the snap; instant cut on projection change and under reduced motion; map never left invisible"
    why_human: "The planner is unit-tested (viewTransition.test.ts, 47 tests). The GSAP executor in useOrientationTransition.ts has no DOM test. Human UAT (34-UAT.md test 4) recorded pass, but on pre-gap-closure code"
coincidental_reliance_items:
  - truth: "ISO-06: an authored default_view applies on location change (the Somnus example used in UAT test 6)"
    reason: undeclared-precondition
    harden: "The Somnus default_view line (data/ships/somnus/deckplan.yaml:4) is an uncommitted working-tree edit, not in any commit. The UAT run passed against it. Commit the fixture, or declare it as a test fixture, so the Somnus check does not rely on uncommitted data. The Django tests cover the logic without it."
human_verification:
  - test: "UAT G-34-5 re-check: open /gmconsole/, ENCOUNTER with a grid deckplan. Read the bottom-left cluster and check the glyphs and sizes."
    expected: "Cluster reads [⟲][ISO VIEW or TOP DOWN][⟳]. The glyphs render as glyphs, not empty boxes (if boxes, switch ROTATE_CCW_LABEL / ROTATE_CW_LABEL in EncounterMapRenderer.tsx:163-164 to 'CCW' / 'CW'). Left button turns the map counter-clockwise, right clockwise. Every button is at least 44x44. At 360px width the cluster fits without horizontal overflow and the legend is hidden; at about 768px it looks right."
    why_human: "Glyph legibility depends on the GM's font stack and cannot be checked by grep. The 194px cluster width is derived, not measured."
  - test: "UAT G-34-6 re-check: with DevTools network throttling, switch between a top-down ship and an iso/90 ship in both directions; run A to B to C in quick succession; switch decks inside one ship; go to BRIDGE and back; rotate during a freeze."
    expected: "No top-down flash and no re-projected copy of the previous ship; no mixed rooms or hull; one cut to the new map. The frozen map keeps its own tokens, doors and room shading. Requires the Somnus default_view fixture (see coincidental_reliance_items)."
    why_human: "Real paint timing and network latency cannot be reproduced in jsdom. The regression test records every MapPreview render, but not what the browser paints."
  - test: "Freeze-window gate: during the freeze (new location loading, old map still shown), confirm the rotate and projection buttons are absent, REVEAL ALL / HIDE ALL and the deck picker are disabled, the token palette is not offered, and tokens cannot be dragged or dropped. Confirm everything returns once the new map appears."
    expected: "Gate closes and lifts exactly with the bundle commit. No control acts on the previous location."
    why_human: "The gate is covered by render-recording tests, but whether the controls read as inert on screen is a visual check."
advisory: []
---

# Phase 34: GM-Controlled Projection and Iso Rotation Verification Report

**Phase Goal:** Make the map view (top-down vs. isometric, and iso rotation) a GM-owned setting broadcast to players, and let the GM rotate the iso view in 90° steps.
**Verified:** 2026-10-16T20:08:18Z
**Status:** human_needed
**Re-verification:** Yes, after gap closure (UAT G-34-5 and G-34-6, plans 34-06 and 34-07). The prior report (2026-10-14, 8/11, human_needed) covered plans 01 to 05 only.

## Verification Basis

- Plan `must_haves` (truths, artifacts, key_links, prohibitions) from plans 34-01 through 34-07 frontmatter.
- ROADMAP Phase 34 Success Criteria 1 to 4, and the four requirements ISO-04, ISO-05, ISO-06, ISO-07.
- SUMMARY.md claims treated as hypotheses. The gap-closure summaries (34-06, 34-07) were checked line by line against the source.
- Targeted tests run by the verifier this session, one named file or module each (no full suite):
  - vitest `EncounterMapRenderer.viewControls.test.tsx` and `EncounterView.locationChange.test.tsx`: 24/24 pass.
  - vitest `viewTransition.test.ts`, `viewOrientation.test.ts`, `svgCoordinates.test.ts`, `gridProjection.test.ts`: 185/185 pass.
  - Django `core.tests.test_encounter_state`, `test_encounter_view_state`, `test_active_view_store`, `test_data_loader`: 103 OK.
- Post-merge gates reported by the orchestrator and not re-run: typecheck OK, `pnpm run build` OK, vitest 437/437, Django `core` 184 OK.
- Review inputs: `34-REVIEW.md` (gap-closure, quick depth, 0 critical / 3 warning / 3 info), `34-REVIEW-DISPOSITION.md` (all six rows `open`), `34-REVIEW-FIX.md` (the earlier backend review, WR-01 and WR-02 fixed in commits 404a344 and e883546).

## Goal Achievement

### Observable Truths

| #   | Truth | Source | Status | Evidence |
| --- | ----- | ------ | ------ | -------- |
| 1 | Player terminal has no view controls and mirrors the GM's projection live (SC1, ISO-04) | ROADMAP SC1; 34-05 truth 1 | VERIFIED | `SharedConsole.tsx` builds `viewOrientation` from the SSE `activeView` and passes it to the player map. Unchanged by 34-06/34-07. Human UAT test 2 pass. |
| 2 | GM rotates in 90° steps; the server computes each step from its own state, and players follow (SC2, ISO-05) | ROADMAP SC2; 34-01/02 | VERIFIED | `encounter_state.rotate_view` (`core/encounter_state.py:82-100`) takes only int ±90 and computes `(current + delta) % 360` inside the store lock. `api_encounter_rotate_view` is `login_required`. Django tests pass. Human UAT test 1 pass. |
| 3 | iso keeps true 30° axes at all 16 offset × authored-rotation combinations; top-down quarter turns are exact (ISO-05) | 34-03 truths 2-4, 6 | VERIFIED | `viewOrientation.test.ts` (77 tests, run this session) covers the 16-combination lattice test and the exact top-down values. Human UAT test 1 pass (Somnus). |
| 4 | Pointer-to-cell hit-testing returns the drawn cell at every projection × offset × authored combination (SC3 hit-test, ISO-07) | 34-03 truth 5 | VERIFIED | `src/utils/__tests__/svgCoordinates.test.ts` (18 tests, run this session) composes `buildProjection`, `screenRotationFor` and `getGridCellViaView`. Human UAT test 3 pass. |
| 5 | Every element renders correctly at every rotation, and a pending or active drag is cancelled on a broadcast change (SC3 render, ISO-07) | ROADMAP SC3; 34-04 truths 9, 14 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `shouldCancelDrag` is called at `TokenLayer.tsx:200` and `PoiLayer.tsx:74`; the background grid is projection-driven. No DOM test exercises the cancel path or the paint. Human UAT tests 1 and 3 recorded pass, on code before 34-06/34-07. Routed to human, not counted in `verified_truths`. |
| 6 | Rotation fades, snaps and resets pan/zoom once at opacity 0; projection and location changes cut; reduced motion cuts; unmount never leaves opacity 0 (ISO-07) | ISO-07; 34-03 truths 8, 9, 11; 34-04 truths 10-13, 15 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | The planner is pure and tested (`viewTransition.test.ts`, 47 tests, run this session). The GSAP executor (`useOrientationTransition.ts`) has no DOM test. Human UAT test 4 recorded pass, on code before 34-06/34-07. Routed to human, not counted. |
| 7 | Deckplan editor preview is a private local mode with no server calls and no broadcast (ISO-04) | ISO-04; 34-05 truth 5 | VERIFIED | `DeckplanPreviewPane.tsx:236` passes `viewControl={{ mode: 'local' }}`. The file imports no service module. Human UAT test 2 pass. |
| 8 | Server validation: strict ±90 delta, enum-checked projection, non-object body is 400, login and CSRF enforced, state unchanged on rejection (ISO-05) | 34-01 truth 3; 34-02 truths 1, 3 | VERIFIED | `rotate_view` rejects bool, 90.0, '90', null, 0, 180 (`encounter_state.py:91`). `set_projection` checks `PROJECTIONS`. Django tests pass. |
| 9 | Race edge: two GM clients or a double click each apply exactly one step (ISO-05) | 34-01 truth 2 | VERIFIED | Prior report was UNCERTAIN: `rotate_view` read and wrote the state in two lock acquisitions. Fixed in commit 404a344. `rotate_view` now calls `_sync_fn` (`encounter_state.py:18-22`) → `sync_state_fn` (`core/views/active_view.py:41-50`) → `update_state_fn` (`core/active_view_store.py:127-139`), so the step is computed under the same lock as the write. `test_step_is_computed_inside_the_store_lock` and the atomic-write tests pass. |
| 10 | An authored `default_view` applies on location change only; deck switches and BRIDGE/STANDBY round trips keep the live view; the default is applied in one store update (ISO-06, SC4) | ISO-06; 34-02 truths 4-8; 34-05 truth 8 | VERIFIED | `core/views/navigation.py:83-87` uses the dedicated `encounter_view_location_slug` marker, not `location_slug`. The projection, offset and marker are written in the same `sync_state` call (single SSE payload). `switch_level` leaves both view keys alone. Django tests pass. Human UAT test 6 reports "the default_view works". |
| 11 | The broadcast view persists across a server restart (ISO-06, SC4) | 34-02 truth 9 | VERIFIED | `update_state` writes atomically. `_load_from_disk` normalizes stored values (commit e883546). `test_active_view_store` and `test_encounter_state` pass. UAT test 6 did not report a persistence failure. |
| 12 | G-34-5: rotate buttons flank the projection toggle, glyphs are 18px, targets are 44px, and the cluster fits 360px (ISO-04, ISO-05) | 34-06 truths 1-5, 8 | VERIFIED (code) / human re-check pending | `EncounterMapRenderer.tsx:958-1006`: order `.encounter-map__rotate-ccw` → `.encounter-map__projection-toggle` → `.encounter-map__rotate-cw`. `ROTATE_BUTTON_STYLE` (lines 188-194) sets 18px, padding 8px, inherits minWidth/minHeight 44px. CCW calls `handleRotateClick(-90)`, CW calls `handleRotateClick(90)`. 9 DOM tests pass (order, direction, glyph size, 44px, mode gating). Glyph legibility and the 360px fit are visual: human items 1. |
| 13 | G-34-6: the GM map, hull and view are one location-bound unit; a location change never paints one location's map with another's view or hull; late responses are discarded (ISO-06, ISO-07) | 34-07 truths 1-10 | VERIFIED (code) / human re-check pending | `useLocationMapBundle.ts`: deck map and manifest load together via `Promise.all` (line 109), commit as one `{slug, mapData, manifest, allDecks, roomVisibility}` (lines 114-121), and each run is guarded by a `cancelled` flag (lines 84, 113, 135). `EncounterView.tsx`: `MapPreview` is rendered only from the bundle (lines 466-481), `locationKey={bundle?.slug}`, map-scoped inputs latched while the bundle is frozen (lines 415-423). The mutation gate closes the seven callbacks, rotate/projection, REVEAL/HIDE, the deck picker and the token palette (lines 452-457, 500-520, 530). 15 render-recording tests pass, including A→B, B→A, A→B→C out-of-order and failure cases. Real-paint flicker under throttling: human items 2 and 3. |

**Score:** 11/13 truths verified (2 present but behavior-unverified: truths 5 and 6).

Re-verification delta: truths 1-4, 7-8 and 10-11 are unchanged from the prior report. Truth 9 moved from UNCERTAIN to VERIFIED after the 404a344 fix. Truths 12 and 13 are new, from the gap-closure plans. Truths 5 and 6 keep their prior PRESENT_BEHAVIOR_UNVERIFIED status, now with human UAT passes on record.

Note on regression scope: human UAT tests 1-4 were run before plans 34-06 and 34-07 changed the GM map. Those human passes do not cover the post-gap code. The automated gap-closure tests (24) and the freeze and cluster re-checks in the human items below are the coverage for that change.

### Plan Prohibitions (judgment tier)

The prior report flagged 11 judgment-tier prohibitions (plans 34-01 through 34-05) as `unverified-prohibition — human review recommended`. The 34-UAT.md run recorded test 7 as **pass**: the developer reviewed the 11 items and confirmed each holds. This is one batch resolution for the eleven items, not a per-item record. Plans 34-06 and 34-07 declare zero prohibitions. Net: 11 resolved by human UAT, 0 new flags, 0 failed.

| Plan | Prohibition (abridged) | Resolution |
|------|------------------------|------------|
| 01 | No optimistic local rotation before server echo | Human UAT test 7 pass |
| 01 | No absolute rotation accepted from a client | Human UAT test 7 pass |
| 02 | No re-apply of authored default on return to same location | Human UAT test 7 pass |
| 02 | No malformed default_view blocks load or reaches store unvalidated | Human UAT test 7 pass |
| 03 | No change to top-down output at offset 0 | Human UAT test 7 pass |
| 03 | No screen-space SVG rotation of the GM offset under iso | Human UAT test 7 pass |
| 04 | No view control, badge or cue on read-only mounts | Human UAT test 7 pass |
| 04 | No server call or broadcast change from the editor's local state | Human UAT test 7 pass |
| 04 | No pan/zoom reset or fade on unrelated updates | Human UAT test 7 pass |
| 05 | No projection, rotation or orientation control on player terminal, side panel or thumbnails | Human UAT test 7 pass |
| 05 | No server endpoint called from the deckplan editor preview | Human UAT test 7 pass |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `core/encounter_state.py` | `rotate_view` atomic, `set_projection` | VERIFIED | Lines 18-22, 82-100 |
| `core/views/active_view.py` | `sync_state_fn` atomic helper | VERIFIED | Lines 41-50 (added by fix 404a344) |
| `core/active_view_store.py` | `update_state_fn` under lock; normalization on load | VERIFIED | Lines 127-139; `normalize_view_fields` (fix e883546) |
| `core/encounter_view.py` | Enums, `normalize_default_view` | VERIFIED | Imported by `data_loader.py` and `navigation.py` |
| `core/views/navigation.py` | Default applied on location change, single store update | VERIFIED | Lines 83-91 |
| `core/data_loader.py` | `default_view` on both return paths | VERIFIED | Per prior report; `test_data_loader` passes |
| `docs/schemas/schema-encounters.md` | `default_view` table, deck `rotation` row (CLAUDE.md Schema Sync) | VERIFIED | Per prior report |
| `src/components/domain/encounter/geometry/viewOrientation.ts` | Normalizers, `buildProjection`, `screenRotationFor` | VERIFIED | 77 tests pass |
| `src/components/domain/encounter/viewTransition.ts` | Pure planner and predicates | VERIFIED | 47 tests pass |
| `src/components/domain/encounter/useOrientationTransition.ts` | GSAP executor | VERIFIED (wiring) / PRESENT_BEHAVIOR_UNVERIFIED (runtime) | Called at `EncounterMapRenderer.tsx`; no DOM test |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | Modes, cluster `[ccw][proj][cw]`, `ROTATE_BUTTON_STYLE` | VERIFIED | Lines 158-194 (styles), 958-1006 (cluster) |
| `src/components/domain/encounter/__tests__/EncounterMapRenderer.viewControls.test.tsx` | First renderer DOM test (34-06) | VERIFIED | 9 tests pass |
| `vitest.config.ts` | `@components`/`@hooks`/`@services` aliases | VERIFIED | Mirrors `vite.config.ts` |
| `src/components/gm/views/useLocationMapBundle.ts` | Slug-bound stale-guarded unit (34-07) | VERIFIED | Lines 76-137 |
| `src/components/gm/views/EncounterView.tsx` | Renders from bundle, latches inputs, mutation gate | VERIFIED | Lines 126-131, 408-423, 452-520, 530 |
| `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx` | Render-recording regression (34-07) | VERIFIED | 15 tests pass |
| `codemaps/frontend.md` | Hook and bind-and-freeze entry | VERIFIED | Lines 34, 158 |
| `.planning/.../34-CONTEXT.md` | Dated D-02 amendment (G-34-5) | VERIFIED | Line 33, original text intact |
| `.planning/.../34-UI-SPEC.md` | 18px glyph, 8px padding, new cluster order | VERIFIED | Lines 41, 63, 76, 239 |
| `src/components/domain/encounter/TokenLayer.tsx`, `renderer/PoiLayer.tsx` | Drag cancel on view change | VERIFIED (wiring) / PRESENT_BEHAVIOR_UNVERIFIED (runtime) | `shouldCancelDrag` at `TokenLayer.tsx:200`, `PoiLayer.tsx:74` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gm/views/EncounterView.tsx` | `services/encounterApi.ts` | `handleProjectionChange` → `setProjection`; `handleRotate` → `rotateView` | WIRED | Per prior report; handlers hold no local view state |
| `gm/views/EncounterView.tsx` | `useLocationMapBundle.ts` | `useLocationMapBundle({...})` at line 126 | WIRED | Bundle supplies mapData, hull, `locationKey` |
| `useLocationMapBundle.ts` | `services/encounterApi.ts` | `Promise.all([getAllDecks, getMapData])` (lines 109-112) | WIRED | Cancelled-flag guard on every run |
| `gm/views/EncounterView.tsx` | `gm/MapPreview.tsx` | `viewControl={{mode:'broadcast',...}}`, `locationKey={bundle?.slug}` | WIRED | Lines 452-481 |
| `EncounterMapRenderer.tsx` | `useOrientationTransition.ts` | `useOrientationTransition({...requested, locationKey}, fadeRef, handleResetView)` | WIRED | Runtime unexercised by DOM test |
| `EncounterMapRenderer.tsx` | `geometry/viewOrientation.ts` | `buildProjection` + `screenRotationFor` | WIRED | 34-03 truth 5 test composes them |
| `core/views/encounter.py` | `core/encounter_state.py` | `enc.rotate_view(delta)`, `enc.set_projection(...)` | WIRED | Django tests pass |
| `core/views/navigation.py` | `core/encounter_view.py` | `normalize_default_view(deckplan.get('default_view'))` | WIRED | Django tests pass |
| `core/encounter_state.py` | `core/active_view_store.py` | `_sync_fn` → `sync_state_fn` → `update_state_fn` (lock held) | WIRED | Fixes the prior UNCERTAIN race edge |
| `DeckplanPreviewPane.tsx` | `EncounterMapRenderer.tsx` | `viewControl={{mode:'local'}}` | WIRED | Local `useState` only; no service import |

### Mount audit (viewControl)

`mode: 'broadcast'` is mounted only in `gm/views/EncounterView.tsx:455-456`. `mode: 'local'` is mounted only in `gm/views/deckplan/DeckplanPreviewPane.tsx:236`. Every other mount (player terminal, GM side panel, bridge and dashboard thumbnails) takes the default `readonly`, which renders no cluster.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| GM `EncounterView` map | `currentDeckMapData` / `bundle.mapData` | `encounterApi.getMapData` via `useLocationMapBundle` | Yes | FLOWING |
| GM `EncounterView` orientation | `viewOrientation` | `activeView.encounter_projection` / `encounter_rotation_offset` from SSE | Yes | FLOWING |
| Rotate cluster | `handleRotate(delta)` | POSTs to `rotate-view`; map follows SSE echo only | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Cluster order, direction, 44px, mode gating | `pnpm exec vitest run EncounterMapRenderer.viewControls.test.tsx` | 9 passed | ✓ PASS |
| No mixed frame on location change; freeze gate | `pnpm exec vitest run EncounterView.locationChange.test.tsx` | 15 passed | ✓ PASS |
| Transition planner, orientation lattice, hit-test, grid projection | `pnpm exec vitest run` on 4 named files | 185 passed | ✓ PASS |
| Rotate step under lock; default_view; store atomicity; loader | `manage.py test core.tests.test_encounter_state core.tests.test_encounter_view_state core.tests.test_active_view_store core.tests.test_data_loader` | 103 OK | ✓ PASS |
| Full suites (typecheck, build, vitest 437, Django 184) | Orchestrator-reported, not re-run | OK | ✓ PASS (reported) |

### Probe Execution

No probes declared. The repository has no `scripts/*/tests/probe-*.sh` files, and this is not a migration or tooling phase. Skipped.

### Requirements Coverage

Every requirement ID declared in the plan frontmatter maps to REQUIREMENTS.md. No orphans.

| Requirement | Source Plans | Description (REQUIREMENTS.md) | Status | Evidence |
|-------------|--------------|-------------------------------|--------|----------|
| ISO-04 | 34-01, 34-02, 34-04, 34-05, 34-06 | Projection is a single GM-owned setting broadcast live; player terminal has no controls; editor keeps a private view | ✓ SATISFIED | Truths 1, 7, 12; mount audit. UAT tests 2, 5 |
| ISO-05 | 34-01, 34-02, 34-03, 34-04, 34-05, 34-06 | GM rotates in 90° steps as an offset on the authored rotation; iso keeps true 30° at every step | ✓ SATISFIED | Truths 2, 3, 8, 9, 12. UAT test 1 |
| ISO-06 | 34-02, 34-05, 34-07 | `default_view` applies on location change only; deck switches keep the view; broadcast view persists | ✓ SATISFIED | Truths 10, 11, 13. UAT test 6 (flicker re-check pending, human item 2) |
| ISO-07 | 34-03, 34-04, 34-05, 34-07 | Every element renders and hit-tests at every projection/rotation; rotation fades; projection cuts; drag cancelled | ✓ SATISFIED (human-confirmed behavior) | Truths 4, 5, 6, 13. Truths 5 and 6 are behavior-unverified in automation; UAT tests 1, 3, 4 pass |

ISO-02 is marked "Superseded by ISO-04" in REQUIREMENTS.md and is mapped to Phase 33. It is not a Phase 34 requirement and is not counted here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/gm/views/useLocationMapBundle.ts` | 124-130 | WR-01: failed location load leaves a permanent "Loading..." placeholder; no retry | ⚠️ Warning | Matches the plan's specified failure behavior (unit cleared, toast), so not a must-have failure. A dead end after a transient error. Disposition: open |
| `src/components/gm/views/useLocationMapBundle.ts` | 96-100 | WR-02: deck-map refetch failure only logged; the deck picker shows the new deck over the old geometry | ⚠️ Warning | Not specified by plan 34-07. Disposition: open |
| `src/components/gm/views/EncounterView.tsx` | 416-424 | WR-03: `latchedMapInputsRef` read during render, written in an effect | ⚠️ Warning | Works in the synchronous test harness. Concurrent or discarded renders could show a lagged latch. Disposition: open |
| `src/components/gm/views/EncounterView.tsx` | 466-512 | IN-01: no visual "frozen / loading" indicator | ℹ️ Info | Disposition: open |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | 183-187 | IN-02: comment says padding keeps 44px; the inherited min-size does | ℹ️ Info | Disposition: open |
| `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx` | 545-561 | IN-03: no test for map-fail-first or deck-only refetch failure | ℹ️ Info | Disposition: open |
| `data/ships/somnus/deckplan.yaml` | 4 | Uncommitted `default_view: {projection: iso, rotation_offset: 90}` line in working tree | ℹ️ Info | Feeds the UAT Somnus check; not in any commit. See coincidental_reliance_items |
| `.planning/ROADMAP.md` | phase 34 header | Status reads "Not started" while all 7 plans are checked off | ℹ️ Info | Stale roadmap status; not a code defect |
| `data/test_stub.md` | — | Untracked file | ℹ️ Info | Not part of this phase; looks like a test artifact |

No debt markers (`TBD`, `FIXME`, `XXX`) and no `TODO`/`HACK`/`PLACEHOLDER` in any file touched by plans 34-06 or 34-07. Debt-marker gate passes.

Review dispositions are all still `open` in `34-REVIEW-DISPOSITION.md`. None of the six findings is a 🛑 Blocker, so no evidence gate or advisory reclassification was needed. The developer should triage them.

### Advisory (New Scope, Unevidenced)

None. Re-verification ran, no new-scope 🛑 Blocker was raised, so nothing was downgraded.

### Human Verification Required

#### 1. UAT G-34-5 re-check: rotate glyphs, cluster order, sizes

**Test:** Open `/gmconsole/`, start an ENCOUNTER with a grid deckplan. Check the bottom-left cluster. Rotate in both directions. Check widths at 360px and about 768px.
**Expected:** Cluster reads `[⟲] [ISO VIEW | TOP DOWN] [⟳]`. The glyphs render as glyphs, not boxes; if they are boxes, switch `ROTATE_CCW_LABEL` and `ROTATE_CW_LABEL` (EncounterMapRenderer.tsx:163-164) to `CCW` / `CW`. Left turns counter-clockwise, right clockwise. Every button is at least 44x44. At 360px the cluster fits with no horizontal overflow and the legend is hidden.
**Why human:** Glyph legibility depends on the GM's font stack. The 194px width is derived, not measured.

#### 2. UAT G-34-6 re-check: flicker-free location change under throttling

**Test:** With DevTools network throttling, switch between a top-down ship and an iso/90 ship in both directions. Run A → B → C quickly. Switch decks inside one ship. Go to BRIDGE and back.
**Expected:** No top-down flash and no re-projected copy of the previous ship; no mixed rooms or hull. One cut to the new map. This needs the Somnus `default_view` fixture to be present in the working tree (see coincidental_reliance_items).
**Why human:** Real paint timing cannot be reproduced in jsdom. The regression test records render props, not painted frames.

#### 3. Freeze-window controls are inert on screen

**Test:** Under throttling, switch to a new location while the old map is still shown. Look at the rotate and projection buttons, REVEAL ALL / HIDE ALL, the deck picker and the token palette. Try to drag a token.
**Expected:** Rotate and projection buttons are absent; REVEAL ALL, HIDE ALL and the deck picker are disabled; the token palette is not offered; tokens cannot be dragged or dropped. Everything returns when the new map appears.
**Why human:** The gate is covered by render-recording tests, but whether the controls read as inert on screen is visual.

## Gaps Summary

No must-have truth FAILED. No artifact is MISSING or STUB. No key link is NOT_WIRED. No 🛑 Blocker. **Phase goal achieved in the codebase.** The remaining work is human confirmation of the two visual gap-closure checks and the freeze-window gate (items 1-3), plus developer triage of the six open review findings.

Items 1 and 2 are re-checks of the two original UAT issues. The gap plans fixed the code, but UAT has not re-run against the fixed code. Until those checks are recorded, the UAT issues stay open.

Warnings WR-01 to WR-03 are real UX and robustness gaps in the new location-bundle path. They are not must-have failures, because plan 34-07 specified the failure behavior that WR-01 describes. Treat them as triage items, not as gap-closure blockers.

Superseded plan text: plan 34-04 truths 3 and 6 describe the pre-G-34-5 cluster order and the 11px rotate style. Plan 34-06, the D-02 amendment in CONTEXT.md, and UI-SPEC supersede both. This report verifies against the new contract.

---

_Verified: 2026-10-16T20:08:18Z_
_Verifier: Claude (gsd-verifier)_
