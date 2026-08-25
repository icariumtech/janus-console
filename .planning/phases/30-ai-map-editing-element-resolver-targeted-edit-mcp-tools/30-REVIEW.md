---
phase: 30-ai-map-editing-element-resolver-targeted-edit-mcp-tools
reviewed: 2026-08-25T02:51:19Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - core/views/gm_data_mapedit.py
  - core/urls.py
  - core/views/__init__.py
  - core/tests/test_gm_api.py
  - mcp_server.py
  - docs/schemas/schema-encounters.md
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-08-25T02:51:19Z
**Depth:** quick
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the new `data-map-edit` endpoint (`_resolve_map_element` + `api_gm_data_map_edit`), its
URL/import wiring, the MCP `find_map_element`/`edit_map_element` tools, the tests added for the
resolver/endpoint, and the schema doc. Path-traversal, extension whitelist, atomic write, and the
"exactly one op" / ambiguity-before-write guards are all sound and covered by tests. The core
defect found is that the `set` operation has no field allowlist, so it can silently rewrite a
room/door's own `id` and corrupt cross-references (door `rooms:` lists, POI/door lookups
elsewhere in the codebase) with no validation or warning — a real data-corruption risk for an
endpoint explicitly designed to be driven by an AI agent. Several secondary issues also found:
a broken glob-on-label fallback caused by the slugifier stripping wildcard characters before use
as a glob pattern, a stale/contradictory door-id-format claim in the schema doc, an MCP tool
parameter that shadows the `set` builtin, and swallowed error detail on 400 responses in
`edit_map_element`.

## Critical Issues

### CR-01: `set` has no field allowlist — can rewrite `id` and break referential integrity

**File:** `core/views/gm_data_mapedit.py:253-259`
**Issue:** `op == 'set'` deep-merges the caller-supplied `patch` dict directly into the resolved
element with no restriction on which keys may be written:
```python
if op == 'set':
    patch = body['set']
    ...
    merged = _deep_merge(obj, patch)
    obj.clear()
    obj.update(merged)
```
Nothing stops `{"target": "mess_hall", "set": {"id": "galley"}}` from renaming a room's `id` in
place. Doors elsewhere in the same deckplan reference rooms by that id in their `rooms: [...]`
list (see `docs/schemas/schema-encounters.md` Door Fields), and door ids themselves are derived
from room ids (`_derive_door_id`). Renaming a room/corridor/door `id` through this endpoint
silently desyncs those references — doors will point at a room id that no longer exists, and the
frontend / other API endpoints that resolve by id (door-status, POI ownership, token placement)
will fail to find the element on next load. This is exactly the kind of edit an AI agent asked to
"rename the mess hall to galley" is likely to attempt via the generic `set` operation documented
in the MCP tool (`mcp_server.py:210-212`, which explicitly advertises `set` as working "for any
field"). There is no confirmation, no re-linking of dependent doors, and no rejection — the file
is written and broadcast as if the edit were safe.
**Fix:** Reject `id` (and any other identity-bearing key relevant to the element's `kind`, e.g.
`rooms` on a door if that should go through a different flow) inside the `set` merge, or perform
a cascading rename of all door `rooms:` references that mention the old id before writing:
```python
if op == 'set':
    patch = body['set']
    if not isinstance(patch, dict):
        return JsonResponse({'error': "'set' must be a JSON object"}, status=400)
    if 'id' in patch and str(patch['id']) != element['id']:
        return JsonResponse(
            {'error': "'set' cannot rename 'id' — this would break door/POI references. "
                      "Renaming elements is not supported."}, status=400)
    merged = _deep_merge(obj, patch)
    obj.clear()
    obj.update(merged)
```

## Warnings

### WR-01: Glob strategy's label matching is broken — wildcard chars stripped before use as a glob pattern

**File:** `core/views/gm_data_mapedit.py:100-101,121-125`
**Issue:** `qslug = _slugify(q)` is computed once and then reused as the *fnmatch pattern* for
label matching in the glob strategy:
```python
qslug = _slugify(q)
...
if not matches and any(c in q for c in '*?['):
    matches = [e for e in elements
               if fnmatch.fnmatch(e['id'], q)
               or label_matches(e, lambda s: fnmatch.fnmatch(s, qslug))]
```
`_slugify` collapses *any* run of non-alphanumeric characters (including `*`, `?`, `[`, `]`) into
a single `_` and then strips leading/trailing `_`. That means `_slugify('coolant_tanks*')` ==
`'coolant_tanks'` — the wildcard is deleted before it ever reaches `fnmatch`. Confirmed directly:
```
>>> _slugify('coolant_tanks*')
'coolant_tanks'
>>> _slugify('co*_tanks')
'coolant_tanks'  # wildcard silently vanishes, pattern degenerates to exact match
```
So the id-based half of the glob branch works (it globs against the raw, unslugified `q`), but
the label-based half never actually performs a glob — it silently degrades to an exact-slug
match. For patterns that only match via label (not id) and contain a wildcard, the glob strategy
returns nothing and the resolver silently falls through to prefix/fuzzy, which may pick different
(or zero) candidates than a user glob-searching by display name would expect. The existing test
(`test_glob_matches_multiple` in `core/tests/test_gm_api.py:374-375`) only exercises the id-based
half (`coolant_tanks*` matches both ids as literal id prefixes), so this regression isn't caught.
**Fix:** Build the label glob pattern by slugifying only the alphanumeric runs while preserving
glob metacharacters, e.g. slugify each token around `*`/`?`/`[...]` separately, or document that
label globbing is unsupported and only glob against `id`.

### WR-02: `add_poi` / `set` accept schema-invalid payloads with no validation

**File:** `core/views/gm_data_mapedit.py:261-270, 253-259`
**Issue:** `add_poi` requires only that the payload be a JSON object — `icon` (documented as
**required** in `docs/schemas/schema-encounters.md` POI Fields) is never checked:
```python
poi = body['add_poi']
if not isinstance(poi, dict):
    return JsonResponse({'error': "'add_poi' must be a JSON object"}, status=400)
existing = obj.setdefault('poi', [])
...
existing.append(poi)
```
`{"target": "mess_hall", "add_poi": {}}` writes a POI with no `icon`, which the frontend expects
to resolve to an SVG filename — this will silently misrender rather than fail loudly at write
time. Similarly, `set` on a door's `status` field accepts any string, not just the documented
enum (`OPEN | CLOSED | LOCKED | SEALED | DAMAGED | BROKEN`), so `{"set": {"status": "OOPEN"}}`
is written without complaint.
**Fix:** Validate `add_poi['icon']` is present and non-empty before appending; consider validating
`status`/`type` against their documented enums when present in a `set` patch.

### WR-03: Read-modify-write has no locking — concurrent edits can silently lose an update

**File:** `core/views/gm_data_mapedit.py:196-303`
**Issue:** The file is read (`target_path.read_text`), mutated in memory, then written
(`safe_write_yaml`) with no file lock or optimistic-concurrency check between the two. Two
concurrent `POST`s against the same deckplan (e.g. the GM editing a door status in the UI at the
same moment the AI agent calls `edit_map_element`) can both read the pre-edit content, and
whichever writes last silently discards the other's change. This mirrors the pre-existing PATCH
endpoint pattern in `gm_data_files.py:261-297`, so it isn't a regression, but it's now exercised
by a second, AI-agent-facing write path and is worth a shared fix (e.g. an mtime/hash
precondition check) rather than being reproduced a third time in a future endpoint.
**Fix:** Out of scope for a single-file quick fix; consider a shared `read_yaml_for_edit`/
`write_yaml_if_unchanged` helper with an mtime or content-hash precondition, reused by both
PATCH and map-edit.

### WR-04: `edit_map_element` swallows structured error detail for non-404/409 4xx responses

**File:** `mcp_server.py:229-239`
**Issue:** Only 404 and 409 responses are returned as parsed JSON; every other error status
(e.g. 400 for `"'set' must be a JSON object"`, `"Cannot add a POI to a door"`, `"Doors have no
POIs"`, `"POI index N out of range"`) goes through `r.raise_for_status()`:
```python
if r.status_code in (404, 409):
    return r.json()
r.raise_for_status()
return r.json()
```
`httpx.HTTPStatusError`'s default message only includes the method/URL/status code, not the
response body, so the specific, actionable error text the backend crafted for exactly these
cases (per the endpoint's own docstring) never reaches the calling AI agent — it just sees a
generic "400 Bad Request" exception.
**Fix:** Treat all `4xx` the same way 404/409 are handled (return the parsed JSON body rather than
raising), reserving `raise_for_status()` for `5xx`:
```python
if 400 <= r.status_code < 500:
    return r.json()
r.raise_for_status()
return r.json()
```

## Info

### IN-01: Schema doc gives a stale/contradictory door-id-derivation format

**File:** `docs/schemas/schema-encounters.md:169` (vs. `:46-49`)
**Issue:** Line 169, under "Door Fields", states: `Auto-derived as `${room.id}_door_${index}`
when no explicit `id:` is given.` This contradicts the format documented earlier in the same file
(lines 46-49) and actually implemented by both `_derive_door_id` in
`core/views/gm_data_mapedit.py:39-52` and the frontend's `deriveId` in
`src/components/domain/encounter/doors/doorNormalizer.ts:683-691`, which both produce
`<roomA>__<roomB|exterior>__<index>`. An AI agent reading only the "Door Fields" section (rather
than the "Editing a single element" section) would compute the wrong id format when trying to
target a door via `edit_map_element`.
**Fix:** Update line 169 to match the actual derivation: `` Auto-derived as
`<roomA>__<roomB|exterior>__<index>` when no explicit `id:` is given. ``

### IN-02: MCP tool parameter shadows the `set` builtin

**File:** `mcp_server.py:194, 223-224`
**Issue:** `edit_map_element`'s `set: dict | None = None` parameter shadows the built-in `set`
type for the duration of the function. It's harmless today (the function body never needs the
builtin), but it's a landmine for anyone extending this function later (e.g. adding
`set(existing_thing)` for validation) and shows up as a lint warning in most Python linters.
**Fix:** Rename the parameter (e.g. `set_fields`) while keeping the outward-facing JSON body key
`"set"` for API compatibility:
```python
async def edit_map_element(
    deckplan: str,
    target: str,
    set_fields: dict | None = None,
    add_poi: dict | None = None,
    remove_poi=None,
) -> dict:
    body: dict = {"target": target}
    if set_fields is not None:
        body["set"] = set_fields
```

---

_Reviewed: 2026-08-25T02:51:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
