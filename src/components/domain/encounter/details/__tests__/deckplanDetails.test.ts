/**
 * deckplanDetails.test.ts — integration coverage against the REAL
 * `data/ships/patrol_gunboat/deckplan.yaml` testbed authored in Task 2.
 *
 * Pins the shipped detail data against silent drift: fails if a future edit
 * renames a room out from under a detail's `room:` reference, or changes
 * the exterior/interior split the testbed was authored to exercise.
 *
 * Also covers `deckToMapData`'s `details` passthrough (Task 3) — the
 * chosen home for these two cases is THIS file (not
 * `useDeckplanModel.test.ts`) per PLAN.md Task 3's file list.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { partitionDetails } from '../detailNormalizer';
import type { DetailEntry, GridRoom } from '../../../../../types/encounterMap';
import { deckToMapData } from '../../../../gm/views/deckplan/useDeckplanModel';
import type { DeckplanDoc } from '../../../../gm/views/deckplan/useDeckplanModel';

const REPO_ROOT = resolve(__dirname, '../../../../../..');
const DECKPLAN_PATH = 'data/ships/patrol_gunboat/deckplan.yaml';

function loadUpperDeck() {
  const text = readFileSync(resolve(REPO_ROOT, DECKPLAN_PATH), 'utf-8');
  const doc = parseYaml(text) as DeckplanDoc;
  const upperDeck = doc.decks.find((d) => d.id === 'upper_deck');
  if (!upperDeck) throw new Error('upper_deck not found in fixture');
  return upperDeck;
}

describe('patrol_gunboat upper_deck details (real YAML)', () => {
  it(`reads ${DECKPLAN_PATH} and finds the upper_deck details testbed`, () => {
    const upperDeck = loadUpperDeck();
    expect(Array.isArray(upperDeck.details)).toBe(true);
    expect(upperDeck.details!.length).toBe(4);
  });

  it('partitionDetails(deck.details, deck.rooms, false) returns exactly 2 exterior entries', () => {
    const upperDeck = loadUpperDeck();
    const result = partitionDetails(
      upperDeck.details as DetailEntry[],
      upperDeck.rooms as GridRoom[],
      false,
    );
    expect(result.exterior.length).toBe(2);
    // pod_strut (id'd polyline) and the sensor dish circle (no id)
    expect(result.exterior.some((d) => d.id === 'pod_strut')).toBe(true);
    expect(result.exterior.some((d) => d.circle !== undefined)).toBe(true);
  });

  it('partitionDetails byRoom has exactly 2 keys (obs_deck, sensor_pod), one entry each', () => {
    const upperDeck = loadUpperDeck();
    const result = partitionDetails(
      upperDeck.details as DetailEntry[],
      upperDeck.rooms as GridRoom[],
      false,
    );
    expect(result.byRoom.size).toBe(2);
    expect(result.byRoom.get('obs_deck')?.length).toBe(1);
    expect(result.byRoom.get('sensor_pod')?.length).toBe(1);
  });

  it('every authored detail room value resolves to a real room id on the deck', () => {
    const upperDeck = loadUpperDeck();
    const roomIds = new Set((upperDeck.rooms as GridRoom[]).map((r) => r.id));
    const referencedRoomIds = (upperDeck.details as DetailEntry[])
      .map((d) => d.room)
      .filter((r): r is string => Boolean(r));
    expect(referencedRoomIds.length).toBeGreaterThan(0);
    for (const roomId of referencedRoomIds) {
      expect(roomIds.has(roomId)).toBe(true);
    }
  });

  it('injecting one synthetic unknown-room entry: 0 additional entries for players, exactly 1 for GM', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const upperDeck = loadUpperDeck();
    const original = upperDeck.details as DetailEntry[];
    const synthetic: DetailEntry = { room: 'nonexistent_room', points: [[0, 0], [1, 1]] };
    // Shallow copy — never mutate the parsed document.
    const withSynthetic = [...original, synthetic];

    const beforePlayer = partitionDetails(original, upperDeck.rooms as GridRoom[], false);
    const afterPlayer = partitionDetails(withSynthetic, upperDeck.rooms as GridRoom[], false);
    const beforeCount = beforePlayer.exterior.length +
      [...beforePlayer.byRoom.values()].reduce((sum, arr) => sum + arr.length, 0);
    const afterPlayerCount = afterPlayer.exterior.length +
      [...afterPlayer.byRoom.values()].reduce((sum, arr) => sum + arr.length, 0);
    expect(afterPlayerCount - beforeCount).toBe(0);

    const beforeGM = partitionDetails(original, upperDeck.rooms as GridRoom[], true);
    const afterGM = partitionDetails(withSynthetic, upperDeck.rooms as GridRoom[], true);
    const beforeGMCount = beforeGM.exterior.length +
      [...beforeGM.byRoom.values()].reduce((sum, arr) => sum + arr.length, 0);
    const afterGMCount = afterGM.exterior.length +
      [...afterGM.byRoom.values()].reduce((sum, arr) => sum + arr.length, 0);
    expect(afterGMCount - beforeGMCount).toBe(1);

    warnSpy.mockRestore();
  });
});

describe('deckToMapData details passthrough', () => {
  it('a deck carrying details returns them on the resulting GridEncounterMapData', () => {
    const text = readFileSync(resolve(REPO_ROOT, DECKPLAN_PATH), 'utf-8');
    const doc = parseYaml(text) as DeckplanDoc;
    const data = deckToMapData(doc, 'upper_deck');
    expect(data).not.toBeNull();
    expect(data!.details).toBeDefined();
    expect(data!.details!.length).toBe(4);
  });

  it('a deck with no details key returns an empty array, not undefined', () => {
    const doc: DeckplanDoc = {
      name: 'Test Ship',
      decks: [{ id: 'no_details_deck', name: 'No Details Deck', rooms: [] }],
    };
    const data = deckToMapData(doc, 'no_details_deck');
    expect(data).not.toBeNull();
    expect(data!.details).toEqual([]);
  });
});
