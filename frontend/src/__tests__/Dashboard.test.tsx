import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';

const mocks = vi.hoisted(() => ({
  locationList: vi.fn(),
  fieldList: vi.fn(),
  bedList: vi.fn(),
  cultureList: vi.fn(),
  planList: vi.fn(),
}));

const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | 'no_projects' | 'no_active_project',
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: { ...actual.locationAPI, list: mocks.locationList },
    fieldAPI: { ...actual.fieldAPI, list: mocks.fieldList },
    bedAPI: { ...actual.bedAPI, list: mocks.bedList },
    cultureAPI: { ...actual.cultureAPI, list: mocks.cultureList },
    plantingPlanAPI: { ...actual.plantingPlanAPI, list: mocks.planList },
  };
});

vi.mock('../hooks/useProjectRequirement', () => ({ useProjectRequirement: () => projectRequirementState }));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    mocks.locationList.mockResolvedValue({ data: { results: [] } });
    mocks.fieldList.mockResolvedValue({ data: { results: [] } });
    mocks.bedList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [] } });
    mocks.planList.mockResolvedValue({ data: { results: [] } });
  });

  it('shows unified onboarding checklist for a completely empty project', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText('Projektstart')).toBeInTheDocument();
    expect(screen.getByText('OpenFarmPlanner unterstützt dich bei der strukturierten Planung von Flächen, Kulturen und Anbauzyklen. Beginne mit dem ersten Schritt deiner Anbauplanung.')).toBeInTheDocument();
    const createLocationLinks = screen.getAllByRole('link', { name: 'Standort hinzufügen' });
    expect(createLocationLinks).toHaveLength(1);
    expect(createLocationLinks[0]).toHaveAttribute('href', '/app/locations?create=true');
    expect(screen.queryByRole('link', { name: 'Parzelle hinzufügen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Anstehende Aufgaben')).not.toBeInTheDocument();
  });

  it('keeps the same onboarding card for partially configured projects', async () => {
    mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Projektstart')).toBeInTheDocument();
    expect(screen.queryByText('Starte deine Anbauplanung')).not.toBeInTheDocument();
  });

  it('shows aggregated upcoming tasks and ready state when setup is complete', async () => {
    mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
    mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: 'Nord', location: 1 }] } });
    mocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet A', field: 2 }] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 4, name: 'Salat', growth_duration_days: 10 }] } });
    mocks.planList.mockResolvedValue({ data: { results: [{ id: 5, culture: 4, bed: 3, planting_date: '2099-01-01', culture_name: 'Salat' }] } });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Anstehende Aufgaben')).toBeInTheDocument();
    expect(screen.queryByText('Standort hinzufügen')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Parzelle hinzufügen' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dein Projekt ist eingerichtet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Starte deine Anbauplanung')).not.toBeInTheDocument();
    expect(screen.getByText('Anstehende Aufgaben')).toBeInTheDocument();
    expect(screen.queryByText('Keine anstehenden Aufgaben vorhanden')).not.toBeInTheDocument();
  });

  it('shows compact tasks empty state when setup is complete but there are no upcoming tasks', async () => {
    mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
    mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: 'Nord', location: 1 }] } });
    mocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet A', field: 2 }] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 4, name: 'Salat' }] } });
    mocks.planList.mockResolvedValue({ data: { results: [{ id: 5, culture: 4, bed: 3, planting_date: '2020-01-01', culture_name: 'Salat' }] } });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Keine anstehenden Aufgaben')).toBeInTheDocument();
    expect(screen.getByText('Aktuell gibt es keine anstehenden Aufgaben für dieses Projekt.')).toBeInTheDocument();
  });
});
