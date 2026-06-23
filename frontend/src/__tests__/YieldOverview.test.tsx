import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import YieldOverviewPage from "../pages/YieldOverview";

const mocks = vi.hoisted(() => ({
  planList: vi.fn(),
  yieldList: vi.fn(),
}));
const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | "no_projects" | "no_active_project",
}));

vi.mock("../api/api", async () => {
  const actual =
    await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    plantingPlanAPI: { list: mocks.planList },
    yieldCalendarAPI: { list: mocks.yieldList },
  };
});

vi.mock("../hooks/useProjectRequirement", () => ({
  useProjectRequirement: () => projectRequirementState,
}));

beforeEach(() => {
  vi.clearAllMocks();
  projectRequirementState.shouldShowProjectRequiredState = false;
  projectRequirementState.missingProjectReason = null;
  mocks.planList.mockResolvedValue({
    data: {
      results: [
        {
          id: 10,
          culture: 1,
          culture_name: "Kohl",
          bed: 3,
          planting_date: "2026-03-01",
        },
      ],
    },
  });
  mocks.yieldList.mockResolvedValue({ data: [] });
});

describe("YieldOverviewPage", () => {
  it("fills empty yield weeks between available week entries", async () => {
    mocks.yieldList.mockResolvedValue({
      data: [
        {
          iso_week: "2026-W13",
          week_start: "2026-03-23",
          cultures: [
            {
              culture_id: 1,
              culture_name: "Kohl",
              yield: 0.7,
              color: "#16a34a",
            },
          ],
        },
        {
          iso_week: "2026-W15",
          week_start: "2026-04-06",
          cultures: [
            {
              culture_id: 1,
              culture_name: "Kohl",
              yield: 0.9,
              color: "#16a34a",
            },
          ],
        },
      ],
    });

    render(
      <MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Ertragsverteilung" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("W13")).toBeInTheDocument();
    expect(screen.getByText("W14")).toBeInTheDocument();
    expect(screen.getByText("W15")).toBeInTheDocument();
    expect(screen.getByTestId("yield-chart-plot")).toHaveStyle({
      width: "100%",
    });
    expect(screen.getByLabelText("Kultur")).toHaveTextContent("Alle Kulturen");
    expect(screen.getByLabelText("Jahr")).toHaveTextContent(
      String(new Date().getFullYear()),
    );
    expect(screen.getByRole("button", { name: "Woche" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByRole("heading", { name: "Ertragsübersicht" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Bereit für weitere Ertragsauswertungen"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Zum Anbaukalender" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Monat" }));

    expect(screen.getByRole("button", { name: "Monat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Mär")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();
  });

  it("shows a helpful empty state when no planting plans exist", async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Noch keine Ertragsprognose verfügbar"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ertragsprognosen werden verfügbar, sobald Anbaupläne mit Erntezeiträumen vorhanden sind.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Anbauplan hinzufügen" }),
    ).toHaveAttribute("href", "/app/anbauplaene?action=create");
  });

  it("shows a yield-data empty state when planting plans have no calculable yields", async () => {
    render(
      <MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Keine erwarteten Erträge vorhanden"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ertragsprognosen werden verfügbar, sobald Anbaupläne mit Erntezeiträumen vorhanden sind.",
      ),
    ).toBeInTheDocument();
  });

  it("reloads yield data when the year changes", async () => {
    render(
      <MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter>,
    );

    await screen.findByText("Keine erwarteten Erträge vorhanden");
    const previousYear = new Date().getFullYear() - 1;

    fireEvent.mouseDown(screen.getByLabelText("Jahr"));
    fireEvent.click(screen.getByRole("option", { name: String(previousYear) }));

    await waitFor(() => {
      expect(mocks.yieldList).toHaveBeenLastCalledWith(previousYear);
    });
  });
});
