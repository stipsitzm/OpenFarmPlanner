import { describe, expect, it } from 'vitest';
import { areaToRectSize, clampInsideParent, getBedRectSize, getBedScaleFromField, getFieldRectSize, initialAutoLayout } from '../pages/graphicalLayoutUtils';

describe('graphicalLayoutUtils', () => {
  it('returns deterministic area size', () => {
    const first = areaToRectSize(12.5, { baseWidth: 120 });
    const second = areaToRectSize(12.5, { baseWidth: 120 });
    expect(first).toEqual(second);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
  });

  it('uses dimensions first and falls back to area for bed rect sizes', () => {
    const dimensionsSize = getBedRectSize({ length_m: 5, width_m: 2, area_sqm: 7 }, 12);
    expect(dimensionsSize).toEqual({ width: 24, height: 60 });

    const fallbackSize = getBedRectSize({ area_sqm: 20, length_m: null, width_m: null }, 12);
    expect(fallbackSize.width).toBeGreaterThan(0);
    expect(fallbackSize.height).toBeGreaterThan(0);
  });



  it('uses dimensions first and falls back to area for field rect sizes', () => {
    const dimensionsSize = getFieldRectSize({ length_m: 15, width_m: 10, area_sqm: 42 }, 20);
    expect(dimensionsSize).toEqual({ width: 200, height: 300 });

    const fallbackSize = getFieldRectSize({ area_sqm: 100, length_m: null, width_m: null }, 20);
    expect(fallbackSize.width).toBeGreaterThan(0);
    expect(fallbackSize.height).toBeGreaterThan(0);
  });

  it('derives bed scale from field dimensions when available', () => {
    const scale = getBedScaleFromField({ length_m: 20, width_m: 10 }, { width: 400, height: 150 });
    expect(scale).toBe(7.5);
  });

  it('falls back to width-based bed scale when field dimensions are unavailable', () => {
    const scale = getBedScaleFromField({ length_m: null, width_m: null }, { width: 600, height: 150 });
    expect(scale).toBe(15);
  });



  it('renders equal pixel widths when bed and field widths in meters match', () => {
    const fieldInnerSize = { width: 360, height: 240 };
    const scale = getBedScaleFromField({ length_m: 20, width_m: 10 }, fieldInnerSize);

    const fieldSize = getFieldRectSize({ length_m: 20, width_m: 10, area_sqm: 200 }, scale);
    const bedSize = getBedRectSize({ length_m: 4, width_m: 10, area_sqm: 40 }, scale);

    expect(bedSize.width).toBe(fieldSize.width);
  });

  it('clamps child position inside parent bounds', () => {
    const position = clampInsideParent({ x: 200, y: -12 }, { width: 80, height: 60 }, { width: 220, height: 140 });
    expect(position).toEqual({ x: 140, y: 0 });
  });

  it('creates non-overflowing initial auto layout', () => {
    const sizes = new Map<number, { width: number; height: number }>([
      [1, { width: 100, height: 50 }],
      [2, { width: 100, height: 50 }],
      [3, { width: 100, height: 50 }],
    ]);

    const output = initialAutoLayout([1, 2, 3], sizes, { width: 230, height: 200 }, 10);
    expect(output.get(1)?.x).toBe(10);
    expect(output.get(2)?.y).toBe(10);
    expect(output.get(3)?.y).toBe(70);
  });
});
