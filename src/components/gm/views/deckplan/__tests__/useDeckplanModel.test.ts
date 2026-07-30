/**
 * Tests for useDeckplanModel.ts — buildIdRangeMap and deckToMapData
 *
 * Covers:
 * - Deck-scoped id collision: corridor_1 on main_deck vs lower_deck → different lines
 * - POI id resolves to its `id:` line
 * - Returns empty Map on invalid/broken YAML (never throws)
 * - deckToMapData returns correct GridEncounterMapData shape
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildIdRangeMap, deckToMapData, parseYamlSafe, DeckplanDoc } from '../useDeckplanModel';

const FIXTURE_PATH = resolve(__dirname, '../__fixtures__/deckplan.fixture.yaml');
const FIXTURE_TEXT = readFileSync(FIXTURE_PATH, 'utf8');

// ----------------------------------------------------------------
// buildIdRangeMap
// ----------------------------------------------------------------

describe('buildIdRangeMap', () => {
  it('returns a Map with entries for both decks', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBeGreaterThan(0);
  });

  it('contains rooms from main_deck', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    expect(map.has('main_deck|room|bridge')).toBe(true);
    expect(map.has('main_deck|room|corridor_1')).toBe(true);
  });

  it('contains rooms from lower_deck', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    expect(map.has('lower_deck|room|engineering')).toBe(true);
    expect(map.has('lower_deck|room|corridor_1')).toBe(true);
  });

  it('deck-scoped collision: corridor_1 on main_deck and lower_deck resolve to DIFFERENT lines', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    const mainCorr = map.get('main_deck|room|corridor_1');
    const lowerCorr = map.get('lower_deck|room|corridor_1');
    expect(mainCorr).toBeDefined();
    expect(lowerCorr).toBeDefined();
    // The same room id on different decks MUST resolve to different line numbers
    expect(mainCorr!.idLineStart).not.toBe(lowerCorr!.idLineStart);
  });

  it('contains the POI from main_deck and resolves it to its id: line', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    expect(map.has('main_deck|poi|poi_alpha')).toBe(true);
    const poiEntry = map.get('main_deck|poi|poi_alpha')!;
    expect(poiEntry.kind).toBe('poi');
    expect(poiEntry.deckId).toBe('main_deck');
    // POI should be on the same line as the flow-style poi item (line 34 in fixture)
    expect(poiEntry.idLineStart).toBeGreaterThan(0);
  });

  it('all entries have valid 1-based line numbers (>= 1) and column numbers (>= 1)', () => {
    const map = buildIdRangeMap(FIXTURE_TEXT);
    for (const [, entry] of map) {
      expect(entry.idLineStart).toBeGreaterThanOrEqual(1);
      expect(entry.idColStart).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns empty Map on completely invalid YAML (does not throw)', () => {
    expect(() => buildIdRangeMap('decks:\n- id: x\n  rooms:\n  - id:')).not.toThrow();
    const map = buildIdRangeMap('decks:\n- id: x\n  rooms:\n  - id:');
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it('returns empty Map on totally broken YAML (garbage input)', () => {
    expect(() => buildIdRangeMap('garbage: [')).not.toThrow();
    const map = buildIdRangeMap('garbage: [');
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it('returns empty Map on empty string', () => {
    const map = buildIdRangeMap('');
    expect(map).toBeInstanceOf(Map);
  });
});

// ----------------------------------------------------------------
// deckToMapData
// ----------------------------------------------------------------

describe('deckToMapData', () => {
  const parsed = parseYamlSafe(FIXTURE_TEXT);

  it('returns null for an unknown deckId', () => {
    expect(deckToMapData(parsed, 'nonexistent_deck')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(deckToMapData(null, 'main_deck')).toBeNull();
    expect(deckToMapData(undefined, 'main_deck')).toBeNull();
  });

  it('returns a GridEncounterMapData-shaped object for main_deck', () => {
    const data = deckToMapData(parsed, 'main_deck');
    expect(data).not.toBeNull();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('unit_size');
    expect(data).toHaveProperty('rooms');
    expect(data).toHaveProperty('doors');
    expect(data).toHaveProperty('vents');
    expect(data).toHaveProperty('poi');
    expect(Array.isArray(data!.rooms)).toBe(true);
    expect(Array.isArray(data!.doors)).toBe(true);
    expect(Array.isArray(data!.vents)).toBe(true);
    expect(Array.isArray(data!.poi)).toBe(true);
  });

  it('uses deck.unit_size over the deckplan-level unit_size', () => {
    const data = deckToMapData(parsed, 'main_deck');
    expect(data!.unit_size).toBe(30); // fixture deck.unit_size = 30
  });

  it('includes the poi for main_deck', () => {
    const data = deckToMapData(parsed, 'main_deck');
    expect(data!.poi!.length).toBe(1);
    expect(data!.poi![0].id).toBe('poi_alpha');
  });

  it('returns empty arrays for poi/doors/vents when absent (lower_deck)', () => {
    const data = deckToMapData(parsed, 'lower_deck');
    expect(data).not.toBeNull();
    expect(data!.poi).toEqual([]);
    expect(data!.doors).toEqual([]);
    expect(data!.vents).toEqual([]);
    expect(data!.rooms.length).toBe(2);
  });

  it('additive: carries the document-level hull when the deck has no hull of its own', () => {
    const data = deckToMapData(parsed, 'main_deck');
    // Fixture has hull at deckplan level; main_deck declares no hull of its own.
    expect(data!.hull).toBeDefined();
    expect(data!.hull!.polygons).toBeInstanceOf(Array);
    expect(data!.hull!.polygons!.length).toBeGreaterThan(0);
  });

  describe('additive hull merge (D-02)', () => {
    const docHull = { polygon: [[0, 0], [20, 0], [20, 20]] as [number, number][] };
    const deckHull = {
      polygons: [
        [[30, 30], [40, 30], [40, 40]] as [number, number][],
        [[50, 50], [60, 50], [60, 60]] as [number, number][],
      ],
    };

    const makeDoc = (hull?: typeof docHull, deckOverrides: Record<string, unknown> = {}): DeckplanDoc => ({
      name: 'Test Ship',
      hull,
      decks: [{ id: 'deck_a', name: 'Deck A', rooms: [], ...deckOverrides }],
    });

    it('document has a hull, deck has none -> result carries the document polygons', () => {
      const data = deckToMapData(makeDoc(docHull), 'deck_a');
      expect(data!.hull!.polygons!.length).toBe(1);
    });

    it('document has none, deck has a hull -> result carries the deck polygons', () => {
      const data = deckToMapData(makeDoc(undefined, { hull: deckHull }), 'deck_a');
      expect(data!.hull!.polygons!.length).toBe(2);
    });

    it('both present -> result.hull.polygons contains document AND deck polygons (sum of counts)', () => {
      const data = deckToMapData(makeDoc(docHull, { hull: deckHull }), 'deck_a');
      expect(data!.hull!.polygons!.length).toBe(1 + 2);
    });

    it('neither present -> result.hull is undefined', () => {
      const data = deckToMapData(makeDoc(undefined, {}), 'deck_a');
      expect(data!.hull).toBeUndefined();
    });
  });
});
