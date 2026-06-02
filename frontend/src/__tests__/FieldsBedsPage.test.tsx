import { fireEvent, render, screen } from '@testing-library/react';
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
  default: ({ createFieldRequest }: { createFieldRequest?: number }) => (
    <div>
      <div>Hierarchieansicht</div>
      <div data-testid="create-field-request">{createFieldRequest ?? 0}</div>
    </div>
  ),
}));

vi.mock('../pages/GraphicalFields', () => ({
  default: ({ interactionMode }: { interactionMode?: 'view' | 'edit' }) => (
    <div>{`Editiermodus-${interactionMode ?? 'none'}`}</div>
  ),
}));

vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
  useRegisterCreateActions: vi.fn(),
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

  it('restores graphical view from persisted state', async () => {
    window.localStorage.setItem('fieldsBedsViewMode', 'graphical');

    renderPage();

    expect(await screen.findByText('Editiermodus-view')).toBeInTheDocument();
    expect(screen.queryByText('Hierarchieansicht')).not.toBeInTheDocument();
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


  it('starts inline add-field editing via query parameter instead of native prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    render(
      <MemoryRouter initialEntries={['/app/fields-beds?create=true']}>
        <FieldsBedsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.getByTestId('create-field-request')).toHaveTextContent('1');
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
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
    expect(screen.getByTestId('create-field-request')).toHaveTextContent('1');
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
