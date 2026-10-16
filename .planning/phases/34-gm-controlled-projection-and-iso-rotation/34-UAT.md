---
status: complete
phase: 34-gm-controlled-projection-and-iso-rotation
source: [34-VERIFICATION.md]
started: 2026-10-14T00:00:00Z
updated: 2026-10-16T17:43:32.692Z
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

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-34-5
  truth: "Rotate controls are legible and well laid out in the GM view cluster"
  status: failed
  reason: "User reported: Lets put the rotate buttons on either side of the view toggle.  Then lets make the CCW/CW icons a little bigger"
  severity: cosmetic
  test: 5
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

- gap_id: G-34-6
  truth: "Entering a location with an authored default_view renders directly in that view with no intermediate frame"
  status: failed
  reason: "User reported: The default_view works but there is some artifacting, when selecting a location with a default_view it seems to flash to the screen in top down first then does the projection and rotation.  Its fast but causes a flicker on the screen"
  severity: minor
  test: 6
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
