---
phase: "34"
slug: "gm-controlled-projection-and-iso-rotation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| ISO-04 | `set_projection` validates, persists, broadcasts | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ❌ W0 (extend) | ⬜ pending |
| ISO-04 | New keys present in SSE payload | unit (Django) | `.venv/bin/python manage.py test core.tests.test_payload_builder` | ❌ W0 (extend) | ⬜ pending |
| ISO-04 | Defaults merge over old `active_view.json` (D-12) | unit (Django) | `.venv/bin/python manage.py test core.tests.test_active_view_store` | ❌ W0 (extend) | ⬜ pending |
| ISO-05 | `rotate_view(±90)` wraps 0..270, rejects other deltas | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ❌ W0 | ⬜ pending |
| ISO-05 | top-down rotation identity at 0, round-trip at 90/180/270 | unit (vitest) | `pnpm exec vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` | ❌ W0 (extend) | ⬜ pending |
| ISO-05/07 | Iso axes on 30° lattice, constant length at all offsets incl. authored rotation folded in (D-15) | unit (vitest) | same | ❌ W0 | ⬜ pending |
| ISO-06 | `load_deckplan` normalizes `default_view` | unit (Django) | `.venv/bin/python manage.py test core.tests.test_data_loader` | ❌ W0 (extend) | ⬜ pending |
| ISO-06 | Location change applies `default_view`; same-location re-entry keeps view (D-16); no-deckplan resets | integration (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_view_state` | ❌ W0 (new) | ⬜ pending |
| ISO-06 | Deck switch keeps projection/offset (D-10) | unit (Django) | `.venv/bin/python manage.py test core.tests.test_encounter_state` | ❌ W0 | ⬜ pending |
| ISO-07 | Pointer→cell correct at all offsets under iso | unit (vitest) | `pnpm exec vitest run src/utils/__tests__/svgCoordinates.test.ts` | ❌ W0 (extend) | ⬜ pending |
| ISO-07 | `classifyChange`: projection → cut, offset → fade, identical → none | unit (vitest) | `pnpm exec vitest run src/components/domain/encounter/__tests__/viewTransition.test.ts` | ❌ W0 (new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — top-down rotation + iso four-azimuth block
- [ ] `src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts` — offset normalization, offset-0 identity
- [ ] `src/components/domain/encounter/__tests__/viewTransition.test.ts` — `classifyChange`
- [ ] `src/utils/__tests__/svgCoordinates.test.ts` — projection-aware cell resolution per offset
- [ ] `core/tests/test_encounter_state.py` — `set_projection`, `rotate_view`, deck-switch retention
- [ ] `core/tests/test_active_view_store.py` — defaults merge for new keys
- [ ] `core/tests/test_payload_builder.py` — new keys present
- [ ] `core/tests/test_data_loader.py` — `default_view` normalization
- [ ] `core/tests/test_encounter_view_state.py` (new) — location-change reset semantics

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rotation fade / projection cut timing; pan-zoom resets to fit on GM change only | ISO-07 | DOM + GSAP timing; no renderer harness | Rotate at all four steps in both projections on GM map; watch player terminal fade and re-fit; confirm no reset on unrelated SSE updates |
| Players see no view controls; GM map shows controls; editor toggle never changes player view | ISO-04/05 | Mount-level DOM assertion needs new harness | Open player terminal, GM tactical map, GM side panel, deckplan editor; toggle in editor and confirm player view unchanged |
| Somnus iso renders as flat 30° diamonds (D-15) | ISO-07 | Visual | Load Somnus in iso, compare against a non-rotated ship |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
