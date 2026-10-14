---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 05
subsystem: encounter-view
tags: [react, typescript, sse, view-control, wiring]
requires:
  - phase: 34-02
    provides: POST /gm/encounter/set-projection/, encounter_projection / encounter_rotation_offset on the SSE payload, default_view reset
  - phase: 34-04
    provides: EncounterMapRenderer viewOrientation / viewControl / locationKey contract
provides:
  - "encounterApi.setProjection client for POST /gm/encounter/set-projection/"
  - "GM tactical map broadcast controls (projection + rotate) with error toasts and locationKey"
  - "Player terminal and dashboard status thumbnail mirror the broadcast viewOrientation read-only"
  - "GM side panel and GM bridge ship thumbnail mirror the broadcast view read-only"
  - "Deckplan editor preview runs in renderer local mode"
affects: []

actuals:
  tokens: 4000
  tasks: 3
  commits: 3
plan_head_before: fb00c90c9ed6c5e5ea47ad3e0c04052e7ab17054
plan_head_after: 8e161fba8320061c6a3530624346985cf65bf6d9

tech-stack:
  added: []
  patterns:
    - "Single viewOrientation prop threaded read-only; the only mount passing viewControl mode 'broadcast' is the GM tactical map (grep-gated)"
    - "GM POST handlers hold no view state and apply no optimistic update; the map follows the SSE echo"

key-files:
  created: []
  modified:
    - src/entries/SharedConsole.tsx
    - src/components/domain/encounter/EncounterView.tsx
    - src/components/domain/encounter/EncounterMapDisplay.tsx
    - src/components/domain/dashboard/BridgeView.tsx
    - src/components/domain/dashboard/sections/StatusSection.tsx
    - src/services/encounterApi.ts
    - src/components/gm/views/EncounterView.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/gm/views/deckplan/DeckplanPreviewPane.tsx
    - src/components/gm/EncounterPanel.tsx
    - src/components/gm/views/BridgeView.tsx

key-decisions:
  - "viewOrientation in SharedConsole is a plain const (per plan), not a hook: the component has early-return-free JSX but hooks are not needed because the renderer keys its transition effect on the primitive projection/rotationOffset values"
  - "EncounterPanel and GmBridgeShipPanel mirror the broadcast read-only; no controls are duplicated (D-02)"

requirements-completed: [ISO-04, ISO-05, ISO-06, ISO-07]

coverage:
  - id: D1
    description: "Player terminal and dashboard status thumbnail receive the broadcast projection and rotation through SharedConsole -> EncounterView/BridgeView -> EncounterMapDisplay (all four render paths) -> renderer, with no view-control prop"
    requirement: ISO-04
    verification:
      - kind: other
        ref: "pnpm run typecheck; acceptance greps (one toViewOrientation( in SharedConsole, viewControl count 0 in all five task-1 files, viewOrientation x6 / locationKey x4 in EncounterMapDisplay)"
        status: pass
    human_judgment: true
    rationale: "That players see the GM's live view with no cue is a DOM-level fact; there is no component test harness. Covered by the 34-05 human checks."
  - id: D2
    description: "GM tactical map: setProjection / rotateView POST and wait for the SSE echo; failed POSTs toast 'Failed to switch map projection — try again' / 'Failed to rotate map — try again'; locationKey passed"
    requirement: ISO-05
    verification:
      - kind: other
        ref: "pnpm run typecheck && pnpm run test (413 pass); acceptance greps for set-projection, both toast strings, locationKey={locationSlug}"
        status: pass
    human_judgment: true
    rationale: "Fade/cut feel and button label following the echo are visual and timing dependent; covered by the human checks."
  - id: D3
    description: "Only the GM tactical map passes mode 'broadcast'; only the deckplan editor preview passes mode 'local' and imports no service module; EncounterPanel and GmBridgeShipPanel pass no viewControl"
    requirement: ISO-04
    verification:
      - kind: other
        ref: "grep -rln \"mode: 'broadcast'\" src lists viewOrientation.ts + gm/views/EncounterView.tsx; grep -rln \"mode: 'local'\" src lists viewOrientation.ts + DeckplanPreviewPane.tsx; viewControl count 0 in EncounterPanel and gm/views/BridgeView"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase gate: full frontend suite, typecheck, production build and the six-module backend suite are green"
    requirement: ISO-07
    verification:
      - kind: unit
        ref: "pnpm run test (413 pass, 16 files); core.tests.test_encounter_state core.tests.test_active_view_store core.tests.test_payload_builder core.tests.test_data_loader core.tests.test_deckplan_passthrough core.tests.test_encounter_view_state (116 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Six consolidated human checks: rotation/cut/fade feel and 30-degree iso incl. Somnus; no controls on players/thumbnails and a private editor; hit-testing and mid-drag cancel at all eight projection x rotation combinations; pan/zoom preservation, quick-press and reduced motion; glyph / 44px / 360px layout; authored default_view, deck switch, BRIDGE round trip and server restart persistence"
    requirement: ISO-06
    verification:
      - kind: manual_procedural
        ref: "34-05-PLAN.md Task 3 human-check blocks 1-6"
        status: unknown
    human_judgment: true
    rationale: "Cannot be performed by an unattended executor: they require a running stack, two live consoles, a browser, OS settings and a server restart. Left for the end-of-phase UAT."

duration: 3min
completed: 2026-10-14
status: complete
---

# Phase 34 Plan 05: Mount Wiring and Phase Gate Summary

**Every map mount is now wired to the GM-controlled view: the player terminal and all thumbnails mirror the broadcast projection and rotation read-only, the GM tactical map owns the broadcast controls (POST then wait for the SSE echo, with error toasts), and the deckplan editor preview runs in private local mode.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 3 (all `type="auto"`)
- **Files:** 11 modified, 0 created
- **Verification:** `pnpm run typecheck` clean; `pnpm run test` 413 pass (16 files); `pnpm run build` succeeds; six-module backend command OK (116 tests)

## Accomplishments

- Task 1: `SharedConsole` declares `encounter_projection` / `encounter_rotation_offset`, derives one `viewOrientation` via `toViewOrientation`, and passes it to the ENCOUNTER `EncounterView` and the BRIDGE `BridgeView` (-> `StatusSection` thumbnail). `EncounterMapDisplay` forwards `viewOrientation` plus `locationKey = locationData?.slug` into all four renderer paths (`commonProps` for the two multi-deck branches, explicit props on the grid and legacy-cast branches). No view-control prop anywhere.
- Task 2: `encounterApi.setProjection` (POST `/gm/encounter/set-projection/`); GM `EncounterView.handleProjectionChange` beside `handleRotate` with the specified toast and no local view state; `viewControl={{ mode: 'broadcast', onProjectionChange, onRotate }}` and `locationKey={locationSlug}`. `MapPreview` gained and forwards `locationKey`. `DeckplanPreviewPane` passes `viewControl={{ mode: 'local' }}` and nothing else (no service import).
- Task 3: `EncounterPanel` and `GmBridgeShipPanel` (via `GmBridgeDashboard`) compute/receive `viewOrientation` and pass no view control (D-02). Full automated phase gate run and green.

## Task Commits

1. **Task 1** - `16fb56d` (feat): player terminal and dashboard thumbnail read-only orientation
2. **Task 2** - `7887c7f` (feat): GM broadcast projection control, editor local mode, locationKey
3. **Task 3** - `8e161fb` (feat): GM side panel and bridge ship thumbnail read-only mirrors

## Decisions Made

- `viewOrientation` in `SharedConsole` is a plain const as the plan specified. It creates a fresh object each render, which is harmless because the renderer transition hook is keyed on the primitive `projection` / `rotationOffset` / `locationKey` values only.
- No controls are added to the side panel or any thumbnail; they are pure mirrors (D-02, D-03, D-14).

## Deviations from Plan

None - plan executed exactly as written.

## Human Checks (pending end-of-phase UAT)

The six `<human-check>` blocks of Task 3 were NOT performed: an unattended executor cannot run two live consoles, a browser, device mode, OS reduce-motion or a server restart. They are recorded as `human_judgment: true` / `status: unknown` in the coverage block (D5) for the verifier / `/gsd-verify-work`:

1. Rotation (4x CW, 4x CCW, ISO VIEW, repeat in iso): exact 90-degree steps, fade about 0.4 s, projection change is a cut, pan/zoom re-fit and RESET VIEW hidden, 30-degree iso axes at all rotations including Somnus, labels/glyphs upright.
2. No view buttons, badge or text cue on the player terminal, player BRIDGE STATUS thumbnail, GM BRIDGE ship thumbnail; the editor preview has the cluster, opens top-down at 0 and changes nothing elsewhere.
3. Hit-testing (palette drop, token drag, context menus, POI drag / Add POI) at all eight projection x rotation combinations; mid-drag rotate from a second window cancels the drag silently.
4. Pan/zoom preserved on token move and room toggle; three quick rotate presses end exactly three steps on; reduced motion gives an instant cut.
5. Tablet and 360 px layout: rotate glyphs visible (fallback: change `ROTATE_CCW_LABEL` / `ROTATE_CW_LABEL` to `CCW` / `CW` in `EncounterMapRenderer.tsx`), all cluster buttons and RESET VIEW at least 44 x 44 px, legend hidden and cluster fits at 360 px.
6. Authored `default_view` (iso / 90) applied on location change, kept across BRIDGE round trip and deck switches, persisted across a Django restart; a location without `default_view` opens top-down at 0.

## Deferred / not done

- **Research pitfall P9 (not a CONTEXT decision):** `MapPreview`'s non-`fill` branch sizes its box from a grid-space bounding box (aspect ratio) that does not account for iso or a 90-degree offset, and the researcher's suggested bbox-helper extraction is NOT done in this phase. The branch is only reachable from `EncounterPanel`, which has no mount in `src` (no `<EncounterPanel` usage); the GM tactical map and the deckplan editor both pass `fill`, which bypasses the aspect math, so every live mount is unaffected. No task in this phase touches that math. Revisit if `EncounterPanel` is re-mounted or another non-`fill` `MapPreview` mount appears.
- `ruff` was unavailable for Python lint during planning (and in this environment); no Python was changed in this plan.
- The six human-check blocks above (see "Human Checks").

## TDD Gate Compliance

Not applicable: all three tasks are `type="auto"` without `tdd="true"`; the repo has no component test harness and the plan prohibits adding rendering logic.

## Known Stubs

None.

## Threat Flags

None. T-34-17 mitigated (grep gates: `mode: 'broadcast'` only in the GM tactical map; `viewControl` count 0 on the player terminal, thumbnails, EncounterPanel and GM bridge). T-34-18 mitigated (editor passes only `mode: 'local'`; `DeckplanPreviewPane` has zero `@/services` imports). T-34-19 and T-34-20 accepted (public display state; static toast literals). No packages installed (T-34-SC). No data-shape changes, so `docs/schemas/` is unchanged.

## Issues Encountered

None.

## Self-Check

- All 11 modified files exist; no files created.
- Commits `16fb56d`, `7887c7f`, `8e161fb` are ancestors of HEAD; `git rev-list --count` from the ledger base `fb00c90` is 3.
- All acceptance greps for the three tasks match as specified.
- Pre-existing user changes (`.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`) were left untouched and unstaged.

## Self-Check: PASSED

## Next Phase Readiness

Phase 34 implementation is complete (5/5 plans). Remaining: the end-of-phase UAT covering the six pending human checks, then phase verification.

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-14*
