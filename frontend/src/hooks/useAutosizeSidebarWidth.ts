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

      // Rows: measure only the text elements, NOT the whole sidebar
      // This prevents the width from growing when expand/collapse buttons are clicked
      const rowTexts = container.querySelectorAll<HTMLElement>(rowTextSelector);
      const sidebars = container.querySelectorAll<HTMLElement>(sidebarSelector);
      
      rowTexts.forEach((textEl, idx) => {
        const sidebar = sidebars[idx];
        if (!sidebar) return;
        
        // Get the text width
        const textWidth = textEl.getBoundingClientRect().width;
        
        // Get sidebar paddings
        const style = getComputedStyle(sidebar);
        const paddings = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        
        // Add fixed width for expand button (28px) + gap (8px) for rows with expand buttons
        const expandButtonWidth = sidebar.querySelector('.gantt-expand-icon') ? 36 : 0;
        
        // Total width: text + paddings + expand button (if present)
        const totalWidth = Math.ceil(textWidth + paddings + expandButtonWidth);
        if (totalWidth > max) max = totalWidth;
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
