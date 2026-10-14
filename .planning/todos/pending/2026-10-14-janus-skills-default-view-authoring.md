---
created: 2026-10-14T00:00:00.000Z
title: Teach janus-skills to author deckplan default_view and deck rotation
area: janus-skills
blocked_by: Phase 34 merged to main (schema-encounters.md sync to janus-skills/resources)
files:
  - ../janus-skills/skills/janus-import-deckplan/SKILL.md
  - ../janus-skills/skills/janus-add-ship/SKILL.md
  - ../janus-skills/skills/janus-player-ship/SKILL.md
---

## Problem

Phase 34 adds an optional location-level `default_view: { projection, rotation_offset }` to
`deckplan.yaml` and documents the existing per-deck `rotation` field in
`docs/schemas/schema-encounters.md`. The schema doc reaches janus-skills automatically via the
sync workflow once Phase 34 is on `main`, but no skill that builds a deckplan
(`janus-import-deckplan`, `janus-add-ship`, `janus-player-ship`) ever asks for or writes
`default_view` or deck `rotation`. Ships therefore always open top-down at 0° unless the GM
hand-edits the YAML.

## Solution

After Phase 34 merges and the schema sync lands in `janus-skills/resources/schema-encounters.md`:

- `janus-import-deckplan` (and `janus-add-ship` / `janus-player-ship` where they emit deckplan
  YAML): optionally ask for a starting view (top-down / iso) and rotation offset
  (0/90/180/270), and emit `default_view` at the location root next to `decks:` only when the
  answer differs from the default. Optionally ask for per-deck `rotation` when the SVG is drawn
  sideways.
- Keep writing `unit_size: 30` explicitly (the schema doc distinguishes the renderer's 40
  fallback from the 30 authoring convention).
- Respect schema pitfall P3: deck `rotation` (absolute authoring orientation) vs
  `default_view.rotation_offset` (relative initial GM view).
- Edit the skills in the janus-skills repo directly — never edit `janus-skills/resources/schema-*.md`
  (overwritten by sync).

No MCP server changes needed: `get_session_context` already returns the new view state keys,
and `patch_yaml` / `write_file` can author `default_view`.
