/**
 * detailNormalizer — partition a deck's authored `details:` list into
 * always-visible exterior entries and per-room interior entries.
 *
 * This is the single gating seam for decorative detail linework (consoles,
 * beds, furniture, machinery blocks, hull greebles). Pure module; no React;
 * no DOM. Tested in `__tests__/detailNormalizer.test.ts` and, against the
 * real `patrol_gunboat` deckplan, in `__tests__/deckplanDetails.test.ts`.
 *
 * D-14 fail-safe: a `room:` value that matches no room on the deck is a
 * typo or a renamed room. It MUST NOT leak an unrevealed room's interior
 * detail to a player — a typo can never spoil content early. So a dangling
 * reference is dropped entirely for players (never rendered anywhere) and
 * routed to `exterior` for the GM (so the GM can still see it, notice it,
 * and fix the typo). Every unknown room id is warned to the dev console at
 * most once per call, naming the id, so authors can find and correct it.
 *
 * This function is deliberately NOT reveal-aware — it never reads the
 * room-visibility state. Reveal gating is achieved structurally: `byRoom`
 * entries are mounted by `RoomsLayer` INSIDE the room's existing SVG
 * reveal group (see `renderer/DetailsLayer.tsx` + `renderer/RoomsLayer.tsx`),
 * so there is exactly one visibility mechanism in the codebase for a given
 * room — the room's own reveal state — rather than two that could drift
 * out of sync (D-12/D-13).
 *
 * High-level contract:
 *
 *   partitionDetails(details, rooms, isGM) → { exterior, byRoom }
 *
 * Never throws. Malformed primitives (neither a valid polyline nor a valid
 * circle) are dropped with a `console.warn` naming the entry index and the
 * reason; siblings are unaffected. The input array and its entries are
 * never mutated.
 */

import { DetailEntry, GridRoom } from '../../../../types/encounterMap';

export interface PartitionedDetails {
  exterior: DetailEntry[];
  byRoom: Map<string, DetailEntry[]>;
}

/**
 * A detail entry's primitive is valid iff it carries exactly one of:
 *  - `points`: an array of at least 2 `[number, number]` pairs, every
 *    coordinate `Number.isFinite`.
 *  - `circle`: `{ cx, cy, r }` all finite, with `r > 0`.
 * Entries with neither (or a malformed one) are dropped and warned.
 */
function isValidPrimitive(entry: DetailEntry, index: number): boolean {
  const hasPoints = Array.isArray(entry.points);
  const hasCircle = entry.circle !== undefined && entry.circle !== null;

  if (!hasPoints && !hasCircle) {
    console.warn(`[detailNormalizer] dropped entry at index ${index}: neither points nor circle present`);
    return false;
  }

  if (hasPoints) {
    const points = entry.points as unknown;
    if (!Array.isArray(points) || points.length < 2) {
      console.warn(`[detailNormalizer] dropped entry at index ${index}: points has fewer than 2 vertices`);
      return false;
    }
    for (const vertex of points) {
      if (
        !Array.isArray(vertex) ||
        vertex.length !== 2 ||
        !Number.isFinite(vertex[0]) ||
        !Number.isFinite(vertex[1])
      ) {
        console.warn(`[detailNormalizer] dropped entry at index ${index}: points has a non-finite coordinate`);
        return false;
      }
    }
    return true;
  }

  // hasCircle
  const circle = entry.circle as unknown as { cx: unknown; cy: unknown; r: unknown };
  if (
    !Number.isFinite(circle.cx) ||
    !Number.isFinite(circle.cy) ||
    !Number.isFinite(circle.r) ||
    (circle.r as number) <= 0
  ) {
    console.warn(`[detailNormalizer] dropped entry at index ${index}: circle has a non-finite coordinate or non-positive radius`);
    return false;
  }
  return true;
}

/**
 * Partition a deck's `details:` list into always-visible exterior entries
 * and per-room interior entries, applying the D-14 fail-safe for dangling
 * `room:` references.
 *
 * @param details - authored `DetailEntry[]` (deck-level `details:` list), or
 *   undefined/null (treated as empty — no warnings)
 * @param rooms - the deck's `GridRoom[]`, used only to build the set of
 *   valid room ids a `room:` reference may resolve to
 * @param isGM - when true, a dangling `room:` reference still renders (in
 *   `exterior`) so the GM can see and fix the typo; when false it is
 *   dropped entirely (D-14 fail-safe)
 */
export function partitionDetails(
  details: DetailEntry[] | undefined | null,
  rooms: GridRoom[],
  isGM: boolean,
): PartitionedDetails {
  const exterior: DetailEntry[] = [];
  const byRoom = new Map<string, DetailEntry[]>();

  if (!details || details.length === 0) {
    return { exterior, byRoom };
  }

  const validRoomIds = new Set(rooms.map((r) => r.id));
  const warnedUnknownRoomIds = new Set<string>();

  details.forEach((entry, index) => {
    if (!isValidPrimitive(entry, index)) return;

    const roomId = entry.room;
    if (!roomId) {
      exterior.push(entry);
      return;
    }

    if (validRoomIds.has(roomId)) {
      const existing = byRoom.get(roomId);
      if (existing) {
        existing.push(entry);
      } else {
        byRoom.set(roomId, [entry]);
      }
      return;
    }

    // D-14 fail-safe: dangling `room:` reference.
    if (!warnedUnknownRoomIds.has(roomId)) {
      warnedUnknownRoomIds.add(roomId);
      console.warn(`[detailNormalizer] detail entry references unknown room id "${roomId}" — rendering nothing for players (fail-safe)`);
    }
    if (isGM) {
      exterior.push(entry);
    }
    // else: dropped entirely — never rendered for players.
  });

  return { exterior, byRoom };
}
