import { describe, expect, it } from 'vitest';
import { getGridCellViaView, inverseRotatePoint, rotatePoint, snapToGrid } from '../svgCoordinates';
import { makeMapView } from '../../components/domain/encounter/geometry/mapView';
import { isoProjection, topDownProjection } from '../../components/domain/encounter/geometry/gridProjection';
import {
  buildProjection,
  screenRotationFor,
  type RotationOffset,
  type ViewProjection,
} from '../../components/domain/encounter/geometry/viewOrientation';

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

describe('pointer-to-cell pipeline across projection x offset x authored rotation (D-09)', () => {
  const CENTRE = { x: 123.4, y: -56.7 };
  const CELLS = [
    { gx: 0, gy: 0 },
    { gx: 3, gy: 2 },
    { gx: -2, gy: 5 },
    { gx: 7, gy: -4 },
  ];
  const FRACTIONS = [
    { fx: 0.5, fy: 0.5 },
    { fx: 0.1, fy: 0.9 },
  ];

  type Combo = [ViewProjection, RotationOffset, number];
  const combos: Combo[] = [];
  for (const projection of ['top-down', 'iso'] as ViewProjection[]) {
    for (const offset of [0, 90, 180, 270] as RotationOffset[]) {
      for (const authored of [0, 90]) combos.push([projection, offset, authored]);
    }
  }

  it.each(combos)('%s offset %i authored %i resolves every drawn cell', (projection, offset, authored) => {
    const view = makeMapView(buildProjection(projection, offset, 40, authored));
    const screenRot = screenRotationFor(projection, authored);
    for (const cell of CELLS) {
      for (const { fx, fy } of FRACTIONS) {
        const drawn = view.project({ gx: cell.gx + fx, gy: cell.gy + fy });
        const onScreen = rotatePoint(drawn.x, drawn.y, screenRot, CENTRE.x, CENTRE.y);
        const unrotated = inverseRotatePoint(onScreen.x, onScreen.y, screenRot, CENTRE.x, CENTRE.y);
        expect(getGridCellViaView(view, unrotated.x, unrotated.y)).toEqual({ gridX: cell.gx, gridY: cell.gy });
      }
    }
  });
});
