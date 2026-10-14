/**
 * mapView — closure facade combining `roomGeometry` (grid space) with a
 * `Projection` (grid → SVG). The renderer holds *one* `MapView` instance
 * per render and asks it for SVG-space positions.
 *
 * INVARIANT 2 (interface): `mapView` is the ONLY producer of SVG coords
 * inside the encounter map render. The renderer never multiplies by
 * `unitSize` directly — it asks the view.
 *
 * Future iso swap: `makeMapView(isoProjection({ unitSize, tilt, rotation }))`
 * produces a different view with no other module affected.
 */
import {
  Door,
  GridRect,
  GridRoom,
  HullDef,
} from '../../../../types/encounterMap';
import { Polygon } from '../../../../utils/polygon2d';
import {
  GridPoint,
  Projection,
  SvgPoint,
} from './gridProjection';
import {
  doorGridPosition,
  GridEdge,
  GridRectArea,
  roomBBoxGrid,
  roomChamferedPolygon,
  roomLabelGrid,
  roomWallEdges,
} from './roomGeometry';

/**
 * The `unitSize` `DoorSymbol`'s local pixel constants (20, 12, 2, ...) were
 * originally tuned against, back when doors were drawn directly in SVG
 * pixel space at the default grid `unitSize` of 40. `doorTransform` divides
 * by this so those constants keep producing the same on-screen size under
 * `topDownProjection({ unitSize: 40 })` while still scaling/foreshortening
 * correctly for any other `unitSize` or `isoProjection`.
 */
const DOOR_REFERENCE_UNIT = 40;

// -------------------------------------------------------------------
// Public types
// -------------------------------------------------------------------

/** A line segment in SVG-pixel coordinates. */
export interface SvgEdge { from: SvgPoint; to: SvgPoint; }

/** SVG-space bounding box (origin + size in pixels). */
export interface SvgBBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Affine transform for rendering a grid-space circle as an SVG shape.
 * Field names match the SVG `matrix(a,b,c,d,e,f)` parameter ORDER exactly
 * (m11=a, m21=b, m12=c, m22=d) — call sites emit
 * `matrix(${t.m11},${t.m21},${t.m12},${t.m22},0,0)` verbatim; do not reorder.
 * Apply to a unit circle at the origin: `translate(cx,cy) matrix(...)`.
 */
export interface CircleTransform {
  cx: number;
  cy: number;
  m11: number;
  m21: number;
  m12: number;
  m22: number;
}

/**
 * Affine transform for rendering a door glyph as a wall-aligned
 * parallelogram. Field names match the SVG `matrix(a,b,c,d,e,f)` parameter
 * ORDER exactly (m11=a, m21=b, m12=c, m22=d), same convention as
 * `CircleTransform` — call sites emit
 * `matrix(${t.m11},${t.m21},${t.m12},${t.m22},${t.cx},${t.cy})` verbatim.
 *
 * Like `CircleTransform`, the basis vectors (m11,m21) and (m12,m22) carry
 * the projection's real magnitude (scaled by `DOOR_REFERENCE_UNIT`, see
 * below) rather than being normalized to a fixed on-screen size — a door
 * foreshortens along with the walls/rooms around it instead of staying a
 * constant pixel size regardless of projection (an earlier version of this
 * transform normalized to unit vectors, which kept doors visually
 * oversized relative to the corridor under isoProjection — see commit
 * fixing door glyph over-sizing under iso). Under `topDownProjection` with
 * the default `unitSize` this reduces to a pure rotation-by-door.angle (or
 * identity for angle 0), byte-identical to the old `x,y` + `rotate()`
 * approach. Under `isoProjection` the two axes are no longer perpendicular
 * (or equal in projected length) after projection, so applying this matrix
 * to a local axis-aligned door shape produces a true, correctly-foreshortened
 * parallelogram — the door equivalent of how `circleTransform` turns a
 * circle into a true ellipse.
 *
 * Apply as `matrix(...)` on a `<g>` wrapping door geometry drawn in local
 * space where local +x is the along-wall axis and local +y is the
 * across-wall axis, centered at local (0,0), using the SAME fixed pixel
 * constants (20, 12, ...) `DoorSymbol` used before this transform existed —
 * those constants were tuned against `DOOR_REFERENCE_UNIT`, not the live
 * `unitSize`.
 */
export interface DoorTransform {
  cx: number;
  cy: number;
  m11: number;
  m21: number;
  m12: number;
  m22: number;
}

/**
 * The renderer-facing facade. Closure-captured projection means there is
 * exactly one source of pixel-scale truth per render pass.
 */
export interface MapView {
  /** SVG-space center of a canonical door. */
  doorPosition(door: Door): SvgPoint;

  /**
   * Affine transform for rendering a door's glyph, wall-aligned and
   * projection-correct. See `DoorTransform` for the coordinate convention.
   */
  doorTransform(door: Door): DoorTransform;

  /**
   * SVG `<polygon points>` string for a rect (no chamfer).
   * Convenience — the same as projecting `roomChamferedPolygon` for a
   * chamfer-0 rect, but skips the polygon allocation.
   */
  roomPolygonPoints(rect: GridRect): string;

  /**
   * SVG `<polygon points>` string for a chamfered (or plain) rect.
   * 4 points if `rect.chamfer === 0` or absent, 8 points otherwise.
   */
  roomChamferedPolygonPoints(rect: GridRect): string;

  /** SVG-space wall edges for a room's `rects[]` (wall-segment algorithm). */
  wallEdges(rects: GridRect[]): SvgEdge[];

  /** SVG-space label position for a room. */
  labelPosition(room: GridRoom): SvgPoint;

  /**
   * SVG-space bounding box of a room collection (with optional hull
   * and grid-cell padding). Pixel sizes are derived by projecting the
   * grid-space bbox corners through `projection.project`.
   */
  bbox(rooms: GridRoom[], hull?: HullDef, padding?: number): SvgBBox;

  /** Pass-through: project a grid point to SVG. */
  project(p: GridPoint): SvgPoint;

  /** Pass-through: unproject an SVG point to grid. */
  unproject(p: SvgPoint): GridPoint;

  /**
   * Affine transform for rendering a grid-space circle of radius `r`
   * centered at grid `(gcx, gcy)` as an SVG shape. For `topDownProjection`
   * this reduces to a pure scale (byte-identical to `r * view.unitSize`).
   * For a non-orthogonal projection (e.g. iso) it produces the matrix that
   * renders the circle as a true ellipse.
   */
  circleTransform(gcx: number, gcy: number, r: number): CircleTransform;

  /**
   * Pixel-scale of one grid cell along an axis. Exposed for door slot
   * dimensions and other "size, not position" pixel computations.
   *
   * Defined as the projected length of the unit grid vector (1, 0).
   * For top-down this equals `unitSize`. For an iso projection this is
   * the projected horizontal cell extent (callers that need vertical
   * cell extent should use `project` directly).
   */
  unitSize: number;
}

// -------------------------------------------------------------------
// makeMapView — closure factory
// -------------------------------------------------------------------

/**
 * Build a `MapView` from a `Projection`. Captures the projection in
 * closure so a single instance can be passed around without rethreading
 * the projection through every call site.
 *
 * Idempotent: calling `makeMapView` twice with the same projection
 * yields functionally equivalent views (no shared mutable state).
 */
export function makeMapView(projection: Projection): MapView {
  // Projected length of the unit grid vector along x.
  const origin = projection.project({ gx: 0, gy: 0 });
  const unitX = projection.project({ gx: 1, gy: 0 });
  const unitSize = Math.hypot(unitX.x - origin.x, unitX.y - origin.y);

  const polygonToPointsString = (poly: Polygon): string => {
    return poly
      .map((p) => {
        const sp = projection.project({ gx: p.x, gy: p.y });
        return `${sp.x},${sp.y}`;
      })
      .join(' ');
  };

  const view: MapView = {
    doorPosition(door: Door): SvgPoint {
      const gp = doorGridPosition(door);
      return projection.project({ gx: gp.gx, gy: gp.gy });
    },

    doorTransform(door: Door): DoorTransform {
      const gp = doorGridPosition(door);
      const rad = (door.angle * Math.PI) / 180;
      // Along-wall and across-wall unit vectors in grid space.
      const alongGrid = { gx: Math.cos(rad), gy: Math.sin(rad) };
      const acrossGrid = { gx: -Math.sin(rad), gy: Math.cos(rad) };

      const center = projection.project({ gx: gp.gx, gy: gp.gy });
      const alongPt = projection.project({ gx: gp.gx + alongGrid.gx, gy: gp.gy + alongGrid.gy });
      const acrossPt = projection.project({ gx: gp.gx + acrossGrid.gx, gy: gp.gy + acrossGrid.gy });

      // Real projected magnitude (÷ DOOR_REFERENCE_UNIT), NOT normalized to
      // a unit vector — see DoorTransform doc comment. A normalized basis
      // would keep the glyph a constant pixel size regardless of
      // projection, which makes it visually oversized under isoProjection
      // (where a grid cell foreshortens to less than `unitSize` on screen)
      // relative to the walls/rooms around it, which DO foreshorten.
      return {
        cx: center.x,
        cy: center.y,
        m11: (alongPt.x - center.x) / DOOR_REFERENCE_UNIT,
        m21: (alongPt.y - center.y) / DOOR_REFERENCE_UNIT,
        m12: (acrossPt.x - center.x) / DOOR_REFERENCE_UNIT,
        m22: (acrossPt.y - center.y) / DOOR_REFERENCE_UNIT,
      };
    },

    roomPolygonPoints(rect: GridRect): string {
      // Plain 4-point rect — no chamfer.
      const x  = projection.project({ gx: rect.x, gy: rect.y });
      const x2 = projection.project({ gx: rect.x + rect.w, gy: rect.y + rect.h });
      const tr = projection.project({ gx: rect.x + rect.w, gy: rect.y });
      const bl = projection.project({ gx: rect.x, gy: rect.y + rect.h });
      return `${x.x},${x.y} ${tr.x},${tr.y} ${x2.x},${x2.y} ${bl.x},${bl.y}`;
    },

    roomChamferedPolygonPoints(rect: GridRect): string {
      const poly = roomChamferedPolygon(rect);
      return polygonToPointsString(poly);
    },

    wallEdges(rects: GridRect[]): SvgEdge[] {
      const gridEdges: GridEdge[] = roomWallEdges(rects);
      return gridEdges.map((e) => ({
        from: projection.project({ gx: e.from.gx, gy: e.from.gy }),
        to:   projection.project({ gx: e.to.gx,   gy: e.to.gy }),
      }));
    },

    labelPosition(room: GridRoom): SvgPoint {
      const g = roomLabelGrid(room);
      return projection.project({ gx: g.gx, gy: g.gy });
    },

    bbox(rooms: GridRoom[], hull?: HullDef, padding = 0): SvgBBox {
      const grid: GridRectArea = roomBBoxGrid(rooms, hull, padding);
      // Project all four corners, not just two opposite ones: a non-orthogonal
      // projection (e.g. isoProjection) can skew the grid rect so that its
      // diagonal corners no longer bound the projected shape — sampling only
      // (gx,gy) and (gx+gw,gy+gh) can under-measure width/height, in the worst
      // case (a+b == 0 for the projection matrix) collapsing it to exactly 0.
      const corners = [
        projection.project({ gx: grid.gx, gy: grid.gy }),
        projection.project({ gx: grid.gx + grid.gw, gy: grid.gy }),
        projection.project({ gx: grid.gx, gy: grid.gy + grid.gh }),
        projection.project({ gx: grid.gx + grid.gw, gy: grid.gy + grid.gh }),
      ];
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const originX = Math.min(...xs);
      const originY = Math.min(...ys);
      const width   = Math.max(...xs) - originX;
      const height  = Math.max(...ys) - originY;
      return { originX, originY, width, height };
    },

    project(p: GridPoint): SvgPoint {
      return projection.project(p);
    },

    unproject(p: SvgPoint): GridPoint {
      return projection.unproject(p);
    },

    circleTransform(gcx: number, gcy: number, r: number): CircleTransform {
      const origin = projection.project({ gx: gcx, gy: gcy });
      const ux = projection.project({ gx: gcx + 1, gy: gcy });
      const uy = projection.project({ gx: gcx, gy: gcy + 1 });
      return {
        cx: origin.x,
        cy: origin.y,
        m11: (ux.x - origin.x) * r,
        m21: (ux.y - origin.y) * r,
        m12: (uy.x - origin.x) * r,
        m22: (uy.y - origin.y) * r,
      };
    },

    unitSize,
  };

  return view;
}
