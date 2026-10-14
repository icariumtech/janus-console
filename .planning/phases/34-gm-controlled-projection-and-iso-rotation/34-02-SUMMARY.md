---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 02
subsystem: encounter-view
tags: [django, validation, deckplan, schema-sync, tdd]

requires:
  - phase: 34-01
    provides: rotate_view tracer, encounter_projection / encounter_rotation_offset store keys and payload keys
provides:
  - "core/encounter_view.py: PROJECTIONS, ROTATION_OFFSETS, ROTATION_DELTAS, DEFAULT_VIEW and normalize_default_view(raw), a per-field normalizer that never raises"
  - "Hardened rotate-view: exact int 90/-90 only (bool and 90.0 rejected), non-object body is 400, CSRF enforced"
  - "POST /api/gm/encounter/set-projection/ (name encounter_set_projection) and enc.set_projection(projection)"
  - "load_deckplan returns a normalized default_view on both return paths"
  - "api_switch_view applies the authored default view only when the location changes, tracked by the internal store key encounter_view_location_slug"
  - "docs/schemas/schema-encounters.md: default_view table, deck rotation row, clarified unit_size row, pitfall P3"
affects: [34-03, 34-04, 34-05]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: ff86e2cbf6251cf320cace62e9729c6a8fa08d39
plan_head_after: fc91f7d9a29e71be7e0dc323d9507d963e6ff829

tech-stack:
  added: []
  patterns:
    - "Closed-enum constants in one module (core/encounter_view.py) shared by setters, loader normalizer and view-switch logic"
    - "Dedicated internal store marker (not in the SSE allow-list) to detect a real location change across BRIDGE/STANDBY round trips"
    - "Defensive double normalization: loader normalizes, api_switch_view normalizes again before writing the store"

key-files:
  created:
    - core/encounter_view.py
  modified:
    - core/encounter_state.py
    - core/views/encounter.py
    - core/views/__init__.py
    - core/urls.py
    - core/data_loader.py
    - core/views/navigation.py
    - core/active_view_store.py
    - docs/schemas/schema-encounters.md
    - core/tests/test_encounter_state.py
    - core/tests/test_encounter_view_state.py
    - core/tests/test_data_loader.py
    - core/tests/test_active_view_store.py
    - core/tests/test_payload_builder.py

key-decisions:
  - "default_view key names are default_view / projection / rotation_offset (rotation_offset, not rotation, so it never collides with the absolute per-deck rotation)"
  - "The authored default is applied only when encounter_view_location_slug differs from the requested slug; location_slug cannot be used because BRIDGE/STANDBY clear it"
  - "unit_size doc row distinguishes the renderer fallback (40) from the authoring convention (30, written explicitly by tools), instead of replacing 30 with 40"

requirements-completed: [ISO-04, ISO-05, ISO-06]

coverage:
  - id: D1
    description: "rotate-view rejects every malformed delta and body (float 90.0, bool, string, null, 0, 180, list/number body) with 400 and unchanged state; enforces login and CSRF; wraps 0->90->180->270->0 and -90 from 0 gives 270; survives a store reload"
    requirement: ISO-05
    verification:
      - kind: integration
        ref: "core/tests/test_encounter_view_state.py#RotateViewHardeningTests"
        status: pass
      - kind: unit
        ref: "core/tests/test_encounter_state.py#RotateViewTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "GM can set the broadcast projection through a validated, login- and CSRF-protected endpoint; the SSE event carries encounter_projection; eight invalid shapes and non-object bodies return 400 with state unchanged"
    requirement: ISO-04
    verification:
      - kind: integration
        ref: "core/tests/test_encounter_view_state.py#SetProjectionEndpointTests"
        status: pass
      - kind: unit
        ref: "core/tests/test_encounter_state.py#SetProjectionTests"
        status: pass
    human_judgment: false
  - id: D3
    description: "deckplan.yaml accepts an optional default_view; load_deckplan returns a per-field normalized value on both return paths and never raises on bad authored values"
    requirement: ISO-06
    verification:
      - kind: unit
        ref: "core/tests/test_data_loader.py#DefaultViewNormalizationTests / LoadDeckplanDefaultViewTests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Entering a different location applies its default_view (or top-down/0); BRIDGE/STANDBY round trips and same-slug re-selects keep the GM's live view; deck switches keep the view; room/portrait/default-deck initialization unchanged"
    requirement: ISO-06
    verification:
      - kind: integration
        ref: "core/tests/test_encounter_view_state.py#SwitchViewDefaultViewTests"
        status: pass
      - kind: unit
        ref: "core/tests/test_encounter_state.py#DeckSwitchKeepsViewTests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Store and payload defaults: _DEFAULT_STATE holds the three view keys, an older state file loads with defaults, and the payload never exposes encounter_view_location_slug"
    requirement: ISO-06
    verification:
      - kind: unit
        ref: "core/tests/test_active_view_store.py#ViewStateDefaultsTests; core/tests/test_payload_builder.py#BuildViewOrientationTests"
        status: pass
    human_judgment: false
  - id: D6
    description: "Schema Sync: docs/schemas/schema-encounters.md documents default_view, the deck rotation field, the clarified unit_size row and pitfall P3 in the same commit as the loader change"
    requirement: ISO-06
    verification:
      - kind: other
        ref: "git show --name-only 5fbd437 lists core/data_loader.py and docs/schemas/schema-encounters.md; acceptance greps match"
        status: pass
    human_judgment: true
    rationale: "Wording quality and accuracy of the schema prose for the janus-skills consumers is a judgment call no test asserts."

duration: 15min
completed: 2026-10-14
status: complete
---

# Phase 34 Plan 02: Backend Projection Control and Default View Summary

**Server-side view control for Phase 34: strict int-only rotate-view, a validated set-projection endpoint, and an optional deckplan `default_view` that is normalized per field and applied exactly once per location change via an internal `encounter_view_location_slug` marker.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (all TDD: RED then GREEN each)
- **Files modified:** 14 (1 created)
- **Tests:** full `manage.py test core` OK (175 tests, 3 skipped), up from 125

## Accomplishments

- Rotate hardening moved out of the tracer: `rotate_view` accepts only an exact `int` of 90 or -90 (the genuinely new rejection is float `90.0`, which equals 90), a list/number/string JSON body returns 400 instead of a 500, and a CSRF-enforcing client without a token gets 403.
- `set_projection` plus `POST /api/gm/encounter/set-projection/` mirror the vents endpoint (`login_required` + `post_json`, no `csrf_exempt`); the value is checked against `PROJECTIONS` and broadcast on the existing SSE event.
- `normalize_default_view` falls back per field (for example `projection: sideways, rotation_offset: 90` gives top-down / 90), logs a warning for invalid values, stays silent for absent ones, rejects bool/float/string/out-of-range offsets, and never raises.
- `api_switch_view` loads the deckplan once (hoisted), keeps the portrait/room-visibility/default-deck initialization identical, and applies the default view only when the stored marker differs from the requested slug.
- Schema doc updated in the same commit as the loader: `default_view` field table and rule description, deck `rotation` row, `unit_size` row clarified to "falls back to 40 when omitted; tools write 30 explicitly", pitfall P3.

## Task Commits

1. **Task 1 RED** - `cff2054` (test): rotate hardening and set-projection tests
2. **Task 1 GREEN** - `5ff3f62` (feat): encounter_view.py, strict rotate_view, set_projection, endpoint and route
3. **Task 2 RED** - `7e80aef` (test): normalizer and load_deckplan tests
4. **Task 2 GREEN** - `5fbd437` (feat): normalizer, loader default_view, schema docs (loader and schema in one commit)
5. **Task 3 RED** - `b60d135` (test): location-change reset, defaults, payload tests
6. **Task 3 GREEN** - `fc91f7d` (feat): marker key and api_switch_view default-view logic

**Plan metadata:** committed separately after this file (docs: complete plan).

## Decisions Made

- Key names `default_view` / `projection` / `rotation_offset` per D-19.
- `normalize_default_view` is applied twice (loader and `api_switch_view`) so a loader bypass can never put an unvalidated value in the store (T-34-09).
- The `unit_size` documentation keeps `30` as the authoring convention so janus-skills keep emitting an explicit value; the renderer fallback of 40 is documented alongside.

## Deviations from Plan

### Minor wording adjustment

**1. [Plan inconsistency] Cross-reference text in the Top-level Fields row**
- **Found during:** Task 2 acceptance greps
- **Issue:** The plan asked the `default_view` table row to say "see Default view fields below", but its own acceptance criterion requires `grep -n "Default view fields"` to return exactly one match (the section heading).
- **Fix:** The row now says "see the `default_view` table below". The heading is the single match.
- **Files modified:** docs/schemas/schema-encounters.md
- **Commit:** 5fbd437

**Total deviations:** 1 (documentation wording only). **Impact:** none on behavior.

Process notes (no code impact):
- Task 2 RED failed as a module `ImportError` (the failure mode the plan itself names), so it is a collection-level failure and not a per-assertion RED. The load_deckplan `KeyError` cases could not run until the import resolved.
- Task 1 RED: the `RotateViewTests` invalid-delta subTests cascaded after the `90.0` case mutated state; the real new rejections are `90.0` and the non-object body. Wrap, CSRF, anonymous and reload tests for the existing rotate path were characterization tests and passed at once, as the plan expected.
- `ruff` is not installed in this environment, so lint was not run.
- `manage.py test core` leaked `data/test_stub.md` (pre-existing, from `test_gm_api.py`); it was deleted, not committed.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks, so the `tdd-red-evidence` classifier was not run. Each task has a `test(34-02)` commit preceding its `feat(34-02)` commit (cff2054 < 5ff3f62, 7e80aef < 5fbd437, b60d135 < fc91f7d). No REFACTOR commits were needed.

## Known Stubs

None.

## Threat Flags

None. The new endpoint and the authored-YAML input are the ones registered in the plan's threat model (T-34-07 to T-34-10). Mitigations delivered: enum check and 400 mapping (T-34-07), `login_required` + `post_json` with no `csrf_exempt`, tested 302 and 403 (T-34-08), per-field normalizer plus defensive re-normalization (T-34-09), dedicated location marker with BRIDGE and same-slug round-trip tests (T-34-10). It also closes T-34-01, T-34-03 and T-34-06 from 34-01.

## Self-Check

- `core/encounter_view.py` exists; modified files all exist.
- Commits `cff2054`, `5ff3f62`, `7e80aef`, `5fbd437`, `b60d135`, `fc91f7d` are ancestors of HEAD; `git rev-list --count` from the ledger base is 6.
- Commit `5fbd437` lists both `core/data_loader.py` and `docs/schemas/schema-encounters.md`.
- Acceptance greps for all three tasks match as specified (single `def set_projection`, `load_deckplan(` appears once in navigation.py, marker absent from payload_builder.py, 30 test methods in test_encounter_view_state.py).
- Plan-level verification: the six-module command OK (116 tests) and full `manage.py test core` OK (175 tests, 3 skipped).

## Self-Check: PASSED

## Next Phase Readiness

Ready for 34-03 (shared `viewOrientation.ts` normalizers on the client, replacing the inline guard in `gm/views/EncounterView.tsx`). The client can now call `set-projection` and read `encounter_projection` / `encounter_rotation_offset` from the SSE event; the authored `default_view` is delivered through those same two keys on location change.

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-14*
