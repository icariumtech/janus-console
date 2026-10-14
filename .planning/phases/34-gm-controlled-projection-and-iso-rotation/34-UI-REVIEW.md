# Phase 34 — UI Review

**Audited:** 2026-10-14
**Baseline:** 34-UI-SPEC.md (UI Design Contract), STYLE_GUIDE.md (project design system)
**Screenshots:** not captured (no dev server on localhost:3000, 5173 or 8080). Code-only audit. Visual pillars are scored from Tailwind-free inline style and class analysis, not rendered output.
**Interaction captures:** off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Labels, tooltips, aria-labels and both error toasts match UI-SPEC verbatim |
| 2. Visuals | 3/4 | Glyph-only rotate buttons depend on an unverified font glyph; no rendered check |
| 3. Color | 3/4 | Spec palette and amber-accent rule followed, but hex literals are repeated inline and the teal token value conflicts across docs |
| 4. Typography | 3/4 | One size (11px) and default weight, as declared; font stack diverges from the global STYLE_GUIDE font |
| 5. Spacing | 3/4 | All values on the 4px grid and 44px targets set in code; 360px and tablet fit not rendered |
| 6. Experience Design | 3/4 | Good error handling, echo-only sync and reduced-motion path; six human checks were never performed, and the cluster has no component test |

**Overall: 19/24**

No pillar scored 1. No BLOCKER-class defect was found in code. The phase ships with unperformed human checks (see Priority Fixes 2).

---

## Top 3 Priority Fixes

1. **Rotate glyphs `⟲` (U+27F2) and `⟳` (U+27F3) may not render in Cascadia Code** — the GM may see empty boxes on the only rotate controls, so the feature is undiscoverable — **Fix:** open the console in the GM's browser, confirm both glyphs render. If not, set `ROTATE_CCW_LABEL = 'CCW'` and `ROTATE_CW_LABEL = 'CW'` in `src/components/domain/encounter/EncounterMapRenderer.tsx` (lines 163–164), as UI-SPEC's pre-declared backstop allows.

2. **Six UI-SPEC human checks were never run** — rotation/fade feel, all eight projection×offset hit-tests, 360px and tablet layout, reduced motion, Somnus iso output change (D-15), and server-restart persistence are all unverified — the phase is marked complete with `human_judgment: true` on four decisions — **Fix:** run the six `<human-check>` blocks from `34-05-PLAN.md` Task 3 (UAT via `/gsd-verify-work`) before treating visual behavior as accepted.

3. **Inline style literals are duplicated and the teal token is inconsistent** — `#4a6b6b`, `#7ab8b8`, `#c9a050`, `rgba(15, 21, 21, 0.95)` are repeated across `EncounterMapRenderer.tsx` (lines ~169–178 and ~910–990), and `CLAUDE.md` gives teal as `#4a6b6b` while `STYLE_GUIDE.md` defines `--color-teal` as `#4a8b8b` — **Fix:** move the overlay palette into named constants (or existing CSS variables after reconciling the teal value in one place), and add a single test or snapshot covering the cluster's label/aria/tooltip contract, since there is no component harness.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Verified against UI-SPEC Copywriting Contract:
- Projection label: `ISO VIEW` when top-down, `TOP DOWN` when iso (`EncounterMapRenderer.tsx` ~line 966). Matches.
- Projection `title`: `Switch map to isometric view (players follow)` / `...top-down view (players follow)` via `followNote` (line 579, 953–956). Matches.
- Projection `aria-label` and `aria-pressed` (lines 958–959). Matches.
- Rotate `title` and `aria-label` (lines 974–975, 983–984). Matches.
- Toasts in `src/components/gm/views/EncounterView.tsx` lines 265 and 274: `Failed to rotate map — try again` and `Failed to switch map projection — try again`. Exact match, em dash included.
- No generic labels (`Submit`, `OK`, `Click Here`) introduced in this phase's changed files.

Minor: the `followNote` suffix is intentionally empty in local (deckplan editor) mode (line 579). UI-SPEC says the editor controls "look and behave identically" to the GM map. The tooltip wording differs. This is defensible (the editor does not affect players) but should be recorded as a conscious deviation.

### Pillar 2: Visuals (3/4)

- Focal hierarchy holds: the map SVG remains primary; the cluster is 11px text at the same visual weight as `RESET VIEW` (UI-SPEC focal-point requirement).
- Cluster placement: `gridArea: 'bottom-left'`, `alignSelf: 'end'`, `display: flex`, `gap: 8px` (lines 939–950). Matches.
- Rotate buttons are glyph-only visually. Each has `title` and `aria-label`, so accessibility is covered. The visual affordance depends on the glyph rendering (Priority Fix 1). Not verifiable from code.
- Legend yields below 480px via `@media (max-width: 479px) { .encounter-map__legend { display: none; } }` in `EncounterMapRenderer.css` (lines 85–88). The wrapper carries the class (line 1009). Correct.
- Fade wrapper `.encounter-map-renderer__fade` (CSS, end of file) keeps the original box geometry. No visual regression is evident from code.

### Pillar 3: Color (3/4)

- Accent discipline is correct: `#c9a050` is applied only to the projection button when iso is broadcast (line 962–963). Rotate buttons and `RESET VIEW` do not use it. Matches the UI-SPEC per-button state table.
- Destructive colours: none introduced.
- Hardcoded hex/rgba in the changed renderer is the main gap. The UI-SPEC declares these as "existing project tokens", but they are inline literals, not `var(--color-*)` references. This is the project's pattern for this file, so it is a WARNING, not a BLOCKER.
- Token drift: `CLAUDE.md` lists Teal `#4a6b6b`. `STYLE_GUIDE.md` lists `--color-teal: #4a8b8b` and `--color-amber: #c9a050`. The UI-SPEC copies `#4a6b6b` as its structural teal. A reader cannot tell which teal is canonical. Reconcile in the docs.
- 60/30/10 split: the cluster is secondary chrome. The `rgba(15, 21, 21, 0.95)` surface covers the 30% share as specified. Map background `#080e0e` is unchanged.

### Pillar 4: Typography (3/4)

- Declared scale is exactly one size (`fontSize: '11px'`, grep of added lines returns one occurrence) and no `fontWeight` is set, so weight is the default 400. Matches UI-SPEC.
- Labels are uppercase with `letterSpacing: '2px'`. Matches.
- Font stack `'Cascadia Code', 'Courier New', monospace` is the UI-SPEC value. It conflicts with the project-wide typography in `STYLE_GUIDE.md`, which specifies `'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace`. The overlay now renders in a different primary face than the rest of the console. This was a deliberate match to `RESET VIEW`, but it is a system-level inconsistency that should be recorded.
- 11px is small for a touch-target control used at the table on tablets. The contract accepts it; the human check at 768–1024px should confirm legibility.

### Pillar 5: Spacing (3/4)

- Every declared value is on the 4px grid: `gap: 8px`, `padding: 8px 16px`, grid `padding: 20px`, `minWidth`/`minHeight: 44px`. Matches UI-SPEC Spacing Scale.
- Touch targets: `OVERLAY_BUTTON_STYLE` applies 44px min to all four buttons, including `RESET VIEW` (lines 169–178, 922–931). Matches.
- Cluster width estimate: UI-SPEC says about 194px. With 11px text, 2px tracking and 16px side padding, `ISO VIEW` will be wider than the spec's ~90px estimate. This is a derived measurement, not a token, but the 360px fit (`~194px` against 320px available) was not rendered.
- Arbitrary values: none introduced in the changed files.

Not verified: rendered layout at 360px and 768–1024px (UI-SPEC human checkpoint).

### Pillar 6: Experience Design (3/4)

Strengths (code-verified):
- Echo-only sync: `handleRotate` and `handleProjectionChange` do not update local state (`EncounterView.tsx` lines 258–276). The button label and map follow the SSE broadcast. Matches D-01 and the spec's "no optimistic update".
- Error handling: both POSTs catch and toast, and the map keeps the broadcast value.
- Reduced motion: `prefersReducedMotion()` in `useOrientationTransition.ts` (lines 22–28) turns rotation into a cut. Matches.
- Focus visibility: no `outline` override on the cluster; default focus ring retained.
- Pan/zoom reset on snap and drag cancellation are implemented in the pure modules covered by vitest (`viewTransition.test.ts`, 47 tests).
- Read-only mounts (player terminal, side panel, thumbnails) receive no `viewControl` (grep-verified in 34-05).

Gaps:
- **Unperformed human checks.** `34-05-SUMMARY.md` states the six `<human-check>` blocks were NOT performed. The rotation feel, cut/fade timing, hit-testing at 8 combinations, glyph legibility, 360px layout, and default_view restore are all unverified. The phase is complete by code tests only.
- **No component-level test** for the cluster render, the echo-only behavior, or the drag-cancel effect in `TokenLayer`/`PoiLayer`. Those effects rely on pure predicates tested separately; wiring is untested.
- **No in-flight feedback.** A click POSTs and the map waits for SSE. Acceptable per UI-SPEC, but on a slow tablet connection the GM may click twice and see no change for the round trip. Server applies relative deltas so state stays correct; the UX lag is the concern.
- **Glyph-only controls** rely on the tooltip for meaning. Acceptable with `title`, but touch users cannot see the tooltip, so the meaning of ⟲/⟳ is only discoverable through the glyph itself.

---

## Registry Safety

Not applicable. `components.json` is absent and UI-SPEC lists no third-party registries.

---

## Files Audited

- `.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-UI-SPEC.md`
- `.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-CONTEXT.md`
- `.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-01-SUMMARY.md` through `34-05-SUMMARY.md`
- `.planning/phases/34-gm-controlled-projection-and-iso-rotation/34-01-PLAN.md` through `34-05-PLAN.md` (referenced, not fully audited)
- `STYLE_GUIDE.md`
- `src/components/domain/encounter/EncounterMapRenderer.tsx` (overlay cluster, lines 160–180, 575–580, 900–1012)
- `src/components/domain/encounter/EncounterMapRenderer.css` (legend breakpoint, fade wrapper)
- `src/components/domain/encounter/useOrientationTransition.ts` (reduced-motion, GSAP ownership of opacity)
- `src/components/domain/encounter/viewTransition.ts`
- `src/components/gm/views/EncounterView.tsx` (handlers, toasts, viewControl wiring)
- `src/components/gm/MapPreview.tsx` (viewControl pass-through; legacy branch receives no control)
- `src/components/gm/views/deckplan/DeckplanPreviewPane.tsx` (local mode)
