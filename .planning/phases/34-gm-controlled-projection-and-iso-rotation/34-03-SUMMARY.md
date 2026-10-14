---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 03
subsystem: encounter-view
tags: [typescript, vitest, projection, isometric, transitions, tdd]

requires:
  - phase: 34-01
    provides: topDownProjection rotation option and the payload-to-pixels test block
  - phase: 34-02
    provides: backend enums (projection top-down/iso, offsets 0/90/180/270, deltas +/-90) mirrored by the client types
provides:
  - "viewOrientation.ts: ViewProjection/RotationOffset/RotateDelta/ViewOrientation/ViewControl types, DEFAULT_VIEW_ORIENTATION, never-throwing normalizers, toViewOrientation, stepRotationOffset, buildProjection with the authored-rotation fold under iso (D-15), screenRotationFor"
  - "viewTransition.ts: classifyChange, planTransition (ordered fadeOut/snap/fadeIn, restore, cut, none), orientationOf, buildViewKey, shouldCancelDrag, shouldClosePopover, fade constants"
  - "Test proof that all 16 offset x authored combinations keep true 30-degree iso axes and that pointer-to-cell resolution is correct for 2 x 4 x 2 projection/offset/authored combinations"
affects: [34-04, 34-05]

actuals:
  tokens: 8000
  tasks: 2
  commits: 4
plan_head_before: a9416ebd78f1b81bda8e147702a739eaf46e7297
plan_head_after: 0c4d9300a279ed36cdf357ab0513e09fd837034b

tech-stack:
  added: []
  patterns:
    - "All rotation/transition decisions live in pure modules with no React/GSAP/DOM imports, so vitest covers them"
    - "Top-down: GM offset inside the projection, authored rotation as outer screen rotation; iso: both folded into the grid azimuth, no screen rotation"

key-files:
  created:
    - src/components/domain/encounter/geometry/viewOrientation.ts
    - src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts
    - src/components/domain/encounter/viewTransition.ts
    - src/components/domain/encounter/__tests__/viewTransition.test.ts
  modified:
    - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
    - src/utils/__tests__/svgCoordinates.test.ts

key-decisions:
  - "Authored deck rotation is folded into the iso azimuth (45 + offset + authored) and screenRotationFor('iso', _) is 0, so Somnus-style rotated decks keep true 30-degree axes (D-15)"
  - "classifyChange: location change alone is 'none'; projection or location change together with an offset change is 'cut'; only offset-only changes fade (and cut under reduced motion)"
  - "planTransition returns change 'restore' with only fadeIn when the displayed orientation already equals the latest request, so no snap and no pan/zoom reset occurs"

requirements-completed: [ISO-05, ISO-07]

coverage:
  - id: D1
    description: "viewOrientation normalizers coerce any invalid projection/offset (45, 360, -90, strings, null, undefined, NaN) to top-down/0 without throwing; stepRotationOffset wraps both ways"
    requirement: ISO-05
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts#normalizeRotationOffset / toViewOrientation / stepRotationOffset"
        status: pass
    human_judgment: false
  - id: D2
    description: "Payload-to-pixels through the shared module: offset 90/180/270 map grid (1,0) to (0,40)/(-40,0)/(0,-40); offset 0 is point-for-point identical to Phase 33 in both projections"
    requirement: ISO-05
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts#payload to pixels / offset 0 reproduces the Phase 33 projections"
        status: pass
    human_judgment: false
  - id: D3
    description: "Authored rotation folded into the iso azimuth; top-down ignores it in buildProjection and screenRotationFor returns it; iso axes stay on the 30-degree lattice at length 28.2843 for all 16 offset x authored pairs"
    requirement: ISO-05
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts#true isometric across the 16 offset x authored combinations"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pointer-to-cell pipeline returns the drawn cell (incl. negative coordinates, off-centre points) for all projection x offset x authored combinations"
    requirement: ISO-05
    verification:
      - kind: unit
        ref: "src/utils/__tests__/svgCoordinates.test.ts#pointer-to-cell pipeline across projection x offset x authored rotation"
        status: pass
    human_judgment: false
  - id: D5
    description: "Transition decisions: classifier none/cut/fade, reduced-motion cut, ordered fadeOut-snap-fadeIn plan with a single snap, restore, latest-request snap target via orientationOf, view key, drag-cancel and popover-close predicates"
    requirement: ISO-07
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/__tests__/viewTransition.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-14
status: complete
---

# Phase 34 Plan 03: View Orientation and Transition Logic Summary

**Pure, fully tested view-orientation module (closed-enum normalizers, authored-rotation fold under iso, screenRotationFor) and pure transition planner (none/cut/fade/restore, reset-at-snap, drag-cancel, popover-close) so the renderer plan 34-04 is wiring only.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files:** 6 (4 created, 2 modified)
- **Tests:** full `pnpm run test` 413 pass across 16 files; typecheck clean

## Accomplishments

- `viewOrientation.ts` imports only `./gridProjection`. `buildProjection('iso', offset, unit, authored)` uses azimuth `45 + offset + authored`; top-down passes only the offset and leaves the authored rotation to the outer screen rotate, reported by `screenRotationFor`.
- Verified in vitest: all 16 offset x authored combinations keep both iso axes on the 30/150 degree lattice at 28.2843 px; offset 0 reproduces Phase 33 output exactly in both projections; `view.unitSize` is invariant per projection.
- Hit-testing matrix (2 projections x 4 offsets x 2 authored, 4 cells incl. negative coords, 2 in-cell fractions) resolves the drawn cell through screen rotate, inverse rotate, and `getGridCellViaView`.
- `viewTransition.ts` imports only the `ViewOrientation` type. 47 tests cover the truth tables, including mixed projection+offset and location+offset changes cutting, and the `restore` case that avoids a pan/zoom reset.

## Task Commits

1. **Task 1 RED** - `cdfbee1` (test)
2. **Task 1 GREEN** - `984e8c0` (feat)
3. **Task 2 RED** - `619e84d` (test)
4. **Task 2 GREEN** - `0c4d930` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Decisions Made

None beyond the plan; D-05 to D-09, D-13, D-15, D-18 implemented as specified.

## Deviations from Plan

None - plan executed exactly as written. `gridProjection.ts` needed no change: the 34-01 `topDownProjection` already satisfied the quarter-turn, positive-zero, -90/450 normalization and round-trip tests.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks, so the `tdd-red-evidence` classifier was not run. Each task has a `test(34-03)` commit before its `feat(34-03)` commit (cdfbee1 < 984e8c0, 619e84d < 0c4d930). No REFACTOR commits were needed.

RED semantic assessment: both RED runs failed at module import (`Failed to resolve import "../viewOrientation"` / `"../viewTransition"`), the failure mode the plan itself names; this is a collection-level failure, not a per-assertion RED. The gridProjection additions characterize 34-01 behavior and passed at once, as the plan anticipated (RED test files: viewOrientation.test.ts, svgCoordinates.test.ts, viewTransition.test.ts).

## Known Stubs

None.

## Threat Flags

None. T-34-11 is mitigated here (`toViewOrientation` / `normalizeRotationOffset` are total and tested with 45, 360, -90, strings, null, NaN); plan 34-04 must replace the 34-01 inline guard in `gm/views/EncounterView.tsx` with them. T-34-12 accepted as planned; no packages installed (T-34-SC).

## Self-Check

- Created files exist: viewOrientation.ts, viewOrientation.test.ts, viewTransition.ts, viewTransition.test.ts.
- Commits `cdfbee1`, `984e8c0`, `619e84d`, `0c4d930` are ancestors of HEAD; `git rev-list --count` from the ledger base is 4.
- Acceptance greps: single `export function` matches for screenRotationFor, toViewOrientation, classifyChange, planTransition, shouldCancelDrag, shouldClosePopover, buildViewKey, orientationOf; one import line in each new module; `45 + rotationOffset + authoredRotation` present once; `it.each` count 11 in viewOrientation.test.ts; `getGridCellViaView` count 5 in svgCoordinates.test.ts.
- Verification: the four-file vitest run passes, `pnpm run test` 413 pass, `pnpm run typecheck` clean.

## Self-Check: PASSED

## Next Phase Readiness

Ready for 34-04 (renderer wiring): consume `toViewOrientation`, `buildProjection`, `screenRotationFor`, `planTransition`, `shouldCancelDrag`, `shouldClosePopover` and `ViewControl`; remove the inline offset guard from 34-01.

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-14*
