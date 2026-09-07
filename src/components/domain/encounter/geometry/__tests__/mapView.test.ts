import { describe, expect, it } from 'vitest';
import { isoProjection, topDownProjection } from '../gridProjection';
import { makeMapView } from '../mapView';
import type { GridRect, GridRoom } from '../../../../../types/encounterMap';

const ISO_EPS = 1e-9;

describe('makeMapView + isoProjection wiring', () => {
  const isoOpts = { unitSize: 40, tilt: 30, rotation: 45 };
  const rect: GridRect = { x: 0, y: 0, w: 2, h: 1 };

  it('roomPolygonPoints matches direct isoProjection.project() calls on the rect corners', () => {
    const proj = isoProjection(isoOpts);
    const view = makeMapView(proj);

    const tl = proj.project({ gx: rect.x, gy: rect.y });
    const tr = proj.project({ gx: rect.x + rect.w, gy: rect.y });
    const br = proj.project({ gx: rect.x + rect.w, gy: rect.y + rect.h });
    const bl = proj.project({ gx: rect.x, gy: rect.y + rect.h });
    const expected = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

    expect(view.roomPolygonPoints(rect)).toBe(expected);
  });

  it('wallEdges endpoints match direct isoProjection.project() calls on the grid edge endpoints', () => {
    const proj = isoProjection(isoOpts);
    const view = makeMapView(proj);

    const edges = view.wallEdges([rect]);
    expect(edges.length).toBeGreaterThan(0);

    for (const edge of edges) {
      // Each SVG-space edge endpoint must be reproducible by unprojecting
      // back to grid space and re-projecting directly through isoProjection.
      const fromGrid = proj.unproject(edge.from);
      const toGrid = proj.unproject(edge.to);
      const fromDirect = proj.project(fromGrid);
      const toDirect = proj.project(toGrid);
      expect(Math.abs(edge.from.x - fromDirect.x)).toBeLessThan(ISO_EPS);
      expect(Math.abs(edge.from.y - fromDirect.y)).toBeLessThan(ISO_EPS);
      expect(Math.abs(edge.to.x - toDirect.x)).toBeLessThan(ISO_EPS);
      expect(Math.abs(edge.to.y - toDirect.y)).toBeLessThan(ISO_EPS);
    }
  });

  it('unitSize is the projected horizontal cell extent, not the raw unitSize', () => {
    const proj = isoProjection(isoOpts);
    const view = makeMapView(proj);
    expect(view.unitSize).toBeCloseTo(Math.hypot(24.4949, 14.1421), 3);
    expect(view.unitSize).not.toBeCloseTo(40, 3);
  });

  it('top-down projection unitSize is unaffected (regression guard)', () => {
    const view = makeMapView(topDownProjection({ unitSize: 40 }));
    expect(view.unitSize).toBe(40);
  });

  it('bbox() does not collapse to near-zero width for a square grid under isoProjection (CR-01 regression)', () => {
    // The default iso config (tilt: 30, rotation: 45) makes the projection
    // matrix's a+b coefficients sum to ~0 (floating-point noise, ~1.4e-14),
    // so a two-corner bbox sample (top-left/bottom-right only) computes a
    // width on the order of 1e-14 for any square grid bounding box — visually
    // zero once it reaches an SVG viewBox. Sampling all four corners fixes
    // this; the correct width for this 4x4 grid box is ~196px, not ~0.
    const proj = isoProjection(isoOpts);
    const view = makeMapView(proj);
    const squareRoom: GridRoom = {
      id: 'square-room',
      name: 'Square Room',
      rects: [{ x: 0, y: 0, w: 4, h: 4 }],
    };

    const box = view.bbox([squareRoom]);

    expect(box.width).toBeGreaterThan(1);
    expect(box.height).toBeGreaterThan(1);
    expect(box.width).toBeCloseTo(195.959, 2);
    expect(box.height).toBeCloseTo(113.137, 2);
  });
});

describe('MapView.circleTransform', () => {
  it('reduces to a pure scale for topDownProjection, byte-identical to the r * unitSize approach', () => {
    const view = makeMapView(topDownProjection({ unitSize: 40 }));
    const t = view.circleTransform(2, 3, 1);
    expect(t).toEqual({ cx: 80, cy: 120, m11: 40, m21: 0, m12: 0, m22: 40 });
  });

  it('applies correctly under isoProjection: transformed local axis points match view.project() of the corresponding grid points', () => {
    const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
    const view = makeMapView(proj);
    const gcx = 3;
    const gcy = 2;
    const r = 1.5;
    const t = view.circleTransform(gcx, gcy, r);

    const expectedX = view.project({ gx: gcx + r, gy: gcy });
    const px = t.cx + t.m11;
    const py = t.cy + t.m21;
    expect(Math.abs(px - expectedX.x)).toBeLessThan(1e-9);
    expect(Math.abs(py - expectedX.y)).toBeLessThan(1e-9);

    const expectedY = view.project({ gx: gcx, gy: gcy + r });
    const qx = t.cx + t.m12;
    const qy = t.cy + t.m22;
    expect(Math.abs(qx - expectedY.x)).toBeLessThan(1e-9);
    expect(Math.abs(qy - expectedY.y)).toBeLessThan(1e-9);
  });
});
