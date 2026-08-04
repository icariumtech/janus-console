/**
 * hullNormalizer — convert authored YAML hull shapes (`HullDef`) into the
 * canonical `NormalizedHull` model defined in `types/encounterMap.ts`.
 *
 * Reused for BOTH the shared location/manifest hull and any per-deck hull
 * (D-03) — one shape, one normalizer. `mergeHulls` implements the additive
 * combination rule (D-02): a deck hull's geometry renders IN ADDITION to
 * the shared silhouette, never replacing or shrinking it.
 *
 * Pure module; no React; no DOM. Tested in `__tests__/hullNormalizer.test.ts`.
 *
 * Diverges from `doorNormalizer` on one point: this normalizer does NOT
 * throw a normalization error. A single malformed authored polygon (fewer
 * than 3 vertices, or any non-finite coordinate) is dropped with a single
 * `console.warn` naming the index and the reason, and its sibling polygons
 * still render — a typo in one pod polygon must never blank the whole map.
 * This mirrors the defensive catch-and-drop fallback already used for door
 * normalization in `EncounterMapRenderer.tsx` (lines ~189-210).
 *
 * High-level contract:
 *
 *   normalizeHull(authored)      → NormalizedHull | null
 *   mergeHulls(...inputs)        → NormalizedHull | null
 *   hullPathD(hull, project)     → string (SVG path `d`)
 */

import { HullDef, NormalizedHull } from '../../../../types/encounterMap';

type Point = [number, number];

/**
 * A polygon (or hole) is valid iff it has at least 3 vertices and every
 * coordinate is finite. Invalid entries are dropped with a `console.warn`
 * naming the index and reason; this function never throws.
 */
function isValidPolygon(poly: unknown, index: number, kind: 'polygon' | 'hole'): poly is Point[] {
  if (!Array.isArray(poly) || poly.length < 3) {
    console.warn(`[hullNormalizer] dropped ${kind} at index ${index}: fewer than 3 vertices`);
    return false;
  }
  for (const vertex of poly) {
    if (
      !Array.isArray(vertex) ||
      vertex.length !== 2 ||
      !Number.isFinite(vertex[0]) ||
      !Number.isFinite(vertex[1])
    ) {
      console.warn(`[hullNormalizer] dropped ${kind} at index ${index}: non-finite coordinate`);
      return false;
    }
  }
  return true;
}

/**
 * Normalize an authored (or already-normalized) hull into the canonical
 * `NormalizedHull` shape.
 *
 * Collects `authored.polygon` first (if present), then each entry of
 * `authored.polygons` in order — so `{ polygon: P, polygons: [A] }` becomes
 * `{ polygons: [P, A], holes: [] }`. Validates every polygon and every hole
 * individually with a shared predicate; malformed entries are dropped
 * (warned), surviving siblings are kept. Returns `null` when the surviving
 * `polygons` and `holes` are both empty (covers `null`/`undefined`/`{}`/
 * `{ polygons: [] }`).
 */
export function normalizeHull(
  authored: HullDef | NormalizedHull | null | undefined,
): NormalizedHull | null {
  if (!authored) return null;

  const candidatePolygons: unknown[] = [];
  if ('polygon' in authored && authored.polygon) candidatePolygons.push(authored.polygon);
  if ('polygons' in authored && authored.polygons) candidatePolygons.push(...authored.polygons);

  const polygons: Point[][] = [];
  candidatePolygons.forEach((poly, i) => {
    if (isValidPolygon(poly, i, 'polygon')) polygons.push(poly);
  });

  const candidateHoles = authored.holes ?? [];
  const holes: Point[][] = [];
  candidateHoles.forEach((hole, i) => {
    if (isValidPolygon(hole, i, 'hole')) holes.push(hole);
  });

  if (polygons.length === 0 && holes.length === 0) return null;
  return { polygons, holes };
}

/**
 * Merge multiple hull sources additively (D-02): normalize each input,
 * skip nullish results, skip any input object already seen by reference
 * identity (so a caller that passes the same hull object as both the prop
 * and `mapData.hull` does not double-draw it), then concatenate `polygons`
 * and `holes` in argument order (shared/first input's geometry first).
 */
export function mergeHulls(
  ...inputs: Array<HullDef | NormalizedHull | null | undefined>
): NormalizedHull | null {
  const seen = new Set<HullDef | NormalizedHull>();
  const polygons: Point[][] = [];
  const holes: Point[][] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (seen.has(input)) continue;
    seen.add(input);
    const normalized = normalizeHull(input);
    if (!normalized) continue;
    polygons.push(...normalized.polygons);
    holes.push(...normalized.holes);
  }

  if (polygons.length === 0) return null; // holes with nothing to punch never render
  return { polygons, holes };
}

/**
 * Build one `M <x,y x,y ...> Z` SVG subpath per outer polygon, followed by
 * one per hole, joined by single spaces — the identical construction
 * `RoomsLayer.tsx` uses for room floors, so an SVG `<path fillRule="evenodd">`
 * built from this `d` punches the holes out of the fill.
 */
export function hullPathD(
  hull: NormalizedHull,
  project: (gx: number, gy: number) => { x: number; y: number },
): string {
  const subpath = (poly: Point[]): string => {
    const pts = poly
      .map(([gx, gy]) => {
        const p = project(gx, gy);
        return `${p.x},${p.y}`;
      })
      .join(' ');
    return `M ${pts} Z`;
  };
  const parts = [...hull.polygons.map(subpath), ...hull.holes.map(subpath)];
  return parts.join(' ');
}
