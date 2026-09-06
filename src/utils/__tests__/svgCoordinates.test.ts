import { describe, expect, it } from 'vitest';
import { getGridCellViaView, snapToGrid } from '../svgCoordinates';
import { makeMapView } from '../../components/domain/encounter/geometry/mapView';
import { isoProjection, topDownProjection } from '../../components/domain/encounter/geometry/gridProjection';

describe('getGridCellViaView', () => {
  it('matches snapToGrid for a topDownProjection-backed view (regression parity)', () => {
    const view = makeMapView(topDownProjection({ unitSize: 40 }));
    const expected = snapToGrid(100, 130, 40);
    expect(expected).toEqual({ gridX: 2, gridY: 3 });
    expect(getGridCellViaView(view, 100, 130)).toEqual(expected);
  });

  it('recovers the source grid cell for an isoProjection-backed view', () => {
    const view = makeMapView(isoProjection({ unitSize: 40, tilt: 30, rotation: 45 }));
    const svgP = view.project({ gx: 3, gy: 2 });
    expect(getGridCellViaView(view, svgP.x, svgP.y)).toEqual({ gridX: 3, gridY: 2 });
  });
});
