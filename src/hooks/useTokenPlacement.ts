import { useCallback, type RefObject } from 'react';
import { screenToSVG, inverseRotatePoint, getGridCellViaView } from '@/utils/svgCoordinates';
import type { MapView } from '@/components/domain/encounter/geometry/mapView';
import type { TokenType, GridRoom } from '@/types/encounterMap';

export interface UseTokenPlacementOpts {
  svgRef: RefObject<SVGSVGElement | null>;
  view: MapView;
  isGM: boolean;
  onTokenPlace?: (type: TokenType, name: string, gridX: number, gridY: number, imageUrl: string, roomId: string) => void;
  isCellOccupied: (gridX: number, gridY: number) => boolean;
  findRoomAtCell: (gridX: number, gridY: number) => GridRoom | null;
  mapRotation?: number;
  mapCenterX?: number;
  mapCenterY?: number;
}

/**
 * Returns the two HTML5 drag-and-drop handlers for placing palette tokens onto
 * the encounter map. The caller passes in svgRef and all geometry/state
 * predicates (isCellOccupied, findRoomAtCell); the hook owns no state and no
 * refs. Placement is GM-only: both handlers short-circuit when isGM is false
 * or onTokenPlace is absent.
 */
export function useTokenPlacement({
  svgRef,
  view,
  isGM,
  onTokenPlace,
  isCellOccupied,
  findRoomAtCell,
  mapRotation = 0,
  mapCenterX = 0,
  mapCenterY = 0,
}: UseTokenPlacementOpts) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [isGM, onTokenPlace]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace || !svgRef.current) return;

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    let template: { type: TokenType; name: string; imageUrl: string };
    try {
      template = JSON.parse(dataStr);
    } catch {
      return;
    }

    const svgCoords = screenToSVG(svgRef.current, e.clientX, e.clientY);
    const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
    const { gridX, gridY } = getGridCellViaView(view, unrotated.x, unrotated.y);

    if (isCellOccupied(gridX, gridY)) return;

    const room = findRoomAtCell(gridX, gridY);
    if (!room) return;

    // Only preventDefault on success — failed drops snap back via browser default
    e.preventDefault();
    onTokenPlace(template.type, template.name, gridX, gridY, template.imageUrl || '', room.id);
  }, [isGM, onTokenPlace, view, isCellOccupied, findRoomAtCell, svgRef]);

  return { handleDragOver, handleDrop };
}
