import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CommandProvider } from '../commands/CommandProvider';
import FieldsBedsPage from '../pages/FieldsBedsPage';

vi.mock('../pages/FieldsBedsHierarchy', () => ({
  default: () => <div>Listenansicht aktiv</div>,
}));

vi.mock('../pages/GraphicalFields', () => ({
  default: () => <div>Grafikansicht aktiv</div>,
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

vi.mock('../components/hierarchy/hooks/useHierarchyData', () => ({
  useHierarchyData: () => ({
    loading: false,
    hasLoaded: true,
    locations: [{ id: 1, name: 'Hofstelle' }],
    fields: [{ id: 11, name: 'Nord', location: 1 }],
    beds: [{ id: 21, name: 'Beet A', field: 11 }],
    fetchData: vi.fn(),
  }),
}));

describe('FieldsBedsPage Alt+G integration', () => {
  it('toggles repeatedly through the global command shortcut without reloading', async () => {
    render(
      <MemoryRouter initialEntries={['/app/fields-beds']}>
        <CommandProvider>
          <FieldsBedsPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Listenansicht aktiv')).toBeInTheDocument();
    const initialPathname = window.location.pathname;

    const expectedViews = [
      'Grafikansicht aktiv',
      'Listenansicht aktiv',
      'Grafikansicht aktiv',
      'Listenansicht aktiv',
      'Grafikansicht aktiv',
      'Listenansicht aktiv',
    ];

    for (const expectedView of expectedViews) {
      fireEvent.keyDown(window, { key: 'g', altKey: true });
      await waitFor(() => {
        expect(screen.getByText(expectedView)).toBeInTheDocument();
      });
    }

    expect(window.location.pathname).toBe(initialPathname);
  });
});
