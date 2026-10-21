---
phase: 34-gm-controlled-projection-and-iso-rotation
reviewed: 2026-10-16T00:00:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - vitest.config.ts
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/components/domain/encounter/__tests__/EncounterMapRenderer.viewControls.test.tsx
  - src/components/gm/views/useLocationMapBundle.ts
  - src/components/gm/views/EncounterView.tsx
  - src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx
  - codemaps/frontend.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 34: Code Review Report (incremental, gap-closure 34-06 / 34-07)

**Reviewed:** 2026-10-16
**Depth:** quick (pattern scan plus a targeted read of the diff since d0470d5 and the surrounding code)
**Files Reviewed:** 7
**Status:** issues_found

## Summary

No secrets, dangerous functions, empty catch blocks or stray debug artifacts. The only `console.error` calls are intentional error logging. The 34-06 rotate-button reorder is correct: the order test, the direction wiring (-90 for CCW, +90 for CW) and the 44px minimums all hold. The 34-07 stale-response guard in `useLocationMapBundle` is sound: each effect run owns a `cancelled` flag, so a late response from a superseded location cannot touch state or callbacks. The A to B to A return goes down the deck-only path and discards the late B responses.

The remaining issues are failure-path UX and robustness gaps in the new bundle/freeze design. There are no correctness blockers.

## Warnings

### WR-01: Failed location load leaves the GM on a permanent "Loading..." placeholder with no recovery path

**File:** `src/components/gm/views/useLocationMapBundle.ts:124-130`, `src/components/gm/views/EncounterView.tsx:487-496`
**Issue:** When the Promise.all for a new location fails, the hook sets `bundle = null` and `loading = false`. In `EncounterView` the render chain is then `currentDeckMapData` (null), `noLocationSelected` (false), `loading` (false), `!hasEncounterMap` (false), and finally the `Loading...` fallback. The GM sees "Loading..." indefinitely. The only signal is a transient toast. The effect depends only on `[locationSlug, enabled, currentDeckId]`, so nothing retries until the GM changes location or deck. Because the previous map is also discarded (`setBundle(null)`), a single transient 5xx or network blip takes the GM's tactical map away entirely. `onLocationBundle(null)` is also not called on this path, so `roomVisibility` stays at the previous location's value while `bundle` is null.
**Fix:** Expose an `error` flag from the hook and render an explicit error state with a retry:
```tsx
// hook
const [error, setError] = useState(false);
// ...in catch: setError(true); in start of load: setError(false)
// view
: error ? (<div className="gm-encounter-view__loading">Map failed to load <Button onClick={retry}>RETRY</Button></div>)
```
Call `onLocationBundleRef.current(null)` in the catch so the visibility reset stays paired with the cleared bundle. Consider keeping the frozen previous bundle on failure instead of blanking it, since the gate already makes it read-only.

### WR-02: Deck-map refetch failure is swallowed, leaving the displayed deck out of step with the selected deck

**File:** `src/components/gm/views/useLocationMapBundle.ts:96-100`
**Issue:** On a deck switch inside the committed location, a rejected `getMapData` only logs to the console. `bundleIsCurrent` stays true, so all mutating controls stay live, and the deck `Select` (bound to `currentDeckId`) shows the new deck while the map still draws the old deck. The GM can then reveal rooms or place tokens on what looks like deck 2 while seeing deck 1's geometry. The comment says a failure "must not blank the map", but there is no user-visible signal either. `onError` is available and unused here.
**Fix:** Call `onErrorRef.current('Failed to load deck map')` in that catch. Optionally mark the bundle stale so the gate closes until the next successful fetch.

### WR-03: `latchedMapInputsRef` is read during render and written in an effect

**File:** `src/components/gm/views/EncounterView.tsx:416-424`
**Issue:** `shownMapInputs` reads `latchedMapInputsRef.current` while rendering, and the ref is updated only in a post-commit effect. This is an impure render. Under StrictMode double-invocation, concurrent rendering, or any render that is discarded before commit, the latch can lag the renders React actually showed. It also violates the `react-hooks/refs` rule. It works under the current synchronous test harness (the tests cover the freeze), but the correctness of the "never render a mixed tuple" guarantee depends on effect timing rather than on the data.
**Fix:** Hold the latched inputs in the bundle itself, or derive them as state:
```tsx
const [shown, setShown] = useState(liveMapInputs);
if (bundleIsCurrent && shown !== liveMapInputs) setShown(liveMapInputs); // derive-state-in-render pattern
const shownMapInputs = bundleIsCurrent ? liveMapInputs : shown;
```
This removes the render-time ref read.

## Info

### IN-01: No visual indication that the map is frozen / read-only

**File:** `src/components/gm/views/EncounterView.tsx:466-512`
**Issue:** While `bundleIsCurrent` is false, the old map stays on screen with its mutating callbacks, buttons and token palette removed or disabled, but nothing tells the GM why. `loading` is only consumed when there is no map. If a request hangs (no timeout in `api`), the GM stays frozen on a stale map indefinitely and can only guess.
**Fix:** Render a small "LOADING <location>..." badge in `gm-encounter-view__floating-controls` when `loading && currentDeckMapData`.

### IN-02: Misleading comment on `ROTATE_BUTTON_STYLE` padding

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:183-187`
**Issue:** The comment says "8px padding so the button stays the 44px minimum square". 18px glyph + 16px padding + 2px border is 36px. The 44px size is guaranteed only by the inherited `minWidth`/`minHeight`, not by the padding. A future edit that drops the min-size spread would silently break the touch target while the comment suggests otherwise.
**Fix:** Reword to "padding is reduced so the inherited 44px min-width/min-height, not the padding, sets the size".

### IN-03: Test coverage gaps for the new hook's failure branches

**File:** `src/components/gm/views/__tests__/EncounterView.locationChange.test.tsx:545-561`
**Issue:** Only a failed `getAllDecks` for a new location is tested. A failed `getMapData` for a new location, a failed deck-only refetch (WR-02) and the permanent "Loading..." state (WR-01) are not asserted. The failing-manifest test also asserts `buttonState('REVEAL ALL') === 'absent'` but does not pin the user-visible placeholder, so WR-01 passes unnoticed.
**Fix:** Add cases for map-fail-first and for a deck-only refetch rejection, and assert the error or retry UI once WR-01 and WR-02 are addressed.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
