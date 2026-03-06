import type { Bed, Field } from '../api/types';

export interface RectSize {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

interface AreaToRectOptions {
  baseWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  scaleFactor?: number;
}

const DEFAULT_OPTIONS: Required<AreaToRectOptions> = {
  baseWidth: 120,
  minWidth: 90,
  maxWidth: 180,
  minHeight: 36,
  scaleFactor: 2.2,
};

export function areaToRectSize(areaSqm: number | undefined, options: AreaToRectOptions = {}): RectSize {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const safeArea = Math.max(0.1, areaSqm ?? 1);
  const width = Math.max(config.minWidth, Math.min(config.maxWidth, config.baseWidth + Math.sqrt(safeArea) * 5));
  const height = Math.max(config.minHeight, (safeArea * config.scaleFactor) / width);
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}


export function getFieldRectSize(
  field: Pick<Field, 'area_sqm' | 'length_m' | 'width_m'>,
  pxPerMeter: number,
  options: AreaToRectOptions = {}
): RectSize {
  if (typeof field.length_m === 'number' && typeof field.width_m === 'number') {
    return {
      width: Math.max(120, Math.round(field.width_m * pxPerMeter)),
      height: Math.max(120, Math.round(field.length_m * pxPerMeter)),
    };
  }

  return areaToRectSize(Number(field.area_sqm ?? 1), options);
}

export function getBedRectSize(bed: Pick<Bed, 'area_sqm' | 'length_m' | 'width_m'>, pxPerMeter: number): RectSize {
  if (typeof bed.length_m === 'number' && typeof bed.width_m === 'number') {
    return {
      width: Math.max(20, Math.round(bed.width_m * pxPerMeter)),
      height: Math.max(20, Math.round(bed.length_m * pxPerMeter)),
    };
  }

  return areaToRectSize(Number(bed.area_sqm ?? 1));
}


export function getBedRectSizeWithinField(
  bed: Pick<Bed, 'area_sqm' | 'length_m' | 'width_m'>,
  field: Pick<Field, 'length_m' | 'width_m'>,
  fieldInnerSize: RectSize,
): RectSize {
  const bedLengthM = typeof bed.length_m === 'number' && bed.length_m > 0 ? bed.length_m : null;
  const bedWidthM = typeof bed.width_m === 'number' && bed.width_m > 0 ? bed.width_m : null;
  const fieldLengthM = typeof field.length_m === 'number' && field.length_m > 0 ? field.length_m : null;
  const fieldWidthM = typeof field.width_m === 'number' && field.width_m > 0 ? field.width_m : null;

  if (bedLengthM !== null && bedWidthM !== null && fieldLengthM !== null && fieldWidthM !== null) {
    const pxPerMeterX = fieldInnerSize.width / fieldWidthM;
    const pxPerMeterY = fieldInnerSize.height / fieldLengthM;

    return {
      width: Math.max(20, Math.round(bedWidthM * pxPerMeterX)),
      height: Math.max(20, Math.round(bedLengthM * pxPerMeterY)),
    };
  }

  return getBedRectSize(bed, getBedScaleFromField(field, fieldInnerSize));
}

export function getBedScaleFromField(
  field: Pick<Field, 'length_m' | 'width_m'>,
  fieldInnerSize: RectSize,
): number {
  const lengthM = typeof field.length_m === 'number' && field.length_m > 0 ? field.length_m : null;
  const widthM = typeof field.width_m === 'number' && field.width_m > 0 ? field.width_m : null;

  if (lengthM !== null && widthM !== null) {
    return Math.max(
      4,
      Math.min(
        fieldInnerSize.width / widthM,
        fieldInnerSize.height / lengthM,
      ),
    );
  }

  return Math.max(10, Math.min(36, fieldInnerSize.width / 40));
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
