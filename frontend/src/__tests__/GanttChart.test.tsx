import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProvider } from '../commands/CommandProvider';
import GanttChartPage from '../pages/GanttChart';

const mocks = vi.hoisted(() => ({
  locationList: vi.fn(),
  fieldList: vi.fn(),
  bedList: vi.fn(),
  planList: vi.fn(),
  cultureList: vi.fn(),
  yieldList: vi.fn(),
  planUpdate: vi.fn(),
  ganttProps: vi.fn(),
}));
const topbarContext = vi.hoisted(() => ({
  setTopbarContextActions: vi.fn(),
  latestActions: [] as Array<Record<string, unknown>>,
}));
const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | 'no_projects' | 'no_active_project',
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: { list: mocks.locationList },
    fieldAPI: { list: mocks.fieldList },
    bedAPI: { list: mocks.bedList },
    plantingPlanAPI: { list: mocks.planList, update: mocks.planUpdate },
    cultureAPI: { list: mocks.cultureList },
    yieldCalendarAPI: { list: mocks.yieldList },
  };
});

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => projectRequirementState,
}));


vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      setTopbarContextActions: (actions: Array<Record<string, unknown>>) => {
        topbarContext.latestActions = actions;
        topbarContext.setTopbarContextActions(actions);
      },
    }),
  };
});

vi.mock('react-modern-gantt', () => ({
  __esModule: true,
  default: (props: {
    tasks: Array<{ name: string; tasks: Array<Record<string, unknown> & { id: string; name: string }> }>;
    renderTooltip?: ({ task }: { task: Record<string, unknown> }) => ReactNode;
    onTaskUpdate?: (groupId: string, task: { id: string; startDate: Date }) => void | Promise<void>;
    locale?: string;
    localeText?: Record<string, unknown>;
  }) => {
    mocks.ganttProps(props);
    const firstTask = props.tasks[0]?.tasks[0];
    const firstGroupName = props.tasks[0]?.name ?? '';
    return (
      <div data-testid="mock-gantt">
        {firstTask && props.onTaskUpdate ? (
          <button
            type="button"
            data-testid="mock-update-task"
            onClick={() => {
              void props.onTaskUpdate(firstGroupName, {
                id: String(firstTask.id),
                startDate: new Date('2026-04-05'),
              });
            }}
          >
            update-task
          </button>
        ) : null}
        {props.tasks.map((group) => (
        <div key={group.name}>
          <span>{group.name}</span>
          {group.tasks.map((task) => <span key={`${group.name}-${task.name}`}>{task.name}</span>)}
          {group.tasks[0] && props.renderTooltip ? (
            <div data-testid={`mock-tooltip-${group.name}`}>
              {props.renderTooltip({ task: group.tasks[0] })}
            </div>
          ) : null}
        </div>
        ))}
      </div>
    );
  },
  ViewMode: {
    MINUTE: 'minute',
    HOUR: 'hour',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    QUARTER: 'quarter',
    YEAR: 'year',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  projectRequirementState.shouldShowProjectRequiredState = false;
  projectRequirementState.missingProjectReason = null;

  mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
  mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: 'Feld', location: 1 }] } });
  mocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet 1', field: 2 }] } });
  mocks.planUpdate.mockResolvedValue({ data: {} });
  mocks.yieldList.mockResolvedValue({ data: [] });
  topbarContext.setTopbarContextActions.mockReset();
  topbarContext.latestActions = [];
});

describe('GanttChartPage', () => {
  it('shows location-specific guidance when no locations exist', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [] } });
    mocks.bedList.mockResolvedValue({ data: { results: [] } });
    mocks.locationList.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Noch keine Anbauplanung möglich')).toBeInTheDocument());
    expect(screen.getByText('Lege zuerst einen Standort an. Danach kannst du Parzellen, Beete, Kulturen und Anbaupläne erfassen.')).toBeInTheDocument();
    expect(screen.getByText('Standort fehlt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Standort hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByText('Kultur fehlt')).not.toBeInTheDocument();
    expect(screen.queryByText('Beet fehlt')).not.toBeInTheDocument();
    expect(screen.queryByText('Anbauplan fehlt')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kultur anlegen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Anbauflächen anlegen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Feldbelegung' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ansicht' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ertragsverteilung')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-gantt')).not.toBeInTheDocument();
  });

  it('shows "Anbauplan fehlt" when cultures and beds exist but no plan exists', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Anbauplan fehlt')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Anbauplan hinzufügen' })).toBeInTheDocument();
  });

  it('shows project-required info instead of a red load error when no project is active', async () => {
    projectRequirementState.shouldShowProjectRequiredState = true;
    projectRequirementState.missingProjectReason = 'no_active_project';

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Es ist aktuell kein Projekt ausgewählt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Projekt auswählen' })).toBeInTheDocument();
    expect(screen.queryByText('Fehler beim Laden der Daten')).not.toBeInTheDocument();
    expect(mocks.locationList).not.toHaveBeenCalled();
  });

  it('keeps the occupancy view active by default', async () => {
    mocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 10,
            culture: 5,
            culture_name: 'Salat',
            bed: 3,
            planting_date: '2026-04-01',
            harvest_date: '2026-05-01',
          },
        ],
      },
    });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Feldbelegung')).toBeInTheDocument());
    expect(screen.queryByText(/Belegung von Parzellen und Beeten im Jahresverlauf/i)).not.toBeInTheDocument();
    await waitFor(() => expect(topbarContext.latestActions.length).toBeGreaterThan(0));
    const viewAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-view') as { hidden?: boolean } | undefined;
    const editAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-edit') as { hidden?: boolean } | undefined;
    expect(viewAction?.hidden).toBe(false);
    expect(editAction?.hidden).toBe(false);
    expect(screen.getByText('Feld / Beet 1')).toBeInTheDocument();
    expect(screen.queryByText('Hof / Feld / Beet 1')).not.toBeInTheDocument();
    expect(mocks.ganttProps).toHaveBeenCalled();
    const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.locale).toBe('de-DE');
    expect(latestProps?.localeText).toMatchObject({
      title: 'Feldplanung',
      resources: 'Beete',
      today: 'Heute',
    });
  });

  it('switches to the seedling view and shows the seedling rows', async () => {
    mocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 11,
            culture: 6,
            culture_name: 'Tomate',
            bed: 3,
            planting_date: '2026-05-10',
            cultivation_type: 'pre_cultivation',
            area_usage_sqm: 8,
            plants_count: 24,
          },
        ],
      },
    });
    mocks.cultureList.mockResolvedValue({
      data: {
        results: [
          {
            id: 6,
            name: 'Tomate',
            propagation_duration_days: 21,
            cultivation_type: 'pre_cultivation',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Jungpflanzen')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Jungpflanzen' }));

    await waitFor(() => expect(screen.getAllByText('Tomate').length).toBeGreaterThan(0));
    expect(screen.getByText('Standort: Hof / Feld')).toBeInTheDocument();
    expect(screen.getByText('Beet: Beet 1')).toBeInTheDocument();
    expect(screen.getByText('Anzuchtbeginn: 19.4.2026')).toBeInTheDocument();
    expect(screen.getByText('Auspflanzung: 10.5.2026')).toBeInTheDocument();
    expect(screen.getByText('Anzuchtdauer: 21 Tage')).toBeInTheDocument();
    expect(screen.getByText('Fläche: 8.00 m²')).toBeInTheDocument();
    expect(screen.getByText('Pflanzenanzahl: 24')).toBeInTheDocument();
    expect(screen.queryByText(/Anbauplan/i)).not.toBeInTheDocument();
    const seedlingViewAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-view') as { hidden?: boolean } | undefined;
    const seedlingEditAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-edit') as { hidden?: boolean } | undefined;
    expect(seedlingViewAction?.hidden).toBe(true);
    expect(seedlingEditAction?.hidden).toBe(true);
    const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.localeText).toMatchObject({
      title: 'Anzuchtplanung',
      resources: 'Kulturen',
      today: 'Heute',
    });
  });

  it('toggles occupancy edit mode with Alt+E', async () => {
    mocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 10,
            culture: 5,
            culture_name: 'Salat',
            bed: 3,
            planting_date: '2026-04-01',
            harvest_date: '2026-05-01',
          },
        ],
      },
    });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(topbarContext.latestActions.length).toBeGreaterThan(0));
    const beforeEditAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-edit') as { active?: boolean } | undefined;
    expect(beforeEditAction?.active).toBe(false);

    fireEvent.keyDown(window, { key: 'e', altKey: true });

    await waitFor(() => {
      const afterEditAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-edit') as { active?: boolean } | undefined;
      expect(afterEditAction?.active).toBe(true);
    });
  });

  it('fills empty yield weeks between available week entries', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [{ id: 10, culture: 1, culture_name: 'Kohl', bed: 3, planting_date: '2026-03-01' }] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Kohl' }] } });
    mocks.yieldList.mockResolvedValue({
      data: [
        {
          iso_week: '2026-W13',
          week_start: '2026-03-23',
          cultures: [{ culture_id: 1, culture_name: 'Kohl', yield: 0.7, color: '#16a34a' }],
        },
        {
          iso_week: '2026-W15',
          week_start: '2026-04-06',
          cultures: [{ culture_id: 1, culture_name: 'Kohl', yield: 0.9, color: '#16a34a' }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Ertragsverteilung')).toBeInTheDocument());
    expect(screen.getByText('W13')).toBeInTheDocument();
    expect(screen.getByText('W14')).toBeInTheDocument();
    expect(screen.getByText('W15')).toBeInTheDocument();
  });

  it('hides yield distribution area when no yield data is available', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [{ id: 10, culture: 1, culture_name: 'Kohl', bed: 3, planting_date: '2026-03-01' }] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Kohl' }] } });
    mocks.yieldList.mockResolvedValue({ data: [] });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('mock-gantt')).toBeInTheDocument());
    expect(screen.queryByText('Ertragsverteilung')).not.toBeInTheDocument();
  });

  it('still shows a red load error for real API failures', async () => {
    mocks.locationList.mockRejectedValueOnce(new Error('network failed'));

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fehler beim Laden der Daten')).toBeInTheDocument();
  });

  it('shows helpful mode tooltips on hover in occupancy mode', async () => {
    mocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 10,
            culture: 5,
            culture_name: 'Salat',
            bed: 3,
            planting_date: '2026-04-01',
            harvest_date: '2026-05-01',
          },
        ],
      },
    });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(topbarContext.latestActions.length).toBeGreaterThan(0));
    const viewAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-view') as { tooltip?: string } | undefined;
    const editAction = topbarContext.latestActions.find((action) => action.id === 'calendar-mode-edit') as { tooltip?: string } | undefined;

    expect(viewAction?.tooltip).toBe('Ansichtsmodus: Kalender ansehen und navigieren. Keine Änderungen per Drag & Drop.');
    expect(editAction?.tooltip).toBe('Bearbeitungsmodus: Anbaupläne können per Drag & Drop direkt im Kalender verschoben und angepasst werden.');
  });

  it('shows backend validation errors and reloads plans after failed task update', async () => {
    const initialPlan = {
      id: 10,
      culture: 5,
      culture_name: 'Salat',
      bed: 3,
      planting_date: '2026-04-01',
      harvest_date: '2026-05-01',
    };
    const reloadedPlan = {
      ...initialPlan,
      planting_date: '2026-04-01',
    };
    mocks.planList
      .mockResolvedValueOnce({ data: { results: [initialPlan] } })
      .mockResolvedValueOnce({ data: { results: [reloadedPlan] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });
    mocks.planUpdate.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          area_usage_sqm: ['Die Fläche dieses Beets wird im überlappenden Zeitraum überschritten.'],
        },
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Feld / Beet 1');
    fireEvent.click(screen.getByTestId('mock-update-task'));

    expect(await screen.findByText('Fläche (m²): Die Fläche dieses Beets wird im überlappenden Zeitraum überschritten.')).toBeInTheDocument();
    await waitFor(() => expect(mocks.planList).toHaveBeenCalledTimes(2));
  });

  it('keeps successful task updates working', async () => {
    const initialPlan = {
      id: 10,
      culture: 5,
      culture_name: 'Salat',
      bed: 3,
      planting_date: '2026-04-01',
      harvest_date: '2026-05-01',
    };
    mocks.planList.mockResolvedValue({ data: { results: [initialPlan] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });
    mocks.planUpdate.mockResolvedValue({
      data: {
        ...initialPlan,
        planting_date: '2026-04-05',
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Feld / Beet 1');
    fireEvent.click(screen.getByTestId('mock-update-task'));

    await waitFor(() => expect(mocks.planUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Fehler beim Aktualisieren des Anbauplans')).not.toBeInTheDocument();
  });
});
