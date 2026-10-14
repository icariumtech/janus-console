---
phase: 34-gm-controlled-projection-and-iso-rotation
reviewed: 2026-10-14T00:00:00Z
depth: quick
files_reviewed: 40
files_reviewed_list:
  - core/active_view_store.py
  - core/data_loader.py
  - core/encounter_state.py
  - core/encounter_view.py
  - core/payload_builder.py
  - core/tests/test_active_view_store.py
  - core/tests/test_data_loader.py
  - core/tests/test_encounter_state.py
  - core/tests/test_encounter_view_state.py
  - core/tests/test_payload_builder.py
  - core/urls.py
  - core/views/__init__.py
  - core/views/encounter.py
  - core/views/navigation.py
  - docs/schemas/schema-encounters.md
  - src/components/domain/dashboard/BridgeView.tsx
  - src/components/domain/dashboard/sections/StatusSection.tsx
  - src/components/domain/encounter/EncounterMapDisplay.tsx
  - src/components/domain/encounter/EncounterMapRenderer.css
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/components/domain/encounter/EncounterView.tsx
  - src/components/domain/encounter/TokenLayer.tsx
  - src/components/domain/encounter/__tests__/viewTransition.test.ts
  - src/components/domain/encounter/geometry/__tests__/gridProjection.test.ts
  - src/components/domain/encounter/geometry/__tests__/viewOrientation.test.ts
  - src/components/domain/encounter/geometry/gridProjection.ts
  - src/components/domain/encounter/geometry/viewOrientation.ts
  - src/components/domain/encounter/renderer/PoiLayer.tsx
  - src/components/domain/encounter/useOrientationTransition.ts
  - src/components/domain/encounter/viewTransition.ts
  - src/components/gm/EncounterPanel.tsx
  - src/components/gm/MapPreview.tsx
  - src/components/gm/views/BridgeView.tsx
  - src/components/gm/views/EncounterView.tsx
  - src/components/gm/views/deckplan/DeckplanPreviewPane.tsx
  - src/entries/SharedConsole.tsx
  - src/hooks/useTokenPlacement.ts
  - src/services/encounterApi.ts
  - src/types/gmConsole.ts
  - src/utils/__tests__/svgCoordinates.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** quick (pattern scan plus a targeted read of the changed hunks, not a full-file read)
**Files Reviewed:** 40
**Status:** issues_found

## Summary

I reviewed the diff from 11828f5 to HEAD for the GM-controlled projection and rotation feature. The review covered the server state and endpoints, the deckplan `default_view` normalizer, the client orientation, transition and drag-cancel logic, and the GM and player wiring.

Verification run:
- `pnpm run typecheck` passes.
- `vitest run src/components/domain/encounter src/utils` passes: 14 files, 373 tests.
- The Django test modules touched by the phase pass: 110 tests.

I found no injection, authz or crash-level defects. Input is validated against closed enums, endpoints use the same `@login_required` and `@post_json` pattern as their siblings, and the internal `encounter_view_location_slug` marker is not exposed in the SSE payload. The client normalizes every incoming value.

The weaknesses are in server-side robustness against bad persisted state and in minor documentation and maintainability points.

## Warnings

### WR-01: `rotate_view` trusts the stored offset and does a non-atomic read-modify-write

**File:** `core/encounter_state.py:73-86`
**Issue:**
- The docstring says the offset is "computed here from current server state" so that "two GM clients each apply exactly one step". The implementation is `get_state()` followed by `_sync()`, which takes the store lock separately. The read and the write are not one critical section.
- It is safe today only because gunicorn runs a single gevent worker with no yield point between the two calls. Any switch to threads or multiple workers silently reintroduces lost updates.
- `encounter_rotation_offset` is read straight from `active_view.json` without validation. `_load_from_disk` merges stored values blindly.
- If the file holds a non-multiple of 90 (hand-edited, or from an older build), or a non-int, `rotate_view` either raises `TypeError` (a 500, since only `ValueError` is caught in the view) or persists an off-grid value such as 135.
- `PayloadBuilder` broadcasts that value unchanged. The client's `normalizeRotationOffset` then coerces it to 0, so the GM's click is silently ignored and server and client state diverge.

**Fix:** Do the read-modify-write under the store lock and coerce the stored value. For example, add an `update_state_fn(fn)` helper in `active_view_store` that applies `fn` to the state inside `_lock`. Then:
```python
def rotate_view(delta):
    ...validate delta...
    def _step(state):
        cur = state.get('encounter_rotation_offset', 0)
        cur = cur if isinstance(cur, int) and not isinstance(cur, bool) and cur in ROTATION_OFFSETS else 0
        return {'encounter_rotation_offset': (cur + delta) % 360}
    return _sync_fn(_step)
```
Alternatively, validate `encounter_rotation_offset` and `encounter_projection` against `ROTATION_OFFSETS` and `PROJECTIONS` in `_load_from_disk` and fall back to the defaults.

### WR-02: `build()` broadcasts unvalidated stored projection and offset

**File:** `core/payload_builder.py:99-100`
**Issue:**
- The payload forwards `state.get('encounter_projection', ...)` and `state.get('encounter_rotation_offset', ...)` as-is.
- The setters and the `default_view` normalizer guarantee enum values only for values written through them. The disk-load path (see WR-01) bypasses that guarantee.
- The "closed enum is the single source of truth" claim in `encounter_view.py` is therefore not enforced at the output boundary.
- The client masks the problem by coercing to defaults, which hides the divergence rather than preventing it.

**Fix:** Validate or normalize once at load time (`_load_from_disk`). That also protects `rotate_view`, and no per-request cost is added to `PayloadBuilder.build`.

## Info

### IN-01: Schema pitfalls are out of order

**File:** `docs/schemas/schema-encounters.md:224-228`
**Issue:** The new pitfall `P3` is inserted before the existing `P2`. That makes the list non-monotonic, and it is a small trap for readers and for the downstream `janus-skills` includes.
**Fix:** Place `P3` after `P2`.

### IN-02: Rotate glyphs depend on font coverage and use inline literals

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:160-163`
**Issue:**
- `⟲` and `⟳` are not guaranteed to render in the Cascadia Code stack. The author already acknowledges a tofu-box risk in the comment.
- Other literals (`#7ab8b8`, `#4a6b6b`, `#c9a050`) are repeated inline across the overlay buttons instead of reusing `COLORS`.

**Fix:** Ship the text fallback (`CCW` / `CW`) or an SVG icon now, rather than depending on a manual human glyph check. Move the colors to constants.

### IN-03: Bridge ship thumbnail inherits the last encounter's orientation

**File:** `src/components/domain/dashboard/sections/StatusSection.tsx:464`, `src/components/gm/views/BridgeView.tsx:638`
**Issue:**
- The ship deck thumbnail on the BRIDGE status tab mirrors `encounter_projection` and `encounter_rotation_offset`, which are encounter-scoped values.
- Because they persist after the GM leaves an encounter (D-16), the bridge thumbnail can show a rotated or iso ship with no visible reason. Players cannot change it.
- The behavior looks intentional, but it is a surprising coupling.

**Fix:** Confirm this is intended. If it is, say so in the plan or schema docs. If it is not, pass `DEFAULT_VIEW_ORIENTATION` to the thumbnail outside ENCOUNTER views.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
