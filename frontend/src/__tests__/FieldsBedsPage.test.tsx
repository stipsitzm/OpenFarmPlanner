import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FieldsBedsPage from '../pages/FieldsBedsPage';
import { MemoryRouter } from 'react-router-dom';

const { locationListMock, fieldListMock, bedListMock, addFieldMock, navigateMock } = vi.hoisted(() => ({
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
  addFieldMock: vi.fn(),
  navigateMock: vi.fn(),
}));
const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | 'no_projects' | 'no_active_project',
}));

vi.mock('../pages/FieldsBedsHierarchy', () => ({
  default: () => <div>Hierarchieansicht</div>,
}));

vi.mock('../pages/GraphicalFields', () => ({
  default: ({ interactionMode }: { interactionMode?: 'view' | 'edit' }) => (
    <div>{`Editiermodus-${interactionMode ?? 'none'}`}</div>
  ),
}));

vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: {
      list: locationListMock,
    },
    fieldAPI: {
      list: fieldListMock,
    },
    bedAPI: {
      list: bedListMock,
    },
  };
});

vi.mock('../components/hierarchy/hooks/useFieldOperations', () => ({
  useFieldOperations: () => ({
    addField: addFieldMock,
    deleteField: vi.fn(),
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => projectRequirementState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('FieldsBedsPage', () => {
  const renderPage = (): void => {
    render(
      <MemoryRouter>
        <FieldsBedsPage />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    locationListMock.mockReset();
    fieldListMock.mockReset();
    bedListMock.mockReset();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    locationListMock.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Hofstelle' }],
      },
    });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 11, name: 'Nord' }] } });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'A', field: 11 }] } });
    addFieldMock.mockReset();
    navigateMock.mockReset();
    window.localStorage.clear();
  });

  it('switches between hierarchy and graphical view via representation buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Editiermodus-/)).not.toBeInTheDocument();
    expect(screen.getByText('Darstellung')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Parzelle hinzufügen' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Modus')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ansicht' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Grafik' }));

    expect(screen.getByText('Editiermodus-view')).toBeInTheDocument();
    expect(screen.getByText('Modus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ansicht' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.queryByText(/Editiermodus-/)).not.toBeInTheDocument();
    expect(screen.queryByText('Modus')).not.toBeInTheDocument();
  });

  it('shows a neutral project-required state when no project is available', async () => {
    projectRequirementState.shouldShowProjectRequiredState = true;
    projectRequirementState.missingProjectReason = 'no_projects';

    renderPage();

    expect(await screen.findByText('Du hast noch kein Projekt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erstes Projekt anlegen' })).toBeInTheDocument();
    expect(screen.queryByText('Hierarchieansicht')).not.toBeInTheDocument();
    expect(locationListMock).not.toHaveBeenCalled();
  });

  it('shows the global add button when exactly one location exists', async () => {
    locationListMock.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Hofstelle' }],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Parzelle hinzufügen' })).toBeInTheDocument();
    });
  });

  it('opens a translated add-field dialog instead of native prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    renderPage();

    const addButton = await screen.findByRole('button', { name: 'Parzelle hinzufügen' });
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Parzelle hinzufügen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name der Parzelle')).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('prevents saving an empty field name in add-field dialog', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Parzelle hinzufügen' }));

    const nameInput = screen.getByLabelText('Name der Parzelle');
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled();
  });

  it('hides the global add button when more than one location exists', async () => {
    locationListMock.mockResolvedValue({
      data: {
        results: [
          { id: 1, name: 'Hofstelle' },
          { id: 2, name: 'Obstgarten' },
        ],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Parzelle hinzufügen' })).not.toBeInTheDocument();
    });
  });

  it('shows onboarding empty-state when no area hierarchy exists', async () => {
    locationListMock.mockResolvedValue({ data: { results: [] } });
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    renderPage();

    expect(await screen.findByText('Noch keine Anbauflächen vorhanden')).toBeInTheDocument();
    expect(screen.queryByText('Keine Einträge vorhanden')).not.toBeInTheDocument();
    expect(screen.getByText('Standort fehlt')).toBeInTheDocument();
  });

  it('shows missing field requirement when location exists but no fields exist', async () => {
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hofstelle' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    renderPage();
    expect(await screen.findByText('Parzelle fehlt')).toBeInTheDocument();
    const matchingButtons = await screen.findAllByRole('button', { name: 'Parzelle hinzufügen' });
    fireEvent.click(matchingButtons[matchingButtons.length - 1]);
    expect(await screen.findByRole('heading', { name: 'Parzelle hinzufügen' })).toBeInTheDocument();
  });

  it('shows missing bed requirement when fields exist but no beds exist', async () => {
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hofstelle' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 3, name: 'Nord' }] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    renderPage();
    expect(await screen.findByText('Es sind noch keine Beete vorhanden.')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Füge Beete über das') && content.includes('Symbol bei der jeweiligen Parzelle hinzu.'))).toBeInTheDocument();
    expect(screen.getByTestId('AddIcon')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Anbauflächen vorhanden')).not.toBeInTheDocument();
  });
});
