import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { matchesShortcut, isTypingInEditableElement, useKeyboardShortcuts, type ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { CommandPalette, filterCommands } from '../commands/CommandPalette';
import type { CommandSpec } from '../commands/types';

describe('useKeyboardShortcuts helpers', () => {
  it('matches alt/shift shortcut combinations exactly', () => {
    const event = new KeyboardEvent('keydown', { key: 'D', altKey: true, shiftKey: true });
    expect(matchesShortcut(event, { alt: true, shift: true, key: 'd' })).toBe(true);
    expect(matchesShortcut(event, { alt: true, key: 'd' })).toBe(false);
  });

  it('ignores typing focus for editable elements', () => {
    const input = document.createElement('input');
    expect(isTypingInEditableElement(input)).toBe(true);

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isTypingInEditableElement(div)).toBe(true);
  });
});

function ShortcutHarness({ contexts, shortcut }: { contexts: string[]; shortcut: ShortcutSpec }): JSX.Element {
  const [count, setCount] = useState(0);
  useKeyboardShortcuts([
    {
      ...shortcut,
      action: () => {
        setCount((value) => value + 1);
        shortcut.action();
      },
    },
  ], true, { currentContexts: contexts });

  return <div data-testid="count">{count}</div>;
}

describe('useKeyboardShortcuts context guard', () => {
  it('runs command only in matching context', () => {
    const action = vi.fn();
    render(
      <ShortcutHarness
        contexts={['global']}
        shortcut={{ id: 'a', title: 'A', keys: { alt: true, key: 'e' }, contexts: ['cultureDetail'], action }}
      />,
    );

    fireEvent.keyDown(window, { key: 'e', altKey: true });
    expect(action).not.toHaveBeenCalled();
  });
});

describe('command palette', () => {
  it('filters and executes a command', () => {
    const run = vi.fn();
    const commands: CommandSpec[] = [
      {
        id: 'culture.edit',
        title: 'Kultur bearbeiten (Alt+E)',
        keywords: ['kultur', 'bearbeiten'],
        shortcutHint: 'Alt+E',
        contextTags: ['cultureDetail'],
        isAvailable: () => true,
        run,
      },
    ];

    expect(filterCommands(commands, 'bearb')).toHaveLength(1);

    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Command Palette (Alt+K)' });
    fireEvent.change(input, { target: { value: 'bearb' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(run).toHaveBeenCalledTimes(1);
  });
});
