import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useNavigationBlocker } from '../hooks/useNavigationBlocker';
import type { Mock } from 'vitest';

const { useBlockerMock } = vi.hoisted(() => ({
  useBlockerMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useBlocker: useBlockerMock,
}));

function TestComponent({ shouldBlock, message }: { shouldBlock: boolean; message?: string }) {
  useNavigationBlocker(shouldBlock, message);
  return null;
}

describe('useNavigationBlocker', () => {
  const defaultBlocker = {
    state: 'unblocked',
    proceed: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useBlockerMock.mockReturnValue(defaultBlocker);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers and cleans up beforeunload handler when blocking is enabled', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = render(
      <TestComponent shouldBlock={true} message="Custom warning" />
    );

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const beforeUnloadHandler = addSpy.mock.calls.find(([event]) => event === 'beforeunload')?.[1] as EventListener;
    const event = new Event('beforeunload') as BeforeUnloadEvent;

    const returnMessage = beforeUnloadHandler(event);
    expect(returnMessage).toBe('Custom warning');

    rerender(<TestComponent shouldBlock={false} message="Custom warning" />);
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
  });

  it('passes correct route-change predicate to useBlocker', () => {
    render(<TestComponent shouldBlock={true} />);

    const predicate = (useBlockerMock as Mock).mock.calls[0][0] as (args: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) => boolean;

    expect(
      predicate({
        currentLocation: { pathname: '/cultures' },
        nextLocation: { pathname: '/cultures' },
      })
    ).toBe(false);

    expect(
      predicate({
        currentLocation: { pathname: '/cultures' },
        nextLocation: { pathname: '/fields-beds' },
      })
    ).toBe(true);
  });

  it('handles blocked state by confirming and proceeding or resetting', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    useBlockerMock.mockReturnValueOnce({
      state: 'blocked',
      proceed: vi.fn(),
      reset: vi.fn(),
    });

    confirmSpy.mockReturnValueOnce(true);
    const { rerender } = render(<TestComponent shouldBlock={true} message="Unsaved" />);

    const firstBlocker = (useBlockerMock as Mock).mock.results[0].value;
    expect(confirmSpy).toHaveBeenCalledWith('Unsaved');
    expect(firstBlocker.proceed).toHaveBeenCalledTimes(1);
    expect(firstBlocker.reset).not.toHaveBeenCalled();

    useBlockerMock.mockReturnValueOnce({
      state: 'blocked',
      proceed: vi.fn(),
      reset: vi.fn(),
    });

    confirmSpy.mockReturnValueOnce(false);
    rerender(<TestComponent shouldBlock={true} message="Unsaved" />);

    const secondBlocker = (useBlockerMock as Mock).mock.results[1].value;
    expect(secondBlocker.proceed).not.toHaveBeenCalled();
    expect(secondBlocker.reset).toHaveBeenCalledTimes(1);
  });
});
