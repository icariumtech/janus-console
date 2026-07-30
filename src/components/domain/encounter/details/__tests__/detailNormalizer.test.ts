import { describe, expect, it, vi } from 'vitest';
import { DetailEntry, GridRoom } from '../../../../../types/encounterMap';
import { partitionDetails } from '../detailNormalizer';

function room(id: string): GridRoom {
  return { id, name: id.toUpperCase(), rects: [{ x: 0, y: 0, w: 1, h: 1 }] };
}

describe('partitionDetails', () => {
  it('lands a no-room entry with valid points in exterior (isGM false)', () => {
    const entry: DetailEntry = { points: [[0, 0], [1, 1]] };
    const result = partitionDetails([entry], [], false);
    expect(result.exterior).toEqual([entry]);
    expect(result.byRoom.size).toBe(0);
  });

  it('lands a no-room entry with valid points in exterior (isGM true)', () => {
    const entry: DetailEntry = { points: [[0, 0], [1, 1]] };
    const result = partitionDetails([entry], [], true);
    expect(result.exterior).toEqual([entry]);
    expect(result.byRoom.size).toBe(0);
  });

  it('lands a no-room entry with a valid circle in exterior', () => {
    const entry: DetailEntry = { circle: { cx: 5, cy: 5, r: 1 } };
    const result = partitionDetails([entry], [], false);
    expect(result.exterior).toEqual([entry]);
  });

  it('lands an entry with room: "bridge" (existing room) under byRoom["bridge"]', () => {
    const entry: DetailEntry = { room: 'bridge', points: [[0, 0], [1, 1]] };
    const result = partitionDetails([entry], [room('bridge')], false);
    expect(result.exterior).toEqual([]);
    expect(result.byRoom.get('bridge')).toEqual([entry]);
  });

  it('groups two entries sharing the same room under one key, in authored order', () => {
    const first: DetailEntry = { room: 'bridge', points: [[0, 0], [1, 1]] };
    const second: DetailEntry = { room: 'bridge', circle: { cx: 2, cy: 2, r: 1 } };
    const result = partitionDetails([first, second], [room('bridge')], false);
    expect(result.byRoom.get('bridge')).toEqual([first, second]);
  });

  it('dangling room ref, isGM false: appears NOWHERE (not exterior, not any byRoom value) and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry: DetailEntry = { room: 'brdige', points: [[0, 0], [1, 1]] };
    const result = partitionDetails([entry], [room('bridge')], false);
    expect(result.exterior).toEqual([]);
    for (const entries of result.byRoom.values()) {
      expect(entries).not.toContain(entry);
    }
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('brdige'));
    warnSpy.mockRestore();
  });

  it('dangling room ref, isGM true: appears in exterior and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry: DetailEntry = { room: 'brdige', points: [[0, 0], [1, 1]] };
    const result = partitionDetails([entry], [room('bridge')], true);
    expect(result.exterior).toEqual([entry]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('brdige'));
    warnSpy.mockRestore();
  });

  it('warns exactly once when three entries share one unknown room id', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries: DetailEntry[] = [
      { room: 'ghost_room', points: [[0, 0], [1, 1]] },
      { room: 'ghost_room', points: [[2, 2], [3, 3]] },
      { room: 'ghost_room', circle: { cx: 4, cy: 4, r: 1 } },
    ];
    partitionDetails(entries, [room('bridge')], true);
    const ghostWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('ghost_room'),
    );
    expect(ghostWarnings.length).toBe(1);
    warnSpy.mockRestore();
  });

  it('drops an entry with neither points nor circle, warns, and does not break siblings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: DetailEntry = { id: 'malformed' };
    const good: DetailEntry = { points: [[0, 0], [1, 1]] };
    const result = partitionDetails([bad, good], [], false);
    expect(result.exterior).toEqual([good]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drops a polyline with a single vertex and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: DetailEntry = { points: [[0, 0]] };
    const result = partitionDetails([bad], [], false);
    expect(result.exterior).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drops a polyline with a non-finite coordinate and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: DetailEntry = { points: [[0, 0], [NaN, 1]] };
    const result = partitionDetails([bad], [], false);
    expect(result.exterior).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drops a circle with radius 0 or negative and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zeroR: DetailEntry = { circle: { cx: 0, cy: 0, r: 0 } };
    const negR: DetailEntry = { circle: { cx: 0, cy: 0, r: -1 } };
    const result = partitionDetails([zeroR, negR], [], false);
    expect(result.exterior).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('returns empty exterior and empty byRoom with no warnings for undefined/empty details', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(partitionDetails(undefined, [], false)).toEqual({ exterior: [], byRoom: new Map() });
    expect(partitionDetails(null, [], false)).toEqual({ exterior: [], byRoom: new Map() });
    expect(partitionDetails([], [], false)).toEqual({ exterior: [], byRoom: new Map() });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('never mutates the input array or its entries', () => {
    const entry: DetailEntry = { room: 'bridge', points: [[0, 0], [1, 1]] };
    const details = Object.freeze([Object.freeze(entry)]) as unknown as DetailEntry[];
    expect(() => partitionDetails(details, [room('bridge')], false)).not.toThrow();
  });
});
