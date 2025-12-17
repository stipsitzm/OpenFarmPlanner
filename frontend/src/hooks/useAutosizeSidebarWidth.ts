import { useLayoutEffect, type DependencyList, type RefObject } from 'react';

interface Options {
  headerTextSelector?: string;
  headerContainerSelector?: string;
  rowTextSelector?: string;
  sidebarSelector?: string;
  cssVarName?: string;
}

/**
 * useAutosizeSidebarWidth
 *
 * Measures the intrinsic width of sidebar text (header and rows) plus their paddings
 * and sets a CSS custom property on the given container element to keep the first
 * column at a consistent width that exactly fits the longest single-line content.
 *
 * Notes:
 * - Expects the text elements to have `white-space: nowrap` so `scrollWidth` reflects
 *   the true single-line width.
 * - Re-measures on window resize and when `deps` change.
 */
export function useAutosizeSidebarWidth(
  containerRef: RefObject<HTMLElement | null>,
  options: Options = {},
  deps: DependencyList = []
): void {
  const {
    headerTextSelector = '.gantt-sidebar-header-text',
    headerContainerSelector = '.gantt-sidebar-header',
    rowTextSelector = '.gantt-row-name',
    sidebarSelector = '.gantt-sidebar',
    cssVarName = '--gantt-sidebar-width',
  } = options;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      let max = 0;

      // Header: text width + padding
      const headerSpan = container.querySelector<HTMLElement>(headerTextSelector);
      const headerContainer = container.querySelector<HTMLElement>(headerContainerSelector);
      if (headerSpan && headerContainer) {
        const hc = getComputedStyle(headerContainer);
        const headerPaddings = parseFloat(hc.paddingLeft) + parseFloat(hc.paddingRight);
        const headerWidth = Math.ceil(headerSpan.scrollWidth + headerPaddings);
        if (headerWidth > max) max = headerWidth;
      }

      // Rows: measure entire sidebar width including expand button, gap, and text
      const sidebars = container.querySelectorAll<HTMLElement>(sidebarSelector);
      sidebars.forEach((sidebar) => {
        // Use scrollWidth to get the full width including all child elements
        const w = Math.ceil(sidebar.scrollWidth + 20); // Add 20px buffer for safety
        if (w > max) max = w;
      });

      if (max > 0) {
        container.style.setProperty(cssVarName, `${max}px`);
      }
    };

    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useAutosizeSidebarWidth;
