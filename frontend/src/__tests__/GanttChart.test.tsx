import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/authContextShared';
import { CommandProvider } from '../commands/CommandProvider';
import GanttChartPage from '../pages/GanttChart';
import { getGanttRenderWindow } from '../pages/ganttRenderWindow';

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
  setTopbarTitleActions: vi.fn(),
  latestActions: [] as Array<Record<string, unknown>>,
  latestTitleActions: [] as Array<Record<string, unknown>>,
}));
const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | 'no_projects' | 'no_active_project',
}));
const OCCUPANCY_MODE_TOOLTIP =
  'Zeigt die Belegung der Beete über das Jahr. Die dargestellten Zeiträume werden aus den Anbauplänen und den kulturspezifischen Zeitangaben (z. B. Aussaat, Pflanzung und Ernte) berechnet.';
const PROPAGATION_MODE_TOOLTIP =
  'Zeigt die Anzuchtphase der Kulturen vor der Pflanzung. Die dargestellten Zeiträume werden aus den Anbauplänen sowie den kulturspezifischen Angaben zur Anzuchtdauer berechnet.';
const TIMELINE_VIEW_MODE_STORAGE_KEY = 'openFarmPlanner.ganttChart.timelineViewMode.42';
const GANTT_STATE_STORAGE_KEY = 'openfarmplanner:gantt:42:state';

const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

interface TestTopbarAction {
  id: string;
  label: string;
  active?: boolean;
  groupId?: string;
  tooltip?: string;
  onClick: () => void;
}

const getTopbarAction = (id: string): TestTopbarAction => {
  const action = topbarContext.latestTitleActions.find((item) => item.id === id) as TestTopbarAction | undefined;
  if (!action) {
    throw new Error(`Missing topbar action: ${id}`);
  }
  return action;
};

const authContextValue: AuthContextValue = {
  user: null,
  isLoading: false,
  activeProjectId: 42,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  activate: vi.fn(),
  resendActivation: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  requestAccountDeletion: vi.fn(),
  restoreAccount: vi.fn(),
  switchActiveProject: vi.fn(),
  refreshUser: vi.fn(),
};

const renderWithAuth = (): ReturnType<typeof render> => render(
  <MemoryRouter>
    <AuthContext.Provider value={authContextValue}>
      <CommandProvider>
        <GanttChartPage />
      </CommandProvider>
    </AuthContext.Provider>
  </MemoryRouter>,
);

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: {
      listAll: async () => (await mocks.locationList()).data,
    },
    fieldAPI: {
      listAll: async () => (await mocks.fieldList()).data,
    },
    bedAPI: {
      listAll: async () => (await mocks.bedList()).data,
    },
    plantingPlanAPI: {
      listAll: async () => (await mocks.planList()).data,
      update: mocks.planUpdate,
    },
    cultureAPI: {
      listAll: async () => (await mocks.cultureList()).data,
    },
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
      setTopbarTitleActions: (actions: Array<Record<string, unknown>>) => {
        topbarContext.latestTitleActions = actions;
        topbarContext.setTopbarTitleActions(actions);
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
    focusMode?: boolean;
    locale?: string;
    localeText?: { title?: string } & Record<string, unknown>;
    maxHeight?: string | number;
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
        <div
          className="rmg-container"
          data-testid="mock-gantt-scroll-container"
          ref={(node) => {
            if (!node) {
              return;
            }
            Object.defineProperty(node, 'clientWidth', { configurable: true, value: 1000 });
            Object.defineProperty(node, 'scrollWidth', { configurable: true, value: 2000 });
          }}
        />
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
  window.localStorage.clear();
  projectRequirementState.shouldShowProjectRequiredState = false;
  projectRequirementState.missingProjectReason = null;

  mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
  mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: 'Feld', location: 1 }] } });
  mocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet 1', field: 2 }] } });
  mocks.planUpdate.mockResolvedValue({ data: {} });
  topbarContext.setTopbarContextActions.mockReset();
  topbarContext.setTopbarTitleActions.mockReset();
  topbarContext.latestActions = [];
  topbarContext.latestTitleActions = [];
});

describe('GanttChartPage', () => {
  it('limits Gantt rendering to the visible row window', () => {
    const groups = Array.from({ length: 200 }, (_, index) => ({
      id: `bed-${index + 1}`,
      name: `Bed ${index + 1}`,
      tasks: [{
        id: `task-${index + 1}`,
        name: 'Salat',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-05-01'),
      }],
    }));

    const window = getGanttRenderWindow(groups, 0, 720);

    expect(window.groups.length).toBeLessThan(groups.length);
    expect(window.startIndex).toBe(0);
    expect(window.totalHeight).toBeGreaterThan(720);
  });

  it.each([
    ['small', 5],
    ['medium', 80],
    ['large', 2400],
  ])('keeps the %s dataset window non-empty', (_label, rowCount) => {
    const groups = Array.from({ length: rowCount }, (_, index) => ({
      id: `bed-${index + 1}`,
      name: `Bed ${index + 1}`,
      tasks: [{
        id: `task-${index + 1}`,
        name: 'Salat',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-05-01'),
      }],
    }));
    const scrollTop = Math.max(0, rowCount * 72 - 720);

    const window = getGanttRenderWindow(groups, scrollTop, 720);

    expect(window.groups.length).toBeGreaterThan(0);
    expect(window.endIndex).toBeLessThanOrEqual(rowCount);
  });

  it('also bounds a visible Gantt window by timeline item count', () => {
    const createTasks = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-${index}`,
      name: 'Salat',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-05-01'),
    }));
    const window = getGanttRenderWindow([
      { id: 'bed-1', name: 'Bed 1', tasks: createTasks('first', 500) },
      { id: 'bed-2', name: 'Bed 2', tasks: createTasks('second', 500) },
    ], 0, 720);

    expect(window.groups).toHaveLength(1);
  });

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
    await waitFor(() => expect(topbarContext.latestTitleActions).toHaveLength(2));
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

  it('restores the persisted timeline view mode when the calendar opens', async () => {
    window.localStorage.setItem(TIMELINE_VIEW_MODE_STORAGE_KEY, 'day');
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

    renderWithAuth();

    await waitFor(() => {
      const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
      expect(latestProps?.viewMode).toBe('day');
    });
    expect(screen.getByRole('button', { name: 'Tag' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('scrolls the first calendar open to the current period instead of the timeline end', async () => {
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

    renderWithAuth();

    const scrollContainer = await screen.findByTestId('mock-gantt-scroll-container');
    await waitFor(() => {
      expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
      expect(scrollContainer.scrollLeft).toBeLessThan(900);
    });
    expect(mocks.ganttProps.mock.calls.at(-1)?.[0]?.focusMode).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(GANTT_STATE_STORAGE_KEY) ?? '{}')).toMatchObject({
      calendarMode: 'occupancy',
      timelineViewMode: 'month',
      referenceDate: getTodayIsoDate(),
    });
  });

  it('restores the saved calendar mode, timeline period, and row scroll for the active project', async () => {
    window.localStorage.setItem(GANTT_STATE_STORAGE_KEY, JSON.stringify({
      calendarMode: 'seedlings',
      timelineViewMode: 'week',
      referenceDate: '2026-04-15',
      rowScrollTop: 144,
    }));
    mocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 10,
            culture: 5,
            culture_name: 'Salat',
            planting_date: '2026-04-20',
            harvest_date: '2026-05-20',
          },
        ],
      },
    });
    mocks.cultureList.mockResolvedValue({
      data: {
        results: [{
          id: 5,
          name: 'Salat',
          propagation_days: 28,
        }],
      },
    });

    renderWithAuth();

    const scrollContainer = await screen.findByTestId('mock-gantt-scroll-container');
    const virtualViewport = await screen.findByTestId('gantt-virtual-viewport');
    await waitFor(() => {
      expect(mocks.ganttProps.mock.calls.at(-1)?.[0]?.viewMode).toBe('week');
      expect(scrollContainer.scrollLeft).toBeGreaterThan(700);
      expect(scrollContainer.scrollLeft).toBeLessThan(900);
      expect(virtualViewport.scrollTop).toBe(144);
    });
    await waitFor(() => expect(topbarContext.latestTitleActions).toHaveLength(2));
    expect(getTopbarAction('calendar-view-mode-seedlings')).toMatchObject({
      active: true,
    });
  });

  it('persists timeline view mode changes and keeps them during data updates', async () => {
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

    renderWithAuth();

    await screen.findByText('Feld / Beet 1');
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));

    await waitFor(() => {
      const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
      expect(latestProps?.viewMode).toBe('week');
    });
    expect(window.localStorage.getItem(TIMELINE_VIEW_MODE_STORAGE_KEY)).toBe('week');

    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum verschieben' }));
    await screen.findByTestId('mock-update-task');
    fireEvent.click(screen.getByTestId('mock-update-task'));

    await waitFor(() => expect(mocks.planUpdate).toHaveBeenCalledTimes(1));
    const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.viewMode).toBe('week');
  });

  it('refreshes calendar data on focus without resetting the timeline view mode', async () => {
    const initialPlan = {
      id: 10,
      culture: 5,
      culture_name: 'Salat',
      bed: 3,
      planting_date: '2026-04-01',
      harvest_date: '2026-05-01',
      harvest_end_date: '2026-05-05',
    };
    const refreshedPlan = {
      ...initialPlan,
      harvest_date: '2026-05-10',
      harvest_end_date: '2026-05-20',
    };
    mocks.planList
      .mockResolvedValueOnce({ data: { results: [initialPlan] } })
      .mockResolvedValue({ data: { results: [refreshedPlan] } });
    mocks.cultureList.mockResolvedValue({
      data: {
        results: [{
          id: 5,
          name: 'Salat',
          growth_duration_days: 39,
          harvest_duration_days: 10,
        }],
      },
    });

    renderWithAuth();

    await screen.findByText('Feld / Beet 1');
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }));
    await waitFor(() => {
      expect(mocks.ganttProps.mock.calls.at(-1)?.[0]?.viewMode).toBe('week');
    });

    fireEvent.focus(window);

    await waitFor(() => expect(mocks.planList).toHaveBeenCalledTimes(2));
    const latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.viewMode).toBe('week');
    expect(latestProps?.tasks[0]?.tasks[0]?.endDate).toEqual(new Date('2026-05-10T00:00:00.000Z'));
    expect(latestProps?.tasks[0]?.tasks[1]?.endDate).toEqual(new Date('2026-05-20T00:00:00.000Z'));
  });

  it('keeps large projects renderable by windowing rows passed to the Gantt library', async () => {
    const rowCount = 200;
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    mocks.bedList.mockResolvedValue({
      data: {
        results: Array.from({ length: rowCount }, (_, index) => ({
          id: index + 1,
          name: `Beet ${index + 1}`,
          field: 2,
        })),
      },
    });
    mocks.planList.mockResolvedValue({
      data: {
        results: Array.from({ length: rowCount }, (_, index) => ({
          id: index + 1,
          culture: 5,
          culture_name: 'Salat',
          bed: index + 1,
          planting_date: '2026-04-01',
          harvest_date: '2026-05-01',
        })),
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

    expect(await screen.findByTestId('gantt-virtual-viewport')).toBeInTheDocument();
    let latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
    expect(latestProps?.tasks.length).toBeGreaterThan(0);
    expect(latestProps?.tasks.length).toBeLessThan(rowCount);
    expect(debugSpy).toHaveBeenCalledWith('[Gantt diagnostics]', expect.objectContaining({
      beds: rowCount,
      plantingPlans: rowCount,
      totalRows: rowCount,
      totalTimelineItems: rowCount,
      renderedRows: expect.any(Number),
      renderedTimelineItems: expect.any(Number),
    }));

    fireEvent.scroll(screen.getByTestId('gantt-virtual-viewport'), {
      target: { scrollTop: 7200 },
    });

    await waitFor(() => {
      latestProps = mocks.ganttProps.mock.calls.at(-1)?.[0];
      expect(latestProps?.tasks[0]?.id).not.toBe('bed-1');
    });
    debugSpy.mockRestore();
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

    await waitFor(() => expect(topbarContext.latestTitleActions).toHaveLength(2));
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

    await waitFor(() => expect(topbarContext.latestTitleActions).toHaveLength(2));
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
