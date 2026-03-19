import { describe, expect, it } from 'vitest';
import { fitContentToStage, getVisibleElements, shouldShowBedLabel, shouldShowFieldLabel, ZOOM_LEVEL_DETAIL, ZOOM_LEVEL_MEDIUM, ZOOM_LEVEL_OVERVIEW } from '../pages/graphicalViewport';

describe('graphicalViewport helpers', () => {
  it('derives visible elements from zoom level', () => {
    expect(getVisibleElements(ZOOM_LEVEL_OVERVIEW - 0.1)).toEqual({
      showBeds: false,
      showBedLabels: false,
      showDetailedBedLabels: false,
    });
    expect(getVisibleElements(ZOOM_LEVEL_MEDIUM)).toEqual({
      showBeds: true,
      showBedLabels: true,
      showDetailedBedLabels: false,
    });
    expect(getVisibleElements(ZOOM_LEVEL_DETAIL)).toEqual({
      showBeds: true,
      showBedLabels: true,
      showDetailedBedLabels: true,
    });
  });

  it('shows labels only when zoom and size are sufficient', () => {
    expect(shouldShowFieldLabel({ width: 150, height: 80 }, 1)).toBe(true);
    expect(shouldShowFieldLabel({ width: 80, height: 30 }, 1)).toBe(false);
    expect(shouldShowBedLabel({ width: 120, height: 50 }, ZOOM_LEVEL_DETAIL)).toBe(true);
    expect(shouldShowBedLabel({ width: 60, height: 20 }, ZOOM_LEVEL_DETAIL)).toBe(false);
    expect(shouldShowBedLabel({ width: 120, height: 50 }, ZOOM_LEVEL_OVERVIEW)).toBe(false);
  });

  it('fits content into the available stage size', () => {
    const viewport = fitContentToStage({ width: 1200, height: 900 }, { width: 400, height: 300 }, 20);
    expect(viewport.scale).toBeGreaterThan(0);
    expect(Number.isFinite(viewport.x)).toBe(true);
    expect(Number.isFinite(viewport.y)).toBe(true);
  });
});
