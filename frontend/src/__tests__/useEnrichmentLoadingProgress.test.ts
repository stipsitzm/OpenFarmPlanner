import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEnrichmentLoadingProgress } from '../pages/useEnrichmentLoadingProgress';

describe('useEnrichmentLoadingProgress', () => {
  it('returns zero progress when not loading', () => {
    const { result } = renderHook(() => useEnrichmentLoadingProgress(false));

    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.activeStepIndex).toBe(0);
  });

  it('updates progress and active step while loading', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useEnrichmentLoadingProgress(true));

    act(() => {
      vi.advanceTimersByTime(13_000);
    });

    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(13);
    expect(result.current.activeStepIndex).toBe(1);
    expect(result.current.progressPercent).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(40_000);
    });

    expect(result.current.activeStepIndex).toBe(3);

    vi.useRealTimers();
  });
});
