import { describe, expect, it } from 'vitest';
import {
  buildProjection,
  DEFAULT_VIEW_ORIENTATION,
  normalizeProjection,
  normalizeRotationOffset,
  screenRotationFor,
  stepRotationOffset,
  toViewOrientation,
  type RotateDelta,
  type RotationOffset,
  type ViewProjection,
} from '../viewOrientation';
import { isoProjection, topDownProjection, type GridPoint, type SvgPoint } from '../gridProjection';
import { makeMapView } from '../mapView';

const EPS = 1e-9;

const closeToSvg = (a: SvgPoint, b: SvgPoint, eps = EPS) => {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
};

const SAMPLE_POINTS: GridPoint[] = [
  { gx: 0, gy: 0 },
  { gx: 1, gy: 0 },
  { gx: 0, gy: 1 },
  { gx: 3, gy: 2 },
  { gx: -2, gy: 5 },
];

const OFFSETS: RotationOffset[] = [0, 90, 180, 270];

describe('normalizeProjection', () => {
  it("returns 'iso' only for the exact string 'iso'", () => {
    expect(normalizeProjection('iso')).toBe('iso');
  });

  it.each<[string, unknown]>([
    ['top-down', 'top-down'],
    ['isometric', 'isometric'],
    ['ISO', 'ISO'],
    ['undefined', undefined],
    ['null', null],
    ['number', 5],
    ['object', {}],
  ])("coerces %s to 'top-down'", (_label, value) => {
    expect(normalizeProjection(value)).toBe('top-down');
  });
});

describe('normalizeRotationOffset', () => {
  it.each<[number]>([[0], [90], [180], [270]])('accepts the number %i', (n) => {
    expect(normalizeRotationOffset(n)).toBe(n);
  });

  it.each<[string, unknown]>([
    ['45', 45],
    ['360', 360],
    ['-90', -90],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['string "90"', '90'],
    ['null', null],
    ['undefined', undefined],
    ['object', {}],
    ['array', [90]],
  ])('coerces %s to 0 and never throws', (_label, value) => {
    expect(() => normalizeRotationOffset(value)).not.toThrow();
    expect(normalizeRotationOffset(value)).toBe(0);
  });
});

describe('toViewOrientation', () => {
  it('passes through a valid pair', () => {
    expect(toViewOrientation('iso', 270)).toEqual({ projection: 'iso', rotationOffset: 270 });
  });

  it.each<[string, unknown, unknown]>([
    ['both undefined', undefined, undefined],
    ['unknown projection with a bad offset', 'isometric', 45],
    ['null projection with a string offset', null, '90'],
    ['number projection with NaN', 5, NaN],
    ['offset 360', 'top-down', 360],
    ['offset -90', 'top-down', -90],
  ])('coerces %s to top-down / 0', (_label, projection, offset) => {
    expect(toViewOrientation(projection, offset)).toEqual({ projection: 'top-down', rotationOffset: 0 });
  });

  it('keeps a valid projection when only the offset is invalid', () => {
    expect(toViewOrientation('iso', 45)).toEqual({ projection: 'iso', rotationOffset: 0 });
  });

  it('DEFAULT_VIEW_ORIENTATION is top-down at offset 0', () => {
    expect(DEFAULT_VIEW_ORIENTATION).toEqual({ projection: 'top-down', rotationOffset: 0 });
  });
});

describe('stepRotationOffset', () => {
  it.each<[RotationOffset, RotateDelta, RotationOffset]>([
    [270, 90, 0],
    [0, -90, 270],
    [90, 90, 180],
    [180, -90, 90],
    [0, 90, 90],
    [90, -90, 0],
  ])('steps %i by %i to %i', (offset, delta, expected) => {
    expect(stepRotationOffset(offset, delta)).toBe(expected);
  });
});

describe('payload to pixels through the shared module (D-06)', () => {
  it('maps the literal SSE payload offset 90 clockwise at a 40 px unit', () => {
    // Literal payload shape from the SSE activeview event: pins the JSON key names.
    const payload = { encounter_projection: 'top-down', encounter_rotation_offset: 90 };
    const o = toViewOrientation(payload.encounter_projection, payload.encounter_rotation_offset);
    const view = makeMapView(buildProjection(o.projection, o.rotationOffset, 40));
    closeToSvg(view.project({ gx: 1, gy: 0 }), { x: 0, y: 40 });
    closeToSvg(view.project({ gx: 0, gy: 1 }), { x: -40, y: 0 });
  });

  it.each<[RotationOffset, SvgPoint]>([
    [180, { x: -40, y: 0 }],
    [270, { x: 0, y: -40 }],
  ])('offset %i maps grid (1,0) to the expected pixel', (offset, expected) => {
    const view = makeMapView(buildProjection('top-down', offset, 40));
    closeToSvg(view.project({ gx: 1, gy: 0 }), expected);
  });
});

describe('screenRotationFor (D-15)', () => {
  it.each<[number]>([[0], [90], [180], [270]])('is 0 under iso for authored rotation %i', (authored) => {
    expect(screenRotationFor('iso', authored)).toBe(0);
  });

  it('returns the authored rotation unchanged under top-down', () => {
    expect(screenRotationFor('top-down', 90)).toBe(90);
    expect(screenRotationFor('top-down', 0)).toBe(0);
    expect(screenRotationFor('top-down', 45)).toBe(45);
  });
});

describe('buildProjection authored-rotation fold under iso (D-15)', () => {
  it.each<[RotationOffset, number, number]>([
    [0, 90, 135],
    [90, 90, 225],
    [270, 270, 585],
  ])('iso offset %i + authored %i equals isoProjection rotation %i', (offset, authored, azimuth) => {
    const actual = buildProjection('iso', offset, 40, authored);
    const expected = isoProjection({ unitSize: 40, tilt: 30, rotation: azimuth });
    for (const p of SAMPLE_POINTS) closeToSvg(actual.project(p), expected.project(p));
  });

  it('rotation 585 projects like rotation 225 (modulo 360)', () => {
    const a = isoProjection({ unitSize: 40, tilt: 30, rotation: 585 });
    const b = isoProjection({ unitSize: 40, tilt: 30, rotation: 225 });
    for (const p of SAMPLE_POINTS) closeToSvg(a.project(p), b.project(p));
  });

  it('top-down ignores the authored rotation (the screen rotate owns it)', () => {
    const actual = buildProjection('top-down', 90, 40, 90);
    const expected = topDownProjection({ unitSize: 40, rotation: 90 });
    for (const p of SAMPLE_POINTS) closeToSvg(actual.project(p), expected.project(p));
  });

  it('an omitted authored rotation behaves as 0', () => {
    for (const projection of ['top-down', 'iso'] as ViewProjection[]) {
      const omitted = buildProjection(projection, 90, 40);
      const zero = buildProjection(projection, 90, 40, 0);
      for (const p of SAMPLE_POINTS) closeToSvg(omitted.project(p), zero.project(p));
    }
  });
});

describe('offset 0 reproduces the Phase 33 projections (D-07 identity)', () => {
  it('iso at offset 0 with no authored rotation equals azimuth 45', () => {
    const actual = buildProjection('iso', 0, 40);
    const expected = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    for (const p of SAMPLE_POINTS) closeToSvg(actual.project(p), expected.project(p));
  });

  it('top-down at offset 0 equals the plain scale', () => {
    const actual = buildProjection('top-down', 0, 40);
    const expected = topDownProjection({ unitSize: 40 });
    for (const p of SAMPLE_POINTS) closeToSvg(actual.project(p), expected.project(p));
  });
});

describe('true isometric across the 16 offset x authored combinations (ISO-05)', () => {
  const pairs: [RotationOffset, number][] = [];
  for (const offset of OFFSETS) for (const authored of [0, 90, 180, 270]) pairs.push([offset, authored]);

  it.each(pairs)('offset %i, authored %i: both axes lie on the 30 degree lattice', (offset, authored) => {
    const proj = buildProjection('iso', offset, 40, authored);
    const origin = proj.project({ gx: 0, gy: 0 });
    for (const axis of [{ gx: 1, gy: 0 }, { gx: 0, gy: 1 }]) {
      const p = proj.project(axis);
      const x = p.x - origin.x;
      const y = p.y - origin.y;
      const angle = ((((Math.atan2(y, x) * 180) / Math.PI) % 180) + 180) % 180;
      const dist = Math.min(Math.abs(angle - 30), Math.abs(angle - 150));
      expect(dist).toBeLessThan(1e-6);
      expect(Math.hypot(x, y)).toBeCloseTo(28.2843, 3);
    }
  });

  it.each(OFFSETS.map((o) => [o]))('view.unitSize is 28.2843 at every iso offset (%i)', (offset) => {
    const view = makeMapView(buildProjection('iso', offset as RotationOffset, 40));
    expect(view.unitSize).toBeCloseTo(28.2843, 3);
  });

  it.each(OFFSETS.map((o) => [o]))('view.unitSize is 40 at every top-down offset (%i)', (offset) => {
    const view = makeMapView(buildProjection('top-down', offset as RotationOffset, 40));
    expect(view.unitSize).toBeCloseTo(40, 9);
  });
});
