---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Better Deckplans
current_phase: 32
current_phase_name: svg converter — details, per deck hulls, circular rooms
status: planning
stopped_at: Phase 32 context gathered
last_updated: "2026-08-25T03:06:48.057Z"
last_activity: 2026-08-24
last_activity_desc: Phase 30 (ad-interim, out-of-order) verification gap closed — code review, regression gate, VERIFICATION.md; current position remains Phase 32
progress:
  total_phases: 23
  completed_phases: 21
  total_plans: 59
  completed_plans: 58
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-12)

**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.
**Current focus:** Phase 31 — deckplan-format-per-deck-hulls-detail-linework

## Current Position

Phase: 32 — svg converter — details, per deck hulls, circular rooms
Status: Ready to plan
Last activity: 2026-08-24 — Phase 30 (ad-interim) verification gap closed; current position remains Phase 32

## v1.0 Milestone Archive

- `.planning/milestones/v1.0-ROADMAP.md` — full phase details (19 phases, 49 plans)
- `.planning/milestones/v1.0-REQUIREMENTS.md` — 51/51 requirements satisfied
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — audit (gaps closed by Phase 20)
- `.planning/MILESTONES.md` — milestone index

## Accumulated Context

Decisions are logged in PROJECT.md Key Decisions table.

See `.planning/milestones/v1.0-ROADMAP.md` for full v1.0 decision log.

### Roadmap Evolution

- Phase 23 added: Containerization — Docker image with external data directory mount, live-reload for AI-managed game data, and best-practices for remote data mutations during play
- Phase 25 added: Map rotation controls
- Phase 28 added: GM Console Data Directory File Editor
- Phase 28.1 inserted (URGENT) after 28: Close gap: D-10 — data-changed SSE consumer + Phase 28 UAT + VERIFICATION.md for phases 25/27/28
- Phase 29 added: Interactive deckplan map editor with live preview, YAML sync, and POI placement
- Phase 30 added + executed (2026-06-06, out of order before 29): AI map editing — element resolver + find_map_element/edit_map_element MCP tools

## Deferred Items

Items acknowledged and deferred at v2.0 milestone close on 2026-06-12 (all pre-date v2.0 scope):

| Category | Item | Status |
|----------|------|--------|
| debug | custom-token-not-placeable | investigating (stale, 2026-02-16) |
| debug | token-drag-preview-too-large | diagnosed (stale, 2026-02-16) |
| debug | token-labels-gm-console | investigating (stale, 2026-02-16) |
| debug | token-popup-missing-controls | investigating (stale, 2026-02-16) |
| debug | token-visibility-hidden-rooms | diagnosed (stale, 2026-02-16) |
| uat | Phase 02 02-UAT.md | passed, 0 pending (status-field noise) |
| uat | Phase 03 03-UAT.md | diagnosed, 0 pending (status-field noise) |
| uat | Phase 14 14-UAT.md | passed, 0 pending (status-field noise) |
| uat | Phase 16 16-HUMAN-UAT.md | partial — 2 pending scenarios (v1.0) |
| uat | Phase 17 17-HUMAN-UAT.md | partial — 2 pending scenarios (v1.0) |
| uat | Phase 18 18-UAT.md | testing, 0 pending (status-field noise) |
| verification | Phase 09 09-VERIFICATION.md | human_needed (v1.0) |
| verification | Phase 16 16-VERIFICATION.md | human_needed (v1.0) |
| verification | Phase 17 17-VERIFICATION.md | human_needed (v1.0) |
| verification | Phase 18 18-VERIFICATION.md | human_needed (v1.0) |
| todo | 2026-03-26-replace-charon-view-with-overlay-tool-on-standby-view | pending (ui) |
| todo | 2026-03-26-show-docs-and-npc-portraits-on-standby-view | pending (ui) |

## Session Continuity

**Resume file:** /home/gjohnson/src/janus-console/.planning/phases/32-svg-converter-details-per-deck-hulls-circular-rooms/32-CONTEXT.md

Last session: 2026-08-07T17:10:54.497Z
Stopped at: Phase 32 context gathered
Next step: /gsd-plan-phase 32 (or /gsd-next)

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 24 P03 | 128 | 3 tasks | 2 files |
| Phase 24 P05 | 3min | 3 tasks | 4 files |
| Phase 27-mcp-image-upload P01 | 2min | 2 tasks | 7 files |
| Phase 28.1 P01 | 12min | 2 tasks | 2 files |
| Phase 28.1 P02 | interactive | 11 UAT tests | all pass |
| Phase 28.1 P03 | 15min | 3 tasks | 3 VERIFICATION files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 31 P01 | ~15min | 2 tasks | 10 files |
| Phase 31 P02 | ~20min | 3 tasks | 11 files |
| Phase 31 P03 | ~60min (Task 1) + human verification | 2 tasks | 1 files |

## Operator Next Steps

- Milestone v3.0 (Better Deckplans) is not yet complete — Phase 31 of 3 is done; Phase 32 (SVG Converter) and Phase 33 (Isometric View) remain. Run /gsd-plan-phase 32 next.

## Decisions

- [Phase ?]: Per-deck hulls are add-alongside (polygon/polygons both valid, no migration); hullNormalizer never throws — drops malformed polygons with a warning
- [Phase ?]: detailNormalizer is deliberately not reveal-aware; interior details gain reveal gating structurally by mounting inside the room's existing SVG reveal group (D-12/D-13)
- [Phase ?]: Phase 31 plan 03 Task 1 confirmed the backend thin-passthrough assumption with zero source changes (Django regression suite, 6 tests); Task 2's human-verify checkpoint was approved 2026-08-04, closing Phase 31
- [Phase 31]: Task 2 checkpoint approved via iterative screenshot review (3 of 8 how-to-verify sub-items directly confirmed: HULL-02, DET-01, DET-03) followed by a final unqualified "approved" covering the remaining sub-items on trust. See 31-03-SUMMARY.md Checkpoint Status for full traceability.

### Blockers

None.
