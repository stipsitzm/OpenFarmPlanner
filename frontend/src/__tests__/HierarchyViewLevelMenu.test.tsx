import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HierarchyViewLevelMenu } from '../components/hierarchy/HierarchyViewLevelMenu';

describe('HierarchyViewLevelMenu', () => {
  it('opens the menu and reports the selected level, then closes', async () => {
    const user = userEvent.setup();
    const onSelectLevel = vi.fn();
    render(<HierarchyViewLevelMenu onSelectLevel={onSelectLevel} />);

    await user.click(screen.getByRole('button', { name: 'Darstellungstiefe der Baumansicht wählen' }));
    expect(screen.getByRole('menuitem', { name: 'Nur Standorte anzeigen' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Standorte und Parzellen anzeigen' }));
    expect(onSelectLevel).toHaveBeenCalledWith('locationsAndFields');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('offers all four presets in order', async () => {
    const user = userEvent.setup();
    render(<HierarchyViewLevelMenu onSelectLevel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Darstellungstiefe der Baumansicht wählen' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Nur Standorte anzeigen',
      'Standorte und Parzellen anzeigen',
      'Alle Ebenen anzeigen',
      'Alle einklappen',
    ]);
  });
});
