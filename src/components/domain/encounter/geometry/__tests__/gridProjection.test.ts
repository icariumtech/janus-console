import { describe, expect, it } from 'vitest';
import {
  isoProjection,
  topDownProjection,
  type GridPoint,
  type Projection,
  type SvgPoint,
} from '../gridProjection';

const RT_EPS = 1e-10;

const closeToSvg = (a: SvgPoint, b: SvgPoint, eps = RT_EPS) => {
  expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
  expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
};

const closeToGrid = (a: GridPoint, b: GridPoint, eps = RT_EPS) => {
  expect(Math.abs(a.gx - b.gx)).toBeLessThan(eps);
  expect(Math.abs(a.gy - b.gy)).toBeLessThan(eps);
};

describe('topDownProjection', () => {
  it('preserves the origin: grid (0,0) → SVG (0,0)', () => {
    const proj = topDownProjection({ unitSize: 40 });
    closeToSvg(proj.project({ gx: 0, gy: 0 }), { x: 0, y: 0 });
  });

  it('scales by unitSize on both axes', () => {
    const proj = topDownProjection({ unitSize: 40 });
    closeToSvg(proj.project({ gx: 1, gy: 1 }), { x: 40, y: 40 });
    closeToSvg(proj.project({ gx: 3, gy: 5 }), { x: 120, y: 200 });
  });

  it('handles fractional grid coordinates', () => {
    const proj = topDownProjection({ unitSize: 40 });
    closeToSvg(proj.project({ gx: 1.5, gy: 2.7 }), { x: 60, y: 108 });
  });

  it('handles negative grid coordinates', () => {
    const proj = topDownProjection({ unitSize: 40 });
    closeToSvg(proj.project({ gx: -2, gy: -0.5 }), { x: -80, y: -20 });
  });

  it('unproject inverts project for known integer pairs', () => {
    const proj = topDownProjection({ unitSize: 40 });
    closeToGrid(proj.unproject({ x: 40, y: 80 }), { gx: 1, gy: 2 });
    closeToGrid(proj.unproject({ x: 0, y: 0 }), { gx: 0, gy: 0 });
  });

  it.each<[number, GridPoint]>([
    [1, { gx: 0, gy: 0 }],
    [1, { gx: 1, gy: 1 }],
    [1, { gx: 7.5, gy: -3.25 }],
    [30, { gx: 0, gy: 0 }],
    [30, { gx: 1, gy: 1 }],
    [30, { gx: 12.345, gy: -67.89 }],
    [40, { gx: 0.001, gy: 0.001 }],
    [40, { gx: 100, gy: 100 }],
    [100, { gx: 0, gy: 0 }],
    [100, { gx: 0.5, gy: 0.5 }],
    [100, { gx: -10, gy: 10 }],
  ])('round-trip property: unproject(project(p)) ≈ p for unitSize=%i, p=%j', (unitSize, p) => {
    const proj = topDownProjection({ unitSize });
    closeToGrid(proj.unproject(proj.project(p)), p);
  });

  it.each<[number, SvgPoint]>([
    [1, { x: 0, y: 0 }],
    [30, { x: 30, y: 60 }],
    [40, { x: 100, y: -200 }],
    [100, { x: 12345, y: -6789 }],
  ])('inverse round-trip: project(unproject(s)) ≈ s for unitSize=%i, s=%j', (unitSize, s) => {
    const proj = topDownProjection({ unitSize });
    closeToSvg(proj.project(proj.unproject(s)), s);
  });

  it('two projections with different unitSize give independent results', () => {
    const fine: Projection = topDownProjection({ unitSize: 30 });
    const coarse: Projection = topDownProjection({ unitSize: 40 });
    closeToSvg(fine.project({ gx: 1, gy: 1 }), { x: 30, y: 30 });
    closeToSvg(coarse.project({ gx: 1, gy: 1 }), { x: 40, y: 40 });
  });

  it('throws on non-positive unitSize', () => {
    expect(() => topDownProjection({ unitSize: 0 })).toThrow();
    expect(() => topDownProjection({ unitSize: -10 })).toThrow();
  });

  it('throws on non-finite unitSize', () => {
    expect(() => topDownProjection({ unitSize: NaN })).toThrow();
    expect(() => topDownProjection({ unitSize: Infinity })).toThrow();
  });
});

describe('isoProjection', () => {
  it('produces a true-isometric 30-degree axis angle (not the 26.565-degree dimetric convention)', () => {
    const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    const p = proj.project({ gx: 1, gy: 0 });
    const angleDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
    expect(angleDeg).toBeCloseTo(30, 6);
  });

  it('unproject inverts project within 1e-9 for a non-trivial point', () => {
    const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    const p: GridPoint = { gx: 12.34, gy: -5.6 };
    const round = proj.unproject(proj.project(p));
    expect(Math.abs(round.gx - p.gx)).toBeLessThan(1e-9);
    expect(Math.abs(round.gy - p.gy)).toBeLessThan(1e-9);
  });

  it('throws on degenerate tilt (0 or 90 degrees)', () => {
    expect(() => isoProjection({ unitSize: 40, tilt: 0, rotation: 45 })).toThrow();
    expect(() => isoProjection({ unitSize: 40, tilt: 90, rotation: 45 })).toThrow();
  });
});
