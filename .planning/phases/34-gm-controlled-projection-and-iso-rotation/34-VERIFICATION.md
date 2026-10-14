---
phase: 34-gm-controlled-projection-and-iso-rotation
verified: 2026-10-14T16:10:00Z
status: human_needed
score: 8/11 must-haves verified
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
  - "src/components/gm/views/deckplan/DeckplanPreviewPane.tsx"
  - "src/entries/SharedConsole.tsx"
  - "src/hooks/useTokenPlacement.ts"
  - "src/services/encounterApi.ts"
  - "src/types/gmConsole.ts"
  - "src/utils/__tests__/svgCoordinates.test.ts"
covered_digest: "v3:sha256:ff1a8736ff0958477dd2e914bd91e306fedaae3f1103cb079bd22daefc4487df"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Every map element (rooms, doors, POIs, tokens, details, background grid, labels) renders correctly at every projection x rotation, and a pending or active token/POI drag is cancelled at runtime when a broadcast projection or offset change arrives"
    test: "With two consoles open, cycle the GM map through all 8 projection x rotation combinations; while dragging a token (and a POI) in one window, rotate or switch projection from the other window"
    expected: "Every element stays on its grid cell; the dragged token or POI snaps back with no move applied and no toast; no ghost remains"
    why_human: "No DOM or component test harness exists. shouldCancelDrag is unit-tested as a predicate, but the TokenLayer and PoiLayer effects that call it, and the SVG rendering itself, are only exercised by a running browser"
  - truth: "Rotation fades out, snaps and resets pan/zoom once at opacity 0, then fades in; projection and location changes cut; the fade is cut under reduced motion; the unmount path never leaves the map at opacity 0"
    test: "On the GM map, press rotate-cw several times; switch projection; enable prefers-reduced-motion in the OS and repeat"
    expected: "Rotation shows a short fade (about 0.4 s total) with pan/zoom re-fit at the snap; projection switch is an instant cut; reduced motion gives an instant cut; the map is never left invisible after leaving and re-entering the encounter view"
    why_human: "The ordering and durations are unit-tested in viewTransition.test.ts (planner), but the GSAP executor in useOrientationTransition.ts has no DOM test; the feel and the absence of stuck opacity are visual"
---

# Phase 34: GM-Controlled Projection and Iso Rotation Verification Report

**Phase Goal:** Make the map view (top-down vs. isometric, and iso rotation) a GM-owned setting broadcast to players, and let the GM rotate the iso view in 90° steps.
**Verified:** 2026-10-14T16:10:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Verification Basis

- Plan must_haves (truths, artifacts, key_links, prohibitions) from 34-01 through 34-05 PLAN frontmatter.
- ROADMAP Phase 34 Success Criteria 1 to 4.
- Requirements ISO-04, ISO-05, ISO-06, ISO-07 (all declared across the five plans; union covers all four, no orphans).
- SUMMARY.md claims were treated as hypotheses and checked against the code.
- Tests named below were run by the verifier, one targeted run each. The full suites (vitest 413/413, Django 175 OK, `pnpm run build`) are as reported by the orchestrator and were not re-run.

## Goal Achievement

### Observable Truths

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | SC1: player terminal has no projection toggle and renders the GM-selected projection live | ROADMAP SC1; 34-05 truth 1 | VERIFIED | `SharedConsole.tsx:918` builds `viewOrientation` via `toViewOrientation(activeView.encounter_projection, activeView.encounter_rotation_offset)` and passes it at lines 960 and 1063. Domain `EncounterView.tsx`, `EncounterMapDisplay.tsx`, `BridgeView.tsx` and `StatusSection.tsx` accept `viewOrientation` only and contain no `viewControl`. A repo-wide grep finds no `projectionMode`, `setProjectionMode`, `toggleProjection` or `viewerProjection` in `src`. The SSE keys are emitted at `payload_builder.py:99-100`. Django test `test_sse_activeview_event_carries_view_fields` covers the SSE event. |
| 2 | SC2: GM rotates 90° steps in both projections as an offset on top of authored rotation; players follow | ROADMAP SC2; 34-01/02/03/05 | VERIFIED | Server: `encounter_state.rotate_view` (`encounter_state.py:76-88`) computes `(current + delta) % 360` from server state and accepts only int ±90. Endpoint `api_encounter_rotate_view` (`views/encounter.py:99-116`) is behind `login_required` and `post_json` with no `csrf_exempt`, routed at `urls.py:78`. Client: `encounterApi.rotateView` POSTs `/gm/encounter/rotate-view/` (`encounterApi.ts:238-244`); GM `handleRotate` (`gm/views/EncounterView.tsx:260-267`) holds no local state. Renderer: `handleRotateClick` sends ±90 via `control.onRotate`, and the rotate buttons are not gated on projection (`EncounterMapRenderer.tsx:567-578`). Projection: `topDownProjection` takes `rotation` (`gridProjection.ts:97-112`); `buildProjection` folds `45 + offset + authored` under iso and passes the offset under top-down (`viewOrientation.ts`). Tests: `RotateViewEndToEndTests`, `RotateViewHardeningTests`, gridProjection rotation tests, viewOrientation payload-to-pixels tests. |
| 3 | SC3 (hit-test part): pointer-to-cell resolves the drawn cell at every projection x offset x authored combination | ROADMAP SC3; 34-03 truth 6 | VERIFIED | `src/utils/__tests__/svgCoordinates.test.ts` composes `buildProjection`, `screenRotationFor`, the inverse rotate and `getGridCellViaView` across 2 projections x 4 offsets x 2 authored rotations, including negative coordinates and off-centre points. The renderer's hit path (`EncounterMapRenderer.tsx:519`) uses the same inverse-rotate by `mapRotation` (the residual screen rotation). The composition is therefore exercised at the pure-math level, not on the DOM. |
| 4 | SC3 (render part): every map element renders correctly at every rotation, and runtime drag-cancel works | ROADMAP SC3; 34-04 truths 3, 8 | PRESENT_BEHAVIOR_UNVERIFIED | Code present and wired: the background grid is projection-driven (not a screen-space pattern; comments at `EncounterMapRenderer.tsx:354` and `:681`); the bounding box comes from `view.bbox`, which is projection-aware (so a 90° offset swaps W/H); `TokenLayer.tsx:~198-206` and `PoiLayer.tsx:72-79` call `shouldCancelDrag` on the `viewKey` and `view` change. The predicate itself is unit-tested, but no test renders the layers or the SVG, so element rendering and the cancel effect are unexercised. Routed to human checks 1 and 3. |
| 5 | SC4: `deckplan.yaml` authors `default_view`; loading a location applies it; the broadcast view persists across reloads | ROADMAP SC4; 34-02 truths 2, 4, 5 | VERIFIED | Loader: `load_deckplan` returns `default_view` from `normalize_default_view` on both return paths (`data_loader.py:706` and `:719`). `normalize_default_view` (`core/encounter_view.py`) falls back per field and never raises. Apply: `api_switch_view` (`views/navigation.py:83-87`) applies the default only when `encounter_view_location_slug` differs from the requested slug. The marker is in `_DEFAULT_STATE` (`active_view_store.py:42`) and is persisted, and `_load_from_disk` merges stored values over defaults (`active_view_store.py:53-63`). Tests run this session: `test_rotated_value_survives_store_reload`, `test_returning_via_bridge_keeps_the_gms_live_view`, `test_rotate_persists_to_disk`, all OK. A real server restart is covered by human check 6. |
| 6 | ISO-07 transition: rotation fades, projection and location change cut, pan/zoom resets once at the snap, reduced motion cuts, unmount never leaves opacity 0 | ISO-07; 34-03 truths 7, 8; 34-04 truths 4, 6, 9 | PRESENT_BEHAVIOR_UNVERIFIED | The planner is pure and tested: `viewTransition.test.ts` (47 tests, run this session, all pass) covers `classifyChange`, the `fadeOut -> snap -> fadeIn` ordering with exactly one snap, `restore` without reset, reduced-motion cut, and `orientationOf`. The GSAP executor `useOrientationTransition.ts` translates those steps into a timeline and runs the `kill` and `clearProps` on restart, cut and unmount. The executor has no DOM test. Routed to human checks 1 and 4. |
| 7 | ISO-04 control locality: broadcast controls appear only on the GM tactical map; the deckplan editor is private local mode with no server calls; all read-only mounts carry no controls | ISO-04; 34-04 truths 1-2; 34-05 truths 2-3 | VERIFIED | `mode: 'broadcast'` is mounted only in `gm/views/EncounterView.tsx:468`. The other hit, `viewOrientation.ts:47`, is the type definition of `ViewControl`, not a mount. `mode: 'local'` appears only in `DeckplanPreviewPane.tsx:236`. `viewControl` is absent from `EncounterPanel.tsx`, `gm/views/BridgeView.tsx`, `StatusSection.tsx`, `SharedConsole.tsx` and the domain `EncounterView`/`EncounterMapDisplay`. `EncounterMapRenderer.tsx`, `useOrientationTransition.ts` and `DeckplanPreviewPane.tsx` contain no `services/` import. The default `READONLY_VIEW_CONTROL` (`EncounterMapRenderer.tsx:158`) renders no cluster. The cluster renders only when `showProjectionButton` or `showRotateButtons` is true (`:575-578`). |
| 8 | ISO-04/05 server validation: strict int ±90 delta, enum-checked projection, non-object body is 400, login and CSRF enforced, state unchanged on every rejection | 34-01 truth 3; 34-02 truths 1, 3 | VERIFIED | `rotate_view` rejects bool, float (`90.0`), string, null, 0, 180 and out-of-enum values (`encounter_state.py:84`). `set_projection` checks `PROJECTIONS` (`encounter_state.py:92`). Both endpoints return 400 on a non-dict body (`views/encounter.py:106-107, 125-126`). Django tests in `RotateViewHardeningTests` (`test_malformed_deltas_return_400_and_state_unchanged`, `test_non_object_bodies_return_400_not_500`, `test_csrf_token_is_required`) and `SetProjectionEndpointTests` cover these. |
| 9 | ISO-05 race edge: two GM clients or a double click each apply exactly one step | 34-01 truth 2 | UNCERTAIN (WARNING) | Sequentially correct: the step is computed server-side from state and the test `test_rotation_is_relative_and_wraps_modulo_360` passes. But `rotate_view` calls `get_state()` (lock acquired and released) and then `_sync()` → `update_state()` (lock again). The read-modify-write is not inside one critical section (`active_view_store.py:95-101`, `encounter_state.py:76-88`). Correctness depends on `docker/gunicorn.conf.py` running `workers = 1` with `worker_class = 'gevent'`. No concurrency test exists. See WR-01. |
| 10 | ISO-05 geometry: offset 0 is identical to Phase 33 in both projections; the 16 offset x authored combinations keep true 30° iso axes; top-down quarter turns are exact | ISO-05; 34-01 truth 6; 34-03 truths 2, 3 | VERIFIED | `viewOrientation.test.ts` ("offset 0 reproduces the Phase 33 projections", "true isometric across the 16 offset x authored combinations", "payload to pixels") and `gridProjection.test.ts` ("topDownProjection rotation, payload to pixels") are in the suite. Code: `buildProjection` under iso uses `45 + rotationOffset + authoredRotation` (no screen rotate, `screenRotationFor` returns 0). Top-down uses `topDownProjection({rotation: rotationOffset})` with `+ 0` to avoid negative zero. |
| 11 | ISO-06 scope: authored default applies on location change only; BRIDGE/STANDBY round trips, same-slug reselect and deck switches keep the GM's live view | ISO-06; 34-02 truths 6-8 | VERIFIED | `navigation.py:83` uses the dedicated marker, not `location_slug`, because BRIDGE and STANDBY clear `location_slug`. `switch_level` does not touch the two view keys (`encounter_state.py:22`). Django tests run this session: `test_returning_via_bridge_keeps_the_gms_live_view` OK. `test_reselecting_same_slug_in_encounter_keeps_the_live_view`, `test_first_entry_applies_authored_default_view_and_marker` and `DeckSwitchKeepsViewTests` are in the orchestrator's green suite. |

**Score:** 8/11 truths verified (2 PRESENT_BEHAVIOR_UNVERIFIED, 1 UNCERTAIN WARNING).

### Plan Prohibitions (judgment tier, non-authoritative)

Every prohibition in 34-01 through 34-05 is `verification: judgment`. The verdicts below are non-authoritative LLM-judge reads of the code. Each is flagged `unverified-prohibition — human review recommended`, and per the ADR-550 D4 routing each counts as a human-verification item. None is a silent pass.

| Plan | Prohibition (abridged) | Judge read | Flag |
|------|------------------------|------------|------|
| 01 | No optimistic local rotation on the GM console before server echo | Holds: GM `EncounterView` has no view state; handlers only await the API | unverified-prohibition — human review recommended |
| 01 | No absolute rotation value accepted from any client | Holds: only ±90 accepted, computed server-side | unverified-prohibition — human review recommended |
| 02 | No re-apply of authored default on return to same location | Holds: marker logic plus Django test | unverified-prohibition — human review recommended |
| 02 | No malformed default_view blocks load or reaches store unvalidated | Holds: normalizer never raises; only enum values stored | unverified-prohibition — human review recommended |
| 03 | No change to top-down output at offset 0; authored rotation stays screen-space under top-down | Holds: identity tests; `screenRotationFor` returns authored under top-down | unverified-prohibition — human review recommended |
| 03 | No screen-space SVG rotation of the GM offset under iso | Holds: iso folds into azimuth; `screenRotationFor` returns 0 | unverified-prohibition — human review recommended |
| 04 | No view control, badge or cue on read-only mounts | Holds: grep confirms no `viewControl` on read-only mounts | unverified-prohibition — human review recommended |
| 04 | No server call or broadcast change from the editor's local state | Holds: no `services/` import; local `useState` only | unverified-prohibition — human review recommended |
| 04 | No pan/zoom reset or fade on unrelated updates | Holds on code: the hook keys on primitives only; runtime unexercised (see truth 6) | unverified-prohibition — human review recommended |
| 05 | No projection, rotation or orientation control on player terminal, side panel or thumbnails | Holds: grep confirms | unverified-prohibition — human review recommended |
| 05 | No server endpoint called from the deckplan editor preview | Holds: `DeckplanPreviewPane` has no service import | unverified-prohibition — human review recommended |

Count: 11 judgment-tier prohibitions, 11 flagged, 0 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `core/encounter_view.py` | Enums, `normalize_default_view` | VERIFIED | Exists, substantive, imported by `data_loader.py:16` and `navigation.py:6` |
| `core/encounter_state.py` | `rotate_view`, `set_projection` | VERIFIED | Lines 76-96; called by views |
| `core/views/encounter.py` | `api_encounter_rotate_view`, `api_encounter_set_projection` | VERIFIED | Lines 99-135; no `csrf_exempt` on the new endpoints |
| `core/urls.py` | Both routes | VERIFIED | Lines 78-79 |
| `core/active_view_store.py` | Three new defaults | VERIFIED | Lines 36-42 |
| `core/payload_builder.py` | Keys in allow-list, marker excluded | VERIFIED | Lines 99-100; `encounter_view_location_slug` not emitted |
| `core/data_loader.py` | `default_view` on both return paths | VERIFIED | Lines 706, 719 |
| `core/views/navigation.py` | Default applied on location change | VERIFIED | Lines 83-87 |
| `docs/schemas/schema-encounters.md` | `default_view` table, P3, deck `rotation` row | VERIFIED | Lines 63, 81-94, 108, 224-226 (CLAUDE.md Schema Sync satisfied) |
| `geometry/viewOrientation.ts` | Normalizers, `buildProjection`, `screenRotationFor` | VERIFIED | Imports only `./gridProjection` |
| `geometry/gridProjection.ts` | `topDownProjection` rotation | VERIFIED | Lines 97-112 |
| `viewTransition.ts` | Pure planner and predicates | VERIFIED | Tested by 47 vitest cases (run this session) |
| `useOrientationTransition.ts` | GSAP executor of the plan | VERIFIED (wiring) / PRESENT_BEHAVIOR_UNVERIFIED (runtime) | Substantive and called at `EncounterMapRenderer.tsx:257`; no DOM test |
| `EncounterMapRenderer.tsx` | Modes, cluster, pipeline, fade wrapper | VERIFIED (wiring) | Cluster and copy at lines 575-990; `OVERLAY_BUTTON_STYLE` at 169 |
| `EncounterMapRenderer.css` | Fade wrapper, legend hidden below 480px | VERIFIED | `.encounter-map-renderer__fade` at 311; media query at 84-89 |
| `TokenLayer.tsx`, `PoiLayer.tsx` | Drag cancel on view change | VERIFIED (wiring) / PRESENT_BEHAVIOR_UNVERIFIED (runtime) | `shouldCancelDrag` called at `TokenLayer.tsx:200` and `PoiLayer.tsx:74` |
| `src/services/encounterApi.ts` | `rotateView`, `setProjection` | VERIFIED | Lines 238-256 |
| `src/types/gmConsole.ts` | `ActiveView` keys | VERIFIED | Lines 75-76 |
| `gm/views/EncounterView.tsx` | Broadcast wiring, toasts, `locationKey` | VERIFIED | Lines 260-278, 468 |
| `gm/views/deckplan/DeckplanPreviewPane.tsx` | Local mode, no services | VERIFIED | Line 236; no service import |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gm/views/EncounterView.tsx` | `encounterApi.ts` | `handleRotate` → `rotateView`; `handleProjectionChange` → `setProjection` | WIRED | Lines 262, 273 |
| `core/views/encounter.py` | `core/encounter_state.py` | `enc.rotate_view(delta)` and `enc.set_projection(...)` | WIRED | Lines 109, 128 |
| `core/payload_builder.py` | `src/types/gmConsole.ts` | SSE keys read as `ActiveView` fields | WIRED | Keys match; SharedConsole reads them at line 918 |
| `EncounterMapRenderer.tsx` | `gridProjection.ts` | `buildProjection` → `topDownProjection` / `isoProjection` | WIRED | `viewOrientation.ts` imports both |
| `EncounterMapRenderer.tsx` | `useOrientationTransition.ts` | `useOrientationTransition({...requested, locationKey}, ...)` | WIRED | Line 257 |
| `useOrientationTransition.ts` | `viewTransition.ts` | `planTransition` / `orientationOf` | WIRED | Imported and called in the layout effect |
| `EncounterMapRenderer.tsx` | `TokenLayer.tsx` / `PoiLayer.tsx` | `viewKey` prop | WIRED | Lines 833, 891 |
| `SharedConsole.tsx` | `EncounterMapDisplay.tsx` | `toViewOrientation(...)` → `viewOrientation` | WIRED | Lines 918, 960, 1063 |
| `core/views/navigation.py` | `core/encounter_view.py` | `normalize_default_view(deckplan.get('default_view'))` | WIRED | Line 84 |
| `core/data_loader.py` | `core/encounter_view.py` | `from core.encounter_view import DEFAULT_VIEW, normalize_default_view` | WIRED | Line 16 |
| `gm/views/EncounterView.tsx` | `gm/MapPreview.tsx` | `viewControl={{ mode: 'broadcast', ... }}` forwarded | WIRED | Line 468; MapPreview forwards at line 250 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SharedConsole `viewOrientation` | `activeView.encounter_projection` | SSE activeview ← `active_view_store` ← `set_projection` / `rotate_view` | Yes | FLOWING |
| GM map orientation | `activeView` (SSE echo) | Same as above; no local state | Yes | FLOWING |
| Renderer `displayed` | `requested` → `planTransition` | Props from the mounts above | Yes | FLOWING |
| Switch-view default | `deckplan.default_view` | `load_deckplan` reading `deckplan.yaml` | Yes | FLOWING |
| Editor local view | `useState(DEFAULT_VIEW_ORIENTATION)` | Renderer-private state, by design | N/A (local by design) | FLOWING (intentional) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rotate persists, survives reload, BRIDGE round trip keeps live view | `SECRET_KEY=x .venv/bin/python manage.py test core.tests.test_encounter_view_state.RotateViewHardeningTests.test_rotated_value_survives_store_reload core.tests.test_encounter_view_state.RotateViewEndToEndTests.test_rotate_persists_to_disk core.tests.test_encounter_view_state.SwitchViewDefaultViewTests.test_returning_via_bridge_keeps_the_gms_live_view` | Ran 3, OK | PASS |
| Transition planner ordering and predicates | `pnpm exec vitest run src/components/domain/encounter/__tests__/viewTransition.test.ts` | 47 passed | PASS |
| Full suites | Orchestrator-reported: vitest 413/413, Django 175 OK, `pnpm run build` OK | Not re-run | PASS (reported) |
| Server endpoints live | Not run (no server started) | - | SKIP (routed to human check 6) |
| Probes | No `scripts/*/tests/probe-*.sh` exists; not a migration phase | - | N/A |

Test-tree note: the Django run above did not leak `data/test_stub.md` (`git status` shows no change under `data/`).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ISO-04 | 01, 02, 04, 05 | Projection is a single GM-owned setting broadcast to all players live; GM map mirrors players; player terminal has no view controls; editor keeps a private, non-broadcast view | SATISFIED (code); human confirmation pending | Truths 1, 7, 8. Human checks 2 and 3 |
| ISO-05 | 01, 02, 03, 04, 05 | GM rotates in 90° steps in both projections as an offset on the authored rotation; iso keeps true 30° at every step | SATISFIED with WARNING | Truths 2, 9 (race WARNING), 10. Human check 1 |
| ISO-06 | 02, 05 | `deckplan.yaml` authors a location-level `default_view`; applied on location change only; persists across reloads | SATISFIED (code); restart and browser confirmation pending | Truths 5, 11. Human check 6 |
| ISO-07 | 03, 04, 05 | At every projection/rotation all map elements render and hit-test correctly; rotation fades, projection cuts, pan/zoom resets, in-progress drag is cancelled | NEEDS HUMAN | Hit-test math verified (truth 3). Element rendering, GSAP executor and runtime drag cancel are PRESENT_BEHAVIOR_UNVERIFIED (truths 4, 6). Human checks 1, 3, 4, 5 |
| ISO-02 | Phase 33 | Per-viewer toggle | Superseded by ISO-04 (not a Phase 34 requirement) | Toggle confirmed absent (truth 1) |

Orphaned requirements: none. `REQUIREMENTS.md` lines 79-84 map exactly ISO-04..ISO-07 to Phase 34, and all four appear in at least one PLAN frontmatter.

Documentation discrepancy: `REQUIREMENTS.md` (lines 40-43, 81-84) marks ISO-04..ISO-07 as `[x]` Complete and "Complete" in traceability, but ISO-07 and the human-gated parts of ISO-04 and ISO-06 depend on the six unperformed human checks. See WR-03.

### Anti-Patterns Found

Scan of the 40 implementation, test and schema files changed by the phase (`git diff --name-only 11828f5..HEAD -- core src docs`):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| all changed files | - | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | - | None found. Debt-marker gate passes |
| `core/encounter_state.py` | 76-88 | Non-atomic read-modify-write across two lock acquisitions (WR-01) | Warning | Latent race; correct only under the single-worker gevent deployment |
| `core/payload_builder.py` | 99-100 | Stored projection and offset forwarded unvalidated (WR-02) | Warning | Hand-edited disk state reaches the SSE payload; the client coerces to 0, which hides the divergence |
| `src/components/gm/MapPreview.tsx` | ~167 | Non-`fill` branch sizes from a grid-space bounding box that ignores iso and offset (research pitfall P9) | Info | Dead path: `EncounterPanel` has zero mounts in `src`; every live mount passes `fill`. Deferred by plan 34-05 |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | 160-163, 169-178 | Rotate glyphs `⟲`/`⟳` depend on font coverage; inline colour literals (IN-02) | Info | Routed to human check 5 with the `CCW`/`CW` fallback |
| `src/components/domain/dashboard/sections/StatusSection.tsx` | 464 | Bridge thumbnail mirrors encounter-scoped orientation after the GM leaves an encounter (IN-03) | Info | Matches plan 34-05 truth ("GM bridge ship thumbnail ... broadcast view"); flagged for awareness |
| `docs/schemas/schema-encounters.md` | 224-228 | P3 inserted before P2 (IN-01) | Info | Ordering only |
| `core/data_loader.py` | load_deckplan | `yaml.safe_load` returning `None` (empty file) would raise on `.get` | Info | Pre-existing; not introduced by this phase. Not a must-have |

### Human Verification Required

The six `<human-check>` blocks in 34-05 Task 3 were not performed (they need a live browser, two consoles, OS reduce-motion and a server restart). They are listed here as human items, not as failures.

### 1. Rotation feel, fade, and 30° iso at every rotation

**Test:** On the GM tactical map, press rotate-cw 4 times, then rotate-ccw 4 times, switch to ISO VIEW, and repeat in iso. Include an iso view of the Somnus deck (authored rotation 90).
**Expected:** Each press is an exact 90° step with a short fade (about 0.4 s total). The projection switch is an instant cut. Pan/zoom re-fits and RESET VIEW disappears at the snap. Iso axes stay at 30° at every rotation, including Somnus. Labels and glyphs stay upright.
**Why human:** Visual feel and timing, and the 30° axis check, need a rendered map. The GSAP executor has no DOM test (truth 6).

### 2. No controls on players, private editor

**Test:** Open the player terminal, the player BRIDGE STATUS thumbnail, and the GM BRIDGE ship thumbnail. Then open the deckplan editor preview.
**Expected:** The player views and both thumbnails have no projection toggle, rotate button, badge or text cue. They follow the GM's live view. The editor preview shows the cluster and opens top-down at offset 0. Changing it does not alter the player view or the broadcast value.
**Why human:** The absence of DOM controls and the live mirroring are visual facts (truths 1, 7).

### 3. Hit-testing and mid-drag cancel at all eight combinations

**Test:** For each of the 2 projections x 4 rotations, do a palette drop, a token drag, a context menu, a POI drag and Add POI. Then start a token drag in one window and rotate or switch projection from a second window.
**Expected:** Everything lands on the drawn cell. The in-progress drag is cancelled silently, with no move applied and no toast.
**Why human:** Runtime pointer-to-cell and drag-cancel effects in `TokenLayer` and `PoiLayer` are not DOM-tested (truth 4).

### 4. Pan/zoom preservation, quick presses, reduced motion

**Test:** Pan and zoom, then move a token and toggle a room. Press rotate three times quickly. Enable reduced motion in the OS and rotate again.
**Expected:** Pan/zoom is preserved through token moves and room toggles. Three quick presses land exactly three steps on. Reduced motion gives an instant cut.
**Why human:** Depends on the live SSE echo and the OS setting (truths 6, 9).

### 5. Glyphs, 44 px targets, narrow viewports

**Test:** Check the rotate glyphs on the GM browser's Cascadia Code stack, and check a tablet width and a 360 px width.
**Expected:** `⟲` and `⟳` render. If either shows as a box, change `ROTATE_CCW_LABEL` and `ROTATE_CW_LABEL` to `CCW` and `CW` in `EncounterMapRenderer.tsx:163-164`. All cluster buttons and RESET VIEW are at least 44x44 px. The legend is hidden and the cluster fits at 360 px.
**Why human:** Glyph availability depends on installed fonts. The plan-04 glyph truth is tagged `verification: backstop`, so the verifier abstains from asserting it (insufficient_spec).

### 6. Authored default_view and persistence

**Test:** Author `default_view: {projection: iso, rotation_offset: 90}` on a location. Load it, switch deck, go to BRIDGE and back, then restart the Django server.
**Expected:** The authored default applies on first load. It is kept across deck switches and the BRIDGE round trip, and it persists across the server restart. A location without `default_view` opens top-down at 0.
**Why human:** Needs a real server restart and two live views (truth 5, truth 11).

### 7. Flagged judgment-tier prohibitions

**Test:** Review the 11 prohibitions in the table above and confirm or reject each non-authoritative judge read.
**Expected:** Each prohibition is confirmed or rejected by a human.
**Why human:** ADR-550 D4 routes judgment-tier prohibitions to human resolution.

## Gaps Summary

No BLOCKER. No must-have truth is FAILED. Every artifact exists, is substantive and is wired. Every key link is WIRED.

Open items, none of which is a code gap:

- **Not yet verified by a human:** rendering of every element at every rotation, the GSAP fade and reset feel, runtime drag cancel, glyph legibility, restart persistence, and the 11 judgment-tier prohibitions. These are the six consolidated 34-05 human checks plus the flagged prohibitions.
- **WARNING WR-01 (latent race):** `rotate_view` does a read-modify-write across two lock acquisitions. Two concurrent rotates are only safe because gunicorn runs one gevent worker. Decision for the developer: accept the single-worker assumption and document it, or make the read-modify-write one critical section (for example an `update_state_fn` under `_lock`).
- **WARNING WR-02:** `build()` forwards stored projection and offset without validation. The fix suggested by the review (validate in `_load_from_disk`) is small.
- **WARNING WR-03 (status discrepancy):** `REQUIREMENTS.md` marks ISO-04..07 Complete while the phase's own human gate is unperformed. Decision for the developer: keep `[x]` and rely on the UAT record, or revert ISO-07 (and the human-gated parts of ISO-04 and ISO-06) to pending until the checks pass.
- **INFO:** the ROADMAP phase header still reads "Status: Not started" while the progress table reads "In Progress 5/5". The P9 `MapPreview` non-fill aspect path is a dead branch, deferred by plan 34-05. The review's IN-01 and IN-03 are cosmetic or intentional.

Deferred items (Step 9b): none. Phase 35 (stacked decks) does not cover any Phase 34 criterion.

## Regression Check

Phase 34 touches the shared encounter renderer, which Phase 33 (iso) and earlier phases consume. Offset-0 identity is pinned by `viewOrientation.test.ts` ("offset 0 reproduces the Phase 33 projections") and the untouched `gridProjection` tests. The Django suite (175 tests, run by the orchestrator) includes the pre-existing `test_encounter_state`, `test_active_view_store`, `test_payload_builder` and `test_data_loader` modules, all green.

---

_Verified: 2026-10-14T16:10:00Z_
_Verifier: Claude (gsd-verifier)_
