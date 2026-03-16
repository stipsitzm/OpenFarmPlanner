import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

const { navigateMock, useNavigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useNavigateMock: vi.fn(),
}));
let currentPathname = '/anbauplaene';
useNavigateMock.mockImplementation(() => navigateMock);

vi.mock('react-router-dom', () => ({
  useNavigate: useNavigateMock,
  useLocation: () => ({ pathname: currentPathname }),
}));

function TestComponent() {
  useKeyboardNavigation();
  return null;
}

describe('useKeyboardNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = '/anbauplaene';
    document.body.innerHTML = '';
  });

  it('navigates to next route on Ctrl+Shift+ArrowRight from Anbaupläne', () => {
    render(<TestComponent />);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(navigateMock).toHaveBeenCalledWith('/app/gantt-chart');
  });

  it('wraps to last route on Ctrl+Shift+ArrowLeft from Anbaupläne', () => {
    currentPathname = '/anbauplaene';
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/app/cultures');
  });


  it('navigates from gantt to seed-demand on Ctrl+Shift+ArrowRight', () => {
    currentPathname = '/gantt-chart';
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/app/seed-demand');
  });


  it('wraps to first route on Ctrl+Shift+ArrowRight from suppliers', () => {
    currentPathname = '/suppliers';
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/app/locations');
  });

  it('falls back to Anbaupläne when current route is unknown', () => {
    currentPathname = '/unknown-path';
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/app/anbauplaene');
  });


  it('treats /planting-plans as Anbaupläne for shortcut navigation', () => {
    currentPathname = '/planting-plans';
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).toHaveBeenCalledWith('/app/gantt-chart');
  });

  it('ignores shortcut when typing in input/textarea/contenteditable', () => {
    const { unmount } = render(<TestComponent />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(navigateMock).not.toHaveBeenCalled();

    input.blur();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(navigateMock).not.toHaveBeenCalled();

    textarea.blur();
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.tabIndex = 0;
    document.body.appendChild(editable);
    editable.focus();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).not.toHaveBeenCalled();
    unmount();
  });

  it('ignores non-matching keyboard combinations', () => {
    render(<TestComponent />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        bubbles: true,
      })
    );

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
