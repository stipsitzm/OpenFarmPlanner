import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { CommandProvider, useCommandContext, useRegisterCommands } from '../commands/CommandProvider';
import { createRootCommands } from '../commands/commands';
import type { CommandSpec } from '../commands/types';

function CommandFixture({ available }: { available: boolean }): React.ReactElement {
  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'fixture.command',
      label: 'Fixture Command',
      group: 'project',
      keywords: ['fixture'],
      shortcutHint: 'Alt+X',
      contextTags: ['global'],
      isEnabled: () => available,
      action: vi.fn(),
    },
  ], [available]);

  useRegisterCommands('fixture', commands);
  return <div>fixture</div>;
}

function RootCommandFixture(props: {
  currentPath?: string;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  onOpenPalette?: () => void;
  onOpenProjectSettings?: () => void;
}): React.ReactElement {
  const { openPalette } = useCommandContext();
  const commands = useMemo(() => createRootCommands({
    currentPath: props.currentPath ?? '/app/cultures',
    activeProjectId: 1,
    isProjectAdmin: true,
    memberships: [
      { project_id: 1, project_name: 'Demo' },
      { project_id: 2, project_name: 'Garten' },
    ],
    onNextPage: props.onNextPage ?? vi.fn(),
    onPreviousPage: props.onPreviousPage ?? vi.fn(),
    onOpenProjectSettings: props.onOpenProjectSettings ?? vi.fn(),
    onOpenProjectMembers: vi.fn(),
    onOpenCreateProject: vi.fn(),
    onSwitchProject: vi.fn(),
    onOpenAccountSettings: vi.fn(),
    onOpenVersionHistory: vi.fn(),
    onLogout: vi.fn(),
    onOpenPalette: props.onOpenPalette ?? openPalette,
    onOpenShortcuts: vi.fn(),
    labels: {
      nextPage: 'Nächste Seite',
      previousPage: 'Vorherige Seite',
      openProjectSettings: 'Projekteinstellungen',
      openProjectMembers: 'Projektmitglieder',
      createProject: 'Projekt erstellen',
      switchProjectPrefix: 'Projekt wechseln',
      openAccountSettings: 'Kontoeinstellungen',
      openVersionHistory: 'Versionsverlauf',
      logout: 'Abmelden',
      openPalette: 'Aktionssuche',
      openShortcuts: 'Tastenkürzel',
    },
  }), [openPalette, props.currentPath, props.onNextPage, props.onOpenPalette, props.onOpenProjectSettings, props.onPreviousPage]);

  useRegisterCommands('root', commands);
  return <div>root fixture</div>;
}

describe('CommandProvider', () => {
  beforeEach(() => {
    localStorage.setItem('ofp.shortcutHintSeen', '1');
  });

  it('hides unavailable commands in palette', async () => {
    render(
      <CommandProvider>
        <CommandFixture available={false} />
      </CommandProvider>,
    );

    fireEvent.keyDown(window, { key: 'k', altKey: true });

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

  it('shows root shortcut commands but hides direct page navigation entries', () => {
    render(
      <CommandProvider>
        <RootCommandFixture currentPath="/app/cultures" />
      </CommandProvider>,
    );

    fireEvent.keyDown(window, { key: 'k', altKey: true });

    expect(screen.getByText('Aktionssuche')).toBeInTheDocument();
    expect(screen.getByText('Tastenkürzel')).toBeInTheDocument();
    expect(screen.getByText('Projekteinstellungen')).toBeInTheDocument();
    expect(screen.getByText('Projekt wechseln: Garten')).toBeInTheDocument();
    expect(screen.getByText('Nächste Seite')).toBeInTheDocument();
    expect(screen.getByText('Alt+Shift+P')).toBeInTheDocument();
    expect(screen.getByText('Alt+Shift+N')).toBeInTheDocument();
    expect(screen.getByText('Alt+1')).toBeInTheDocument();
    expect(screen.getByText('Alt+Shift+A')).toBeInTheDocument();
    expect(screen.getByText('Alt+Shift+V')).toBeInTheDocument();
    expect(screen.getByText('Alt+Shift+L')).toBeInTheDocument();
    expect(screen.queryByText('Standorte')).not.toBeInTheDocument();
  });

  it('opens the command palette with Alt+K when not typing', () => {
    render(
      <CommandProvider>
        <RootCommandFixture />
      </CommandProvider>,
    );

    fireEvent.keyDown(window, { key: 'k', altKey: true });

    expect(screen.getByRole('textbox', { name: 'Aktionssuche (Alt+K)' })).toBeInTheDocument();
  });

  it('does not open the command palette with Alt+K while typing in an input', () => {
    render(
      <CommandProvider>
        <RootCommandFixture />
        <input aria-label="focused input" />
      </CommandProvider>,
    );

    const input = screen.getByRole('textbox', { name: 'focused input' });
    input.focus();
    fireEvent.keyDown(window, { key: 'k', altKey: true });

    expect(screen.queryByRole('textbox', { name: 'Aktionssuche (Alt+K)' })).not.toBeInTheDocument();
  });

  it('keeps Ctrl+Shift+Arrow navigation working through root commands', () => {
    const onNextPage = vi.fn();
    render(
      <CommandProvider>
        <RootCommandFixture onNextPage={onNextPage} />
      </CommandProvider>,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, shiftKey: true });

    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it('runs root project settings shortcut from shared command metadata', () => {
    const onOpenProjectSettings = vi.fn();
    render(
      <CommandProvider>
        <RootCommandFixture onOpenProjectSettings={onOpenProjectSettings} />
      </CommandProvider>,
    );

    fireEvent.keyDown(window, { key: 'P', altKey: true, shiftKey: true });

    expect(onOpenProjectSettings).toHaveBeenCalledTimes(1);
  });
});
