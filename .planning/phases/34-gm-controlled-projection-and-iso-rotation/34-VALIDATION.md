---
phase: "34"
slug: "gm-controlled-projection-and-iso-rotation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-14"
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) for frontend; Django `TestCase` for backend |
| **Config file** | `vitest.config.ts`; Django settings via `manage.py` |
| **Quick run command** | `pnpm exec vitest run <changed test file>` / `.venv/bin/python manage.py test core.tests.<module>` |
| **Full suite command** | `pnpm run test && pnpm run typecheck && .venv/bin/python manage.py test core.tests.test_encounter_state core.tests.test_active_view_store core.tests.test_payload_builder core.tests.test_data_loader core.tests.test_deckplan_passthrough core.tests.test_encounter_view_state` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `pnpm exec vitest run <file>` or `manage.py test <module>`
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in by the planner/executor against task IDs. Requirement → test map (from 34-RESEARCH.md § Validation Architecture):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| ISO-04 | `set_projection` validates, persists, broadcasts | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ✅ | ✅ green |
| ISO-04 | New keys present in SSE payload | unit (Django) | `.venv/bin/python manage.py test core.tests.test_payload_builder` | ✅ | ✅ green |
| ISO-04 | Defaults merge over old `active_view.json` (D-12) | unit (Django) | `.venv/bin/python manage.py test core.tests.test_active_view_store` | ✅ | ✅ green |
| ISO-05 | `rotate_view(±90)` wraps 0..270, rejects other deltas | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ✅ | ✅ green |
| ISO-05 | top-down rotation identity at 0, round-trip at 90/180/270 | unit (vitest) | `pnpm exec vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` | ✅ | ✅ green |
| ISO-05/07 | Iso axes on 30° lattice, constant length at all offsets incl. authored rotation folded in (D-15) | unit (vitest) | same | ✅ | ✅ green |
| ISO-06 | `load_deckplan` normalizes `default_view` | unit (Django) | `.venv/bin/python manage.py test core.tests.test_data_loader` | ✅ | ✅ green |
| ISO-06 | Location change applies `default_view`; same-location re-entry keeps view (D-16); no-deckplan resets | integration (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_view_state` | ✅ | ✅ green |
| ISO-06 | Deck switch keeps projection/offset (D-10) | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ✅ | ✅ green |
| ISO-07 | Pointer→cell correct at all offsets under iso | unit (vitest) | `pnpm exec vitest run src/utils/__tests__/svgCoordinates.test.ts` | ✅ | ✅ green |
| ISO-07 | `classifyChange`: projection → cut, offset → fade, identical → none | unit (vitest) | `pnpm exec vitest run src/components/domain/encounter/__tests__/viewTransition.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Task → automated command map (filled by planner)

Wave 0 test files are created INSIDE the owning task's RED step (tdd="true" / tracer starts red), so no separate Wave 0 plan exists; every task below carries an `<automated>` command.

| Task | Plan / wave | Requirement | Automated command |
|------|-------------|-------------|-------------------|
| 34-01-T1 (tracer, server leg + projection seam) | 01 / W1 | ISO-04, ISO-05 | `.venv/bin/python manage.py test core.tests.test_encounter_view_state`; `pnpm exec vitest run .../geometry/__tests__/gridProjection.test.ts`; `pnpm run typecheck` |
| 34-01-T2 (GM client leg) | 01 / W1 | ISO-04, ISO-05 | `pnpm run typecheck`; `pnpm run test` |
| 34-02-T1 (rotate hardening + set-projection + core/encounter_view.py) | 02 / W2 | ISO-04, ISO-05 | `.venv/bin/python manage.py test core.tests.test_encounter_state core.tests.test_encounter_view_state` |
| 34-02-T2 (default_view loader + schema docs) | 02 / W2 | ISO-06 | `.venv/bin/python manage.py test core.tests.test_data_loader core.tests.test_deckplan_passthrough` |
| 34-02-T3 (switch-view reset, store/payload defaults) | 02 / W2 | ISO-06 | six-module backend suite (Full suite command, backend part) |
| 34-03-T1 (viewOrientation module, hit-test matrix) | 03 / W2 | ISO-05, ISO-07 | `pnpm exec vitest run` on viewOrientation, gridProjection, svgCoordinates test files; `pnpm run typecheck` |
| 34-03-T2 (transition planner, drag-cancel, popover-close predicates) | 03 / W2 | ISO-07 | `pnpm exec vitest run src/components/domain/encounter/__tests__/viewTransition.test.ts`; `pnpm run typecheck` |
| 34-04-T1 (renderer modes, cluster, tracer-prop migration) | 04 / W3 | ISO-04, ISO-05, ISO-07 | `pnpm run typecheck`; `pnpm run test` |
| 34-04-T2 (transition hook executing the tested plan, drag cancel) | 04 / W3 | ISO-07 | `pnpm exec vitest run src/components/domain/encounter/__tests__/viewTransition.test.ts` (the decisions the hook and layers execute); `pnpm run typecheck`; `pnpm run test` (DOM/GSAP timing itself is covered by the 34-05 human checks) |
| 34-05-T1 | 05 / W4 | ISO-04 | `pnpm run typecheck` |
| 34-05-T2 | 05 / W4 | ISO-04, ISO-05 | `pnpm run typecheck`; `pnpm run test` |
| 34-05-T3 | 05 / W4 | ISO-04..07 | Full suite command + six `<human-check>` blocks (Manual-Only table below) |

---

## Wave 0 Requirements

- [x] `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — top-down rotation + iso four-azimuth block
- [x] `src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts` — offset normalization, offset-0 identity
- [x] `src/components/domain/encounter/__tests__/viewTransition.test.ts` — `classifyChange`
- [x] `src/utils/__tests__/svgCoordinates.test.ts` — projection-aware cell resolution per offset
- [x] `core/tests/test_encounter_state.py` — `set_projection`, `rotate_view`, deck-switch retention
- [x] `core/tests/test_active_view_store.py` — defaults merge for new keys
- [x] `core/tests/test_payload_builder.py` — new keys present
- [x] `core/tests/test_data_loader.py` — `default_view` normalization
- [x] `core/tests/test_encounter_view_state.py` (new) — location-change reset semantics

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rotation fade / projection cut timing; pan-zoom resets to fit on GM change only | ISO-07 | DOM + GSAP timing; no renderer harness | Rotate at all four steps in both projections on GM map; watch player terminal fade and re-fit; confirm no reset on unrelated SSE updates |
| Players see no view controls; GM map shows controls; editor toggle never changes player view | ISO-04/05 | Mount-level DOM assertion needs new harness | Open player terminal, GM tactical map, GM side panel, deckplan editor; toggle in editor and confirm player view unchanged |
| Somnus iso renders as flat 30° diamonds (D-15) | ISO-07 | Visual | Load Somnus in iso, compare against a non-rotated ship |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-14 — all automated rows green (vitest 413/413, Django `core` 175 OK); manual-only rows deferred to end-of-phase UAT (34-05 Task 3 human checks).

## Validation Audit 2026-10-14

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
