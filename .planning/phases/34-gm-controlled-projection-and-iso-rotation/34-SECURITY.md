---
phase: "34"
slug: "gm-controlled-projection-and-iso-rotation"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-14"
---

# Phase 34 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GM browser → `/api/gm/encounter/rotate-view/`, `/api/gm/encounter/set-projection/` | Authenticated session POST with an untrusted JSON body | Relative rotation delta, projection enum (low sensitivity) |
| `deckplan.yaml` → `load_deckplan` / `api_switch_view` | Authored (possibly AI-written) YAML flows into the persisted shared store | `default_view` projection / offset (low) |
| `var/active_view.json` ↔ server memory | Persisted file, survives restarts, may be hand-edited | Projection, rotation offset, location marker (low) |
| SSE payload → player / GM browsers | Server-authored values feed client trig and SVG | Display state, public by design (low) |
| Read-only mounts vs controlling mounts; editor local mode vs broadcast | `viewControl` decides whether controls and callbacks exist | UI capability (integrity) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-34-01 | Tampering | `rotate_view` delta | medium | mitigate | `core/encounter_state.py` `rotate_view`: rejects bool / non-int / outside `ROTATION_DELTAS`; ValueError → 400; `test_invalid_delta_is_rejected_and_state_unchanged`, `test_malformed_deltas_return_400_and_state_unchanged` | closed |
| T-34-02 | Spoofing / Elevation | Unauthenticated caller mutating shared view | high | mitigate | `@login_required` on `api_encounter_rotate_view` (`core/views/encounter.py:99`); anonymous-302 test in `test_encounter_view_state` | closed |
| T-34-03 | Tampering | CSRF on rotate POST | medium | mitigate | no `csrf_exempt` on the view; `test_csrf_token_is_required` (enforce_csrf_checks → 403) | closed |
| T-34-04 | Tampering | Corrupt persisted offset reaching client trig | low | mitigate | `toViewOrientation` used in `gm/views/EncounterView.tsx:106` and `entries/SharedConsole.tsx:918` (replaced the 34-01 inline guard) | closed |
| T-34-05 | Integrity | Concurrent rotate losing a step | low | mitigate | offset computed server-side from current state with relative delta only; `test_rotation_is_relative_and_wraps_modulo_360` | closed |
| T-34-06 | Denial of service | Non-dict body → 500 | low | mitigate | `isinstance(data, dict)` guards at `core/views/encounter.py:106,125`; `test_non_object_bodies_return_400_not_500` | closed |
| T-34-07 | Tampering | `set_projection` value | medium | mitigate | `isinstance(str) and in PROJECTIONS` check in `set_projection`; `test_invalid_projection_returns_400_and_state_unchanged`, `test_invalid_values_raise_and_leave_state_unchanged` | closed |
| T-34-08 | Spoofing / Elevation | Unauthenticated / cross-site projection change | high | mitigate | `@login_required` + `@post_json`, no `csrf_exempt` (`core/views/encounter.py:119`); 302 and 403 tests | closed |
| T-34-09 | Tampering / DoS | Hostile `default_view` YAML | high | mitigate | `normalize_default_view` (`core/encounter_view.py:22`) validates per field, never raises, logs warning; re-normalized in `api_switch_view` (`core/views/navigation.py:84`); `test_hostile_default_view_is_normalized_defensively` | closed |
| T-34-10 | Integrity | Authored default overwriting live view on return | medium | mitigate | `encounter_view_location_slug` marker (`core/views/navigation.py:83-87`); `test_returning_via_bridge_keeps_the_gms_live_view`, `test_reselecting_same_slug_in_encounter_keeps_the_live_view` | closed |
| T-34-11 | Tampering | Out-of-range view values reaching trig / SVG | low | mitigate | `toViewOrientation` / `normalizeRotationOffset` total, unit-tested with 45, 360, -90, strings, null, NaN (`viewOrientation.test.ts`) | closed |
| T-34-12 | Denial of service | NaN / Infinity from bad authored `rotation` | low | accept | see Accepted Risks Log AR-34-01 | closed |
| T-34-13 | Elevation of privilege | Player terminal exposing view controls | high | mitigate | renderer default `viewControl` is readonly (no cluster); `mode: 'broadcast'` appears only in `gm/views/EncounterView.tsx:468` (plus the type in `viewOrientation.ts`); server also requires login | closed |
| T-34-14 | Integrity | Editor local view leaking into broadcast | medium | mitigate | local mode uses private state, no callback path; `EncounterMapRenderer.tsx` has 0 `services/` imports | closed |
| T-34-15 | Denial of service | GSAP leak leaving map at opacity 0 | medium | mitigate | `useOrientationTransition.ts` kills timeline on restart / cut / unmount and `clearProps: 'opacity'`; no React-controlled opacity on the fade wrapper | closed |
| T-34-16 | Integrity | Drag completing after view change | medium | mitigate | `shouldCancelDrag` in `TokenLayer.tsx:200` and `renderer/PoiLayer.tsx:74`; predicate unit-tested in `viewTransition.test.ts` | closed |
| T-34-17 | Elevation of privilege | Player-visible mount receiving broadcast controls | high | mitigate | `viewControl` passed only in GM `EncounterView`, `MapPreview` (forwarding), `DeckplanPreviewPane` (local) and the renderer itself; none on player terminal, thumbnails, `EncounterPanel`, GM bridge | closed |
| T-34-18 | Integrity | Editor preview posting to server | medium | mitigate | `DeckplanPreviewPane.tsx` passes only `mode: 'local'`, 0 `services/` imports | closed |
| T-34-19 | Information disclosure | Projection / rotation on public SSE | low | accept | see AR-34-02 | closed |
| T-34-20 | Tampering | Toast text injection | low | accept | see AR-34-03 | closed |
| T-34-SC | Tampering | npm / pip installs | high | mitigate | `package.json`, `pnpm-lock.yaml`, `requirements.txt` unchanged across the phase (`git diff 11828f5..HEAD` empty); gsap was already a pinned dependency | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Out of scope, noted:** `api_encounter_place_token` and `api_encounter_move_token` in `core/views/encounter.py` are `@csrf_exempt`. They predate this phase (commit c38ead87, 2026-05-12) and were not touched by it.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-34-01 | T-34-12 | Authored deck `rotation` is trusted GM-authored data described by the schema doc; projections already throw on non-finite `unitSize`; no new untrusted input introduced | plan 34-03 threat model | 2026-10-14 |
| AR-34-02 | T-34-19 | Projection / rotation are non-sensitive display state, same exposure as existing room-visibility and vents flags on the already-public `/api/active-view/stream/` | plan 34-05 threat model | 2026-10-14 |
| AR-34-03 | T-34-20 | Toast strings are static literals; no server or user text is interpolated | plan 34-05 threat model | 2026-10-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-14 | 21 | 21 | 0 | secure-phase orchestrator (ASVS L1 grep verification, short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-14
