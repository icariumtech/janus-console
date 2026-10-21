---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 06
subsystem: ui
tags: [react, vitest, jsdom, encounter-map, view-controls, gap-closure]
requires:
  - phase: 34-gm-controlled-projection-and-iso-rotation
    provides: "View-control cluster (projection toggle + rotate buttons) in EncounterMapRenderer (plans 34-01..34-05)"
provides:
  - "GM view-control cluster ordered [rotate-ccw][projection][rotate-cw] with 18px rotate glyphs in 44x44 buttons"
  - "First component-level DOM test in the repo (createRoot + act, no new dependency)"
  - "vitest aliases @components/@hooks/@services mirroring vite.config.ts"
  - "34-UI-SPEC.md and 34-CONTEXT.md D-02 amendment recording the G-34-5 contract"
affects: [34-07, ui-review, verify-work]
status: complete
commits: 4
plan_head_before: 8834e77d7805fbe537a95e8676ef7fb01decebb7
plan_head_after: f3f82f7eaed8fbc9454f8e063c43a889bacf91f8
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - "Renderer-level DOM test: createRoot + act, ResizeObserver stub, buttons classified by className not glyph text"
    - "Single-line assertion values (joined strings) so vitest TAP failures stay parseable by the RED-evidence classifier"
key-files:
  created:
    - src/components/domain/encounter/__tests__/EncounterMapRenderer.viewControls.test.tsx
  modified:
    - vitest.config.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - .planning/phases/34-gm-controlled-projection-and-iso-rotation/34-UI-SPEC.md
    - .planning/phases/34-gm-controlled-projection-and-iso-rotation/34-CONTEXT.md
key-decisions:
  - "Rotate glyph buttons use ROTATE_BUTTON_STYLE (18px, letterSpacing 0, lineHeight 1, padding 8px) so they stay exactly 44x44 and the cluster stays about 194px wide"
  - "D-02 amended in CONTEXT.md at the GM's UAT request: 'beside' is realised as flanking; original D-02 text left intact"
requirements-completed: [ISO-04, ISO-05]
duration: 12 min
completed: 2026-10-16
---

# Phase 34 Plan 06: Flanking Rotate Buttons Summary

GM view-control cluster now reads rotate-ccw, ISO VIEW / TOP DOWN, rotate-cw with 18px rotate glyphs in 44x44 targets, locked by the repo's first component-level DOM test.

## Accomplishments

- Reordered the cluster in `EncounterMapRenderer.tsx` to `[rotate-ccw][projection][rotate-cw]` (G-34-5); handlers, class names, titles and aria attributes untouched, so each rotate button still drives its own direction.
- Added `ROTATE_BUTTON_STYLE` / `ROTATE_GLYPH_FONT_SIZE` (18px glyph, letterSpacing 0, lineHeight 1, padding 8px, inherits 44px min size).
- Added `EncounterMapRenderer.viewControls.test.tsx` (9 tests): order in local and broadcast modes, single-callback gating, read-only no-cluster, direction wiring (-90 / 90), toggle projection call, glyph size, 44px targets.
- Mirrored `@components`, `@hooks`, `@services` aliases in `vitest.config.ts` (unblocks 34-07's renderer-level test).
- Updated 34-UI-SPEC.md (Typography, Control cluster, Spacing, Narrow viewports, Discretion row 4, Reconciliation) and added the dated D-02 amendment to 34-CONTEXT.md.

## Task Commits

| Task | Commit | Type | Description |
| ---- | ------ | ---- | ----------- |
| 1 (infra) | 2934049 | chore | Mirror vite path aliases in vitest config |
| 1 (RED) | 94e1715 | test | Failing test for cluster order and glyph size |
| 1 (GREEN) | af73bcb | feat | Flank the toggle with larger rotate buttons |
| 2 | f3f82f7 | docs | Amend D-02 and update UI-SPEC |

## TDD Gate Compliance

- RED: `pnpm exec vitest run --reporter=tap-flat` on the new file. Target test: "broadcast mode with both callbacks renders rotate-ccw, projection toggle, rotate-cw in that order". Failed on the planned assertion (actual `projection-toggle > rotate-ccw > rotate-cw`, expected `rotate-ccw > projection-toggle > rotate-cw`); local-order test and glyph-size test (`expected 11 to be greater than or equal to 16`) also failed; the other 6 tests passed as preservation guards. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (reason `target_test_failed`). Semantic assessment: target executed and failed on the intended ordering assertion, not on setup/import faults.
- GREEN: all 9 tests pass; full suite 422 passed; typecheck clean.
- REFACTOR: none needed.
- RED commit (94e1715) precedes GREEN commit (af73bcb).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED evidence unparseable with array-valued assertions**
- **Found during:** Task 1 RED
- **Issue:** `toEqual([...])` failures emit multi-line `actual`/`expected` blocks in vitest's TAP output, which the RED-evidence classifier rejected (`invalid_record`: Non-TAP data).
- **Fix:** The `order()` helper returns a joined string so assertion values are single-line; the test semantics are unchanged.
- **Files modified:** EncounterMapRenderer.viewControls.test.tsx
- **Verification:** Re-ran; classifier returned `RED_EVIDENCE_OK`. Committed in the RED commit.

**2. [Note] CONTEXT.md amendment is six added lines, not one**
- The amendment text is wrapped to the file's 90-column bullet style, so the diff is 6 added / 0 removed lines, all one continuation of the D-02 bullet. The original D-02 text is unchanged.

**Total deviations:** 1 auto-fixed (1 blocking), 1 note. **Impact:** none on behaviour.

## Human Verification (deferred to end-of-phase UAT)

Start the stack, open /gmconsole/, an ENCOUNTER with a grid deckplan: confirm the cluster reads rotate-ccw, ISO VIEW / TOP DOWN, rotate-cw; glyphs are clearly larger than the 11px label, centered, and not blank boxes (if boxes, switch `ROTATE_CCW_LABEL` / `ROTATE_CW_LABEL` to CCW / CW); left button turns the map counter-clockwise, right clockwise; every button is at least 44x44; at 360px width the cluster fits without horizontal overflow (legend hidden) and at about 768px looks right.

## Known Stubs

None.

## Threat Flags

None. T-34-21 (direction swap) mitigated by the direction-wiring test; T-34-22 (44px floor) mitigated by the inline min-size test.

## Issues Encountered

None beyond the deviation above.

## Next Phase Readiness

Ready for 34-07; the vitest alias fix and DOM-test harness it needs are in place.

## Self-Check: PASSED

- Files present: vitest.config.ts, EncounterMapRenderer.tsx, EncounterMapRenderer.viewControls.test.tsx, 34-UI-SPEC.md, 34-CONTEXT.md.
- Commits 2934049, 94e1715, af73bcb, f3f82f7 exist on the branch.
