---
phase: "33"
slug: "isometric-view"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-06"
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`environment: 'jsdom'`, `include: ['src/**/__tests__/**/*.test.{ts,tsx}']`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` |
| **Full suite command** | `pnpm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts`
- **After every plan wave:** Run `pnpm run test` (full suite) + `pnpm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green, plus a human-verify checkpoint opening both real screens (player `EncounterView` and GM `gm/views/EncounterView.tsx`'s tactical map) and toggling each independently, per ISO-02/ISO-03's explicit "live" + "independently" wording.
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | ISO-01 | — | N/A | unit | `npx vitest run src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | ISO-01 | — | N/A | unit | new test targeting `RoomsLayer.tsx`/`DetailsLayer.tsx` circle-as-ellipse rendering | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 2 | ISO-01 | — | N/A | unit | new test targeting `Token.tsx`/`TokenLayer.tsx` position via `view.project()` | ❌ W0 | ⬜ pending |
| 33-02-02 | 02 | 2 | ISO-03 | — | N/A | unit | new test for projection-aware `snapToGrid`/`getGridCell` replacement | ❌ W0 | ⬜ pending |
| 33-03-01 | 03 | 3 | ISO-02, ISO-03 | — | N/A | manual | human-verify checkpoint — toggle both real screens independently | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts` — add `isoProjection` describe-block (axis-angle, round-trip, degenerate-tilt-throws)
- [ ] A test file for the circle→ellipse matrix-transform technique (no existing test file covers `RoomsLayer.tsx`/`DetailsLayer.tsx` circle rendering today — pre-existing gap, made visible by this phase)
- [ ] A test (new or extending `svgCoordinates.test.ts` if the planner creates one) for the projection-aware inverse-mapping replacement of `snapToGrid`/`getGridCell`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle flips `projectionMode` local state and re-renders with the new projection; two independent mounts do not affect each other | ISO-02, ISO-03 | Cross-instance independence is a React-fundamentals guarantee already implicitly exercised by existing multi-mount usage (5+ mounts today) — not new risk surface worth a bespoke test harness | Open the player `EncounterView` and the GM console map (`gm/views/EncounterView.tsx`) side by side; toggle top-down/iso on each independently; confirm the other view's projection is unaffected and the change is an instant cut, not an animated transition |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
