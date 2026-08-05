---
phase: 31-deckplan-format-per-deck-hulls-detail-linework
verified: 2026-08-05T02:10:10Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework — Verification Report

**Phase Goal:** Extend the `deckplan.yaml` schema and `EncounterMapRenderer` so decks can declare their own hull geometry and decorative detail linework, with interior details gated by room reveal.
**Verified:** 2026-08-05T02:10:10Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A deck in `deckplan.yaml` can declare its own hull, rendered additively on that deck alongside the location-level hull (HULL-01, refined to additive per D-02) | VERIFIED | `hullNormalizer.mergeHulls` concatenates shared+deck polygons (`src/components/domain/encounter/hull/hullNormalizer.ts:98-117`); `EncounterMapRenderer.tsx:169-170` calls `mergeHulls(hullProp, mapData.hull)`; `patrol_gunboat/deckplan.yaml`'s `upper_deck` carries a deck-level hull; 19 hullNormalizer unit tests + human-checkpoint screenshot (round 1) directly showed the shared silhouette + spine block together |
| 2 | A deck hull with multiple disjoint polygons draws each correctly, and a detached pod is not clipped (HULL-02) | VERIFIED | `hullPathD` builds one M...Z subpath per polygon (`hullNormalizer.ts:125-140`); `roomBBoxGrid` normalizes the hull before iterating so a far-offset polygon widens the bbox (`roomGeometry.ts`, tested); `patrol_gunboat/upper_deck` ships 2 disjoint polygons (spine x19-32, detached pod x42-48) — confirmed via `node -e` YAML assertion; human-checkpoint screenshot directly confirmed the detached pod fully on-screen and unclipped |
| 3 | `hull: holes:` render as evenodd cutouts, and a hull with only `holes:` and no polygon never renders as a solid filled shape (correctness edge case) | VERIFIED | `hullPathD` emits hole subpaths appended for evenodd fill-rule; `mergeHulls` returns `null` when `polygons.length === 0` post-merge (`hullNormalizer.ts:115`) — this is the WR-02 code-review fix, confirmed present in the file and covered by two new regression tests (`hullNormalizer.test.ts:94-107`, both passing) |
| 4 | `deckplan.yaml` supports decorative detail linework attached to a room and to the deck exterior, and `EncounterMapRenderer` draws both polyline and circle primitives (DET-01) | VERIFIED | `DetailEntry` type + `partitionDetails` (`detailNormalizer.ts`) + `DetailShape`/`DetailsLayer` (`renderer/DetailsLayer.tsx`) render both primitives with fixed style, `pointerEvents="none"`; `EncounterMapRenderer.tsx:274-275,546` wires `partitionDetails` and mounts `<DetailsLayer>`; `patrol_gunboat/upper_deck` ships 4 detail entries (interior/exterior/circle/filled/id-less) — confirmed via `node -e` YAML assertion; human-checkpoint screenshot directly confirmed strut, dish, console line, and filled block all rendering thinner/dimmer than walls |
| 5 | Players viewing an unrevealed room do not see its interior detail linework; once revealed, the details appear on the room's flicker cascade (DET-03) | VERIFIED | `detailEls` mounted as children of the room's existing reveal `<g>` in all 3 `RoomsLayer.tsx` branches (grep confirms 4 occurrences: 1 definition + 3 insertions); `partitionDetails` is provably not reveal-aware (`grep -c roomVisibility detailNormalizer.ts` = 0) — gating is structural; D-14 dangling-ref fail-safe unit-tested (dropped for players, shown to GM, warned); human-checkpoint screenshots (rounds 2-3) directly confirmed the console line absent while hidden and appearing together with the room's own reveal cascade, not a separate pop-in |
| 6 | Exterior/hull detail linework is always visible regardless of any room's reveal state | VERIFIED | `DetailsLayer` (exterior group) is mounted unconditionally in `EncounterMapRenderer.tsx` with no visibility check of any kind (unlike the vents block directly below it); `partitionDetails` routes no-`room:` entries straight to `exterior` with no gating. Human checkpoint covered this only via the final unqualified "approved" (not an isolated both-rooms-hidden screenshot) — code path is unconditional so this is low risk, but flagged below as partial-evidence |
| 7 | `hull: holes:` polygons are punched out via SVG fill-rule evenodd, each hole gets its own outline stroke | VERIFIED | `EncounterMapRenderer.tsx` hull SVG block renders `fillRule="evenodd"` plus one `<polygon>` outline per `holeOutlines` entry (grep confirms `fillRule="evenodd"` present); human checkpoint round 1 showed the atrium hole punched near the spine |
| 8 | `data/ships/somnus/deckplan.yaml` keeps rendering with its existing singular `hull: polygon:` form, file unchanged — no migration | VERIFIED | `normalizeHull` still accepts singular `polygon:` (test: `hullNormalizer.test.ts:8`); `git diff --stat` on somnus/base_alpha/campaign-ship deckplan.yaml files is empty (re-confirmed live) |
| 9 | One malformed authored hull polygon (or detail primitive) is dropped with a console warning; the rest of the map still renders | VERIFIED | `isValidPolygon` (hullNormalizer) and `isValidPrimitive` (detailNormalizer) both drop-and-warn per entry, never throw; unit-tested for both modules including the WR-01 both-points-and-circle fix (`detailNormalizer.test.ts:90-110`, passing) |
| 10 | The GM console deckplan editor preview shows deck-level hulls and detail linework live while the GM edits deckplan.yaml | VERIFIED | `DeckplanPreviewPane` renders via `MapPreview` (`DeckplanPreviewPane.tsx:230`), which delegates to `EncounterMapRenderer` (`MapPreview.tsx:27,147`) — the exact same rendering path as the GM/player encounter map, so editor-preview parity is structural, not merely claimed; `useDeckplanModel.deckToMapData` forwards `mergeHulls(...)` and `deck.details ?? []` (confirmed at `useDeckplanModel.ts:246,250`) |
| 11 | Deck-level `hull:` and `details:` survive both the SSE payload path (`PayloadBuilder`) and the REST endpoint (`api_encounter_map_data`) unmodified; the top-level hull still reaches `manifest.hull` unchanged | VERIFIED | `core/tests/test_deckplan_passthrough.py` — 6 tests, all passing (confirmed via live `manage.py test` run); `normalize_deck_poi` anti-allow-list regression case (unknown key survives, input dict not mutated) also passing |
| 12 | Requirement IDs HULL-01, HULL-02, DET-01, DET-03 are all satisfied and correctly attributed to Phase 31 with no orphans | VERIFIED | REQUIREMENTS.md lines 21-28/67-70 map all four IDs to Phase 31 and mark them `[x]` Complete; all four appear in every plan's `requirements:` frontmatter; no other Phase-31-tagged requirement exists that isn't claimed by a plan |

**Score:** 12/12 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/domain/encounter/hull/hullNormalizer.ts` | `normalizeHull`/`mergeHulls`/`hullPathD`, single hull validation gate | ✓ VERIFIED | All 3 exports present; 19 passing unit tests incl. WR-02 fix |
| `src/components/domain/encounter/details/detailNormalizer.ts` | `partitionDetails`, gating seam | ✓ VERIFIED | Export present; 16 passing unit tests incl. WR-01 fix |
| `src/components/domain/encounter/renderer/DetailsLayer.tsx` | `DetailShape`/`DetailsLayer`, fixed-style SVG | ✓ VERIFIED | Both exports present; `pointerEvents="none"` on every variant; `view.project` used for vertices (no raw `unitSize` multiply) |
| `src/types/encounterMap.ts` | `HullDef` extended, `NormalizedHull`, `DetailEntry`, `GridEncounterMapData.details` | ✓ VERIFIED | All present; `pnpm run typecheck` exits 0 |
| `data/ships/patrol_gunboat/deckplan.yaml` | Multi-deck testbed: `upper_deck` with 2 hull polygons, 1 hole, 4 detail entries | ✓ VERIFIED | `node -e` YAML assertion confirms shape; `total_decks: 2` |
| `docs/schemas/schema-encounters.md` | Hull polygon/polygons/holes rows, `## Detail Fields` section, deck-entry rows | ✓ VERIFIED | Both sections present, confirmed via grep |
| `core/tests/test_deckplan_passthrough.py` | Django regression guard for both payload paths | ✓ VERIFIED | 6 test methods, all passing live |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EncounterMapRenderer.tsx` | `hullNormalizer.ts` | `mergeHulls(hullProp, mapData.hull)` | ✓ WIRED | Confirmed at line 169-170 |
| `EncounterMapRenderer.tsx` | `detailNormalizer.ts` | `partitionDetails(mapData.details, mapData.rooms, isGM)` | ✓ WIRED | Confirmed at line 274-275 |
| `EncounterMapRenderer.tsx` | `DetailsLayer.tsx` | `<DetailsLayer>` mounted between hull block and `<RoomsLayer>` | ✓ WIRED | Line 546, after hull (511) and before RoomsLayer (549) — stacking order matches plan's discretion call |
| `RoomsLayer.tsx` | `DetailsLayer.tsx` (`DetailShape`) | `detailEls` inserted into all 3 room-shape branches | ✓ WIRED | grep confirms 4 occurrences (1 definition + 3 insertions) |
| `roomGeometry.ts` (`roomBBoxGrid`) | `hullNormalizer.ts` | `normalizeHull` before iterating polygons | ✓ WIRED | Confirmed; unit-tested widened-bbox case passes |
| `useDeckplanModel.ts` (`deckToMapData`) | `hullNormalizer.ts` / `types/encounterMap.ts` | `mergeHulls(...)`, `details: deck.details ?? []` | ✓ WIRED | Confirmed at lines 246, 250 |
| `MapPreview.tsx` | `EncounterMapRenderer.tsx` | Editor preview delegates to the same renderer | ✓ WIRED | Confirmed import + render call |
| `test_deckplan_passthrough.py` | `payload_builder.py` / `encounter_utils.py` | Fixture asserts hull+details survive `PayloadBuilder` and `normalize_deck_poi` | ✓ WIRED | Live test run: 6/6 passing |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend typecheck | `pnpm run typecheck` | exit 0 | ✓ PASS |
| Hull/details/geometry/doors unit suites | `pnpm test -- --run src/components/domain/encounter/hull src/components/domain/encounter/details src/components/domain/encounter/geometry src/components/domain/encounter/doors` | 12 files, 239 tests, all pass | ✓ PASS |
| Full frontend suite (regression sweep) | `pnpm test -- --run` | 12 files, 239 tests, all pass | ✓ PASS |
| Backend passthrough + payload-builder suites | `.venv/bin/python manage.py test core.tests.test_deckplan_passthrough core.tests.test_payload_builder -v 2` | 19 tests, all `ok` | ✓ PASS |
| WR-01 regression test present | `grep -n "both points and circle" detailNormalizer.test.ts` | 2 matches, test passing | ✓ PASS |
| WR-02 regression test present | `grep -n "WR-02" hullNormalizer.test.ts` | 2 matches, both passing | ✓ PASS |
| No changes to pre-existing authored deckplans | `git diff --stat data/ships/somnus/... data/galaxy/.../base_alpha/... data/campaign/ship/...` | empty output | ✓ PASS |
| No debt markers (TODO/FIXME/TBD/XXX/PLACEHOLDER) in phase files | grep sweep across 14 key files | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HULL-01 | 31-01, 31-03 | Deck declares own hull (additive per D-02) | ✓ SATISFIED | `mergeHulls` wired end-to-end; REQUIREMENTS.md marked `[x]` |
| HULL-02 | 31-01, 31-03 | Multiple disjoint polygons per deck hull | ✓ SATISFIED | `hullPathD` + bbox fix + testbed; REQUIREMENTS.md marked `[x]` |
| DET-01 | 31-02, 31-03 | Detail linework on rooms and deck exterior | ✓ SATISFIED | `DetailEntry`/`partitionDetails`/`DetailsLayer`; REQUIREMENTS.md marked `[x]` |
| DET-03 | 31-02, 31-03 | Reveal-gated interior details, always-visible exterior | ✓ SATISFIED | Structural gating inside RoomsLayer reveal group; REQUIREMENTS.md marked `[x]` |

No orphaned requirements — REQUIREMENTS.md's Progress table (lines 67-70) maps exactly these four IDs to Phase 31, and every plan's `requirements:` frontmatter claims all four.

### Anti-Patterns Found

None. Debt-marker sweep (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) across all 14 phase-touched source files returned zero matches.

### Code Review Findings (31-REVIEW.md) — Resolution Confirmed

- **WR-01** (DetailEntry validation/render precedence mismatch when both `points` and `circle` present): fix confirmed present in `detailNormalizer.ts:59-62` (both-present now drops+warns before either primitive is inspected); regression test confirmed present and passing.
- **WR-02** (hull with `holes` but no polygon rendering as a solid filled shape): fix confirmed present in `hullNormalizer.ts:115` (`mergeHulls` returns `null` when merged `polygons.length === 0`); two regression tests confirmed present and passing, including the case where a holes-only deck hull is legitimately merged with a shared hull that does have a polygon.
- **WR-03** (MapPreview.tsx duplicates roomGeometry bbox logic): deferred by the reviewer as a maintainability observation, not a correctness bug — confirmed this does not affect any of the 5 ROADMAP success criteria; acceptable to leave for a future touch of that file.
- **IN-01, IN-02**: pre-existing, out of phase scope, confirmed not phase-31-introduced.

### Human Verification — Completed via Blocking Checkpoint (Noted for Traceability)

31-03's Task 2 was a `checkpoint:human-verify gate="blocking"` covering all 8 how-to-verify sub-items across the 5 ROADMAP success criteria. Per 31-03-SUMMARY.md's "Checkpoint Status" section, the human directly confirmed **3 of 8** sub-items via screenshot exchange:

- HULL-02 (detached pod + atrium hole, unclipped)
- DET-01 (console line visibly thinner than wall stroke)
- DET-03 (interior detail absent while hidden, appears together with the room's reveal cascade)

The remaining **5 of 8** sub-items — HULL-01's Main Deck toggle-off check, always-visible exterior details with both rooms hidden, atrium hole as a standalone close-up, GM console editor-preview parity, and click-through on rooms with detail linework — were covered only by the final unqualified "approved" response, without additional screenshots.

**This verifier's judgment:** this is not treated as a gap. The checkpoint is the designed mechanism for exactly this kind of criteria (visual/interactive behavior with no component-render test harness in this codebase, per 31-03-PLAN.md's own flagged_assumptions). The human explicitly closed the blocking gate. For the 5 sub-items not individually screenshotted, this verifier independently confirmed the underlying code path by static analysis rather than relying on the approval alone:
- HULL-01 Main Deck (no `upper_deck` hull merged in) vs Upper Deck (merged) is a direct consequence of `mergeHulls(hullProp, mapData.hull)` being keyed on the selected deck's `mapData.hull` — no code path could show the spine on Main Deck.
- Exterior-always-visible is unconditional in code (no gating check exists in the `DetailsLayer` mount site).
- Editor-preview parity is structural — `MapPreview` delegates to the same `EncounterMapRenderer` component GM/player views use, not a separate rendering path.
- Click-through is enforced by `pointerEvents="none"` on every `DetailShape` variant, confirmed present with no click handlers in the file.

No new human-verification items are being opened by this report. Recorded here per the orchestrator's instruction so the partial-evidence nature of the original approval remains traceable if anything surfaces later.

### Gaps Summary

None. All 12 goal-backward truths verified, all required artifacts exist/are substantive/are wired, all key links confirmed, all requirement IDs correctly attributed with no orphans, both WARNING-tier code-review findings (WR-01, WR-02) confirmed fixed with passing regression tests, zero debt markers, and the phase's own backend-passthrough assumption is proven (not just asserted) by a live, passing Django test run.

---

_Verified: 2026-08-05T02:10:10Z_
_Verifier: Claude (gsd-verifier)_
