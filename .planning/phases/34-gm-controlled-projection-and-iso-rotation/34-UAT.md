---
status: complete
phase: 34-gm-controlled-projection-and-iso-rotation
source: [34-VERIFICATION.md, 34-06-SUMMARY.md, 34-07-SUMMARY.md]
started: 2026-10-14T00:00:00Z
updated: 2026-10-16T23:44:16.571Z
---

## Current Test

[testing complete]

## Tests

### 1. Rotation fade/cut/reset feel and 30° iso at every rotation (incl. Somnus)
expected: Rotate fades, projection/location change cuts, pan/zoom re-fits only on GM view change; iso is true 30° at all four offsets on every ship including Somnus; players follow live.
result: pass

### 2. No controls on player mounts; private editor preview
expected: Player terminal, status/bridge thumbnails and GM side panel show no view controls. The deckplan editor preview opens top-down at offset 0, its toggle/rotate buttons never change what players see.
result: pass

### 3. Hit-testing and mid-drag cancel at all 8 projection × rotation combinations
expected: Placing/moving tokens and POIs lands in the cell under the pointer in top-down and iso at 0/90/180/270. Rotating (e.g. from a second window) during a drag cancels the drag without moving the token/POI.
result: pass

### 4. Pan/zoom preservation, quick presses, reduced motion
expected: Token moves and room toggles do not reset pan/zoom. Three quick rotate presses settle on the correct final orientation with no stuck opacity. With prefers-reduced-motion, rotation cuts instead of fading.
result: pass

### 5. Rotate glyphs, 44px targets, 360px layout
expected: ⟲ / ⟳ render legibly in the GM's browser (else switch to CCW/CW at EncounterMapRenderer.tsx:163-164). Cluster buttons are ≥44px. At 360px width the cluster fits and the legend is hidden below 480px.
result: issue
reported: "Lets put the rotate buttons on either side of the view toggle.  Then lets make the CCW/CW icons a little bigger"
severity: cosmetic

### 6. Authored default_view, deck switch, BRIDGE round trip, restart persistence
expected: Entering a location with an authored default_view applies it once; a location without one opens top-down 0. Deck switches keep the live view; going to BRIDGE and back (or re-selecting the same location) keeps the GM's live view. The view survives a Django server restart.
result: issue
reported: "The default_view works but there is some artifacting, when selecting a location with a default_view it seems to flash to the screen in top down first then does the projection and rotation.  Its fast but causes a flicker on the screen"
severity: minor

### 7. Judgment-tier prohibitions (11, across plans 01–05)
expected: Review the 11 prohibitions flagged `unverified-prohibition — human review recommended` in 34-VERIFICATION.md and confirm each holds.
result: pass

### 8. G-34-5 re-check — rotate buttons flank the toggle, larger glyphs
expected: Cluster reads [⟲][projection toggle][⟳]; glyphs 18px and legible; ≥44px targets; ⟲=CCW, ⟳=CW; fits at 360px.
result: pass

### 9. G-34-6 re-check — no flicker on location change
expected: With Somnus default_view {iso, 90}, switching another location → Somnus and back (also with DevTools network throttling) never shows a top-down flash or a mixed frame (old ship in the new view, or new rooms with the old hull). The old map stays until the new one swaps in at once. A→B→C quick switches land on C. Deck switch and BRIDGE round trip unchanged.
result: pass

### 10. Frozen-map controls during a location load
expected: While a new location is loading (easiest with network throttling), the still-visible old map is read-only: rotate/projection buttons absent, REVEAL ALL / HIDE ALL and deck picker disabled, token palette hidden, tokens not draggable. Everything returns once the new map appears.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-34-5
  truth: "Rotate controls are legible and well laid out in the GM view cluster"
  status: resolved
  reason: "User reported: Lets put the rotate buttons on either side of the view toggle.  Then lets make the CCW/CW icons a little bigger"
  severity: cosmetic
  test: 5
  root_cause: "Layout/design request, not a defect: the bottom-left view cluster renders [projection toggle][⟲][⟳] in that order, and the rotate glyphs inherit OVERLAY_BUTTON_STYLE's 11px font, so they read small."
  artifacts:
    - path: "src/components/domain/encounter/EncounterMapRenderer.tsx"
      issue: "Cluster JSX (~lines 949-990) places both rotate buttons after the projection toggle; rotate buttons use OVERLAY_BUTTON_STYLE fontSize 11px (lines 163-180)"
  missing:
    - "Reorder cluster to [⟲ CCW][projection toggle][⟳ CW] (rotate buttons flank the toggle)"
    - "Give the rotate buttons a larger glyph font size (e.g. ~16-18px) while keeping ≥44px targets and the 360px-width fit"
    - "Update any renderer tests asserting cluster button order"
  debug_session: ""
  resolved_by: 34-06-PLAN.md
  resolved_at: 2026-10-16

- gap_id: G-34-6
  truth: "Entering a location with an authored default_view renders directly in that view with no intermediate frame"
  status: resolved
  reason: "User reported: The default_view works but there is some artifacting, when selecting a location with a default_view it seems to flash to the screen in top down first then does the projection and rotation.  Its fast but causes a flicker on the screen"
  severity: minor
  test: 6
  root_cause: "GM-only. GM EncounterView takes viewOrientation + locationKey from the new activeView immediately, but currentDeckMapData and manifest (hull) are fetched by two separate effects and never cleared on location change. useOrientationTransition cuts/resets pan-zoom on the PREVIOUS location's map in the new view (e.g. Somnus shown top-down when leaving, Morrigan shown iso/90 when entering), then paints a mixed frame (new rooms + old hull) before the correct map. Pre-existing stale-data behavior made visible by Phase 34 default_view. Player terminal is clean (map, slug, view arrive in one payload)."
  artifacts:
    - path: "src/components/gm/views/EncounterView.tsx"
      issue: "Lines 99/105-108 derive slug+view from activeView; 121-148 loadAllDecks (manifest/hull) and 150-172 loadCurrentDeckMap don't clear old data, are separate requests, and lack stale-response guards; 449-470 renders MapPreview for any non-null currentDeckMapData regardless of which location it belongs to"
    - path: "src/components/domain/encounter/useOrientationTransition.ts"
      issue: "Lines 69-73 cut + onSnap run on whatever map is present; the real new map arriving later gets no reset of its own (hook itself is correct)"
  missing:
    - "Bind map data to its location: store {slug, mapData, manifest} as one unit and render MapPreview only when loaded.slug === locationSlug (else loading state or freeze old map in its old view)"
    - "Load deck map + manifest together (Promise.all, single state set) so rooms and hull commit together"
    - "Guard both loads against out-of-order responses (cancelled flag / AbortController) — fixes latent A→B→C stale-map bug"
    - "Regression test: GM EncounterView across a location change between differing views never pairs one location's map with another's view or hull"
    - "No server or player-side changes needed"
  debug_session: ".planning/debug/34-default-view-flicker.md"
  resolved_by: 34-07-PLAN.md
  resolved_at: 2026-10-16
