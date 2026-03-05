import { describe, expect, it } from 'vitest';
import { areaToRectSize, clampInsideParent, initialAutoLayout } from '../pages/graphicalLayoutUtils';

describe('graphicalLayoutUtils', () => {
  it('returns deterministic area size', () => {
    const first = areaToRectSize(12.5, { baseWidth: 120 });
    const second = areaToRectSize(12.5, { baseWidth: 120 });
    expect(first).toEqual(second);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
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
