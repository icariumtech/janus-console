# Phase 34: GM-Controlled Projection and Iso Rotation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 34-gm-controlled-projection-and-iso-rotation
**Areas discussed:** GM preview vs broadcast, Rotation controls & motion, Defaults & reset rules, Player-side transition

---

## GM preview vs broadcast

| Question | Options | Selected |
|----------|---------|----------|
| GM console map vs player view | Always mirror / Private preview + push | Always mirror |
| Where GM controls live | Map overlay / GM encounter panel / Both | Map overlay |
| Deckplan editor preview | Local toggle, no broadcast / Top-down only / Follow broadcast | Local toggle, no broadcast |
| Player terminal view controls | Nothing / Read-only indicator | Nothing |

---

## Rotation controls & motion

| Question | Options | Selected |
|----------|---------|----------|
| How rotation change appears | Smooth spin / Instant snap / Quick fade | Quick fade |
| Animate top-down ↔ iso toggle | Keep it a cut / Animate it too | Keep it a cut |
| Rotation in top-down too | Iso only / Both, shared angle | Both, shared angle |
| Button direction | Ship turns with arrow / Camera orbits with arrow | Ship turns with arrow |

---

## Defaults & reset rules

| Question | Options | Selected |
|----------|---------|----------|
| GM rotation vs YAML mapRotation | Offset on top / GM replaces it | Offset on top |
| Deck switch (same ship) | Keep both / Reset to default | Keep both |
| New location/map | Reset to top-down 0 / Keep GM's last / Per-map authored default | Per-map authored default |
| Persist across reload/restart | Yes, like other encounter state / No, session-only | Yes |

---

## Player-side transition

| Question | Options | Selected |
|----------|---------|----------|
| Player pan/zoom on view change | Keep zoom, re-center / Reset to fit / Keep exactly | Reset to fit |
| On-screen cue | No cue / Terse JANUS flash | No cue |
| GM map follows same rule | Same rule / GM keeps exact view | Same rule |

---

## Claude's Discretion

- Default-view YAML field name/shape (location-level), store/API shape, fade duration & mechanism, top-down rotation mechanics, button glyphs.

## Deferred Ideas

- Animated top-down ↔ iso transition; player orientation badge; JANUS reorientation flash (all rejected for this phase). Stacked decks → Phase 35.
