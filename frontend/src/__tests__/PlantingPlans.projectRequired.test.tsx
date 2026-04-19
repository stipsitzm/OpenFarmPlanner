import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlantingPlans from "../pages/PlantingPlans";

const apiMocks = vi.hoisted(() => ({
  cultureList: vi.fn(),
  bedList: vi.fn(),
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
}));

vi.mock("../api/api", async () => {
  const actual = await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: apiMocks.cultureList,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: apiMocks.bedList,
    },
  };
});

describe("PlantingPlans project requirement state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    apiMocks.cultureList.mockResolvedValue({ data: { results: [] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [] } });
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
    expect(screen.getByRole("button", { name: "Projekt erstellen" })).toBeInTheDocument();
    expect(apiMocks.cultureList).not.toHaveBeenCalled();
    expect(apiMocks.bedList).not.toHaveBeenCalled();
  });
});
