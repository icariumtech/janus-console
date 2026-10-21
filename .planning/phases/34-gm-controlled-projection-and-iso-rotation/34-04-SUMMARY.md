---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 04
subsystem: encounter-view
tags: [react, typescript, gsap, svg-projection, view-control]
requires:
  - phase: 34-01
    provides: tracer props, encounterApi.rotateView, ActiveView projection/offset fields
  - phase: 34-03
    provides: viewOrientation.ts and viewTransition.ts pure modules
provides:
  - "EncounterMapRenderer viewOrientation / viewControl / locationKey contract with readonly, broadcast and local modes"
  - "Bottom-left control cluster (projection toggle, rotate ccw/cw) on a shared 44px OVERLAY_BUTTON_STYLE"
  - "useOrientationTransition: GSAP executor of planTransition (fade, snap+pan/zoom reset, cut, restore)"
  - "Mid-drag cancel in TokenLayer and PoiLayer, popover close on geometry change"
affects: [34-05]

actuals:
  tokens: 5000
  tasks: 2
  commits: 2
plan_head_before: 0f8b362830e396a0f0ee2615201305520791f28b
plan_head_after: ab345274ce177deb057f317a34d5966939bab4c1

tech-stack:
  added: []
  patterns:
    - "Renderer owns no decision logic for rotation: durations, eases, step order, snap target, drag-cancel and popover-close predicates all come from vitest-covered pure functions"
    - "GSAP exclusively owns the fade wrapper's inline opacity; React never sets it"

key-files:
  created:
    - src/components/domain/encounter/useOrientationTransition.ts
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/EncounterMapRenderer.css
    - src/components/domain/encounter/TokenLayer.tsx
    - src/components/domain/encounter/renderer/PoiLayer.tsx
    - src/hooks/useTokenPlacement.ts
    - src/components/gm/MapPreview.tsx
    - src/components/gm/views/EncounterView.tsx

key-decisions:
  - "mapRotation now holds the residual screen rotation (screenRotationFor), so rotViewBox math and every inverse-rotate call site keep working untouched"
  - "Local mode is structurally server-free: private useState, explicit branch that never calls control callbacks, and the renderer imports no service module"
  - "GM EncounterView passes viewControl mode 'broadcast' with only onRotate; the projection broadcast callback is deferred to 34-05"

requirements-completed: [ISO-04, ISO-05, ISO-07]

coverage:
  - id: D1
    description: "Renderer view modes (readonly / broadcast / local), D-15 projection pipeline through buildProjection and screenRotationFor, control cluster with UI-SPEC copy, colours and 44px targets, legend hidden below 480px, drop handler re-binds on geometry change, tracer props migrated to viewOrientation / viewControl"
    requirement: ISO-04
    verification:
      - kind: other
        ref: "pnpm run typecheck && pnpm run test (413 pass) && pnpm run build; acceptance greps for labels, titles, aria-labels, OVERLAY_BUTTON_STYLE count, single mapRotation, no services import"
        status: pass
    human_judgment: true
    rationale: "The repo has no component test harness, so cluster rendering, copy/colour fidelity, glyph legibility and the local-mode behavior are confirmed visually in plan 34-05."
  - id: D2
    description: "useOrientationTransition executes the tested transition plan: fade-out, snap with pan/zoom reset at opacity 0, fade-in; cut on projection/location change and reduced motion; restore without reset; timeline killed on restart and unmount"
    requirement: ISO-07
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/__tests__/viewTransition.test.ts (47 pass; plan, classifier and snap target logic)"
        status: pass
    human_judgment: true
    rationale: "The GSAP wiring itself (timing feel, no stuck opacity, reset at the snap) is not DOM-tested; verified by the human checks in 34-05."
  - id: D3
    description: "Pending or active token/POI drags are cancelled via shouldCancelDrag on requested-orientation key or view change with no move callback; open popovers close via shouldClosePopover"
    requirement: ISO-07
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/__tests__/viewTransition.test.ts#shouldCancelDrag / shouldClosePopover"
        status: pass
    human_judgment: true
    rationale: "The effects in TokenLayer, PoiLayer and the renderer that call these predicates have no DOM test; verified by the 34-05 human checks."
  - id: D4
    description: "The rotate glyphs render visibly in the GM's browser with the Cascadia Code font stack"
    requirement: ISO-04
    verification:
      - kind: manual_procedural
        ref: "34-05 human check (fallback: set ROTATE_CCW_LABEL / ROTATE_CW_LABEL to 'CCW' / 'CW')"
        status: unknown
    human_judgment: true
    rationale: "Glyph availability depends on the GM's installed fonts and cannot be asserted from code."

duration: 8min
completed: 2026-10-14
status: complete
---

# Phase 34 Plan 04: Renderer View Control and Rotation Transition Summary

**EncounterMapRenderer is now a view-controlled component: readonly / broadcast / local modes, a shared-style bottom-left cluster, the D-15 projection pipeline, and a GSAP hook that executes the tested transition plan (fade on rotation, cut on projection or location change, pan/zoom reset at the snap), with popover close and mid-drag cancel.**

## Performance

- **Duration:** ~8 min (20:46 to 20:54 UTC)
- **Tasks:** 2
- **Files:** 8 (1 created, 7 modified)
- **Verification:** `pnpm run typecheck` clean, `pnpm run test` 413 pass across 16 files (viewTransition.test.ts 47 pass), `pnpm run build` succeeds

## Accomplishments

- Task 1: removed the 34-01 tracer props and local `projectionMode` state. The renderer takes `viewOrientation` and `viewControl`, derives `requested` from a broadcast value or private local state (local always opens top-down / 0), builds the projection with `buildProjection(..., authoredRotation)` and defines `mapRotation = screenRotationFor(...)` once. The cluster (`ISO VIEW | TOP DOWN`, `⟲`, `⟳`) renders only for broadcast (per supplied callback) and local modes, using the shared `OVERLAY_BUTTON_STYLE` (44px targets, also used by RESET VIEW). Legend hidden under 480px. `useTokenPlacement` drop handler re-binds on rotation/centre change. `MapPreview` forwards the new props; GM `EncounterView` derives orientation through `toViewOrientation` (inline guard removed) and passes `{ mode: 'broadcast', onRotate }`.
- Task 2: `useOrientationTransition` (state, refs, a layout effect keyed only on `projection`, `rotationOffset`, `locationKey`) runs `planTransition` and translates steps into a GSAP timeline; the snap reads the latest request via a ref; cuts clear inline opacity and reset pan/zoom in the same frame; unmount kills the timeline and clears opacity. The svg sits in `div.encounter-map-renderer__fade` (no React opacity); overlays and popups remain outside it. `TokenLayer` and `PoiLayer` take `viewKey` and cancel drags with `shouldCancelDrag`.

## Task Commits

1. **Task 1** - `3fcd5ec` (feat): view-control modes, projection pipeline, cluster, prop migration
2. **Task 2** - `ab34527` (feat): transition hook, fade wrapper, popover close, drag cancel

## Decisions Made

- Used `{displayed.projection, displayed.rotationOffset, closePopover}` as the popover-close effect dependencies (per plan) rather than the object, so a re-created but equal displayed object never triggers a check.
- The hook's two `react-hooks/exhaustive-deps` suppressions are intentional: the primitive-only dependency list is the P-reset contract.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Not applicable: both tasks are `type="auto"` without `tdd="true"`. The decisions they execute were already covered test-first in 34-03; the plan prohibits DOM tests (no component test harness in the repo).

## Known Stubs

None.

## Threat Flags

None. T-34-13 (readonly default renders no cluster; 34-05 will grep that only the GM map passes `mode: 'broadcast'`), T-34-14 (local mode explicit branch, no service import: `grep -c "services/"` is 0), T-34-15 (no React opacity; kill + clearProps on restart, cut and unmount) and T-34-16 (`shouldCancelDrag` on key and view object) are mitigated as planned. No packages installed (T-34-SC). No schema or data-shape changes, so `docs/schemas/` is unchanged.

## Issues Encountered

None. Visual and interaction behavior (fade feel, glyph rendering, narrow viewport, drag cancel) is deferred to the human checks in 34-05 as planned.

## Self-Check

- Created file `src/components/domain/encounter/useOrientationTransition.ts` exists.
- Commits `3fcd5ec` and `ab34527` are ancestors of HEAD; `git rev-list --count` from the ledger base is 2.
- Acceptance greps all match as specified for both tasks (OVERLAY_BUTTON_STYLE x5, single aria-labels/titles/glyph constants, one `screenRotationFor(` and `const mapRotation`, no `setProjectionMode`, no `services/`, `power1` count 0 in the hook, wrapper has no `style=`, one `shouldCancelDrag(` per layer, dependency list is the three primitives).

## Self-Check: PASSED

## Next Phase Readiness

Ready for 34-05: wire the remaining mounts (player terminal readonly, deckplan editor local, GM projection callback `onProjectionChange` and `locationKey`) and run the human checks for glyphs, fade timing, reset, drag cancel and the narrow viewport.

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-14*
