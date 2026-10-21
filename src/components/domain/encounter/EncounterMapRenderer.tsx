/**
 * EncounterMapRenderer - SVG renderer for grid-based encounter maps
 *
 * Renders GridEncounterMapData: rooms as touching wall-aligned rectangles,
 * wall-segment algorithm for exterior walls, scanline floor texture,
 * faint background grid, and GM right-click context menu for room visibility.
 *
 * Orchestrates the layer components in ./renderer/ (RoomsLayer, DoorsLayer,
 * PoiLayer, DoorSymbol, PoiInfoPopup, VentTogglePopup) — this file owns
 * shared state (pan/zoom, popovers, projection/view), the top-level SVG
 * structure, and the handlers those layers need.
 */

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { usePanZoom } from '../../../hooks/usePanZoom';
import { useExclusivePopover } from '../../../hooks/useExclusivePopover';
import { useTokenPlacement } from '../../../hooks/useTokenPlacement';
import { screenToSVG, inverseRotatePoint, getGridCellViaView } from '../../../utils/svgCoordinates';
import {
  Door,
  GridEncounterMapData,
  GridRoom,
  DoorStatus,
  DoorStatusState,
  HullDef,
  PoiData,
  RoomVisibilityState,
  TokenState,
  TokenStatus,
  TokenType,
} from '../../../types/encounterMap';
import { pointInPolygon } from '../../../utils/polygon2d';
import { ENCOUNTER_ICONS, iconSymbolId } from './EncounterIcons';
import { LegendPanel } from './LegendPanel';
import { LevelIndicator } from './LevelIndicator';
import { TokenLayer } from './TokenLayer';
import { TokenPopup } from './TokenPopup';
import { RoomContextMenu } from './RoomContextMenu';
import { DoorStatusPopup } from '../../gm/DoorStatusPopup';
import {
  buildProjection,
  screenRotationFor,
  stepRotationOffset,
  DEFAULT_VIEW_ORIENTATION,
  type ViewOrientation,
  type ViewControl,
  type ViewProjection,
  type RotateDelta,
} from './geometry/viewOrientation';
import { makeMapView } from './geometry/mapView';
import { normalizeDoor, normalizeDoors } from './doors/doorNormalizer';
import { hullPathD, mergeHulls } from './hull/hullNormalizer';
import { partitionDetails } from './details/detailNormalizer';
import { useRoomRevealAnimations } from './animation/useRoomRevealAnimations';
import { useOrientationTransition } from './useOrientationTransition';
import { buildViewKey, shouldClosePopover } from './viewTransition';
import { COLORS } from './renderer/mapColors';
import { RoomsLayer } from './renderer/RoomsLayer';
import { DetailsLayer } from './renderer/DetailsLayer';
import { DoorsLayer } from './renderer/DoorsLayer';
import { PoiLayer } from './renderer/PoiLayer';
import { PoiInfoPopup } from './renderer/PoiInfoPopup';
import { VentTogglePopup } from './renderer/VentTogglePopup';
import './EncounterMapRenderer.css';

interface EncounterMapRendererProps {
  mapData: GridEncounterMapData;
  roomVisibility?: RoomVisibilityState;
  /** Current deck level (1-indexed) for multi-deck maps */
  currentLevel?: number;
  /** Total number of decks */
  totalLevels?: number;
  /** Current deck name */
  deckName?: string;
  /** Token state */
  tokens?: TokenState;
  /** Is this a GM view? */
  isGM?: boolean;
  /** Callback when GM toggles room visibility */
  onRoomToggle?: (roomId: string, visible: boolean) => void;
  /** Callback when any user clicks (taps) a room — used by editor preview for click-to-jump */
  onRoomClick?: (roomId: string) => void;
  /** Door status overrides from GM */
  doorStatus?: DoorStatusState;
  /** Callback when GM changes door status */
  onDoorStatusChange?: (doorId: string, status: DoorStatus) => void;
  /** Callback when any user left-clicks a door — used by editor preview for click-to-jump */
  onDoorClick?: (doorId: string) => void;
  /** Token callbacks */
  onTokenPlace?: (type: TokenType, name: string, x: number, y: number, imageUrl: string, roomId: string) => void;
  onTokenMove?: (id: string, x: number, y: number, roomId: string) => void;
  onTokenRemove?: (id: string) => void;
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
  /** The shared location/manifest hull silhouette — renders on EVERY deck.
   *  `mapData.hull` carries this deck's own additional geometry (pods,
   *  nacelles, detached modules); neither replaces the other — both render
   *  additively (D-02). For multi-deck maps, pass the manifest hull here so
   *  every deck shows the same base silhouette regardless of active level. */
  hull?: HullDef;
  /** Optional style override for the root container div (e.g. position:absolute when embedded in MapPreview) */
  style?: React.CSSProperties;
  /** Extra grid-cell padding around map in the SVG viewBox — increases effective "zoom out" at default zoom:1 */
  viewPadding?: number;
  /** Whether to show the legend panel (default true) */
  showLegend?: boolean;
  /** Whether vents are visible to players */
  ventsVisible?: boolean;
  /** Callback when GM right-clicks a vent to toggle all vents */
  onVentsToggle?: (visible: boolean) => void;
  /** The broadcast view (projection + rotation offset). Used in 'readonly' and
   *  'broadcast' control modes; ignored in 'local' mode. Defaults to top-down / 0. */
  viewOrientation?: ViewOrientation;
  /** Who controls the view. Defaults to read-only with no buttons ('readonly').
   *  'broadcast' shows a button per supplied callback; 'local' owns private state
   *  (opens top-down / offset 0) and never calls the server (D-04). */
  viewControl?: ViewControl;
  /** Identity of the encounter location. A location change together with an
   *  orientation change is always an instant cut (D-08). */
  locationKey?: string;
  // ----------------------------------------------------------------
  // Editor-mode props (Plan 29-03) — all four are inert unless `editable` is true.
  // Wiring these callbacks to Monaco edits is Plan 29-04.
  // ----------------------------------------------------------------
  /** Enable editor-mode POI interactions (click-to-select, drag-to-move, empty-cell-click). */
  editable?: boolean;
  /** Called when the user clicks a POI in editor mode (no drag occurred). */
  onPoiClick?: (poiId: string) => void;
  /** Called when the user drags a POI in editor mode; (gridX, gridY) are the snapped drop cell. */
  onPoiMove?: (poiId: string, x: number, y: number) => void;
  /** Called when the user clicks an empty grid cell (no room/POI hit) in editor mode. */
  onEmptyCellClick?: (x: number, y: number) => void;
}

// -------------------------------------------------------------------
// All inline geometry helpers were removed in plan 21-03. They now live in:
//   - polygon2d (pointInPolygon, polygonAreaCentroid, octagonFromRect, etc.)
//   - geometry/roomGeometry (roomLabelGrid, roomWallEdges, doorEndpoints, etc.)
//   - geometry/mapView (the renderer's seam — SVG-space queries)
//   - doors/doorNormalizer (legacy → canonical Door conversion)
// Room/door/POI rendering itself lives in ./renderer/ (RoomsLayer, DoorsLayer,
// DoorSymbol, PoiLayer, PoiInfoPopup, VentTogglePopup) as of the Tier-2
// decomposition — see that directory for the render logic this file used to
// contain inline.
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Exclusive popover discriminated union — one open slot at a time.
// Defined here (renderer module scope) so the hook stays generic.
// -------------------------------------------------------------------
type EncounterPopover =
  | { type: 'token'; payload: { id: string; pos: { x: number; y: number } } }
  | { type: 'door';  payload: { id: string; x: number; y: number; status: DoorStatus } }
  | { type: 'poi';   payload: { poi: PoiData; x: number; y: number } }
  | { type: 'room';  payload: { room: GridRoom; x: number; y: number; gridX?: number; gridY?: number } }
  | { type: 'vent';  payload: { x: number; y: number; currentlyVisible: boolean } }

// Default control mode: mirrors the broadcast view, renders no view buttons (D-03, D-14).
const READONLY_VIEW_CONTROL: ViewControl = { mode: 'readonly' };

// Rotate glyphs. If either fails the human glyph check (shows as a box in the
// GM's Cascadia Code stack), switch these to the pre-declared text fallback
// 'CCW' / 'CW' (UI-SPEC glyph backstop).
const ROTATE_CCW_LABEL = '⟲';
const ROTATE_CW_LABEL = '⟳';

// Shared overlay button style (UI-SPEC touch row): RESET VIEW and the projection
// button use this directly; per-button overrides are only `color` and, for the
// projection button, `border`. The two rotate glyph buttons build on it via
// ROTATE_BUTTON_STYLE below. No hover style and no outline override.
const OVERLAY_BUTTON_STYLE: React.CSSProperties = {
  pointerEvents: 'auto',
  background: 'rgba(15, 21, 21, 0.95)',
  border: '1px solid #4a6b6b',
  fontFamily: "'Cascadia Code', 'Courier New', monospace",
  fontSize: '11px',
  letterSpacing: '2px',
  padding: '8px 16px',
  minWidth: '44px',
  minHeight: '44px',
  cursor: 'pointer',
};

// G-34-5: the rotate glyph buttons read larger than the 11px text labels. Only
// size and padding differ from OVERLAY_BUTTON_STYLE: no tracking on a single
// centered glyph, line-height 1 so a fallback font's tall metrics cannot inflate
// the row, and 8px padding so the button stays the 44px minimum square.
const ROTATE_GLYPH_FONT_SIZE = '18px';
const ROTATE_BUTTON_STYLE: React.CSSProperties = {
  ...OVERLAY_BUTTON_STYLE,
  fontSize: ROTATE_GLYPH_FONT_SIZE,
  letterSpacing: '0',
  lineHeight: 1,
  padding: '8px',
  color: '#7ab8b8',
};

/** Oversize factor for the svg box + viewBox (pan margin) — see the render comment. */
const GRID_MARGIN_MULTIPLIER = 4;

export function EncounterMapRenderer({
  mapData,
  roomVisibility,
  currentLevel = 1,
  totalLevels = 1,
  deckName,
  tokens,
  isGM = false,
  onRoomToggle,
  onRoomClick,
  onDoorClick,
  doorStatus,
  onDoorStatusChange,
  onTokenPlace,
  onTokenMove,
  onTokenRemove,
  onTokenStatusToggle,
  hull: hullProp,
  style,
  viewPadding = 2,
  showLegend = true,
  ventsVisible,
  onVentsToggle,
  viewOrientation,
  viewControl,
  locationKey,
  editable = false,
  onPoiClick,
  onPoiMove,
  onEmptyCellClick,
}: EncounterMapRendererProps) {
  // Additive hull (D-02): the shared location/manifest silhouette (hullProp)
  // renders on every deck AND this deck's own hull (mapData.hull), if any,
  // adds its geometry on top — neither replaces the other. mergeHulls
  // dedupes by reference identity so passing the same object twice never
  // double-draws it.
  const effectiveHull = useMemo(
    () => mergeHulls(hullProp, mapData.hull),
    [hullProp, mapData.hull],
  );

  // Single exclusive-popover state — opening any slot closes all others.
  const { popover, open: openPopover, close: closePopover } = useExclusivePopover<EncounterPopover>();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  // Tracked reactively (not just read on demand) so the oversized svg CSS
  // box (sized from GRID_MARGIN_MULTIPLIER × container, see the svg style
  // below) re-sizes on window/panel resize, not just on pan/zoom.
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The oversized svg's untransformed top-left within the container (matches
  // its measured-branch left/top below), so zoom anchors at the cursor.
  const { viewState, containerHandlers, resetView: handleResetView } = usePanZoom(containerRef, {
    x: (containerSize.width * (1 - GRID_MARGIN_MULTIPLIER)) / 2,
    y: (containerSize.height * (1 - GRID_MARGIN_MULTIPLIER)) / 2,
  });

  // unit_size — pixels per grid cell (default 40 if YAML omits it)
  const unitSize = mapData.unit_size ?? 40;

  // View orientation (D-04, D-17). Controlled modes ('readonly' / 'broadcast')
  // follow the broadcast value; 'local' owns private state that always opens
  // top-down / offset 0 and ignores any map default_view.
  const control = viewControl ?? READONLY_VIEW_CONTROL;
  const [localView, setLocalView] = useState<ViewOrientation>(DEFAULT_VIEW_ORIENTATION);
  const requested: ViewOrientation =
    control.mode === 'local' ? localView : (viewOrientation ?? DEFAULT_VIEW_ORIENTATION);
  // The displayed orientation lags `requested` during a rotation fade; the
  // transition hook snaps it (and resets pan/zoom) when the map is invisible.
  const displayed = useOrientationTransition({ ...requested, locationKey }, fadeRef, handleResetView);
  // Changes with the REQUESTED orientation/location; TokenLayer/PoiLayer cancel
  // an in-progress drag on it (D-18).
  const viewKey = buildViewKey({ ...requested, locationKey });

  // Popovers are anchored in screen pixels, so close any open one when the
  // displayed geometry changes.
  const prevDisplayedRef = useRef(displayed);
  useEffect(() => {
    if (shouldClosePopover(prevDisplayedRef.current, displayed)) closePopover();
    prevDisplayedRef.current = displayed;
  }, [displayed.projection, displayed.rotationOffset, closePopover]);

  // YAML-authored deck rotation. Top-down keeps it as the outer screen rotate();
  // iso folds it into the grid azimuth (D-15) — see viewOrientation.ts.
  const authoredRotation = mapData.rotation ?? 0;

  // Projection + mapView — the renderer's seam to all SVG-space queries.
  // After plan 21-03 the renderer never multiplies by unitSize directly;
  // everything goes through `view`.
  const projection = useMemo(
    () => buildProjection(displayed.projection, displayed.rotationOffset, unitSize, authoredRotation),
    [unitSize, displayed.projection, displayed.rotationOffset, authoredRotation]
  );
  const view = useMemo(() => makeMapView(projection), [projection]);

  // Canonical Door[] derived from top-level mapData.doors via doorNormalizer.
  // After plan 21-04 the YAML carries `doors:` at the map root (canonical
  // AuthoredDoor shape); the legacy nested room.doors[] adapter is gone.
  const canonicalDoors: Door[] = useMemo(() => {
    if (!mapData.rooms || mapData.rooms.length === 0) return [];
    const authored = mapData.doors ?? [];
    if (authored.length === 0) return [];
    try {
      return normalizeDoors(authored, mapData.rooms);
    } catch (err) {
      // Defensive: a single bad authored entry should not blank the map.
      // Fall back to per-door normalization, dropping bad entries.
      const out: Door[] = [];
      for (let i = 0; i < authored.length; i++) {
        try {
          // normalizeDoors enforces overlap detection across the whole
          // set; per-entry path here uses normalizeDoor (no overlap check)
          // for resilience against single bad entries.
          out.push(normalizeDoor(authored[i], mapData.rooms, i));
        } catch {
          // skip the bad door rather than blank the entire map
        }
      }
      console.error(
        `[EncounterMapRenderer] ${authored.length - out.length} door(s) dropped due to normalization errors:`,
        err,
      );
      return out;
    }
  }, [mapData.rooms, mapData.doors]);

  // SVG dimensions — always computed from ALL rooms + hull (never filtered by visibility)
  const { originX, originY, svgWidth, svgHeight } = useMemo(() => {
    const bb = view.bbox(mapData.rooms, effectiveHull ?? undefined, viewPadding);
    return {
      originX: bb.originX,
      originY: bb.originY,
      svgWidth: bb.width,
      svgHeight: bb.height,
    };
  }, [view, mapData.rooms, effectiveHull, viewPadding]);

  // Residual SCREEN rotation (D-15): the authored rotation under top-down, 0
  // under iso (where it is already folded into the projection).
  const mapRotation = screenRotationFor(displayed.projection, authoredRotation);
  const mapCenterX = originX + svgWidth / 2;
  const mapCenterY = originY + svgHeight / 2;
  // For 90/270° rotations the effective bounding box flips W↔H
  const rotIs90or270 = mapRotation === 90 || mapRotation === 270;
  const rotViewBoxX = rotIs90or270 ? mapCenterX - svgHeight / 2 : originX;
  const rotViewBoxY = rotIs90or270 ? mapCenterY - svgWidth / 2 : originY;
  const rotViewBoxW = rotIs90or270 ? svgHeight : svgWidth;
  const rotViewBoxH = rotIs90or270 ? svgWidth : svgHeight;

  // Panning/zooming is done by CSS-transforming the whole <svg> element
  // (see the `transform` style below) — the svg's own rendered box moves
  // as a rigid unit, so once its edge is dragged into view there is
  // structurally nothing beyond it (not a matter of what's drawn inside).
  // The fix is to make BOTH the viewBox and the svg's CSS box
  // GRID_MARGIN_MULTIPLIER× bigger than the "tight" ship-fitted size,
  // scaled together (so the ship's default on-screen size is unchanged —
  // scaling viewBox and box by the same factor leaves the `meet` fit
  // scale, and thus everything's apparent size, identical) — this simply
  // gives panning/zooming room to move before an edge can appear.
  // (GRID_MARGIN_MULTIPLIER is module-level so usePanZoom can use it too.)
  const gridViewBoxW = rotViewBoxW * GRID_MARGIN_MULTIPLIER;
  const gridViewBoxH = rotViewBoxH * GRID_MARGIN_MULTIPLIER;
  const gridViewBoxX = rotViewBoxX - (gridViewBoxW - rotViewBoxW) / 2;
  const gridViewBoxY = rotViewBoxY - (gridViewBoxH - rotViewBoxH) / 2;

  // Background grid lines — drawn as individually projected line segments
  // (not a flat SVG <pattern> tile) so the grid follows the active
  // projection: axis-aligned under topDownProjection, skewed into
  // parallelograms under isoProjection. A projection is linear, so a
  // straight grid line in grid space is still a straight line once
  // projected — no polyline approximation needed, just project both
  // endpoints. Coverage spans the full (oversized) grid viewBox rather
  // than just the ship's own bbox, so panning/zooming within that margin
  // always shows grid instead of a hard black edge.
  const bgGridLines = useMemo(() => {
    const corners = [
      view.unproject({ x: gridViewBoxX, y: gridViewBoxY }),
      view.unproject({ x: gridViewBoxX + gridViewBoxW, y: gridViewBoxY }),
      view.unproject({ x: gridViewBoxX, y: gridViewBoxY + gridViewBoxH }),
      view.unproject({ x: gridViewBoxX + gridViewBoxW, y: gridViewBoxY + gridViewBoxH }),
    ];
    const gx0 = Math.floor(Math.min(...corners.map((c) => c.gx)));
    const gy0 = Math.floor(Math.min(...corners.map((c) => c.gy)));
    const gx1 = Math.ceil(Math.max(...corners.map((c) => c.gx)));
    const gy1 = Math.ceil(Math.max(...corners.map((c) => c.gy)));
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let gx = gx0; gx <= gx1; gx++) {
      const p1 = view.project({ gx, gy: gy0 });
      const p2 = view.project({ gx, gy: gy1 });
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    for (let gy = gy0; gy <= gy1; gy++) {
      const p1 = view.project({ gx: gx0, gy });
      const p2 = view.project({ gx: gx1, gy });
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return lines;
  }, [view, gridViewBoxX, gridViewBoxY, gridViewBoxW, gridViewBoxH]);

  // Hull SVG geometry — projected via mapView. `fillPath` unions every
  // outer polygon and hole into one evenodd path (RoomsLayer's hole
  // technique, scaled to N outer polygons); `outlines`/`holeOutlines` are
  // the per-polygon stroke rings drawn on top of the fill.
  const hullSvg = useMemo(() => {
    if (!effectiveHull) return null;
    const projectPoint = (gx: number, gy: number) => view.project({ gx, gy });
    const toPoints = (poly: [number, number][]) =>
      poly
        .map(([x, y]) => {
          const sp = projectPoint(x, y);
          return `${sp.x},${sp.y}`;
        })
        .join(' ');
    return {
      fillPath: hullPathD(effectiveHull, projectPoint),
      outlines: effectiveHull.polygons.map(toPoints),
      holeOutlines: effectiveHull.holes.map(toPoints),
    };
  }, [effectiveHull, view]);

  // Partitioned detail linework (DET-01/DET-03): `exterior` is always
  // visible regardless of any room's reveal state; `byRoom` entries are
  // passed to RoomsLayer, which mounts them INSIDE each room's own SVG
  // reveal group so they inherit that room's gating and CRT flicker
  // cascade structurally (D-12/D-13) — see detailNormalizer for the D-14
  // dangling-room-ref fail-safe.
  const { exterior: exteriorDetails, byRoom: detailsByRoom } = useMemo(
    () => partitionDetails(mapData.details, mapData.rooms, isGM),
    [mapData.details, mapData.rooms, isGM],
  );

  // Check if a room is visible (default to true if no visibility state)
  const isRoomVisible = useCallback((roomId: string): boolean => {
    if (!roomVisibility) return true;
    return roomVisibility[roomId] !== false;
  }, [roomVisibility]);

  // Room reveal/hide cascade — extracted to animation/useRoomRevealAnimations.
  // scheduleReveal (pure) computes the per-room steps; the hook owns the timers.
  // enabled=false (GM view) returns an empty Map and runs no timers.
  const mapIdentity = `${mapData.deck_id ?? ''}|${mapData.name}`;
  const roomAnimState = useRoomRevealAnimations({
    visibility: roomVisibility,
    rooms: mapData.rooms,
    mapIdentity,
    enabled: !isGM,
  });

  // -------------------------------------------------------------------
  // Get effective door status: runtime override > authored default.
  // Door id is canonical. Plan 21-04's migration preserved the legacy
  // `${room.id}_door_${index}` id form on every existing map so any
  // persisted runtime overrides in DoorStatusState continue to resolve
  // after the data layer flipped to the top-level `doors:` shape.
  // -------------------------------------------------------------------
  const getEffectiveDoorStatus = useCallback((door: Door): DoorStatus => {
    return (doorStatus?.[door.id] as DoorStatus) || door.status || 'CLOSED';
  }, [doorStatus]);

  // -------------------------------------------------------------------
  // Find room containing a grid cell. Uses pointInPolygon from polygon2d.
  // -------------------------------------------------------------------
  const findRoomAtCell = useCallback((gridX: number, gridY: number): GridRoom | null => {
    // Cell center point for circle/polygon containment tests
    const px = gridX + 0.5;
    const py = gridY + 0.5;
    return mapData.rooms.find(room => {
      if (room.circle) {
        const { cx, cy, r } = room.circle;
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      }
      if (room.polygon && room.polygon.length > 0) {
        const poly = room.polygon.map(([x, y]) => ({ x, y }));
        return pointInPolygon({ x: px, y: py }, poly);
      }
      return (room.rects ?? []).some(r => gridX >= r.x && gridX < r.x + r.w && gridY >= r.y && gridY < r.y + r.h);
    }) ?? null;
  }, [mapData.rooms]);

  // -------------------------------------------------------------------
  // Check if a grid cell is occupied by a token
  // -------------------------------------------------------------------
  const isCellOccupied = useCallback((gridX: number, gridY: number): boolean => {
    if (!tokens) return false;
    return Object.values(tokens).some(t => t.x === gridX && t.y === gridY);
  }, [tokens]);

  // -------------------------------------------------------------------
  // Door right-click handler — opens DoorStatusPopup at cursor position.
  // Operates on the canonical Door (door.id is the persisted identifier).
  // -------------------------------------------------------------------
  const handleDoorClick = useCallback((
    e: React.MouseEvent,
    door: Door,
  ) => {
    if (!isGM || !onDoorStatusChange) return;
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    openPopover({ type: 'door', payload: {
      id: door.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      status: getEffectiveDoorStatus(door),
    } });
  }, [isGM, onDoorStatusChange, getEffectiveDoorStatus, openPopover]);

  // Gated once here (not per-door) — DoorsLayer just binds this per door.
  const doorContextMenuHandler = (isGM && onDoorStatusChange) ? handleDoorClick : undefined;

  // -------------------------------------------------------------------
  // Room right-click handler — opens context menu (GM only).
  // In editor mode, also computes snapped grid coords for "Add POI".
  // -------------------------------------------------------------------
  const handleRoomContextMenu = useCallback((e: React.MouseEvent, room: GridRoom) => {
    if (!isGM) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const payload: EncounterPopover['payload'] & { room: GridRoom } = {
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    };
    if (editable && onEmptyCellClick) {
      const svg = svgRef.current;
      if (svg) {
        const svgCoords = screenToSVG(svg, e.clientX, e.clientY);
        const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
        const snapped = getGridCellViaView(view, unrotated.x, unrotated.y);
        payload.gridX = snapped.gridX;
        payload.gridY = snapped.gridY;
      }
    }
    openPopover({ type: 'room', payload });
  }, [isGM, editable, onEmptyCellClick, mapRotation, mapCenterX, mapCenterY, view, openPopover]);

  // -------------------------------------------------------------------
  // Room tap handler — shows info popup (player terminal only)
  // Uses pointerdown+pointerup for reliable touch+mouse support.
  // -------------------------------------------------------------------
  const roomTapStart = useRef<{ x: number; y: number } | null>(null);

  const handleRoomPointerDown = useCallback((e: React.PointerEvent) => {
    roomTapStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleRoomPointerUp = useCallback((e: React.PointerEvent, room: GridRoom) => {
    const start = roomTapStart.current;
    roomTapStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) return; // was a drag, not a tap
    onRoomClick?.(room.id);
    if (isGM) return;
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    openPopover({ type: 'room', payload: {
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    } });
  }, [isGM, onRoomClick, openPopover]);

  // -------------------------------------------------------------------
  // View-control handlers (D-02, D-04). Local mode updates private state and
  // never calls a control callback; broadcast mode only calls what was supplied.
  // -------------------------------------------------------------------
  const handleProjectionToggle = () => {
    const next: ViewProjection = requested.projection === 'iso' ? 'top-down' : 'iso';
    if (control.mode === 'local') setLocalView((v) => ({ ...v, projection: next }));
    else if (control.mode === 'broadcast') control.onProjectionChange?.(next);
  };

  const handleRotateClick = (delta: RotateDelta) => {
    if (control.mode === 'local') {
      setLocalView((v) => ({ ...v, rotationOffset: stepRotationOffset(v.rotationOffset, delta) }));
    } else if (control.mode === 'broadcast') {
      control.onRotate?.(delta);
    }
  };

  const showProjectionButton =
    control.mode === 'local' || (control.mode === 'broadcast' && !!control.onProjectionChange);
  const showRotateButtons =
    control.mode === 'local' || (control.mode === 'broadcast' && !!control.onRotate);
  const followNote = control.mode === 'broadcast' ? ' (players follow)' : '';

  const { handleDragOver, handleDrop } = useTokenPlacement({
    svgRef,
    view,
    isGM,
    onTokenPlace,
    isCellOccupied,
    findRoomAtCell,
    mapRotation,
    mapCenterX: mapCenterX,
    mapCenterY: mapCenterY,
  });

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="encounter-map-renderer"
      {...containerHandlers}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: 'grab',
        touchAction: 'none',
        ...style,
      }}
    >
      {/* SVG Map — wrapped so GSAP can fade it on rotation without touching
          the overlay controls or popups (siblings outside this wrapper). */}
      <div ref={fadeRef} className="encounter-map-renderer__fade">
      <svg
        ref={svgRef}
        viewBox={`${gridViewBoxX} ${gridViewBoxY} ${gridViewBoxW} ${gridViewBoxH}`}
        className="encounter-map-renderer__svg"
        preserveAspectRatio="xMidYMid meet"
        style={
          containerSize.width > 0 && containerSize.height > 0
            ? {
                // Both the viewBox (above) and this CSS box are scaled up
                // by GRID_MARGIN_MULTIPLIER together, which leaves the
                // `meet` fit scale (and so the ship's on-screen size)
                // unchanged — see the GRID_MARGIN_MULTIPLIER comment above.
                // This just gives panning/zooming margin: the svg element
                // itself moves as a rigid box via the transform below, so
                // without extra size here its edge would slide into view
                // (exposing blank space past it) on any pan.
                position: 'absolute',
                // Override the class's max-width/max-height:100% (meant for
                // the un-oversized fallback below) — otherwise it caps this
                // explicit width/height right back down to the container.
                maxWidth: 'none',
                maxHeight: 'none',
                left: (containerSize.width * (1 - GRID_MARGIN_MULTIPLIER)) / 2,
                top: (containerSize.height * (1 - GRID_MARGIN_MULTIPLIER)) / 2,
                width: containerSize.width * GRID_MARGIN_MULTIPLIER,
                height: containerSize.height * GRID_MARGIN_MULTIPLIER,
                transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
                transformOrigin: '0 0',
              }
            : {
                // Before the container's first measurement, fall back to
                // the plain max-width/max-height-fitted box (no oversized
                // margin yet) so there's no flash of an incorrectly sized
                // element.
                transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
                transformOrigin: '0 0',
              }
        }
        onContextMenu={editable ? (e) => e.preventDefault() : undefined}
      >
        <defs>
          {/* POI icon symbols — Mothership RPG Map Icons (MIT, László Varga) */}
          {Object.entries(ENCOUNTER_ICONS).map(([name, content]) => (
            <symbol
              key={name}
              id={iconSymbolId(name)}
              viewBox="0 0 64 64"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ))}

        </defs>

        {/* Fixed rotation wrapper — rotates all map content around its center.
            mapRotation is YAML-authored (e.g. 90 for a horizontally-oriented ship). */}
        <g transform={mapRotation !== 0 ? `rotate(${mapRotation}, ${mapCenterX}, ${mapCenterY})` : undefined}>

        {/* Background — fills the full (oversized) grid viewBox, not just
            the ship's own bbox, so panning/zooming within the margin (see
            GRID_MARGIN_MULTIPLIER above) never scrolls past the grid into
            blank space. Grid lines are individually projected (not a flat
            <pattern> tile) so they follow the active projection — see
            bgGridLines above. */}
        <rect
          x={gridViewBoxX} y={gridViewBoxY}
          width={gridViewBoxW} height={gridViewBoxH}
          fill={COLORS.bgPrimary}
        />
        <g className="encounter-map__bg-grid">
          {bgGridLines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#141e1e" strokeWidth={0.5}
            />
          ))}
        </g>

        {/* Hull polygon — ship/structure outer frame.
            Filled with hull-interior color so the space between rooms
            reads as solid hull material rather than empty void.
            Rendered above the background grid but below room floors. */}
        {hullSvg && (
          <g className="encounter-map__hull">
            <path
              d={hullSvg.fillPath}
              fillRule="evenodd"
              fill={COLORS.hullFill}
              className="encounter-map__hull-fill"
            />
            {hullSvg.outlines.map((pts, i) => (
              <polygon
                key={`hull-poly-${i}`}
                points={pts}
                fill="none"
                stroke={COLORS.hullFill}
                strokeWidth={4}
                strokeLinejoin="miter"
                className="encounter-map__hull-outline"
              />
            ))}
            {hullSvg.holeOutlines.map((pts, i) => (
              <polygon
                key={`hull-hole-${i}`}
                points={pts}
                fill="none"
                stroke={COLORS.hullFill}
                strokeWidth={4}
                strokeLinejoin="miter"
                className="encounter-map__hull-outline"
              />
            ))}
          </g>
        )}

        {/* Exterior detail linework (DET-03) — hull greebles, always visible
            regardless of any room's reveal state. No GM gating, no reveal
            gating: unlike the vents block below, these are never hidden. */}
        <DetailsLayer details={exteriorDetails} view={view} />

        {/* Rooms (with walls, floor fill, context menu targets, labels) */}
        <RoomsLayer
          rooms={mapData.rooms}
          isRoomVisible={isRoomVisible}
          roomAnimState={roomAnimState}
          isGM={isGM}
          view={view}
          mapRotation={mapRotation}
          detailsByRoom={detailsByRoom}
          onRoomContextMenu={handleRoomContextMenu}
          onRoomPointerDown={handleRoomPointerDown}
          onRoomPointerUp={handleRoomPointerUp}
        />

        {/* Vent paths — dashed lines, GM-only until revealed */}
        {mapData.vents && mapData.vents.length > 0 && (isGM || ventsVisible) && (
          <g className="encounter-map__vents">
            {mapData.vents.map((vent) => {
              const pts = vent.points
                .map(([gx, gy]) => {
                  const p = view.project({ gx, gy });
                  return `${p.x},${p.y}`;
                })
                .join(' ');
              return (
                <g key={vent.id}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={view.unitSize * 0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ cursor: isGM ? 'context-menu' : 'default', pointerEvents: isGM ? 'stroke' : 'none' }}
                    onContextMenu={isGM ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = containerRef.current?.getBoundingClientRect();
                      openPopover({ type: 'vent', payload: { x: rect ? e.clientX - rect.left : e.clientX, y: rect ? e.clientY - rect.top : e.clientY, currentlyVisible: ventsVisible ?? false } });
                    } : undefined}
                  />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={ventsVisible ? COLORS.vent : COLORS.ventHidden}
                    strokeWidth={view.unitSize * 0.18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${view.unitSize * 0.3} ${view.unitSize * 0.15}`}
                    opacity={isGM && !ventsVisible ? 0.4 : 1}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* Door symbols — rendered above room floors and walls.
            Iterates the canonical Door[] (normalized from top-level
            mapData.doors by doorNormalizer at load).
            Door visibility uses ref-by-id checks against roomA/roomB —
            no spatial lookup. If a door's roomB is null (exterior) the
            doorEndpoints helper resolves the cell on the other side. */}
        <DoorsLayer
          doors={canonicalDoors}
          isGM={isGM}
          roomVisibility={roomVisibility}
          rooms={mapData.rooms}
          findRoomAtCell={findRoomAtCell}
          isRoomVisible={isRoomVisible}
          view={view}
          getEffectiveDoorStatus={getEffectiveDoorStatus}
          onDoorContextMenu={doorContextMenuHandler}
          onDoorClick={onDoorClick}
        />

        {/* POI layer — rendered above doors */}
        <PoiLayer
          pois={mapData.poi ?? []}
          isGM={isGM}
          isRoomVisible={isRoomVisible}
          editable={editable}
          view={view}
          svgRef={svgRef}
          containerRef={containerRef}
          mapRotation={mapRotation}
          mapCenterX={mapCenterX}
          mapCenterY={mapCenterY}
          onPoiMove={onPoiMove}
          onPoiClick={onPoiClick}
          onPoiHover={(poi, x, y) => openPopover({ type: 'poi', payload: { poi, x, y } })}
          onPoiHoverEnd={closePopover}
          viewKey={viewKey}
        />

        {/* Token layer (rendered above all other elements) */}
        {tokens && Object.keys(tokens).length > 0 && (
          <TokenLayer
            tokens={tokens}
            view={view}
            roomVisibility={roomVisibility}
            isGM={isGM}
            onTokenMove={onTokenMove}
            selectedTokenId={popover?.type === 'token' ? popover.payload.id : null}
            onTokenSelect={(id, e) => {
              if (id === null) {
                closePopover();
              } else {
                const token = tokens?.[id];
                const container = containerRef.current;
                const svg = svgRef.current;
                if (token && container && svg) {
                  // Token top-center in original grid-space SVG coordinates
                  const center = view.project({ gx: token.x + 0.5, gy: token.y + 0.5 });
                  let tokenTopSvgX = center.x;
                  let tokenTopSvgY = center.y - view.unitSize * 0.4;
                  // Apply map rotation so the point is in viewBox space (the <g> rotates it visually)
                  if (mapRotation !== 0) {
                    const rad = (mapRotation * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const dx = tokenTopSvgX - mapCenterX;
                    const dy = tokenTopSvgY - mapCenterY;
                    tokenTopSvgX = mapCenterX + dx * cos - dy * sin;
                    tokenTopSvgY = mapCenterY + dx * sin + dy * cos;
                  }
                  // getScreenCTM includes viewBox + preserveAspectRatio + CSS pan/zoom transform
                  const ctm = svg.getScreenCTM();
                  if (ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = tokenTopSvgX;
                    pt.y = tokenTopSvgY;
                    const screenPt = pt.matrixTransform(ctm);
                    const rect = container.getBoundingClientRect();
                    openPopover({ type: 'token', payload: { id, pos: { x: screenPt.x - rect.left, y: screenPt.y - rect.top } } });
                    return;
                  }
                }
                // Fallback: center of container
                const rect = containerRef.current?.getBoundingClientRect();
                openPopover({ type: 'token', payload: { id, pos: {
                  x: e ? e.clientX - (rect?.left || 0) : (rect?.width || 0) / 2,
                  y: e ? e.clientY - (rect?.top || 0) : (rect?.height || 0) / 3,
                } } });
              }
            }}
            mapRooms={mapData.rooms as unknown as import('../../../types/encounterMap').RoomData[]}
            mapRotation={mapRotation}
            mapCenterX={mapCenterX}
            mapCenterY={mapCenterY}
            viewKey={viewKey}
          />
        )}

        </g>{/* end fixed rotation wrapper */}
      </svg>
      </div>

      {/* Overlay panels - positioned by CSS Grid */}
      <div
        className="encounter-map__overlays"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateAreas: '"top-left . top-right" ". . ." "bottom-left . bottom-right"',
          padding: '20px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Reset view button - top left */}
        {(viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0) && (
          <button
            className="encounter-map__reset-btn"
            onClick={handleResetView}
            title="Reset view"
            style={{
              ...OVERLAY_BUTTON_STYLE,
              gridArea: 'top-left',
              alignSelf: 'start',
              justifySelf: 'start',
              color: '#8b7355',
            }}
          >
            RESET VIEW
          </button>
        )}

        {/* View-control cluster - bottom left (D-02 as amended by G-34-5, D-05).
            Order: [rotate ccw][projection][rotate cw]. Only for the broadcast /
            local control modes; read-only mounts get none (D-03). */}
        {(showProjectionButton || showRotateButtons) && (
          <div
            className="encounter-map__view-controls"
            style={{
              gridArea: 'bottom-left',
              alignSelf: 'end',
              justifySelf: 'start',
              display: 'flex',
              gap: '8px',
              pointerEvents: 'none',
            }}
          >
            {showRotateButtons && (
              <button
                className="encounter-map__rotate-ccw"
                onClick={() => handleRotateClick(-90)}
                title={`Rotate map counter-clockwise${followNote}`}
                aria-label="Rotate map counter-clockwise"
                style={ROTATE_BUTTON_STYLE}
              >
                {ROTATE_CCW_LABEL}
              </button>
            )}
            {showProjectionButton && (
              <button
                className="encounter-map__projection-toggle"
                onClick={handleProjectionToggle}
                title={
                  requested.projection === 'iso'
                    ? `Switch map to top-down view${followNote}`
                    : `Switch map to isometric view${followNote}`
                }
                aria-label="Toggle map projection between top-down and isometric"
                aria-pressed={requested.projection === 'iso'}
                style={{
                  ...OVERLAY_BUTTON_STYLE,
                  border: requested.projection === 'iso' ? '1px solid #c9a050' : '1px solid #4a6b6b',
                  color: requested.projection === 'iso' ? '#c9a050' : '#7ab8b8',
                }}
              >
                {requested.projection === 'iso' ? 'TOP DOWN' : 'ISO VIEW'}
              </button>
            )}
            {showRotateButtons && (
              <button
                className="encounter-map__rotate-cw"
                onClick={() => handleRotateClick(90)}
                title={`Rotate map clockwise${followNote}`}
                aria-label="Rotate map clockwise"
                style={ROTATE_BUTTON_STYLE}
              >
                {ROTATE_CW_LABEL}
              </button>
            )}
          </div>
        )}

        {/* Level indicator - top right */}
        <div
          className="encounter-map__level-indicator"
          style={{ gridArea: 'top-right', alignSelf: 'start', justifySelf: 'end' }}
        >
          <LevelIndicator
            currentLevel={currentLevel}
            totalLevels={totalLevels}
            deckName={deckName}
          />
        </div>

        {/* Legend - bottom right */}
        {showLegend && (
          <div
            className="encounter-map__legend"
            style={{ gridArea: 'bottom-right', alignSelf: 'end', justifySelf: 'end' }}
          >
            <LegendPanel />
          </div>
        )}
      </div>

      {/* Token popup — rendered outside SVG for proper styling */}
      {popover?.type === 'token' && tokens?.[popover.payload.id] && (
        <TokenPopup
          tokenId={popover.payload.id}
          data={tokens[popover.payload.id]}
          x={popover.payload.pos.x}
          y={popover.payload.pos.y}
          onClose={() => closePopover()}
          onRemove={onTokenRemove}
          onStatusToggle={onTokenStatusToggle}
          isGM={isGM}
        />
      )}

      {/* POI info popup — shown on hover/click */}
      {popover?.type === 'poi' && (
        <PoiInfoPopup poi={popover.payload.poi} x={popover.payload.x} y={popover.payload.y} />
      )}

      {/* Door status popup — rendered outside SVG */}
      {popover?.type === 'door' && onDoorStatusChange && (
        <DoorStatusPopup
          x={popover.payload.x}
          y={popover.payload.y}
          currentStatus={popover.payload.status}
          onSelect={(status) => {
            onDoorStatusChange(popover.payload.id, status);
            closePopover();
          }}
          onClose={() => closePopover()}
        />
      )}

      {/* Room context menu — GM right-click (with toggle) or player tap (info only) */}
      {popover?.type === 'room' && (
        <RoomContextMenu
          room={popover.payload.room}
          isVisible={isGM ? isRoomVisible(popover.payload.room.id) : undefined}
          x={popover.payload.x}
          y={popover.payload.y}
          onToggleVisibility={isGM && !editable ? () => {
            onRoomToggle?.(popover.payload.room.id, !isRoomVisible(popover.payload.room.id));
            closePopover();
          } : undefined}
          onAddPoi={editable && onEmptyCellClick && popover.payload.gridX !== undefined ? () => {
            onEmptyCellClick(popover.payload.gridX!, popover.payload.gridY!);
            closePopover();
          } : undefined}
          onClose={() => closePopover()}
        />
      )}

      {/* Vent context menu — GM right-click to reveal/hide all vents */}
      {popover?.type === 'vent' && isGM && onVentsToggle && (
        <VentTogglePopup
          x={popover.payload.x}
          y={popover.payload.y}
          currentlyVisible={popover.payload.currentlyVisible}
          onToggle={() => {
            onVentsToggle(!popover.payload.currentlyVisible);
            closePopover();
          }}
          onClose={closePopover}
        />
      )}

    </div>
  );
}
