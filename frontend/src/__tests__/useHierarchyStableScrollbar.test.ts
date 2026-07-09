/**
 * Verifies the custom scrollbar introduced to fix the free DataGrid's
 * "jumping" scrollbar under useHierarchyRowWindow's internal paging (see
 * that hook's docs): MUI's own floating scrollbar sizes itself from only the
 * currently-loaded ~100-row page, so its thumb visibly resets on every page
 * transition even though the user is scrolling continuously. This hook
 * computes the thumb's position from the TRUE total row height across every
 * page instead, which should stay continuous across a transition.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import {
  useHierarchyStableScrollbar,
  type HierarchyRowWindowForScrollbar,
} from '../components/hierarchy/hooks/useHierarchyStableScrollbar';

const SELECTOR = '.mock-scroller';
const ROW_HEIGHT = 30;
const PAGE_SIZE = 100;
const CLIENT_HEIGHT = 500;

function setUpDom() {
  const wrapper = document.createElement('div');
  const container = document.createElement('div');
  container.className = 'mock-scroller';
  Object.defineProperty(container, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true });
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  const wrapperRef = createRef<HTMLDivElement>();
  // @ts-expect-error -- assigning to a readonly ref for test setup, same pattern used elsewhere in this suite.
  wrapperRef.current = wrapper;
  const trackRef = createRef<HTMLDivElement>();

  return { wrapper, container, wrapperRef, trackRef };
}

function makeRowWindow(
  overrides: Partial<HierarchyRowWindowForScrollbar> = {},
): HierarchyRowWindowForScrollbar {
  return {
    page: 0,
    pageSize: PAGE_SIZE,
    pageCount: 3,
    ensureRowIndexVisible: vi.fn(() => true),
    ...overrides,
  };
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('useHierarchyStableScrollbar', () => {
  beforeEach(() => {
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  it('sizes the thumb from the total row count, not just the loaded page', () => {
    const { container, wrapperRef, trackRef } = setUpDom();
    container.scrollTop = 0;
    const rowHeights = Array.from({ length: 300 }, () => ROW_HEIGHT); // 9000px total

    const { result } = renderHook(() => (
      useHierarchyStableScrollbar(rowHeights, makeRowWindow(), SELECTOR, wrapperRef, trackRef, 0)
    ));

    // total content (9000) vs viewport (500) => thumb covers ~5.5% of the track.
    expect(result.current.isActive).toBe(true);
    const expectedThumbHeight = (CLIENT_HEIGHT / 9000) * CLIENT_HEIGHT;
    expect(result.current.thumbHeight).toBeCloseTo(expectedThumbHeight, 1);
  });

  it('is inactive when all rows already fit within the viewport', () => {
    const { wrapperRef, trackRef } = setUpDom();
    const rowHeights = Array.from({ length: 5 }, () => ROW_HEIGHT); // 150px total, fits in 500px viewport

    const { result } = renderHook(() => (
      useHierarchyStableScrollbar(rowHeights, makeRowWindow({ pageCount: 1 }), SELECTOR, wrapperRef, trackRef, 0)
    ));

    expect(result.current.isActive).toBe(false);
    expect(result.current.thumbHeight).toBe(0);
  });

  it('keeps the thumb position continuous across a page transition instead of resetting', () => {
    const { container, wrapperRef, trackRef } = setUpDom();
    const rowHeights = Array.from({ length: 300 }, () => ROW_HEIGHT); // 9000px total, 3 pages of 100

    // Near the bottom edge of page 0 (rows 0..99, local height 3000px).
    container.scrollTop = 2900;
    const { result, rerender } = renderHook(
      ({ page }) => useHierarchyStableScrollbar(rowHeights, makeRowWindow({ page }), SELECTOR, wrapperRef, trackRef, 0),
      { initialProps: { page: 0 } },
    );
    const thumbTopBeforeTransition = result.current.thumbTop;

    // Simulate useHierarchyRowWindow's page transition: it advances the page
    // and resets the container's local scrollTop near the new page's top
    // edge (RESET_OFFSET_PX in that hook) — done here before rerender, the
    // same order in which the real effect and this hook's effect would run.
    container.scrollTop = 56;
    rerender({ page: 1 });
    const thumbTopAfterTransition = result.current.thumbTop;

    // The global position barely moved (2900 -> 3056 out of 8500 possible),
    // so the thumb should have moved only slightly, not snapped back toward
    // the top of the track the way a per-page-relative scrollbar would.
    expect(Math.abs(thumbTopAfterTransition - thumbTopBeforeTransition)).toBeLessThan(15);
  });

  it('dragging the thumb across a page boundary calls ensureRowIndexVisible for the target row', () => {
    const { container, wrapperRef, trackRef } = setUpDom();
    const rowHeights = Array.from({ length: 300 }, () => ROW_HEIGHT); // 9000px total
    container.scrollTop = 0;
    const ensureRowIndexVisible = vi.fn(() => true);

    const { result } = renderHook(() => (
      useHierarchyStableScrollbar(rowHeights, makeRowWindow({ ensureRowIndexVisible }), SELECTOR, wrapperRef, trackRef, 0)
    ));

    const thumbTravel = CLIENT_HEIGHT - result.current.thumbHeight;
    const maxGlobalScrollTop = 9000 - CLIENT_HEIGHT;

    const setPointerCapture = vi.fn();
    result.current.onThumbPointerDown({
      clientY: 0,
      pointerId: 1,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget: { setPointerCapture },
    } as unknown as React.PointerEvent<HTMLDivElement>);

    // Drag far enough down the track to land past page 0's 3000px of rows.
    const dragDeltaY = thumbTravel; // drags to the very bottom of the track
    const MoveEvent = typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
    window.dispatchEvent(new MoveEvent('pointermove', { clientY: dragDeltaY } as MouseEventInit));

    expect(ensureRowIndexVisible).toHaveBeenCalled();
    const targetRowIndex = ensureRowIndexVisible.mock.calls[0][0] as number;
    // Dragging to the bottom of the track should target a row well past
    // page 0's 100 rows (proof the drag maps against the full row list).
    expect(targetRowIndex).toBeGreaterThan(PAGE_SIZE);
    expect(targetRowIndex * ROW_HEIGHT).toBeCloseTo(maxGlobalScrollTop, -2);
  });

  it('keeps the thumb within the rows-only viewport when clientHeight includes a header', () => {
    // MUI renders the column header row *inside* .MuiDataGrid-virtualScroller
    // (as a sticky top element), so container.clientHeight covers the header
    // too. The track this thumb is drawn in only spans the rows area (it's
    // offset below the header — see FieldsBedsHierarchy.tsx), so the hook
    // must subtract headerHeight itself or the thumb's travel range ends up
    // taller than the track and overflows past its bottom edge once scrolled
    // to the very end.
    const HEADER_HEIGHT = 40;
    const { container, wrapperRef, trackRef } = setUpDom();
    const rowHeights = Array.from({ length: 300 }, () => ROW_HEIGHT); // 9000px total
    container.scrollTop = 9000 - CLIENT_HEIGHT; // scrolled all the way to the end

    const { result } = renderHook(() => (
      useHierarchyStableScrollbar(rowHeights, makeRowWindow(), SELECTOR, wrapperRef, trackRef, HEADER_HEIGHT)
    ));

    const rowsOnlyViewport = CLIENT_HEIGHT - HEADER_HEIGHT;
    expect(result.current.thumbTop + result.current.thumbHeight).toBeLessThanOrEqual(rowsOnlyViewport + 0.01);
  });
});
