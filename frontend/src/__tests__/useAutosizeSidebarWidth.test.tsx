import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React, { useRef } from 'react';
import { useAutosizeSidebarWidth } from '../hooks/useAutosizeSidebarWidth';

function TestComponent() {
  const ref = useRef<HTMLDivElement>(null);
  useAutosizeSidebarWidth(ref, {}, []);

  return (
    <div ref={ref}>
      <div className="gantt-sidebar-header" style={{ paddingLeft: '4px', paddingRight: '6px' }}>
        <span className="gantt-sidebar-header-text">Header</span>
      </div>
      <div className="gantt-sidebar" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
        <span className="gantt-expand-icon">+</span>
        <span className="gantt-row-name">Row A</span>
      </div>
      <div className="gantt-sidebar" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
        <span className="gantt-row-name">Row B</span>
      </div>
    </div>
  );
}

describe('useAutosizeSidebarWidth', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const style = (el as HTMLElement).style;
      return {
        paddingLeft: style.paddingLeft || '0px',
        paddingRight: style.paddingRight || '0px',
      } as CSSStyleDeclaration;
    });

    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(50);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if ((this as HTMLElement).classList.contains('gantt-row-name')) {
        const text = (this as HTMLElement).textContent || '';
        return { width: text.includes('A') ? 80 : 40 } as DOMRect;
      }
      return { width: 0 } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets css variable based on measured content and updates on resize', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { container, unmount } = render(<TestComponent />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--gantt-sidebar-width')).toBe('136px');

    const onResize = addSpy.mock.calls.find(([evt]) => evt === 'resize')?.[1] as EventListener;
    onResize(new Event('resize'));
    expect(root.style.getPropertyValue('--gantt-sidebar-width')).toBe('136px');

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('does nothing when ref container is missing', () => {
    function Empty() {
      const ref = React.useRef<HTMLDivElement>(null);
      useAutosizeSidebarWidth(ref, {}, []);
      return null;
    }

    expect(() => render(<Empty />)).not.toThrow();
  });
});
