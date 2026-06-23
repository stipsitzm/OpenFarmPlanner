import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
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
const OCCUPANCY_MODE_TOOLTIP =
  'Zeigt die Belegung der Beete über das Jahr. Die dargestellten Zeiträume werden aus den Anbauplänen und den kulturspezifischen Zeitangaben (z. B. Aussaat, Pflanzung und Ernte) berechnet.';
const PROPAGATION_MODE_TOOLTIP =
  'Zeigt die Anzuchtphase der Kulturen vor der Pflanzung. Die dargestellten Zeiträume werden aus den Anbauplänen sowie den kulturspezifischen Angaben zur Anzuchtdauer berechnet.';

interface TestTopbarAction {
  id: string;
  label: string;
  active?: boolean;
  groupId?: string;
  tooltip?: string;
  onClick: () => void;
}

const getTopbarAction = (id: string): TestTopbarAction => {
  const action = topbarContext.latestActions.find((item) => item.id === id) as TestTopbarAction | undefined;
  if (!action) {
    throw new Error(`Missing topbar action: ${id}`);
  }
  return action;
};

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: { list: mocks.locationList },
    fieldAPI: { list: mocks.fieldList },
    bedAPI: { list: mocks.bedList },
    plantingPlanAPI: { list: mocks.planList, update: mocks.planUpdate },
    cultureAPI: { list: mocks.cultureList },
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
    editMode?: boolean;
    allowTaskMove?: boolean;
    renderHeader?: (props: {
      title: string;
      darkMode: boolean;
      viewMode: string;
      onViewModeChange: (mode: string) => void;
      showViewModeSelector: boolean;
    }) => ReactNode;
    viewMode?: string;
    locale?: string;
    localeText?: { title?: string } & Record<string, unknown>;
  }) => {
    mocks.ganttProps(props);
    const firstTask = props.tasks[0]?.tasks[0];
    const firstGroupName = props.tasks[0]?.name ?? '';
    return (
      <div data-testid="mock-gantt">
        {props.renderHeader?.({
          title: props.localeText?.title ?? 'Project Timeline',
          darkMode: false,
          viewMode: props.viewMode ?? 'month',
          onViewModeChange: vi.fn(),
          showViewModeSelector: true,
        })}
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
  topbarContext.setTopbarContextActions.mockReset();
  topbarContext.latestActions = [];
});

describe('GanttChartPage', () => {
  it('shows field-specific guidance when no locations exist', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [] } });
    mocks.fieldList.mockResolvedValue({ data: { results: [] } });
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
    expect(screen.getByText('Öffne die Anbauflächen und füge dort eine Parzelle beim passenden Standort hinzu. Danach kannst du Beete, Kulturen und Anbaupläne erfassen.')).toBeInTheDocument();
    expect(screen.queryByText('Parzelle fehlt')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parzelle hinzufügen' })).toHaveAttribute('href', '/app/fields-beds?action=add-parcel');
    expect(screen.queryByRole('link', { name: 'Standort hinzufügen' })).not.toBeInTheDocument();
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

  it('shows plan guidance without a redundant missing-plan badge when areas and cultures exist', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [{ id: 5, name: 'Salat' }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Noch keine Anbaupläne vorhanden')).toBeInTheDocument());
    expect(screen.getByText('Für die vorhandenen Anbauflächen wurden noch keine Anbaupläne erstellt. Lege einen Anbauplan an, um Kulturen und Termine im Anbaukalender darzustellen.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anbauplan hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByText('Anbauplan fehlt')).not.toBeInTheDocument();
    expect(screen.queryByText('Öffne die Anbauflächen und füge dort eine Parzelle beim passenden Standort hinzu. Danach kannst du Beete, Kulturen und Anbaupläne erfassen.')).not.toBeInTheDocument();
  });

  it('shows culture-specific guidance when land hierarchy exists but no cultures exist', async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });
    mocks.cultureList.mockResolvedValue({ data: { results: [] } });
    mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hofstelle' }] } });
    mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 10, name: 'Nordfeld', location: 1 }] } });
    mocks.bedList.mockResolvedValue({ data: { results: [{ id: 20, name: 'Beet 1', field: 10 }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <GanttChartPage />
        </CommandProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Noch keine Kulturen vorhanden')).toBeInTheDocument());
    expect(screen.getByText('Lege jetzt deine erste Kultur an oder importiere eine Kultur aus der Kulturbibliothek. Danach kannst du Anbaupläne erstellen.')).toBeInTheDocument();
    expect(screen.getByText('Kultur fehlt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kulturbibliothek öffnen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByText('Öffne die Anbauflächen und füge dort eine Parzelle beim passenden Standort hinzu. Danach kannst du Beete, Kulturen und Anbaupläne erfassen.')).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Projekt auswählen' })).toHaveAttribute('href', '/app/project-selection');
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

    await waitFor(() => expect(screen.getByText('Feldplanung')).toBeInTheDocument());
    expect(screen.queryByText(/Belegung von Parzellen und Beeten im Jahresverlauf/i)).not.toBeInTheDocument();
    await waitFor(() => expect(topbarContext.latestActions).toHaveLength(2));
    expect(getTopbarAction('calendar-view-mode-occupancy')).toMatchObject({
      label: 'Feldbelegung',
      active: true,
      groupId: 'calendar-view-mode',
      tooltip: OCCUPANCY_MODE_TOOLTIP,
    });
    expect(getTopbarAction('calendar-view-mode-seedlings')).toMatchObject({
      label: 'Anzucht',
      active: false,
      groupId: 'calendar-view-mode',
      tooltip: PROPAGATION_MODE_TOOLTIP,
    });
    expect(screen.getByRole('button', { name: 'Zeitraum verschieben' })).toBeInTheDocument();
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
    expect(latestProps?.editMode).toBe(false);
    expect(latestProps?.allowTaskMove).toBe(false);
    expect(latestProps?.onTaskUpdate).toBeUndefined();
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

    await waitFor(() => expect(topbarContext.latestActions).toHaveLength(2));
    act(() => {
      getTopbarAction('calendar-view-mode-seedlings').onClick();
    });

    await waitFor(() => expect(screen.getAllByText('Tomate').length).toBeGreaterThan(0));
    expect(screen.queryByText('Standort: Hof / Feld')).not.toBeInTheDocument();
    expect(screen.queryByText('Beet: Beet 1')).not.toBeInTheDocument();
    expect(screen.getByText('Anzuchtbeginn: 19.4.2026')).toBeInTheDocument();
    expect(screen.getByText('Auspflanzung: 10.5.2026')).toBeInTheDocument();
    expect(screen.getByText('Anzuchtdauer: 21 Tage')).toBeInTheDocument();
    expect(screen.queryByText('Fläche: 8,00 m²')).not.toBeInTheDocument();
    expect(screen.getByText('Gesamtpflanzen: 24')).toBeInTheDocument();
    expect(screen.getByText('Anzahl Anbaupläne: 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zeitraum verschieben' })).not.toBeInTheDocument();
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

    expect(await screen.findByRole('button', { name: 'Zeitraum verschieben' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(window, { key: 'e', altKey: true });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zeitraum verschieben' })).toHaveAttribute('aria-pressed', 'true');
    });
    const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.editMode).toBe(true);
    expect(latestProps?.allowTaskMove).toBe(true);
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

  it('registers helpful mode tooltips for the topbar mode actions', async () => {
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

    expect(await screen.findByRole('button', { name: 'Zeitraum verschieben' })).toBeInTheDocument();

    await waitFor(() => expect(topbarContext.latestActions).toHaveLength(2));
    expect(getTopbarAction('calendar-view-mode-occupancy').tooltip).toBe(OCCUPANCY_MODE_TOOLTIP);
    expect(getTopbarAction('calendar-view-mode-seedlings').tooltip).toBe(PROPAGATION_MODE_TOOLTIP);
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
    expect(screen.queryByTestId('mock-update-task')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum verschieben' }));
    await screen.findByTestId('mock-update-task');
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
    expect(screen.queryByTestId('mock-update-task')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum verschieben' }));
    await screen.findByTestId('mock-update-task');
    fireEvent.click(screen.getByTestId('mock-update-task'));

    await waitFor(() => expect(mocks.planUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Fehler beim Aktualisieren des Anbauplans')).not.toBeInTheDocument();
  });
});
