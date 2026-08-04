import { describe, expect, it, vi } from 'vitest';
import { HullDef, NormalizedHull } from '../../../../../types/encounterMap';
import { hullPathD, mergeHulls, normalizeHull } from '../hullNormalizer';

describe('normalizeHull', () => {
  it('converts a singular polygon to a one-entry polygons list', () => {
    const P: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    expect(normalizeHull({ polygon: P })).toEqual({ polygons: [P], holes: [] });
  });

  it('keeps a plural polygons list as-is', () => {
    const A: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const B: [number, number][] = [[20, 20], [30, 20], [30, 30]];
    expect(normalizeHull({ polygons: [A, B] })).toEqual({ polygons: [A, B], holes: [] });
  });

  it('combines singular polygon first, then plural polygons, in order', () => {
    const P: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const A: [number, number][] = [[20, 20], [30, 20], [30, 30]];
    expect(normalizeHull({ polygon: P, polygons: [A] })).toEqual({ polygons: [P, A], holes: [] });
  });

  it('carries holes unpaired to any outer polygon', () => {
    const P: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const H: [number, number][] = [[2, 2], [4, 2], [4, 4]];
    expect(normalizeHull({ polygon: P, holes: [H] })).toEqual({ polygons: [P], holes: [H] });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {} as HullDef],
    ['empty polygons list', { polygons: [] } as HullDef],
  ])('returns null for %s', (_label, input) => {
    expect(normalizeHull(input)).toBeNull();
  });

  it('drops a malformed polygon (fewer than 3 vertices) and warns, keeping siblings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const bad = [[0, 0], [10, 0]] as [number, number][];
    const result = normalizeHull({ polygons: [good, bad] });
    expect(result).toEqual({ polygons: [good], holes: [] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[hullNormalizer]'));
    warnSpy.mockRestore();
  });

  it('drops a malformed polygon (non-finite coordinate) and warns, keeping siblings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const bad = [[0, 0], [10, 0], [NaN, 10]] as [number, number][];
    const result = normalizeHull({ polygons: [good, bad] });
    expect(result).toEqual({ polygons: [good], holes: [] });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('drops a malformed hole independently of valid outer polygons', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const P: [number, number][] = [[0, 0], [10, 0], [10, 10]];
    const badHole = [[0, 0], [1, 1]] as [number, number][];
    const result = normalizeHull({ polygon: P, holes: [badHole] });
    expect(result).toEqual({ polygons: [P], holes: [] });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('mergeHulls', () => {
  const shared: HullDef = { polygon: [[0, 0], [10, 0], [10, 10]] };
  const deck: HullDef = { polygon: [[20, 20], [30, 20], [30, 30]] };

  it('concatenates polygons of both inputs, shared first, in argument order', () => {
    expect(mergeHulls(shared, deck)).toEqual({
      polygons: [shared.polygon, deck.polygon],
      holes: [],
    });
  });

  it('returns deck polygons only when shared is undefined', () => {
    expect(mergeHulls(undefined, deck)).toEqual({ polygons: [deck.polygon], holes: [] });
  });

  it('counts the same object reference once (no duplicated polygons)', () => {
    const h: HullDef = { polygon: [[0, 0], [10, 0], [10, 10]] };
    expect(mergeHulls(h, h)).toEqual({ polygons: [h.polygon], holes: [] });
  });

  it('returns null when called with no inputs or all-null inputs', () => {
    expect(mergeHulls()).toBeNull();
    expect(mergeHulls(null, undefined)).toBeNull();
  });

  it('returns null when every source contributes only holes and no polygon (WR-02)', () => {
    const holesOnly: HullDef = { holes: [[[2, 2], [4, 2], [4, 4]]] };
    expect(mergeHulls(holesOnly)).toBeNull();
  });

  it('keeps holes from a holes-only deck hull when merged with a shared hull that has a polygon (WR-02)', () => {
    const holesOnlyDeck: HullDef = { holes: [[[2, 2], [4, 2], [4, 4]]] };
    expect(mergeHulls(shared, holesOnlyDeck)).toEqual({
      polygons: [shared.polygon],
      holes: holesOnlyDeck.holes,
    });
  });
});

describe('hullPathD', () => {
  const project = (gx: number, gy: number) => ({ x: gx * 2, y: gy * 2 });

  it('builds a single M...Z subpath for one polygon with no holes', () => {
    const hull: NormalizedHull = { polygons: [[[0, 0], [10, 0], [10, 10]]], holes: [] };
    expect(hullPathD(hull, project)).toBe('M 0,0 20,0 20,20 Z');
  });

  it('builds three M...Z subpaths for two polygons plus one hole, projected', () => {
    const hull: NormalizedHull = {
      polygons: [
        [[0, 0], [10, 0], [10, 10]],
        [[20, 20], [30, 20], [30, 30]],
      ],
      holes: [[[2, 2], [4, 2], [4, 4]]],
    };
    expect(hullPathD(hull, project)).toBe(
      'M 0,0 20,0 20,20 Z M 40,40 60,40 60,60 Z M 4,4 8,4 8,8 Z',
    );
  });
});
