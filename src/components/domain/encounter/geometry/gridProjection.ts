/**
 * gridProjection — coordinate transform between grid space and SVG space.
 *
 * INVARIANT: this module must NOT import from `src/types/encounterMap.ts`
 * (or any other domain module). Like `polygon2d`, it stays domain-free so
 * tokens, hulls, POIs, terminals — anything anchored to a grid coordinate —
 * can reuse it without coupling.
 *
 * `Projection` is the seam. `topDownProjection({ unitSize, rotation? })` and
 * `isoProjection({ unitSize, tilt, rotation })` both implement it, so the view
 * can switch or rotate without breaking any caller. The renderer asks the projection for
 * SVG coordinates; the projection is the ONLY producer of SVG-space numbers
 * (interface invariant 2 of the four-module geometry stack).
 */

// ---- Coordinate spaces -------------------------------------------

/** A point in grid space. `gx` / `gy` are fractional cell coordinates. */
export interface GridPoint {
  gx: number;
  gy: number;
}

/** A point in SVG (pixel) space, the renderer's output coordinate frame. */
export interface SvgPoint {
  x: number;
  y: number;
}

// ---- Projection interface ----------------------------------------

/**
 * Bidirectional transform between grid space and SVG space.
 *
 * `unproject(project(p))` is identity within floating-point epsilon for any
 * `GridPoint`; the inverse round-trip is also identity for `SvgPoint`.
 */
export interface Projection {
  /** Map a grid coordinate to an SVG-space point (in pixels). */
  project(p: GridPoint): SvgPoint;
  /** Map an SVG-space point back to grid coordinates. */
  unproject(p: SvgPoint): GridPoint;
}

// ---- topDownProjection -------------------------------------------

/** Options for the top-down projection. */
export interface TopDownProjectionOptions {
  /** Pixels per grid cell. Must be > 0. */
  unitSize: number;
  /**
   * Grid azimuth in degrees (default 0). Positive turns the grid clockwise on
   * screen: at 90, grid +x maps to screen +y and grid +y maps to screen -x.
   * Exact at multiples of 90 (no trig rounding noise).
   */
  rotation?: number;
}

/** Exact cosine/sine for the four quarter turns; Math.cos/Math.sin otherwise. */
function cosSin(rotationDeg: number): { cos: number; sin: number } {
  const q = ((rotationDeg % 360) + 360) % 360;
  switch (q) {
    case 0:
      return { cos: 1, sin: 0 };
    case 90:
      return { cos: 0, sin: 1 };
    case 180:
      return { cos: -1, sin: 0 };
    case 270:
      return { cos: 0, sin: -1 };
    default: {
      const r = (q * Math.PI) / 180;
      return { cos: Math.cos(r), sin: Math.sin(r) };
    }
  }
}

/**
 * Build a top-down (orthographic) projection where one grid cell maps to
 * `unitSize` pixels along each axis. Origin is preserved: grid (0,0) maps
 * to SVG (0, 0). An optional `rotation` turns the grid clockwise on screen
 * about that origin; rotation 0 (or omitted) is the plain scale.
 *
 * @example
 *   const proj = topDownProjection({ unitSize: 40 });
 *   proj.project({ gx: 1.5, gy: 2 });   // → { x: 60, y: 80 }
 *   proj.unproject({ x: 60, y: 80 });   // → { gx: 1.5, gy: 2 }
 *
 * @example rotated 90 degrees clockwise
 *   const proj = topDownProjection({ unitSize: 40, rotation: 90 });
 *   proj.project({ gx: 1, gy: 0 });     // → { x: 0, y: 40 }
 *
 * @example iso swap (same shape, every other module is unaffected)
 *   const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
 *   const view = makeMapView(proj);
 */
export function topDownProjection(opts: TopDownProjectionOptions): Projection {
  const us = opts.unitSize;
  if (!(us > 0) || !Number.isFinite(us)) {
    throw new Error(`topDownProjection: unitSize must be a positive finite number, got ${us}`);
  }
  const { cos, sin } = cosSin(opts.rotation ?? 0);
  // `+ 0` turns a negative zero into a positive zero.
  return {
    project({ gx, gy }) {
      return { x: us * (cos * gx - sin * gy) + 0, y: us * (sin * gx + cos * gy) + 0 };
    },
    unproject({ x, y }) {
      return { gx: (cos * x + sin * y) / us + 0, gy: (-sin * x + cos * y) / us + 0 };
    },
  };
}

// ---- isoProjection -------------------------------------------------

/** Options for the true-isometric projection (degrees, not radians). */
export interface IsoProjectionOptions {
  /** Pixels per grid cell (pre-foreshortening scale). Must be > 0. */
  unitSize: number;
  /** Foreshortening angle from horizontal, in degrees. Must be in (0, 90). */
  tilt: number;
  /** Rotation of the grid axes in the SVG plane, in degrees. */
  rotation: number;
}

/**
 * Build a true-isometric projection: both grid axes are foreshortened by
 * `tilt` degrees from horizontal (unlike the 26.565-degree "2:1" dimetric
 * convention common in pixel-art games) and rotated by `rotation` degrees.
 *
 * @example
 *   const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });
 */
export function isoProjection(opts: IsoProjectionOptions): Projection {
  const us = opts.unitSize;
  const tilt = opts.tilt;
  if (!(us > 0) || !Number.isFinite(us)) {
    throw new Error(`isoProjection: unitSize must be a positive finite number, got ${us}`);
  }
  if (!(tilt > 0 && tilt < 90) || !Number.isFinite(tilt)) {
    throw new Error(`isoProjection: tilt must be a finite number strictly between 0 and 90, got ${tilt}`);
  }

  const t = (tilt * Math.PI) / 180;
  const r = (opts.rotation * Math.PI) / 180;

  const a = us * Math.cos(t) * Math.cos(r);
  const b = -us * Math.cos(t) * Math.sin(r);
  const c = us * Math.sin(t) * Math.sin(r);
  const d = us * Math.sin(t) * Math.cos(r);
  const det = a * d - b * c;

  return {
    project({ gx, gy }) {
      return { x: a * gx + b * gy, y: c * gx + d * gy };
    },
    unproject({ x, y }) {
      return { gx: (d * x - b * y) / det, gy: (-c * x + a * y) / det };
    },
  };
}
