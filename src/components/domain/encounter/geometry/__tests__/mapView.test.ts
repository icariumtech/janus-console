import { describe, expect, it } from 'vitest';
import { isoProjection, topDownProjection } from '../gridProjection';
import { makeMapView } from '../mapView';
import type { GridRect } from '../../../../../types/encounterMap';

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
});
