/**
 * DoorSymbol - Pure SVG door symbol (frame, halves, damaged/locked/sealed
 * overlays, type indicators). Extracted from EncounterMapRenderer's
 * renderDoorSymbol() — a pure function of its props, no closures over
 * component state.
 *
 * All geometry is drawn in a local coordinate frame centered at (0,0) where
 * local +x is always the door's along-wall axis (the "long" dimension) and
 * local +y is always the across-wall axis (the "short" dimension). The
 * enclosing `<g>` applies `transform.matrix` (see `MapView.doorTransform`)
 * to place and orient that local frame in SVG space — under
 * `topDownProjection` this is a pure rotation, under `isoProjection` the two
 * local axes are no longer perpendicular once projected, producing a true
 * wall-aligned parallelogram instead of a rotated rectangle.
 */
import { COLORS } from './mapColors';
import { DoorTransform } from '../geometry/mapView';

interface DoorSymbolProps {
  doorType: string;
  doorStatus: string | undefined;
  style: { stroke: string; doorFill: string };
  transform: DoorTransform;
  onContextMenuHandler?: (e: React.MouseEvent) => void;
  widthCells?: number;
  onClickHandler?: (e: React.MouseEvent) => void;
}

export function DoorSymbol({
  doorType,
  doorStatus,
  style,
  transform,
  onContextMenuHandler,
  widthCells = 1,
  onClickHandler,
}: DoorSymbolProps) {
  // Local-space dimensions, tuned against DOOR_REFERENCE_UNIT (see
  // MapView.doorTransform) — `transform` scales/foreshortens these to real
  // screen pixels, so they are NOT raw SVG pixels themselves.
  const doorLength = 20 * widthCells; // along-wall (local x)
  // Across-wall thickness is intentionally smaller than a naive "0.3 cell"
  // ratio: under isoProjection the along/across axes project to well under
  // 90° apart (e.g. 120° at the default tilt/rotation), so a thin
  // rectangle's axis-aligned bounding box balloons along the diagonal even
  // though its true projected area shrinks correctly. Trimming this keeps
  // the glyph visually proportionate under iso without touching the
  // along-wall length (which must stay flush with the door's actual width).
  const doorThickness = 8;            // across-wall (local y)
  const isOpen = doorStatus === 'OPEN';
  const isDamaged = doorStatus === 'DAMAGED';
  const isLocked = doorStatus === 'LOCKED';
  const isSealed = doorStatus === 'SEALED';

  const statusClass = doorStatus ? `encounter-map__door--${doorStatus.toLowerCase()}` : '';

  const splitOffset = doorLength * 0.55;
  const openTransformLeft = `translateX(-${splitOffset}px)`;
  const openTransformRight = `translateX(${splitOffset}px)`;

  const doorFill = isDamaged ? COLORS.hazard : style.doorFill;
  const doorStroke = isLocked ? COLORS.amber : isSealed ? COLORS.hazard : COLORS.borderMain;
  const doorStrokeWidth = isLocked ? 2 : isSealed ? 2.5 : 1.5;

  const t = transform;

  return (
    <g
      className={`encounter-map__door encounter-map__door--${doorType} ${statusClass}`}
      onContextMenu={onContextMenuHandler}
      onClick={onClickHandler}
      transform={`matrix(${t.m11},${t.m21},${t.m12},${t.m22},${t.cx},${t.cy})`}
      style={{ cursor: onClickHandler ? 'pointer' : onContextMenuHandler ? 'context-menu' : 'default' }}
    >
      {/* Opaque background to cover wall lines behind door */}
      <rect
        x={-doorLength / 2 + 1}
        y={-doorThickness / 2 + 1}
        width={doorLength - 2}
        height={doorThickness - 2}
        fill={COLORS.bgPrimary}
        stroke="none"
      />
      {/* Door frame/gap indicator - always present, visible when open */}
      <rect
        x={-doorLength / 2}
        y={-doorThickness / 2}
        width={doorLength}
        height={doorThickness}
        fill={COLORS.bgPrimary}
        stroke={COLORS.borderSubtle}
        strokeWidth={1}
        strokeDasharray="2 2"
        className="encounter-map__door-frame"
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* First door half */}
      <rect
        x={-doorLength / 2}
        y={-doorThickness / 2}
        width={doorLength / 2}
        height={doorThickness}
        fill={doorFill}
        stroke={doorStroke}
        strokeWidth={doorStrokeWidth}
        className="encounter-map__door-half encounter-map__door-half--left"
        style={{
          transform: isOpen ? openTransformLeft : 'translate(0, 0)',
        }}
      />

      {/* Second door half */}
      <rect
        x={0}
        y={-doorThickness / 2}
        width={doorLength / 2}
        height={doorThickness}
        fill={doorFill}
        stroke={doorStroke}
        strokeWidth={doorStrokeWidth}
        className="encounter-map__door-half encounter-map__door-half--right"
        style={{
          transform: isOpen ? openTransformRight : 'translate(0, 0)',
        }}
      />

      {/* DAMAGED: Crack lines overlay */}
      {isDamaged && !isOpen && (
        <g className="encounter-map__door-damage">
          <path
            d={`M${-doorLength / 2 + 2},${-doorThickness / 2 + 2}
                 L${-2},${0}
                 L${doorLength / 2 - 2},${doorThickness / 2 - 2}`}
            fill="none"
            stroke={COLORS.bgPrimary}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M${3},${-doorThickness / 2 + 1} L${1},${-2}`}
            fill="none"
            stroke={COLORS.bgPrimary}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle
            cx={-2}
            cy={0}
            r={1.5}
            fill={COLORS.amber}
            className="encounter-map__door-spark"
          />
        </g>
      )}

      {/* LOCKED: Lock indicator */}
      {isLocked && !isOpen && (
        <g className="encounter-map__door-lock">
          <rect
            x={-4}
            y={-5}
            width={8}
            height={10}
            fill={doorFill}
            stroke="none"
          />
          <circle
            cx={0}
            cy={-2}
            r={2.5}
            fill={COLORS.bgPrimary}
            stroke={COLORS.amber}
            strokeWidth={1}
          />
          <rect
            x={-1.5}
            y={0}
            width={3}
            height={4}
            fill={COLORS.bgPrimary}
            stroke={COLORS.amber}
            strokeWidth={1}
          />
        </g>
      )}

      {/* SEALED: Heavy duty indicator */}
      {isSealed && !isOpen && (
        <g className="encounter-map__door-seal">
          <rect
            x={-doorLength / 2 + 3}
            y={-doorThickness / 2 + 3}
            width={doorLength - 6}
            height={doorThickness - 6}
            fill="none"
            stroke={COLORS.hazard}
            strokeWidth={1}
          />
          <line
            x1={-doorLength / 2 + 2}
            y1={0}
            x2={doorLength / 2 - 2}
            y2={0}
            stroke={COLORS.bgPrimary}
            strokeWidth={2}
          />
        </g>
      )}

      {/* Door type indicators (only for non-open doors) */}
      {!isOpen && (
        <>
          {/* Airlock double rectangle */}
          {doorType === 'airlock' && !isLocked && !isSealed && (
            <rect
              x={-doorLength / 2 + 2}
              y={-doorThickness / 2 + 2}
              width={doorLength - 4}
              height={doorThickness - 4}
              fill="none"
              stroke={COLORS.bgPrimary}
              strokeWidth={1}
            />
          )}
          {/* Blast door X */}
          {doorType === 'blast_door' && !isLocked && !isSealed && !isDamaged && (
            <>
              <line
                x1={-doorLength / 2 + 2}
                y1={-doorThickness / 2 + 2}
                x2={doorLength / 2 - 2}
                y2={doorThickness / 2 - 2}
                stroke={COLORS.bgPrimary}
                strokeWidth={1}
              />
              <line
                x1={doorLength / 2 - 2}
                y1={-doorThickness / 2 + 2}
                x2={-doorLength / 2 + 2}
                y2={doorThickness / 2 - 2}
                stroke={COLORS.bgPrimary}
                strokeWidth={1}
              />
            </>
          )}
        </>
      )}
    </g>
  );
}
