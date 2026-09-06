/**
 * DetailsLayer — fixed-style SVG rendering of decorative detail linework
 * (consoles, beds, furniture, machinery blocks, hull greebles).
 *
 * Two mount points, both structural (D-12/D-13 — no separate visibility
 * logic lives here):
 *  - `DetailsLayer` renders the always-visible EXTERIOR group, mounted in
 *    `EncounterMapRenderer.tsx` on the hull plate (above the hull, below
 *    rooms) — details with no `room:` reference (DET-03).
 *  - `DetailShape` renders exactly ONE primitive and is dropped by
 *    `RoomsLayer.tsx` inside the room's own reveal `<g>` for INTERIOR
 *    details (entries with a `room:` reference) — it inherits the room's
 *    CRT flicker cascade and GM dimming automatically because it is a
 *    child of that group, not because of anything in this file.
 *
 * Fixed renderer style (D-10): thin stroke, dimmer teal, no per-detail
 * styling fields exist in the authored YAML. `filled: true` (D-11) is the
 * only appearance flag — it only applies to closed shapes (a `closed`
 * polyline or a circle); an open polyline is always unfilled.
 *
 * Never intercepts pointer events — detail linework is decoration, never
 * an interactive target (`pointerEvents="none"` on every variant).
 */
import { DetailEntry } from '../../../../types/encounterMap';
import { MapView } from '../geometry/mapView';
import { COLORS, DETAIL_FILL_OPACITY, DETAIL_STROKE_WIDTH } from './mapColors';

interface DetailShapeProps {
  detail: DetailEntry;
  view: MapView;
}

/** Renders exactly one detail primitive (polyline/polygon or circle). */
export function DetailShape({ detail, view }: DetailShapeProps) {
  const isClosedShape = Boolean(detail.closed) || Boolean(detail.circle);
  const fill = detail.filled && isClosedShape ? COLORS.detail : 'none';
  const fillOpacity = detail.filled && isClosedShape ? DETAIL_FILL_OPACITY : undefined;

  if (detail.circle) {
    const t = view.circleTransform(detail.circle.cx, detail.circle.cy, detail.circle.r);
    return (
      <circle
        cx={0}
        cy={0}
        r={1}
        transform={`translate(${t.cx},${t.cy}) matrix(${t.m11},${t.m21},${t.m12},${t.m22},0,0)`}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={COLORS.detail}
        strokeWidth={DETAIL_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
        className="encounter-map__detail"
      />
    );
  }

  if (detail.points && detail.points.length >= 2) {
    const pts = detail.points
      .map(([gx, gy]) => {
        const p = view.project({ gx, gy });
        return `${p.x},${p.y}`;
      })
      .join(' ');

    if (detail.closed) {
      return (
        <polygon
          points={pts}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={COLORS.detail}
          strokeWidth={DETAIL_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
          className="encounter-map__detail"
        />
      );
    }

    return (
      <polyline
        points={pts}
        fill="none"
        stroke={COLORS.detail}
        strokeWidth={DETAIL_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
        className="encounter-map__detail"
      />
    );
  }

  return null;
}

interface DetailsLayerProps {
  details: DetailEntry[];
  view: MapView;
}

/** Always-visible exterior detail group — mounted on the hull plate. */
export function DetailsLayer({ details, view }: DetailsLayerProps) {
  if (!details || details.length === 0) return null;
  return (
    <g className="encounter-map__details">
      {details.map((detail, index) => (
        <DetailShape key={detail.id ?? `detail-${index}`} detail={detail} view={view} />
      ))}
    </g>
  );
}
