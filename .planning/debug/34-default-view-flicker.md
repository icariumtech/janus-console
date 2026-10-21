---
status: diagnosed
trigger: "G-34-6 (minor): default_view works but selecting a location with a default_view flashes top-down first, then applies projection + rotation — fast but visible flicker"
created: 2026-10-16T00:00:00Z
updated: 2026-10-16T13:00:00Z
goal: find_root_cause_only
symptoms_prefilled: true
bug_class: Bohrbug (deterministic; network latency only sets how long the stale frames stay on screen)
---

## Current Focus

hypothesis: CONFIRMED. GM EncounterView takes the orientation and locationKey from the new activeView right away, but keeps showing the previous location's map (and hull) until two separate async fetches return. So for at least one network round trip the GM paints the OLD map in the NEW orientation. Then it paints a mixed frame (one location's rooms with the other location's hull). The player surface is clean.
test: done. Ran scratch vitest/jsdom harnesses against the real components and real server payloads, recording the DOM at every macrotask boundary (every frame that can be painted).
expecting: n/a
next_action: none (diagnose-only). Hand back to the orchestrator for plan-phase --gaps.

reasoning_checkpoint:
  hypothesis: "On /gmconsole/, EncounterView.tsx feeds MapPreview viewOrientation + locationKey taken synchronously from activeView (lines 99, 105-108, 467, 469). It also feeds mapData/hull from state that is not cleared when the location changes and is refetched by two independent effects (121-148, 150-172). So the cut in useOrientationTransition re-projects the PREVIOUS location's map into the new view and resets pan/zoom on it. The new map and hull then arrive in one or two later commits."
  confirming_evidence:
    - "Real GM EncounterView, morrigan(top-down/0) -> somnus(iso/90), paintable frames: MORRIGAN/TOPDOWN -> MORRIGAN/ISO -> SOMNUS rooms/ISO with MORRIGAN hull -> SOMNUS/ISO"
    - "Reverse somnus(iso/90) -> morrigan(top-down/0): SOMNUS/ISO -> SOMNUS/TOPDOWN (literal top-down Somnus flash) -> MORRIGAN rooms with SOMNUS hull -> MORRIGAN/TOPDOWN"
    - "Real player EncounterView: the stale SOMNUS/TOPDOWN commit and the corrected SOMNUS/ISO commit run in the same synchronous run (no microtask checkpoint between them), so they cannot be painted. The only paintable frames are DEMETER/TOPDOWN -> SOMNUS/ISO"
  falsification_test: "If the GM held the old map until new data arrived, or cleared it, no frame would pair one location's map with another's orientation or hull. The harness would then show only OLD/old-orientation -> (loading) -> NEW/new-orientation."
  fix_rationale: "Tie the orientation and locationKey given to MapPreview to the location the loaded map data belongs to. Load deck map + manifest as one unit so the renderer never gets mixed inputs, and the cut/pan-zoom reset fires on the frame where the new map appears."
  blind_spots: "No real-browser paint capture: jsdom proves task/commit structure, not pixels. The user's literal phrase 'top down first' fits the leaving-Somnus direction exactly; the entering direction shows the old ship in iso. Did not check other GM surfaces (BridgeView ship-deck thumbnail), which follow the broadcast orientation but do not change location."
  candidate_causes:
    - "code (CONFIRMED): GM EncounterView pairs sync-derived orientation/locationKey with async, uncleared map data + separately fetched manifest hull"
    - "code (ELIMINATED): useOrientationTransition cut paints a stale-orientation frame of the new map (it commits once, then fixes it synchronously in useLayoutEffect, same task)"
    - "config/server (ELIMINATED): api_switch_view writes location and view in two steps or broadcasts twice"
    - "environment/network (CONTRIBUTING): fetch round-trip latency sets how long the stale frames last; at least one round trip always happens"
    - "data (NOT A CAUSE, amplifier): Somnus deck rotation: 90 plus default_view iso/90 makes old and new orientation differ a lot, so the stale frame is very visible"
  and_gate: "yes: the artifact needs (a) the old and new locations to have different broadcast orientations (only possible since Phase 34's default_view / GM controls) AND (b) the GM view to keep showing the old location's map during the async refetch. (b) existed before Phase 34 but could not be seen, because orientation never changed with location."

## Symptoms

expected: Selecting a location whose deckplan authors default_view {projection: iso, rotation_offset: 90} shows the map directly in iso/90 with no intermediate frame.
actual: "it seems to flash to the screen in top down first then does the projection and rotation. Its fast but causes a flicker on the screen."
errors: none
reproduction: add `default_view: {projection: iso, rotation_offset: 90}` to data/ships/somnus/deckplan.yaml; on /gmconsole/ ENCOUNTER select another location, then select Somnus. Possibly also visible on /terminal/.
started: Phase 34 (default_view feature introduced)

## Eliminated

- hypothesis: server applies location and projection/offset in two separate writes/broadcasts
  evidence: core/views/navigation.py:56-95 builds one update_kwargs and calls sync_state once (one broadcaster.announce). Covered by test_sse_payload_carries_applied_view. No other writer of encounter_projection/offset besides set_projection/rotate_view (core/encounter_state.py:95-109).
  timestamp: 2026-10-16T12:20:00Z

- hypothesis: a separate selection/preview call sets the location before switch-view (two-step client write)
  evidence: GMConsole.tsx:146-158 handleSelectLocation issues exactly one gmConsoleApi.switchView POST (gmConsoleApi.ts:44-46). activeView is set only from SSE onEvent (GMConsole.tsx:73-75) and the one-time bootstrap. The map GET endpoints (api_encounter_map_data / api_encounter_all_decks) are read-only.
  timestamp: 2026-10-16T12:25:00Z

- hypothesis: useOrientationTransition's location 'cut' paints a frame of the NEW map in the OLD (top-down) orientation (player surface)
  evidence: The real player EncounterView fed real PayloadBuilder payloads (demeter top-down/0 -> somnus iso/90) does commit a SOMNUS/TOPDOWN DOM (commit 1, stale `displayed` state). But the layout-effect setDisplayed re-render commits SOMNUS/ISO inside the same synchronous run, with no microtask checkpoint between them, so the browser cannot paint commit 1. Paintable frames: DEMETER/TOPDOWN -> SOMNUS/ISO only.
  timestamp: 2026-10-16T12:56:00Z

- hypothesis: a fresh mount (view_type switch, or arrival from a non-map location) starts from DEFAULT_VIEW_ORIENTATION top-down
  evidence: useOrientationTransition initializes `displayed` from `requested` (useOrientationTransition.ts:39). The scratch S3 fresh mount with iso/90 shows only SOMNUS/ISO commits and frames. On the GM, a fresh MapPreview mount only happens after the fetch returns, by which time activeView already carries iso/90.
  timestamp: 2026-10-16T12:51:00Z

- hypothesis: the SSE consumer applies a partial activeView
  evidence: GMConsole setActiveView(rawData) replaces the whole object. SharedConsole applyActiveView -> handleViewChange commits the whole payload at once (same view type: immediately). The payload always carries location_data + encounter_projection + encounter_rotation_offset together (payload_builder.py:99-100, 118-178).
  timestamp: 2026-10-16T12:30:00Z

## Evidence

- timestamp: 2026-10-16T12:10:00Z
  checked: Knowledge base (.planning/debug/knowledge-base.md)
  found: file does not exist; no prior resolutions to match
  implication: no known-pattern candidate

- timestamp: 2026-10-16T12:15:00Z
  checked: src/entries/GMConsole.tsx:146-158 handleSelectLocation
  found: location selection issues exactly one call, gmConsoleApi.switchView('ENCOUNTER', slug). No optimistic local setActiveView; activeView is only set from SSE onEvent (lines 73-75) and the initial bootstrap.
  implication: no pre-selection/preview call writes location without projection.

- timestamp: 2026-10-16T12:18:00Z
  checked: useOrientationTransition.ts:54-100 + viewTransition.ts:33-41
  found: a location change is a 'cut' handled in useLayoutEffect via setDisplayed + onSnap(resetView). The first render of the commit uses the OLD `displayed` orientation; the layout-effect setState is flushed synchronously before paint.
  implication: the cut itself cannot paint a stale-orientation frame. But it runs against whatever mapData the renderer has at that moment.

- timestamp: 2026-10-16T12:35:00Z
  checked: src/components/gm/views/EncounterView.tsx:99-172, 447-470
  found: locationSlug (99) and viewOrientation (105-108) come synchronously from activeView. They go to MapPreview as locationKey (469) and viewOrientation (467) on the same render the SSE arrives. currentDeckMapData (fetched in effect 150-172) and manifest (fetched in effect 121-148, supplies hull at 464) are NOT cleared when locationSlug changes. They are refetched by two independent requests, and MapPreview renders whenever currentDeckMapData is non-null (449), whatever location it belongs to. Neither effect has a stale-response guard (no cancelled flag / AbortController).
  implication: for at least one round trip the GM renderer gets {old map, old hull, NEW orientation, NEW locationKey}. Then {new map, old hull} or {old map, new hull}. Then the final state.

- timestamp: 2026-10-16T12:56:00Z
  checked: Scratch harness. Real GM EncounterView (encounterApi mocked with REAL /api/encounter-map/<slug>/ and /all-decks/ JSON captured via Django), SSE simulated as one activeView replacement, DOM sampled at every macrotask boundary.
  found: |
    uscss_morrigan(top-down/0) -> somnus(iso/90), map=40ms all=60ms:
      MORRIGAN/TOPDOWN -> MORRIGAN/ISO (old ship re-projected; pan/zoom reset here) -> SOMNUS rooms/ISO + MORRIGAN hull (wrong viewBox) -> SOMNUS/ISO + SOMNUS hull
    demeter -> somnus with map=120 all=40: DEMETER/ISO -> DEMETER rooms + SOMNUS hull -> SOMNUS/ISO
    somnus(iso/90) -> uscss_morrigan(top-down/0):
      SOMNUS/ISO -> SOMNUS/TOPDOWN (Somnus literally flashes top-down) -> MORRIGAN rooms + SOMNUS hull -> MORRIGAN/TOPDOWN
  implication: the GM surface paints 2 stale/mixed frames on every location change between locations whose views differ. With real latency these last tens to hundreds of ms: the reported flicker.

- timestamp: 2026-10-16T12:58:00Z
  checked: Scratch harness. Real player EncounterView (domain/encounter/EncounterView.tsx -> EncounterMapDisplay -> EncounterMapRenderer) fed real PayloadBuilder payloads, commit log tagged by synchronous-run id.
  found: commits run#3 SOMNUS/TOPDOWN and run#3 SOMNUS/ISO are in the same synchronous run. Macrotask frames: DEMETER/TOPDOWN -> SOMNUS/ISO.
  implication: the player terminal does not paint a top-down frame. Map, slug and orientation arrive in one payload (EncounterMapDisplay.tsx:110-112). Any player-side flicker is the old 0.5s encounterDeckGlitch animation (domain/encounter/EncounterView.tsx:135-146, EncounterView.css:21-37), which is intentional and does not depend on orientation.

- timestamp: 2026-10-16T12:59:00Z
  checked: var/active_view.json (current persisted state)
  found: location_slug = uscss_morrigan, encounter_view_location_slug = uscss_morrigan, top-down/0
  implication: the user's "other location" was most likely the campaign ship uscss_morrigan (top-down/0, polygon grid map with no default_view). It is the same shape class as Somnus, so the stale Morrigan-in-iso frame (entering) and Somnus-in-top-down frame (leaving) are easy to read as "Somnus flashed top-down first".

## Resolution

root_cause: GM EncounterView (src/components/gm/views/EncounterView.tsx) gives MapPreview a viewOrientation and locationKey taken synchronously from the new activeView (lines 99, 105-108, 467, 469). It also gives it mapData and hull from location-scoped state that is not cleared on location change and is refetched by two independent async effects (manifest/hull at 121-148 -> 464; currentDeckMapData at 150-172 -> 451). So on the SSE commit, useOrientationTransition's 'cut' (useOrientationTransition.ts:69-73) re-projects the PREVIOUS location's map into the new view and resets pan/zoom on it. That frame is painted for one fetch round trip, then a mixed frame (new rooms + old hull, or the reverse, with a wrong viewBox), then the correct map. AND-gate: this only shows when the old and new broadcast orientations differ, which became possible with Phase 34 default_view. Before that, the same stale-data window was invisible. The player terminal is not affected.
fix:
verification:
files_changed: []
