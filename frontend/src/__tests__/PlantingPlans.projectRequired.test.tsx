import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlantingPlans from "../pages/PlantingPlans";

const apiMocks = vi.hoisted(() => ({
  cultureList: vi.fn(),
  locationList: vi.fn(),
  fieldList: vi.fn(),
  bedList: vi.fn(),
  planList: vi.fn(),
}));

const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | "no_projects" | "no_active_project",
}));

vi.mock("../hooks/useProjectRequirement", () => ({
  useProjectRequirement: () => projectRequirementState,
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

describe("PlantingPlans project requirement state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    apiMocks.cultureList.mockResolvedValue({ data: { results: [] } });
    apiMocks.locationList.mockResolvedValue({ data: { results: [] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [] } });
    apiMocks.planList.mockResolvedValue({ data: { results: [] } });
  });

  it("shows friendly no-project state and skips project-bound loading", async () => {
    projectRequirementState.shouldShowProjectRequiredState = true;
    projectRequirementState.missingProjectReason = "no_projects";

    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Du hast noch kein Projekt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erstes Projekt anlegen" })).toBeInTheDocument();
    expect(apiMocks.cultureList).not.toHaveBeenCalled();
    expect(apiMocks.bedList).not.toHaveBeenCalled();
  });

  it("shows only location-specific next step when no locations exist", async () => {
    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Du kannst noch keinen Anbauplan hinzufügen.")).toBeInTheDocument();
    expect(screen.getByText("Lege zuerst einen Standort an.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Standort hinzufügen" })).toHaveAttribute(
      "href",
      "/app/locations?create=true",
    );
    expect(screen.queryByText("Standort fehlt")).not.toBeInTheDocument();
    expect(screen.queryByText("Kultur fehlt")).not.toBeInTheDocument();
    expect(screen.queryByText("Beet fehlt")).not.toBeInTheDocument();
  });
});
