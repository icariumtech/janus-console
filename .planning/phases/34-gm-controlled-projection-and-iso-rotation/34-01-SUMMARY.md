---
phase: 34-gm-controlled-projection-and-iso-rotation
plan: 01
subsystem: encounter-view
tags: [django, sse, react, svg-projection, vitest, tracer]

requires:
  - phase: 33-isometric-projection
    provides: isoProjection and the Projection seam in gridProjection.ts
provides:
  - "Shared GM-owned encounter view state: encounter_projection ('top-down') and encounter_rotation_offset (0) in active_view_store, persisted and broadcast on the SSE activeview event"
  - "POST /api/gm/encounter/rotate-view/ applying a relative +/-90 step on the server, modulo 360"
  - "topDownProjection rotation option (grid azimuth, exact at quarter turns)"
  - "GM tactical map rotate-clockwise button; the map re-projects only after the SSE echo"
affects: [34-02, 34-03, 34-04, 34-05]

actuals:
  tokens: 6000
  tasks: 2
  commits: 3
plan_head_before: 11828f5883fd62eeff046ff19443bac301631ecf
plan_head_after: 31225d80720503b8a1db93629d9da201fcedcdb5

tech-stack:
  added: []
  patterns:
    - "Relative-delta mutation computed server-side from current state (no client-supplied absolute value)"
    - "Contract pin: SSE key names asserted in both the Django SSE test and the vitest payload-to-pixels test"

key-files:
  created:
    - core/tests/test_encounter_view_state.py
  modified:
    - core/active_view_store.py
    - core/encounter_state.py
    - core/views/encounter.py
    - core/views/__init__.py
    - core/urls.py
    - core/payload_builder.py
    - src/components/domain/encounter/geometry/gridProjection.ts
    - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
    - src/types/gmConsole.ts
    - src/services/encounterApi.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/gm/views/EncounterView.tsx

key-decisions:
  - "Rotation is relative-only: rotate_view(delta) rejects anything outside (90, -90) and computes the new offset from server state, so double clicks and two GM clients each apply exactly one step"
  - "GM EncounterView holds no local view state and does no optimistic update; the map follows activeView only (D-01)"
  - "Client coerces any offset other than 90/180/270 to 0 inline; plan 34-03 replaces this with the shared normalizer"

patterns-established:
  - "topDownProjection uses exact cos/sin pairs at 0/90/180/270 and a +0 to avoid negative zero"

requirements-completed: [ISO-04, ISO-05]

coverage:
  - id: D1
    description: "Rotate POST advances the server offset, persists it to disk, and carries encounter_rotation_offset / encounter_projection in the payload and the SSE activeview event"
    requirement: ISO-04
    verification:
      - kind: integration
        ref: "core/tests/test_encounter_view_state.py#RotateViewEndToEndTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Invalid delta (45) returns 400 and an anonymous POST is redirected to login, both leaving state unchanged"
    requirement: ISO-04
    verification:
      - kind: integration
        ref: "core/tests/test_encounter_view_state.py#test_invalid_delta_is_rejected_and_state_unchanged / test_anonymous_post_is_redirected_and_state_unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "topDownProjection rotation 90 maps grid +x to screen +y and grid +y to screen -x; rotation 0 or omitted is identity"
    requirement: ISO-05
    verification:
      - kind: unit
        ref: "src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts#topDownProjection rotation, payload to pixels (Phase 34 tracer)"
        status: pass
    human_judgment: false
  - id: D4
    description: "GM tactical map shows a rotate-clockwise button and rotates visibly only after the SSE echo (no optimistic update)"
    requirement: ISO-04
    verification:
      - kind: other
        ref: "pnpm run typecheck && pnpm run test (wiring compiles, suite green); no component-level test of the button or the echo-only behavior"
        status: pass
    human_judgment: true
    rationale: "No automated test renders the GM EncounterView, clicks the button, and observes the re-projection after the SSE echo; button placement, glyph legibility, and echo-only behavior need a human to confirm in the running console."

duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 34 Plan 01: Rotate-View Tracer Summary

**GM clicks clockwise-rotate on the tactical map; the server advances a shared, persisted rotation offset (relative +/-90, modulo 360), broadcasts it on the SSE activeview event, and the GM map re-projects 90 degrees clockwise through topDownProjection only after the echo.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (1 tracer with TDD RED/GREEN, 1 auto)
- **Files modified:** 14 (1 created)

## Accomplishments

- Server leg proven end to end by 8 Django tests: HTTP POST, in-memory state, on-disk JSON, `build_active_view_payload`, and the real broadcaster queue message, plus 400 on a bad delta and 302 for an anonymous caller.
- `topDownProjection` accepts `rotation` (clockwise-positive, exact at quarter turns, identity at 0/omitted); the existing 26 gridProjection tests are unchanged and green, plus 2 new payload-to-pixels tests pinning the JSON key names.
- GM client leg: `ActiveView` types, `encounterApi.rotateView`, `EncounterMapRenderer` `rotationOffset`/`onRotate` props (iso gets `45 + rotationOffset`), `MapPreview` forwarding, and `gm/views/EncounterView.tsx` wiring with no local view state.
- Tracer gate: `human_verify_mode` is the default `end-of-phase` and the tracer `<verify>` is automated-only, so it was re-run after GREEN (Django 8 OK, vitest 28 pass, typecheck clean). Logged: Tracer verified end-to-end, expanding.

## Task Commits

1. **Task 1 RED: failing tests** - `e8daf6f` (test)
2. **Task 1 GREEN: server leg + projection seam** - `5110403` (feat)
3. **Task 2: GM client leg** - `31225d8` (feat)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Files Created/Modified

- `core/active_view_store.py` - `encounter_projection` and `encounter_rotation_offset` defaults (persisted by the existing atomic write)
- `core/encounter_state.py` - `ROTATION_DELTAS` and `rotate_view(delta)`
- `core/views/encounter.py`, `core/views/__init__.py`, `core/urls.py` - `api_encounter_rotate_view`, `login_required` + `post_json`, no `csrf_exempt`
- `core/payload_builder.py` - both keys added to the explicit allow-list
- `core/tests/test_encounter_view_state.py` - `RotateViewEndToEndTests` (8 tests)
- `src/components/domain/encounter/geometry/gridProjection.ts` (+ test) - `rotation?: number`
- `src/types/gmConsole.ts`, `src/services/encounterApi.ts` - types and `rotateView`
- `src/components/domain/encounter/EncounterMapRenderer.tsx` - props, projection memo, button in a flex container with the existing toggle
- `src/components/gm/MapPreview.tsx`, `src/components/gm/views/EncounterView.tsx` - forwarding and GM wiring

## Decisions Made

None beyond the plan. Followed D-01, D-06, D-07, D-12 as specified.

## Deviations from Plan

None - plan executed exactly as written, with these environment and process notes (no code impact):

- The Django suite needs `SECRET_KEY`; tests were run with `SECRET_KEY=test-secret-key` (a throwaway value, `.env` not read).
- The worktree had no `.venv` or `node_modules`; both were symlinked from the main checkout (both are gitignored, not committed).
- The plan says "Ran 7 or more tests"; the end-to-end class has 8 because the 200 response body and the state assertions are separate tests.
- Running `manage.py test core` leaves an untracked `data/test_stub.md` (a pre-existing leak from `core/tests/test_gm_api.py`, unrelated to this plan). It was deleted rather than committed; not fixed (out of scope).

## TDD Gate Compliance

The plan is `type: execute` with a `tdd="true"` task, so the RED evidence classifier (`gsd_run check tdd-red-evidence`) was not run. RED commit `e8daf6f` precedes GREEN `5110403`.

Semantic assessment of RED: the vitest RED failed on the planned assertion (`project({gx:1,gy:0})` returned x=40 instead of 0 because rotation was ignored). The Django RED failed in `setUp` with `NoReverseMatch` for `encounter_rotate_view` (all 8 tests errored), which is the failure mode the plan itself names; it proves the route was missing but does not exercise individual assertions until GREEN.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. The new endpoint and persisted fields are the ones already covered by the plan's threat model (T-34-01 to T-34-06). Mitigations present in this plan: delta whitelist with 400 (T-34-01), `login_required` with an anonymous-302 test (T-34-02), no `csrf_exempt` (T-34-03, test lands in 34-02), client coercion to 0 (T-34-04), server-side relative rotation (T-34-05). The strict int-only check (`90.0`, `True`) is deferred to 34-02, as planned: `rotate_view` currently accepts `90.0` because `90.0 == 90`.

## Self-Check

Run before this section was appended; all items below verified.

- Created file `core/tests/test_encounter_view_state.py` exists.
- Commits `e8daf6f`, `5110403`, `31225d8` are ancestors of HEAD.
- Acceptance greps for both tasks all match as specified.
- Plan-level verification: Django `core.tests.test_encounter_view_state` OK (8), full `manage.py test core` OK (125, 3 skipped), vitest gridProjection 28 pass, `pnpm run test` 258 pass, `pnpm run typecheck` clean.

## Self-Check: PASSED

## Next Phase Readiness

Ready for 34-02 (strict delta validation, `core/encounter_view.py`, `set_projection`) and 34-03 (shared `viewOrientation.ts` normalizers replacing the inline guard in `gm/views/EncounterView.tsx`). Not yet covered: the player terminal does not consume `encounter_rotation_offset` (plan 34-04), and the GM button's visual result was verified by types and unit tests only, not in a running browser.

---
*Phase: 34-gm-controlled-projection-and-iso-rotation*
*Completed: 2026-10-14*
