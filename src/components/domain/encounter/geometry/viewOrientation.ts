/**
 * viewOrientation — the shared GM-controlled view state for the encounter map.
 *
 * The GM broadcasts a projection ('top-down' | 'iso') and a clockwise grid
 * rotation offset (0 | 90 | 180 | 270). Every view value enters the client
 * through `toViewOrientation` / `normalizeRotationOffset` (closed enums, never
 * throw), so a stale or corrupt SSE payload cannot reach trig or SVG attributes.
 *
 * COMPOSITION RULE (D-07 / D-15), enforced by `buildProjection` and
 * `screenRotationFor`:
 *  - top-down: the GM offset is a grid-space rotation inside the projection;
 *    the deck's authored YAML rotation stays an outer SCREEN rotation. The two
 *    commute, so the result equals one rotation by authored + offset.
 *  - iso: the authored rotation and the GM offset both live in the grid
 *    azimuth (45 + offset + authored), so floors keep true 30-degree axes.
 *    There is no residual screen rotation (a screen rotation would turn the
 *    30-degree axes into 60-degree axes).
 *
 * INVARIANT: imports only from './gridProjection'.
 */
import { isoProjection, topDownProjection, type Projection } from './gridProjection';

export type ViewProjection = 'top-down' | 'iso';
export type RotationOffset = 0 | 90 | 180 | 270;
export type RotateDelta = 90 | -90;

export interface ViewOrientation {
  projection: ViewProjection;
  rotationOffset: RotationOffset;
}

/** Orientation used before any broadcast value arrives (matches the server default). */
export const DEFAULT_VIEW_ORIENTATION: ViewOrientation = {
  projection: 'top-down',
  rotationOffset: 0,
};

/**
 * Who controls the view and which buttons the renderer shows.
 * - readonly: mirrors the broadcast; no buttons.
 * - broadcast: shows a button only for each callback supplied.
 * - local: keeps private renderer state and never calls the server (D-04).
 */
export type ViewControl =
  | { mode: 'readonly' }
  | {
      mode: 'broadcast';
      onProjectionChange?: (p: ViewProjection) => void;
      onRotate?: (delta: RotateDelta) => void;
    }
  | { mode: 'local' };

/** 'iso' only for the exact string 'iso'; anything else is top-down. */
export function normalizeProjection(value: unknown): ViewProjection {
  return value === 'iso' ? 'iso' : 'top-down';
}

/** Accepts only the numbers 0, 90, 180, 270; anything else is 0. Never throws. */
export function normalizeRotationOffset(value: unknown): RotationOffset {
  return value === 0 || value === 90 || value === 180 || value === 270 ? value : 0;
}

/** Coerce raw payload values into a valid ViewOrientation. Never throws. */
export function toViewOrientation(projection: unknown, rotationOffset: unknown): ViewOrientation {
  return {
    projection: normalizeProjection(projection),
    rotationOffset: normalizeRotationOffset(rotationOffset),
  };
}

/** Apply a relative +/-90 step, wrapping modulo 360. */
export function stepRotationOffset(offset: RotationOffset, delta: RotateDelta): RotationOffset {
  return ((((offset + delta) % 360) + 360) % 360) as RotationOffset;
}

/**
 * Build the grid-to-SVG projection for a view orientation.
 *
 * @param authoredRotation - the deck's YAML rotation. Folded into the grid
 *   azimuth under iso (D-15); ignored under top-down, where the renderer's
 *   screen rotate (see `screenRotationFor`) owns it.
 */
export function buildProjection(
  projection: ViewProjection,
  rotationOffset: RotationOffset,
  unitSize: number,
  authoredRotation = 0,
): Projection {
  if (projection === 'iso') {
    return isoProjection({
      unitSize,
      tilt: 30,
      rotation: 45 + rotationOffset + authoredRotation,
    });
  }
  return topDownProjection({ unitSize, rotation: rotationOffset });
}

/** Residual SCREEN-space rotation the renderer must still apply (and undo when hit-testing). */
export function screenRotationFor(projection: ViewProjection, authoredRotation: number): number {
  return projection === 'iso' ? 0 : authoredRotation;
}
