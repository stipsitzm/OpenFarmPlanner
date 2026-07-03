import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusManagerProvider } from "../focus/FocusManager";
import { beforeEach, describe, expect, it, vi } from "vitest";
import YieldOverviewPage from "../pages/YieldOverview";
import { getYieldAxisLabelStep } from "../pages/yieldOverviewUtils";

const mocks = vi.hoisted(() => ({
  planList: vi.fn(),
  yieldList: vi.fn(),
  navigate: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

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
  it("shows every label when columns have enough horizontal space", () => {
    expect(getYieldAxisLabelStep(360, 3, "week")).toBe(1);
    expect(getYieldAxisLabelStep(720, 12, "month")).toBe(1);
  });

  it("progressively reduces label density when columns become narrow", () => {
    expect(getYieldAxisLabelStep(360, 20, "week")).toBe(2);
    expect(getYieldAxisLabelStep(360, 40, "week")).toBe(4);
    expect(getYieldAxisLabelStep(360, 12, "month")).toBe(2);
  });

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
      <FocusManagerProvider><MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter></FocusManagerProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Ertragsverteilung" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("W13")).toBeInTheDocument();
    expect(screen.getByText("W14")).toBeInTheDocument();
    expect(screen.getByText("W15")).toBeInTheDocument();
    expect(screen.getByText("W13")).toHaveStyle({ visibility: "visible" });
    expect(screen.getByText("W14")).toHaveStyle({ visibility: "visible" });
    expect(screen.getByText("W15")).toHaveStyle({ visibility: "visible" });
    expect(screen.getByTestId("yield-chart-plot")).toHaveStyle({
      width: "100%",
    });
    expect(screen.getByTestId("yield-bar-column-2026-W13")).toHaveStyle({
      flex: "1 1 0",
    });
    expect(screen.getByTestId("yield-axis-column-2026-W13")).toHaveStyle({
      flex: "1 1 0",
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

    fireEvent.mouseOver(screen.getByTestId("yield-bar-2026-W13-1"));
    expect(await screen.findByText("W13 Mär")).toBeInTheDocument();
    expect(screen.getByText("0.70 kg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Monat" }));

    expect(screen.getByRole("button", { name: "Monat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Mär")).toHaveStyle({ visibility: "visible" });
    expect(screen.getByText("Apr")).toHaveStyle({ visibility: "visible" });
  });

  it("offers a context menu on a yield segment to open the culture or copy its summary", async () => {
    mocks.yieldList.mockResolvedValue({
      data: [
        {
          iso_week: "2026-W13",
          week_start: "2026-03-23",
          cultures: [
            { culture_id: 1, culture_name: "Kohl", yield: 0.7, color: "#16a34a" },
          ],
        },
      ],
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <FocusManagerProvider><MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter></FocusManagerProvider>,
    );

    const segment = await screen.findByTestId("yield-bar-2026-W13-1");
    fireEvent.contextMenu(segment);

    expect(await screen.findByRole("menuitem", { name: "Kultur öffnen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Kultur öffnen" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/app/cultures?cultureId=1");

    fireEvent.contextMenu(segment);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Zeile kopieren" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Kohl · W13 Mär · 0.70 kg"));
  });

  describe("keyboard navigation on the chart bars", () => {
    beforeEach(() => {
      mocks.yieldList.mockResolvedValue({
        data: [
          {
            iso_week: "2026-W13",
            week_start: "2026-03-23",
            cultures: [
              { culture_id: 1, culture_name: "Kohl", yield: 0.7, color: "#16a34a" },
              { culture_id: 2, culture_name: "Karotte", yield: 0.5, color: "#f97316" },
            ],
          },
          {
            iso_week: "2026-W14",
            week_start: "2026-03-30",
            cultures: [
              { culture_id: 1, culture_name: "Kohl", yield: 0.9, color: "#16a34a" },
              { culture_id: 2, culture_name: "Karotte", yield: 0.4, color: "#f97316" },
            ],
          },
        ],
      });
    });

    it("moves focus between periods with ArrowRight/ArrowLeft", async () => {
      render(
        <FocusManagerProvider><MemoryRouter>
          <YieldOverviewPage />
        </MemoryRouter></FocusManagerProvider>,
      );

      const week13Kohl = await screen.findByTestId("yield-bar-2026-W13-1");
      const week14Kohl = screen.getByTestId("yield-bar-2026-W14-1");

      fireEvent.keyDown(week13Kohl, { key: "ArrowRight" });
      expect(week14Kohl).toHaveFocus();

      fireEvent.keyDown(week14Kohl, { key: "ArrowLeft" });
      expect(week13Kohl).toHaveFocus();
    });

    it("moves focus between stacked cultures within a period with ArrowUp/ArrowDown", async () => {
      render(
        <FocusManagerProvider><MemoryRouter>
          <YieldOverviewPage />
        </MemoryRouter></FocusManagerProvider>,
      );

      const week13Kohl = await screen.findByTestId("yield-bar-2026-W13-1");
      const week13Karotte = screen.getByTestId("yield-bar-2026-W13-2");

      fireEvent.keyDown(week13Kohl, { key: "ArrowUp" });
      expect(week13Karotte).toHaveFocus();

      fireEvent.keyDown(week13Karotte, { key: "ArrowDown" });
      expect(week13Kohl).toHaveFocus();
    });

    it("opens the culture with Enter", async () => {
      render(
        <FocusManagerProvider><MemoryRouter>
          <YieldOverviewPage />
        </MemoryRouter></FocusManagerProvider>,
      );

      const week13Karotte = await screen.findByTestId("yield-bar-2026-W13-2");
      fireEvent.keyDown(week13Karotte, { key: "Enter" });

      expect(mocks.navigate).toHaveBeenCalledWith("/app/cultures?cultureId=2");
    });

    it("toggles the tooltip open with Space", async () => {
      render(
        <FocusManagerProvider><MemoryRouter>
          <YieldOverviewPage />
        </MemoryRouter></FocusManagerProvider>,
      );

      const week13Kohl = await screen.findByTestId("yield-bar-2026-W13-1");
      expect(screen.queryByText("0.70 kg")).not.toBeInTheDocument();

      fireEvent.keyDown(week13Kohl, { key: " " });
      expect(await screen.findByText("0.70 kg")).toBeInTheDocument();

      fireEvent.keyDown(week13Kohl, { key: " " });
      await waitFor(() => expect(screen.queryByText("0.70 kg")).not.toBeInTheDocument());
    });

    it("opens the context menu at the focused segment with the ContextMenu key", async () => {
      render(
        <FocusManagerProvider><MemoryRouter>
          <YieldOverviewPage />
        </MemoryRouter></FocusManagerProvider>,
      );

      const week13Kohl = await screen.findByTestId("yield-bar-2026-W13-1");
      fireEvent.keyDown(week13Kohl, { key: "ContextMenu" });

      expect(await screen.findByRole("menuitem", { name: "Kultur öffnen" })).toBeInTheDocument();
    });
  });

  it("shows a helpful empty state when no planting plans exist", async () => {
    mocks.planList.mockResolvedValue({ data: { results: [] } });

    render(
      <FocusManagerProvider><MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter></FocusManagerProvider>,
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
    const currentYear = new Date().getFullYear();
    render(
      <FocusManagerProvider><MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter></FocusManagerProvider>,
    );

    expect(
      await screen.findByText(`Keine erwarteten Erträge für ${currentYear}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Für das Jahr ${currentYear} sind keine Erntedaten vorhanden. Wähle ein anderes Jahr oder stelle sicher, dass deine Kulturen erwartete Erträge eingetragen haben.`,
      ),
    ).toBeInTheDocument();
  });

  it("reloads yield data when the year changes", async () => {
    const currentYear = new Date().getFullYear();
    render(
      <FocusManagerProvider><MemoryRouter>
        <YieldOverviewPage />
      </MemoryRouter></FocusManagerProvider>,
    );

    await screen.findByText(`Keine erwarteten Erträge für ${currentYear}`);
    const previousYear = new Date().getFullYear() - 1;

    fireEvent.mouseDown(screen.getByLabelText("Jahr"));
    fireEvent.click(screen.getByRole("option", { name: String(previousYear) }));

    await waitFor(() => {
      expect(mocks.yieldList).toHaveBeenLastCalledWith(previousYear);
    });
  });
});
