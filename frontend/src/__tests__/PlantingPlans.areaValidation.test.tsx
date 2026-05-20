import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlantingPlans from "../pages/PlantingPlans";
import type { EditableDataGridCommandApi } from "../components/data-grid";

const mockGridRowState = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
}));

const apiMocks = vi.hoisted(() => ({
  cultureList: vi.fn(),
  locationList: vi.fn(),
  fieldList: vi.fn(),
  bedList: vi.fn(),
  planList: vi.fn(),
}));

const commandApiSpies = vi.hoisted(() => ({
  setDraftValues: vi.fn(),
  saveAttemptResult: vi.fn(),
}));

vi.mock("../hooks/useProjectRequirement", () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

vi.mock("../commands/useCommandContext", () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
  useRegisterCreateActions: vi.fn(),
}));

vi.mock("../hooks/useNavigationBlocker", () => ({
  useNavigationBlocker: () => ({
    isBlocked: false,
    proceed: vi.fn(),
    reset: vi.fn(),
    destination: null,
  }),
}));

vi.mock("../components/data-grid", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const actual = await vi.importActual<typeof import("../components/data-grid")>("../components/data-grid");
  type MockGridProps = {
    api?: {
      list?: () => Promise<{ data: { results: Record<string, unknown>[] } }>;
    };
    mapToRow?: (row: Record<string, unknown>) => Record<string, unknown>;
    onRowsStateChange?: (rows: Record<string, unknown>[]) => void;
    onLoadStateChange?: (state: { loading: boolean; dataFetched: boolean }) => void;
    onBeforeSaveRow?: (row: Record<string, unknown>) => boolean;
    commandApiRef?: { current: EditableDataGridCommandApi | null };
  };
  return {
    ...actual,
    EditableDataGrid: ({ api, mapToRow, onRowsStateChange, onLoadStateChange, onBeforeSaveRow, commandApiRef }: MockGridProps) => {
      if (commandApiRef) {
        commandApiRef.current = {
          addRow: vi.fn(),
          editSelectedRow: vi.fn(),
          deleteSelectedRow: vi.fn(),
          getSelectedRowId: vi.fn(),
          reload: vi.fn(),
          setDraftValues: commandApiSpies.setDraftValues,
        };
      }
      const latestPropsRef = React.useRef({ api, mapToRow, onRowsStateChange, onLoadStateChange });
      latestPropsRef.current = { api, mapToRow, onRowsStateChange, onLoadStateChange };
      React.useEffect(() => {
        let isMounted = true;
        const { api: currentApi, mapToRow: currentMapToRow, onRowsStateChange: currentOnRowsStateChange, onLoadStateChange: currentOnLoadStateChange } = latestPropsRef.current;
        currentOnLoadStateChange?.({ loading: true, dataFetched: false });
        void currentApi?.list?.().then((response) => {
          if (!isMounted) {
            return;
          }
          const rows = response.data.results.map((row) => currentMapToRow?.(row) ?? row);
          currentOnRowsStateChange?.(rows);
          currentOnLoadStateChange?.({ loading: false, dataFetched: true });
        });
        return () => {
          isMounted = false;
        };
      }, []);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              commandApiSpies.saveAttemptResult(onBeforeSaveRow?.(mockGridRowState.row) ?? true);
            }}
          >
            Zeile speichern
          </button>
          <button
            type="button"
            onClick={() => {
              commandApiSpies.saveAttemptResult(onBeforeSaveRow?.(mockGridRowState.row) ?? true);
            }}
          >
            Speichern mit Enter
          </button>
        </>
      );
    },
  };
});

const areaText = (label: string, value: string): RegExp =>
  new RegExp(`${label}:\\s*${value}\\s*m²`);

const waitForPlansToLoad = async (callCount = 1): Promise<void> => {
  await waitFor(() => {
    expect(apiMocks.planList).toHaveBeenCalledTimes(callCount);
  });
};

vi.mock("../api/api", async () => {
  const actual = await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: apiMocks.cultureList,
    },
    locationAPI: {
      ...actual.locationAPI,
      list: apiMocks.locationList,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      list: apiMocks.fieldList,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: apiMocks.bedList,
    },
    plantingPlanAPI: {
      ...actual.plantingPlanAPI,
      list: apiMocks.planList,
    },
  };
});

describe("PlantingPlans save-time area validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.cultureList.mockResolvedValue({ data: { results: [{ id: 2, name: "Möhre", plants_per_m2: 10 }] } });
    apiMocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: "Hof" }] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [{ id: 11, name: "Parzelle 1", location: 1 }] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet A", field: 11, area_sqm: 1 }] } });
    apiMocks.planList.mockResolvedValue({ data: { results: [] } });
  });

  it("shows bed-limit dialog when requested area exceeds bed area", async () => {
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-01", area_m2: "99,00",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die Größe dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText(areaText("Beetfläche", "1,00"))).toBeInTheDocument();
    expect(screen.getByText(areaText("Angefragt", "99,00"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beetfläche übernehmen" })).toBeInTheDocument();
  });

  it("shows bed-limit dialog when saving via Enter flow", async () => {
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-01", area_m2: "99",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Speichern mit Enter" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die Größe dieses Beets.")).toBeInTheDocument();
  });

  it("applies bed area when clicking 'Beetfläche übernehmen'", async () => {
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-01", area_m2: "99,00",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));
    await userEvent.click(await screen.findByRole("button", { name: "Beetfläche übernehmen" }));

    expect(commandApiSpies.setDraftValues).toHaveBeenCalledWith(1, expect.objectContaining({ area_m2: 1, plants_count: 10 }));
    await waitFor(() => {
      expect(screen.queryByText("Die angegebene Fläche überschreitet die Größe dieses Beets.")).not.toBeInTheDocument();
    });
  });

  it("shows remaining-area dialog when request exceeds available area", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet A", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [{
          id: 9, bed: 101, culture: 2, planting_date: "2026-04-01", harvest_date: "2026-05-01", area_usage_sqm: 4,
        }],
      },
    });
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-10", harvest_date: "2026-05-10", area_m2: "5",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText(areaText("Verfügbare Restfläche", "3,00"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restfläche übernehmen" })).toBeInTheDocument();
  });

  it("shows remaining-area dialog when saving via Enter flow", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet A", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [{
          id: 9, bed: 101, culture: 2, planting_date: "2026-04-01", harvest_date: "2026-05-01", area_usage_sqm: 4,
        }],
      },
    });
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-10", harvest_date: "2026-05-10", area_m2: "5",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Speichern mit Enter" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).toBeInTheDocument();
  });

  it("shows identical dialog details for click-save and enter-save", async () => {
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-01", area_m2: "99,00",
    };
    const { unmount } = render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));
    expect(await screen.findByText(areaText("Übernommen wird", "1,00"))).toBeInTheDocument();
    unmount();

    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad(2);
    await userEvent.click(await screen.findByRole("button", { name: "Speichern mit Enter" }));
    expect(await screen.findByText(areaText("Übernommen wird", "1,00"))).toBeInTheDocument();
  });

  it("applies available area and shows snackbar for empty or max input", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet A", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [{
          id: 9, bed: 101, culture: 2, planting_date: "2026-04-01", harvest_date: "2026-05-01", area_usage_sqm: 4,
        }],
      },
    });
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-10", harvest_date: "2026-05-10", area_m2: "max",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(commandApiSpies.setDraftValues).toHaveBeenCalledWith(1, expect.objectContaining({ area_m2: 3, plants_count: 30 }));
    expect(await screen.findByText("Maximal verfügbare Fläche übernommen: 3,00 m²")).toBeInTheDocument();
    expect(screen.queryByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).not.toBeInTheDocument();
  });

  it("does not count same-bed rows whose German date ranges do not overlap", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet 1", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 21,
            bed: 101,
            culture: 2,
            planting_date: "20.9.2026",
            harvest_end_date: "2.2.2027",
            area_usage_sqm: 7,
          },
          {
            id: 22,
            bed: 101,
            culture: 2,
            planting_date: "20.2.2026",
            harvest_end_date: "18.9.2026",
            area_usage_sqm: 1,
          },
        ],
      },
    });
    mockGridRowState.row = {
      id: 22,
      bed: 101,
      culture: 2,
      planting_date: "20.2.2026",
      harvest_end_date: "18.9.2026",
      area_m2: "7",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(commandApiSpies.saveAttemptResult).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Für dieses Beet ist im gewählten Zeitraum keine freie Fläche verfügbar.")).not.toBeInTheDocument();
  });

  it("counts same-bed rows whose German date ranges overlap", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "Beet 1", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 23,
            bed: 101,
            culture: 2,
            planting_date: "2.2.2026",
            harvest_end_date: "2.6.2026",
            area_usage_sqm: 3,
          },
          {
            id: 22,
            bed: 101,
            culture: 2,
            planting_date: "20.2.2026",
            harvest_end_date: "18.9.2026",
            area_usage_sqm: 1,
          },
        ],
      },
    });
    mockGridRowState.row = {
      id: 22,
      bed: 101,
      culture: 2,
      planting_date: "20.2.2026",
      harvest_end_date: "18.9.2026",
      area_m2: "5",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText(areaText("Bereits belegt", "3,00"))).toBeInTheDocument();
    expect(screen.getByText(areaText("Verfügbare Restfläche", "4,00"))).toBeInTheDocument();
  });

  it("shows the corrected remaining-area values for the Majoran overlap scenario", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "1", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 21,
            bed: 101,
            culture: 2,
            planting_date: "20.9.2026",
            harvest_end_date: "2.2.2027",
            area_usage_sqm: 7,
          },
          {
            id: 23,
            bed: 101,
            culture: 2,
            planting_date: "2.2.2026",
            harvest_end_date: "2.6.2026",
            area_usage_sqm: 3,
          },
          {
            id: 22,
            bed: 101,
            culture: 2,
            planting_date: "20.2.2026",
            harvest_end_date: "18.9.2026",
            area_usage_sqm: 1,
          },
        ],
      },
    });
    mockGridRowState.row = {
      id: 22,
      bed: 101,
      culture: 2,
      planting_date: "20.2.2026",
      harvest_end_date: "18.9.2026",
      area_m2: "5",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText(areaText("Beetfläche", "7,00"))).toBeInTheDocument();
    expect(screen.getByText(areaText("Bereits belegt", "3,00"))).toBeInTheDocument();
    expect(screen.getByText(areaText("Verfügbare Restfläche", "4,00"))).toBeInTheDocument();
    expect(screen.getByText(areaText("Übernommen wird", "4,00"))).toBeInTheDocument();
    expect(commandApiSpies.saveAttemptResult).toHaveBeenLastCalledWith(false);
  });

  it("allows saving the Majoran row when the requested area fits the corrected remaining area", async () => {
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 101, name: "1", field: 11, area_sqm: 7 }] } });
    apiMocks.planList.mockResolvedValue({
      data: {
        results: [
          {
            id: 21,
            bed: 101,
            culture: 2,
            planting_date: "20.9.2026",
            harvest_end_date: "2.2.2027",
            area_usage_sqm: 7,
          },
          {
            id: 23,
            bed: 101,
            culture: 2,
            planting_date: "2.2.2026",
            harvest_end_date: "2.6.2026",
            area_usage_sqm: 3,
          },
          {
            id: 22,
            bed: 101,
            culture: 2,
            planting_date: "20.2.2026",
            harvest_end_date: "18.9.2026",
            area_usage_sqm: 1,
          },
        ],
      },
    });
    mockGridRowState.row = {
      id: 22,
      bed: 101,
      culture: 2,
      planting_date: "20.2.2026",
      harvest_end_date: "18.9.2026",
      area_m2: "4",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
    await waitForPlansToLoad();
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(commandApiSpies.saveAttemptResult).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).not.toBeInTheDocument();
  });
});
