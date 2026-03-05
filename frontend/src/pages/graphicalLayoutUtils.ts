export interface RectSize {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

const AREA_SCALE_FACTOR = 2.2;
const MIN_BED_WIDTH = 90;
const MAX_BED_WIDTH = 180;

export function areaToRectSize(areaSqm: number | undefined, baseWidth = 120): RectSize {
  const safeArea = Math.max(0.1, areaSqm ?? 1);
  const width = Math.max(MIN_BED_WIDTH, Math.min(MAX_BED_WIDTH, baseWidth + Math.sqrt(safeArea) * 5));
  const height = Math.max(36, (safeArea * AREA_SCALE_FACTOR) / width);
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function clampInsideParent(position: Position, childSize: RectSize, parentSize: RectSize): Position {
  const maxX = Math.max(0, parentSize.width - childSize.width);
  const maxY = Math.max(0, parentSize.height - childSize.height);
  return {
    x: Math.min(Math.max(0, position.x), maxX),
    y: Math.min(Math.max(0, position.y), maxY),
  };
}

export function initialAutoLayout(ids: number[], childSizes: Map<number, RectSize>, parentSize: RectSize, gap = 12): Map<number, Position> {
  const output = new Map<number, Position>();
  let cursorX = gap;
  let cursorY = gap;
  let rowHeight = 0;

  for (const id of ids) {
    const size = childSizes.get(id);
    if (!size) continue;

    if (cursorX + size.width > parentSize.width - gap) {
      cursorX = gap;
      cursorY += rowHeight + gap;
      rowHeight = 0;
    }

    output.set(id, clampInsideParent({ x: cursorX, y: cursorY }, size, parentSize));
    cursorX += size.width + gap;
    rowHeight = Math.max(rowHeight, size.height);
  }

  return output;
}
