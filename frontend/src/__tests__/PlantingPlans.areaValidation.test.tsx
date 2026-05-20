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
  const actual = await vi.importActual<typeof import("../components/data-grid")>("../components/data-grid");
  return {
    ...actual,
    EditableDataGrid: ({ onBeforeSaveRow, commandApiRef }: {
      onBeforeSaveRow?: (row: Record<string, unknown>) => boolean;
      commandApiRef?: { current: EditableDataGridCommandApi | null };
    }) => {
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
      return (
        <button
          type="button"
          onClick={() => {
            onBeforeSaveRow?.(mockGridRowState.row);
          }}
        >
          Zeile speichern
        </button>
      );
    },
  };
});

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
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die Größe dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText("Beetfläche: 1,00 m²")).toBeInTheDocument();
    expect(screen.getByText("Angefragt: 99,00 m²")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beetfläche übernehmen" })).toBeInTheDocument();
  });

  it("applies bed area when clicking 'Beetfläche übernehmen'", async () => {
    mockGridRowState.row = {
      id: 1, bed: 101, culture: 2, planting_date: "2026-04-01", area_m2: "99,00",
    };
    render(<MemoryRouter><PlantingPlans /></MemoryRouter>);
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
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(await screen.findByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).toBeInTheDocument();
    expect(screen.getByText("Verfügbare Restfläche: 3,00 m²")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restfläche übernehmen" })).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole("button", { name: "Zeile speichern" }));

    expect(commandApiSpies.setDraftValues).toHaveBeenCalledWith(1, expect.objectContaining({ area_m2: 3, plants_count: 30 }));
    expect(await screen.findByText("Maximal verfügbare Fläche übernommen: 3,00 m²")).toBeInTheDocument();
    expect(screen.queryByText("Die angegebene Fläche überschreitet die verfügbare Restfläche dieses Beets.")).not.toBeInTheDocument();
  });
});
