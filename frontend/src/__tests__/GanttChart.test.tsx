import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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

vi.mock('react-modern-gantt', () => ({
  __esModule: true,
  default: ({ tasks, renderTooltip }: { tasks: Array<{ name: string; tasks: Array<Record<string, unknown> & { id: string; name: string }> }>; renderTooltip?: ({ task }: { task: Record<string, unknown> }) => ReactNode }) => (
    <div data-testid="mock-gantt">
      {tasks.map((group) => (
        <div key={group.name}>
          <span>{group.name}</span>
          {group.tasks.map((task) => <span key={`${group.name}-${task.name}`}>{task.name}</span>)}
          {group.tasks[0] && renderTooltip ? (
            <div data-testid={`mock-tooltip-${group.name}`}>
              {renderTooltip({ task: group.tasks[0] })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  ),
  ViewMode: { MONTH: 'month' },
}));

beforeEach(() => {
  vi.clearAllMocks();

  mocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
  mocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: 'Feld', location: 1 }] } });
  mocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet 1', field: 2 }] } });
  mocks.planUpdate.mockResolvedValue({ data: {} });
  mocks.yieldList.mockResolvedValue({ data: [] });
});

describe('GanttChartPage', () => {
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
      <CommandProvider>
        <GanttChartPage />
      </CommandProvider>,
    );

    await waitFor(() => expect(screen.getByText('Feldbelegung')).toBeInTheDocument());
    expect(screen.queryByText(/Belegung von Schlägen und Beeten im Jahresverlauf/i)).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByText('Beet 1')).toBeInTheDocument();
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
      <CommandProvider>
        <GanttChartPage />
      </CommandProvider>,
    );

    await waitFor(() => expect(screen.getByText('Jungpflanzen')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Jungpflanzen' }));

    await waitFor(() => expect(screen.getAllByText('Tomate').length).toBeGreaterThan(0));
    expect(screen.getByText('Standort: Hof / Feld')).toBeInTheDocument();
    expect(screen.getByText('Beet: Beet 1')).toBeInTheDocument();
    expect(screen.getByText('Anzuchtbeginn: 19.4.2026')).toBeInTheDocument();
    expect(screen.getByText('Auspflanzung: 10.5.2026')).toBeInTheDocument();
    expect(screen.getByText('Anzuchtdauer: 21 Tage')).toBeInTheDocument();
    expect(screen.getByText('Fläche: 8.00 m²')).toBeInTheDocument();
    expect(screen.getByText('Pflanzenanzahl: 24')).toBeInTheDocument();
    expect(screen.queryByText(/Anbauplan/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
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
      <CommandProvider>
        <GanttChartPage />
      </CommandProvider>,
    );

    const editSwitch = await screen.findByRole('switch');
    expect(editSwitch).not.toBeChecked();

    fireEvent.keyDown(window, { key: 'e', altKey: true });

    await waitFor(() => expect(editSwitch).toBeChecked());
  });
});
