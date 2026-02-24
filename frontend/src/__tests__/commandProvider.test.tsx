import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { CommandProvider, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';

function CommandFixture({ available }: { available: boolean }): React.ReactElement {
  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'fixture.command',
      title: 'Fixture Command',
      keywords: ['fixture'],
      shortcutHint: 'Alt+X',
      contextTags: ['global'],
      isAvailable: () => available,
      run: vi.fn(),
    },
  ], [available]);

  useRegisterCommands('fixture', commands);
  return <div>fixture</div>;
}

describe('CommandProvider', () => {
  it('hides unavailable commands in palette', async () => {
    localStorage.setItem('ofp.shortcutHintSeen', '1');
    render(
      <CommandProvider>
        <CommandFixture available={false} />
      </CommandProvider>,
    );

    await userEvent.keyboard('{Alt>}k{/Alt}');

    expect(screen.queryByText('Fixture Command')).not.toBeInTheDocument();
  });

  it('shows one-time shortcut hint only once', async () => {
    vi.useFakeTimers();
    localStorage.removeItem('ofp.shortcutHintSeen');

    const { rerender } = render(
      <CommandProvider>
        <div>first</div>
      </CommandProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorage.getItem('ofp.shortcutHintSeen')).toBe('1');

    rerender(
      <CommandProvider>
        <div>second</div>
      </CommandProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorage.getItem('ofp.shortcutHintSeen')).toBe('1');

    vi.useRealTimers();
  });
});
