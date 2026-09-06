---
phase: 33-isometric-view
plan: 02
subsystem: encounter-map
tags: [tokens, poi, drag-drop, grid-snap, react, encounter-map, isometric]

# Dependency graph
requires:
  - phase: 33-isometric-view
    provides: "isoProjection() true-isometric transform, MapView.project()/unproject(), live top-down/iso toggle (Plan 33-01)"
provides:
  - getGridCellViaView() — projection-aware sibling of snapToGrid/getGridCell, unit-tested for both topDownProjection regression parity and isoProjection round-trip correctness
  - Token.tsx/TokenLayer.tsx migrated from raw unitSize:number to view:MapView (token glyphs render at correct projected position under iso)
  - All 4 mouse-inversion call sites (TokenLayer drag-to-move, useTokenPlacement drag-drop, EncounterMapRenderer editor "add POI" click, PoiLayer editor POI drag) resolve grid cell via view.unproject(), not raw unitSize division
affects: [33-03]

# Actuals (#2632)
actuals:
  tokens: 4567
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getGridCellViaView(view, svgX, svgY) as the single mouse-inversion path for any screen position resolving to a grid cell, replacing raw unitSize division wherever a MapView is available"

key-files:
  created:
    - src/utils/__tests__/svgCoordinates.test.ts
  modified:
    - src/utils/svgCoordinates.ts
    - src/components/domain/encounter/Token.tsx
    - src/components/domain/encounter/TokenLayer.tsx
    - src/hooks/useTokenPlacement.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/renderer/PoiLayer.tsx
    - src/components/gm/MapPreview.tsx

key-decisions:
  - "TokenLayer's drag-to-move snap (unitSizeRef -> viewRef) was migrated in Task 2's commit rather than deferred to Task 3, since removing unitSizeRef to support the view:MapView prop change immediately breaks the old snapToGrid call at that site — the two changes are inseparable in a single compiling commit."
  - "PoiLayer's document-level drag-pointer useEffect now closes over `view` directly (added to its dependency array) instead of introducing a viewRef, per the plan's explicit instruction to drop the ref pattern rather than replace it; mapRotation/mapCenterX/mapCenterY keep their existing ref-mirroring pattern unchanged."

patterns-established:
  - "Any future call site converting a screen/SVG position back to a grid cell uses getGridCellViaView(view, ...) after screenToSVG + inverseRotatePoint, never raw division by unitSize."

requirements-completed: [ISO-01, ISO-03]

coverage:
  - id: D1
    description: "getGridCellViaView(view, svgX, svgY) is byte-identical to snapToGrid under topDownProjection and correctly inverts isoProjection round-trips"
    requirement: "ISO-03"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/svgCoordinates.test.ts#getGridCellViaView"
        status: pass
    human_judgment: false
  - id: D2
    description: "Token.tsx renders every token glyph's position via view.project({gx:x+0.5,gy:y+0.5}) and every size via view.unitSize, not raw unitSize*data.x arithmetic (Pitfall 1 closed)"
    requirement: "ISO-01"
    verification:
      - kind: manual_procedural
        ref: "grep -n 'unitSize: number' src/components/domain/encounter/Token.tsx src/components/domain/encounter/TokenLayer.tsx (0 matches); pnpm run typecheck (0 errors)"
        status: pass
    human_judgment: true
    rationale: "Visual correctness of token position/sizing under the live iso toggle requires a human to view the rendered map — no DOM-render test infrastructure exists in this repo (per 33-01's RESEARCH.md finding) to assert this automatically."
  - id: D3
    description: "All 4 mouse-inversion call sites (TokenLayer drag-to-move, useTokenPlacement drag-drop, EncounterMapRenderer editor-mode 'add POI' click, PoiLayer editor POI drag x2) resolve grid cell via getGridCellViaView(view, ...), closing every place a GM drag/drop could silently commit to the wrong cell under iso"
    requirement: "ISO-03"
    verification:
      - kind: unit
        ref: "grep -rn 'snapToGrid|getGridCell\\(' src/components/domain/encounter/TokenLayer.tsx src/hooks/useTokenPlacement.ts src/components/domain/encounter/EncounterMapRenderer.tsx src/components/domain/encounter/renderer/PoiLayer.tsx (0 matches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "MapPreview.tsx's legacy (non-grid) EncounterMapData renderer is visually unaffected — its independent unitSize-based room/connection/drag-drop math is untouched; it only gains a topDownProjection-backed legacyView to satisfy TokenLayer's updated prop contract"
    requirement: "ISO-01"
    verification:
      - kind: unit
        ref: "pnpm run test (250/250 pass, including pre-existing suite with zero regressions)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-06
status: complete
---

# Phase 33 Plan 02: Token Render + Mouse-Inversion Migration to view: MapView Summary

**Token glyphs now render their position/size via `view.project()`/`view.unitSize` instead of raw `unitSize` arithmetic, and all 4 GM drag/drop grid-snap call sites resolve cells via the new unit-tested `getGridCellViaView()` helper — closing both remaining iso-projection bypass pitfalls this session's audit found.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-06 (worktree fast-forwarded from a stale base to pick up Plan 33-01's commits before starting)
- **Completed:** 2026-09-06
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- `getGridCellViaView(view, svgX, svgY)` added to `svgCoordinates.ts` as the projection-aware sibling of `snapToGrid`/`getGridCell` — unit-tested for both top-down regression parity and iso round-trip correctness (new `svgCoordinates.test.ts`, this module's first test file).
- `Token.tsx` migrated from a raw `unitSize: number` prop to `view: MapView`: center position now computed via `view.project({gx: data.x+0.5, gy: data.y+0.5})`, and all size math (radius/glow/stroke) via `view.unitSize` — Pitfall 1 closed (every token's visible position now correct under iso).
- `TokenLayer.tsx` threads a single `view: MapView` prop to both its live and ghost-drag `Token` renders, and its own drag-to-move grid-cell snap now uses `getGridCellViaView`.
- `useTokenPlacement.ts` migrated from `unitSize: number` to `view: MapView`; its drag-drop placement handler now runs the full `screenToSVG` → `inverseRotatePoint` → `getGridCellViaView` pipeline instead of the raw-unitSize `getGridCell`.
- `EncounterMapRenderer.tsx`'s editor-mode "click empty cell to add POI" snap and its `useTokenPlacement` call site both migrated to `view`/`getGridCellViaView`.
- `PoiLayer.tsx`'s two document-level drag handlers (pointermove/pointerup) migrated to `getGridCellViaView`; the now-dead `unitSize` prop, `unitSizeRef`, and its syncing effect were removed entirely.
- `MapPreview.tsx`'s legacy (non-grid) `EncounterMapData` renderer gained a `topDownProjection`-backed `legacyView` solely to satisfy `TokenLayer`'s updated prop contract — its own independent unitSize-based room/connection/drag-drop math is completely untouched, so this deprecated screen has zero visual regression and correctly gains no iso capability.

## Task Commits

Each task was committed atomically (TDD RED/GREEN pair for Task 1, standard commits for Tasks 2-3):

1. **Task 1 — RED:** `bfd9d09` (test) — failing `getGridCellViaView` tests (regression parity + iso correctness)
2. **Task 1 — GREEN:** `d7ada52` (feat) — `getGridCellViaView()` implementation
3. **Task 2:** `04b3e8a` (feat) — Token/TokenLayer render migration to `view: MapView` (includes TokenLayer's own drag-to-move snap migration, made necessary by removing `unitSizeRef`)
4. **Task 3:** `f5ab45d` (feat) — wired `getGridCellViaView` into the remaining 3 mouse-inversion call sites (`useTokenPlacement`, `EncounterMapRenderer`'s editor snap, `PoiLayer`'s 2 drag handlers)

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `src/utils/svgCoordinates.ts` — added `getGridCellViaView()`
- `src/utils/__tests__/svgCoordinates.test.ts` (new) — regression-parity + iso-correctness tests
- `src/components/domain/encounter/Token.tsx` — `view: MapView` prop, position/size via `view.project()`/`view.unitSize`
- `src/components/domain/encounter/TokenLayer.tsx` — `view: MapView` prop, `viewRef` mirror, both Token render call sites + drag-to-move snap migrated
- `src/hooks/useTokenPlacement.ts` — `view: MapView` prop, `handleDrop` migrated to `getGridCellViaView`
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — `TokenLayer`/`PoiLayer`/`useTokenPlacement` call sites updated; editor "add POI" snap migrated
- `src/components/domain/encounter/renderer/PoiLayer.tsx` — dead `unitSize` prop/ref/effect removed; both drag handlers migrated to `getGridCellViaView`
- `src/components/gm/MapPreview.tsx` — added `legacyView` (topDownProjection-backed) to satisfy `TokenLayer`'s new prop contract; its own unitSize math untouched

## Decisions Made
- TokenLayer's drag-to-move snap was migrated inside Task 2's commit (not deferred to Task 3) since removing `unitSizeRef` to support the `view: MapView` prop change would otherwise leave a non-compiling reference to the old ref at that call site — the two changes are inseparable in a single working commit.
- PoiLayer's document-level drag-pointer `useEffect` now closes over `view` directly (added to its dependency array) rather than introducing a `viewRef`, per the plan's explicit instruction to drop the ref pattern rather than replace it. `mapRotation`/`mapCenterX`/`mapCenterY` keep their existing ref-mirroring pattern unchanged since the plan didn't ask to touch them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules in a fresh worktree**
- **Found during:** Task 1 (running `pnpm run typecheck`/`test` for the first time)
- **Issue:** This worktree had no `node_modules` installed (`tsc: not found`), blocking all verification commands.
- **Fix:** Ran `pnpm install` (matches `pnpm-lock.yaml`, zero lockfile changes).
- **Files modified:** None (dependency install only, no package.json/lockfile changes).
- **Verification:** `pnpm run typecheck` and `pnpm run test` both run cleanly afterward.
- **Committed in:** N/A (no commit needed — install artifacts are gitignored `node_modules/`).

**2. [Rule 3 - Blocking] Worktree branch was forked from a stale base, missing Plan 33-01's commits**
- **Found during:** Startup (before Task 1) — `.planning/phases/33-isometric-view/` did not exist in the initial working tree, contradicting the task prompt's stated precondition that Wave 1's work was already present.
- **Issue:** This worktree's branch (`worktree-agent-a4bdf5f40bb68dce5`) was a strict git ancestor of `gsd/phase-33-isometric-view` (merge-base equaled this branch's HEAD) — Plan 33-01's 9 commits (isoProjection, MapView.circleTransform, the toggle button) were entirely absent.
- **Fix:** Ran `git merge --ff-only gsd/phase-33-isometric-view`. This was safe and purely additive: the worktree branch had zero unique commits to lose (merge-base == HEAD), so the fast-forward only added the missing Wave-1 history without rewriting or discarding anything.
- **Files modified:** None directly (brought in Plan 33-01's already-committed files).
- **Verification:** `git log` confirmed all 9 of Plan 33-01's commits present afterward; `.planning/phases/33-isometric-view/33-01-SUMMARY.md`, `gridProjection.ts`'s `isoProjection()`, and `mapView.ts`'s `circleTransform()` all present as expected.
- **Committed in:** N/A (fast-forward merge, no new commit created — HEAD simply advanced).

---

**Total deviations:** 2 auto-fixed (2 blocking — environment/worktree setup issues, zero code deviations from the plan's specified implementation)
**Impact on plan:** Both fixes were necessary preconditions for executing the plan at all; neither touched application code or changed the plan's scope. All 3 tasks were implemented exactly as specified.

### Note on an unsatisfiable literal acceptance-criterion grep (same pattern as 33-01)

Task 2's acceptance criteria include `grep -n "unitSize" src/components/domain/encounter/Token.tsx src/components/domain/encounter/TokenLayer.tsx` returning zero matches. As written this plain substring grep also matches `view.unitSize` (used for token radius/glow/stroke sizing, exactly as the task's own `<action>` specifies). The actual intent — confirmed by the task's `<done>` criterion ("Token.tsx renders every token glyph's position via view.project() and every size via view.unitSize") — is that the raw/bare `unitSize` **prop** (not `view.unitSize`) is removed. Verified instead via `grep -n "unitSize: number"` (0 matches in both files) and confirming no bare `unitSize` prop remains in either `TokenProps` or `TokenLayerProps`. Treated as the same plan-authoring imprecision 33-01's SUMMARY already documented, not a new deviation.

## Issues Encountered
None beyond the two blocking-issue auto-fixes documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every mouse-inversion call site (drag-to-move, drag-drop placement, editor "add POI" click, editor POI drag) and the token render path are now iso-correct via `getGridCellViaView`/`view.project()`.
- Plan 33-03's job (per ROADMAP/STATE): full-suite phase gate and remaining iso-projection polish. No blockers from this plan.

---
*Phase: 33-isometric-view*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 8 key files verified present on disk. All 4 commits (bfd9d09, d7ada52, 04b3e8a, f5ab45d) verified present in `git log`. Re-ran `pnpm run typecheck` (0 errors) and `pnpm run test` (250/250 pass, 14 test files) — both clean with zero regressions. Re-verified all 3 tasks' acceptance-criteria greps: `getGridCellViaView` exported (Task 1); no bare `unitSize` prop in Token.tsx/TokenLayer.tsx (Task 2); zero `snapToGrid`/`getGridCell(` matches across the 4 migrated call sites and no `unitSize` prop remaining in PoiLayer.tsx (Task 3).
