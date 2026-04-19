import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FieldsBedsPage from '../pages/FieldsBedsPage';

const { locationListMock, addFieldMock, navigateMock } = vi.hoisted(() => ({
  locationListMock: vi.fn(),
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
  beforeEach(() => {
    locationListMock.mockReset();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    locationListMock.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Hofstelle' }],
      },
    });
    addFieldMock.mockReset();
    navigateMock.mockReset();
    window.localStorage.clear();
  });

  it('switches between hierarchy and graphical view via representation buttons', async () => {
    render(<FieldsBedsPage />);

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
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

    render(<FieldsBedsPage />);

    expect(await screen.findByText('Du hast noch kein Projekt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Projekt erstellen' })).toBeInTheDocument();
    expect(screen.queryByText('Hierarchieansicht')).not.toBeInTheDocument();
    expect(locationListMock).not.toHaveBeenCalled();
  });
});
