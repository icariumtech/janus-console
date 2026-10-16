---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 07
subsystem: ui
tags: [react, vitest, jsdom, encounter-map, gm-console, gap-closure, stale-response-guard]
requires:
  - phase: 34-gm-controlled-projection-and-iso-rotation
    provides: "vitest @components/@hooks/@services aliases and the createRoot+act DOM-test pattern (plan 34-06)"
provides:
  - "useLocationMapBundle hook: deck map, manifest, all-decks and room visibility loaded together (Promise.all) and committed as one slug-bound unit with a stale-response guard"
  - "GM EncounterView renders MapPreview only from the bound unit; previous map stays frozen in its own view until the new one is complete"
  - "Freeze-window mutation gate: mutating callbacks, rotate/projection, REVEAL ALL / HIDE ALL, deck picker and token palette unavailable while the frozen bundle is not the active location"
  - "EncounterView.locationChange regression test (15 tests) recording every MapPreview render"
affects: [verify-work, ui-review, 34-UAT]
status: complete
commits: 3
plan_head_before: 1412d0ce540452fd90a6ec3a970fe95f43502dbf
plan_head_after: 46f24aceca3d95a84f2e52e07efe18e821b22a1f
actuals:
  tokens: 14000
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Bind-and-freeze: data that must render together is committed as one slug-keyed unit; the old unit stays displayed (with its latched live inputs) until the new one is complete"
    - "Render-recording test: mock the child, push every received prop set to a hoisted log, classify each render as one location or MIXED"
    - "Controllable API promises: per-endpoint call arrays with resolve/reject handles for deterministic response ordering"
key-files:
  created:
    - src/components/gm/views/useLocationMapBundle.ts
    - src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx
  modified:
    - src/components/gm/views/EncounterView.tsx
    - codemaps/frontend.md
key-decisions:
  - "Keep the previous location's map frozen in its own view (not a loading placeholder) while the next location loads, so the swap is one commit with no blank or intermediate frame; only the first load keeps the Loading placeholder"
  - "Promise.all is all-or-nothing: a failed manifest request clears the unit and toasts 'Failed to load map data' rather than showing a map with a missing hull"
  - "Mutating GM endpoints take no slug and act on the server's active location, so during the freeze they are withheld/disabled (gated on bundleIsCurrent) instead of bound to the frozen bundle"
  - "activeView-synced map inputs (view, tokens, doors, room visibility, vents) are latched at the point they are handed to MapPreview, not changed at their sync effects"
requirements-completed: [ISO-06, ISO-07]
duration: 4 min
completed: 2026-10-16
---

# Phase 34 Plan 07: GM Location-Change Mixed Frames Summary

GM encounter map now renders only from a slug-bound {map, hull, view, tokens, doors, room visibility, vents} unit, freezing the old map in its own view until the new one is complete and withholding every mutating control during the freeze (closes G-34-6).

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-16T19:56:33Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Root cause of G-34-6 fixed: map and hull were refetched by two unguarded effects while the view and `locationKey` came straight from the new `activeView`, so a location change painted the old map in the new view, then a mixed frame, then the correct map. `useLocationMapBundle` loads both requests together and commits `{slug, mapData, manifest, allDecks, roomVisibility}` in one block; superseded responses (A to B to C, A to B to A) are discarded by a cancelled flag.
- `EncounterView` hands `MapPreview` the bundle's slug as `locationKey` and, while the bundle is not current, the last live values of orientation, tokens, door status, room visibility and vents flag (`latchedMapInputsRef`), so no frame mixes locations.
- Mutation gate (T-34-28): while the displayed bundle's slug differs from `locationSlug`, the seven mutating `MapPreview` callbacks and the rotate/projection `viewControl` callbacks are withheld, REVEAL ALL / HIDE ALL / deck picker are disabled and the token palette is not rendered; all return in the commit that swaps the new bundle in. Deck switch inside a location still refetches only the deck map.
- 15-test regression suite (`EncounterView.locationChange.test.tsx`) covering first load, both directions in both response orders, map-scoped inputs during the freeze, out-of-order and return-to-origin responses, deck switch, failed manifest, and the gate closing and lifting. Full suite 437 tests and `tsc --noEmit` green.

## Task Commits

1. **Task 1 RED: failing regression test** - `000e0df` (test)
2. **Task 1 GREEN: bind map, hull and view as one unit** - `2f3aa02` (feat)
3. **Task 2: frontend codemap** - `46f24ac` (docs)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Gate Compliance

- **RED:** `test(34-07)` commit `000e0df` precedes `feat(34-07)` commit `2f3aa02`.
- **RED evidence:** `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (reason `target_test_failed`, format tap, 15 tests, 13 failed, 2 passed). Target test: `location change a to b (top-down to iso), map-first: never renders a mixed tuple`.
- **semanticAssessment:** the target executed and failed on the planned assertion: actual `MIXED(map=a hull=a key=b view=b tokens=b doors=b vis=b vents=b)` where `a` was expected (old map under the new key, view, tokens, doors, room visibility and vents). The mutation-gate freeze cases failed because all seven callbacks were present while the old map sat under the new slug; b-to-a, a-to-b-to-c, return-to-a, failure and first-load cases failed with the same kind of mixed/leaked tuple. The two cases that passed in RED (deck switch inside a location; gate lifts after the bundle arrives) guard behaviour that must not regress.
- **GREEN:** all 15 pass after the hook and view wiring. No REFACTOR commit.

## Files Created/Modified

- `src/components/gm/views/useLocationMapBundle.ts` - hook binding deck map, manifest, all-decks and room visibility to a slug with a cancelled-flag stale guard
- `src/components/gm/views/EncounterView.tsx` - renders from the bound unit; latches view and map-scoped inputs; mutation gate on `bundleIsCurrent`
- `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx` - render-recording regression test
- `codemaps/frontend.md` - hook entry and bind-and-freeze note

## Decisions Made

See `key-decisions` in the frontmatter. In short: freeze the old map instead of a placeholder, all-or-nothing load, gate (not bind) mutations during the freeze, latch the activeView-synced inputs at the hand-off to `MapPreview`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test asserted the vents flag by exact owner string**
- **Found during:** Task 1 GREEN (first run after implementing)
- **Issue:** Fixtures a and c share `vents: false`, so the owner classification for the vents field is `a|c`; `toBe('a')` failed on correct behaviour in the two map-scoped-input cases.
- **Fix:** Assert that the vents owners contain `a` and do not contain `b`. Tokens, doors and room visibility (unique per fixture) keep exact owner assertions. The RED failures were already on the tokens assertion, so the RED evidence is unaffected.
- **Files modified:** `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx`
- **Committed in:** `2f3aa02`

---

**Total deviations:** 1 auto-fixed (1 test bug)
**Impact on plan:** None on scope; production code matches the plan.

## Issues Encountered

- The test file was reformatted on disk by tooling between my write and my first run; no content change beyond whitespace. A temporary `34-07-red-evidence.json` record (needed by the RED classifier) was deleted after validation and not committed.
- The plan's first-load case and the "before any bundle exists" case assert the same property (no map after the map response alone); both fail in RED and pass in GREEN.

## Human Verification (end-of-phase UAT)

Not run here (real paint timing and network latency cannot be reproduced in jsdom). For the UAT harvest: with network throttling, switch between a top-down ship and an iso/90 ship in both directions, A-B-C in quick succession, deck switches inside one ship, BRIDGE round trips and rotation. Expected: no top-down flash, no re-projected copy of the previous ship, no mixed rooms/hull; the frozen map keeps its own tokens, doors and room shading; during the freeze rotate/projection buttons are absent, REVEAL ALL / HIDE ALL / deck picker are disabled and inert, tokens cannot be dragged or dropped; everything works again when the new map appears; the player terminal is unchanged. Do not commit or revert the working-tree edit to `data/ships/somnus/deckplan.yaml`.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or schema change; T-34-24, T-34-25 and T-34-28 are mitigated and test-covered, T-34-26 and T-34-27 accepted as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

G-34-6 is closed pending the end-of-phase UAT check above. No blockers.

## Self-Check: PASSED

- Files exist: `src/components/gm/views/useLocationMapBundle.ts`, `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx` (FOUND)
- Commits `000e0df`, `2f3aa02`, `46f24ac` are ancestors of HEAD (FOUND); `test(34-07)` precedes `feat(34-07)`
- Acceptance greps: `disabled={!bundleIsCurrent}` x3, `useLocationMapBundle` x2 in the view, `Promise.all` plus both API calls in the hook, `locationKey={bundle` x1, `latchedMapInputsRef` x3, `shownMapInputs.` x5, codemap mentions the hook x2
- `pnpm run test` 437 passed, `pnpm run typecheck` exit 0; no file under `core/`, `src/components/domain/` or `MapPreview.tsx` modified

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-16*
