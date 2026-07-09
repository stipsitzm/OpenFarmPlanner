import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Draws a custom vertical scrollbar for the hierarchy table, sized and
 * positioned against the TRUE total row height across every internal page
 * (see useHierarchyRowWindow) instead of just the ~100 rows currently
 * mounted.
 *
 * The free @mui/x-data-grid's own floating scrollbar (`.MuiDataGrid-scrollbar
 * --vertical`) sizes itself from the grid's current content height, which —
 * under useHierarchyRowWindow's paging workaround — only ever reflects the
 * loaded page. Every page swap changes that page's content height (rows vary
 * from ~36px beds to ~46px locations, and the last page is usually shorter),
 * so the native thumb's size and position visibly reset/jump on every
 * transition even though the user experiences it as one continuous scroll.
 * This hook computes exact cumulative row-top offsets from the real row
 * heights (not an estimate) so the thumb's size/position are stable and
 * continuous across page boundaries.
 *
 * The real scroll container (`.MuiDataGrid-virtualScroller`) is left
 * scrollable via wheel/touch/keyboard exactly as before — this hook only
 * mirrors its position for display and, when the user drags the thumb,
 * drives it via scrollTop/ensureRowIndexVisible (crossing page boundaries as
 * needed).
 *
 * `trackRef` is created and attached by the caller (not by this hook) so its
 * identity is a plain component-owned ref the linter can follow — bundling a
 * ref inside this hook's returned object made every other property on that
 * object look like a ref access to eslint-plugin-react-hooks' static
 * analysis.
 */

const THUMB_MIN_HEIGHT_PX = 24;
// totalContentHeight (summed from our own per-row heights) and viewportHeight
// (measured from the scroll container's real clientHeight) each land within
// a couple of px of each other purely from the grid's own border and
// sub-pixel layout rounding, even when every row is fully visible with
// nothing to scroll. Without this tolerance, that discrepancy alone flipped
// isActive to true and drew a scrollbar for hierarchies that fit the
// viewport outright (e.g. a handful of collapsed top-level rows).
const OVERFLOW_TOLERANCE_PX = 4;

export interface HierarchyRowWindowForScrollbar {
  page: number;
  pageSize: number;
  pageCount: number;
  ensureRowIndexVisible: (rowIndex: number) => boolean;
}

export interface HierarchyStableScrollbar {
  /** False when content fits without scrolling — nothing should render. */
  isActive: boolean;
  thumbHeight: number;
  thumbTop: number;
  onThumbPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTrackPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function useHierarchyStableScrollbar(
  rowHeights: number[],
  rowWindow: HierarchyRowWindowForScrollbar,
  scrollContainerSelector: string,
  wrapperRef: React.RefObject<HTMLElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>,
  headerHeight: number,
): HierarchyStableScrollbar {
  const totalRowCount = rowHeights.length;
  const { page, pageSize, ensureRowIndexVisible } = rowWindow;

  // prefixOffsets[i] is the pixel offset of the top of row i within the full
  // (all-pages) row list; prefixOffsets[totalRowCount] is the total content
  // height. Built from the same exact per-row heights the grid itself uses
  // (getRowHeight), not an average/estimate.
  const prefixOffsets = useMemo(() => {
    const offsets = new Array<number>(totalRowCount + 1);
    offsets[0] = 0;
    for (let i = 0; i < totalRowCount; i += 1) {
      offsets[i + 1] = offsets[i] + rowHeights[i];
    }
    return offsets;
  }, [rowHeights, totalRowCount]);

  const totalContentHeight = prefixOffsets[totalRowCount] ?? 0;
  const pageStartOffset = prefixOffsets[Math.min(page * pageSize, totalRowCount)] ?? 0;

  const [viewportHeight, setViewportHeight] = useState(0);
  const [localScrollTop, setLocalScrollTop] = useState(0);

  const getContainer = useCallback((): HTMLElement | null => (
    wrapperRef.current?.querySelector<HTMLElement>(scrollContainerSelector) ?? null
  ), [scrollContainerSelector, wrapperRef]);

  // Re-measures on every page change (not just via the scroll/resize
  // listeners below) because a page transition can move scrollTop
  // programmatically (see useHierarchyRowWindow's reset-to-edge effect)
  // before this effect's listener has a chance to observe the resulting
  // 'scroll' event in some environments (e.g. jsdom doesn't fire one for
  // programmatic scrollTop assignment at all).
  useLayoutEffect(() => {
    const container = getContainer();
    const measure = (): void => {
      // container.clientHeight is the *whole* scrollable area, including the
      // column header row — MUI renders GridHeaders as a sticky element
      // inside .MuiDataGrid-virtualScroller itself, not as a sibling above
      // it. The track (see FieldsBedsHierarchy.tsx) is positioned below the
      // header (top: headerHeight), so its actual rendered height is
      // clientHeight - headerHeight; using the unadjusted clientHeight here
      // made the thumb's travel range taller than the track it's drawn in,
      // letting it overflow past the track's bottom edge once scrolled to
      // the very end.
      setViewportHeight(container ? Math.max(0, container.clientHeight - headerHeight) : 0);
      setLocalScrollTop(container ? container.scrollTop : 0);
    };
    measure();
    if (!container) {
      return undefined;
    }

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(container);
    }

    container.addEventListener("scroll", measure, { passive: true });
    return () => {
      resizeObserver?.disconnect();
      container.removeEventListener("scroll", measure);
    };
  }, [getContainer, page, headerHeight]);

  const globalScrollTop = pageStartOffset + localScrollTop;
  const maxGlobalScrollTop = Math.max(0, totalContentHeight - viewportHeight);
  const isActive = totalContentHeight > viewportHeight + OVERFLOW_TOLERANCE_PX && viewportHeight > 0;

  const thumbHeight = isActive
    ? Math.max(THUMB_MIN_HEIGHT_PX, (viewportHeight / totalContentHeight) * viewportHeight)
    : 0;
  const thumbTravel = Math.max(0, viewportHeight - thumbHeight);
  const thumbTop = isActive && maxGlobalScrollTop > 0
    ? (Math.min(globalScrollTop, maxGlobalScrollTop) / maxGlobalScrollTop) * thumbTravel
    : 0;

  // Largest row index whose top offset is <= targetOffset.
  const rowIndexAtOffset = useCallback((targetOffset: number): number => {
    if (totalRowCount === 0) {
      return 0;
    }
    let low = 0;
    let high = totalRowCount - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (prefixOffsets[mid] <= targetOffset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }, [prefixOffsets, totalRowCount]);

  // Set by scrollToGlobalOffset right before it triggers a page change, and
  // consumed by the effect below once that page's container is on screen —
  // mirrors the pendingResetRef pattern in useHierarchyRowWindow, but for an
  // arbitrary drag-target offset instead of a fixed top/bottom edge.
  const pendingGlobalOffsetRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingGlobalOffsetRef.current === null) {
      return;
    }
    const container = getContainer();
    const target = pendingGlobalOffsetRef.current;
    pendingGlobalOffsetRef.current = null;
    const applyPendingScroll = (): void => {
      if (!container) {
        return;
      }
      container.scrollTop = target - pageStartOffset;
      setLocalScrollTop(container.scrollTop);
    };
    applyPendingScroll();
  }, [page, getContainer, pageStartOffset]);

  const scrollToGlobalOffset = useCallback((targetOffset: number): void => {
    const clamped = Math.min(Math.max(0, targetOffset), maxGlobalScrollTop);
    const targetRowIndex = rowIndexAtOffset(clamped);
    const targetPage = Math.floor(targetRowIndex / pageSize);
    if (targetPage !== page) {
      pendingGlobalOffsetRef.current = clamped;
      ensureRowIndexVisible(targetRowIndex);
      return;
    }
    const container = getContainer();
    if (container) {
      container.scrollTop = clamped - pageStartOffset;
      setLocalScrollTop(container.scrollTop);
    }
  }, [ensureRowIndexVisible, getContainer, maxGlobalScrollTop, page, pageSize, pageStartOffset, rowIndexAtOffset]);

  const onThumbPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (thumbTravel <= 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startClientY = event.clientY;
    const startGlobalScrollTop = globalScrollTop;
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const deltaRatio = (moveEvent.clientY - startClientY) / thumbTravel;
      scrollToGlobalOffset(startGlobalScrollTop + deltaRatio * maxGlobalScrollTop);
    };
    const handleUp = (): void => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [globalScrollTop, maxGlobalScrollTop, scrollToGlobalOffset, thumbTravel]);

  const onTrackPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (event.target !== track || !track || totalContentHeight <= 0) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const clickRatio = (event.clientY - rect.top) / rect.height;
    scrollToGlobalOffset(clickRatio * totalContentHeight - viewportHeight / 2);
  }, [scrollToGlobalOffset, totalContentHeight, trackRef, viewportHeight]);

  return useMemo(() => ({
    isActive,
    thumbHeight,
    thumbTop,
    onThumbPointerDown,
    onTrackPointerDown,
  }), [isActive, thumbHeight, thumbTop, onThumbPointerDown, onTrackPointerDown]);
}
