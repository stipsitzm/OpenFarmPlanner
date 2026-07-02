import React from "react";
import { render, screen } from "@testing-library/react";
import { GanttChart, ViewMode, type TaskGroup } from "../src";

const tasks: TaskGroup[] = [
  {
    id: "group-1",
    name: "Engineering",
    tasks: [
      {
        id: "task-1",
        name: "API Integration",
        startDate: new Date(2026, 1, 1),
        endDate: new Date(2026, 2, 1),
      },
    ],
  },
];

describe("GanttChart localization", () => {
  const inRangeCurrentDate = new Date(2026, 1, 15);

  test("uses localeText labels for title, resources, and view modes", () => {
    render(
      <GanttChart
        tasks={tasks}
        currentDate={inRangeCurrentDate}
        viewModes={[ViewMode.DAY, ViewMode.MONTH]}
        viewMode={ViewMode.MONTH}
        locale="de-DE"
        localeText={{
          title: "Feldplanung",
          resources: "Beete",
          viewModes: {
            [ViewMode.DAY]: "Tag",
            [ViewMode.MONTH]: "Monat",
          },
        }}
      />,
    );

    expect(screen.getByText("Feldplanung")).toBeInTheDocument();
    expect(screen.getByText("Beete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monat" })).toBeInTheDocument();
  });

  test("allows explicit props to override localeText defaults", () => {
    render(
      <GanttChart
        tasks={tasks}
        currentDate={inRangeCurrentDate}
        title="Open Farm Planner"
        headerLabel="Felder"
        todayLabel="Heute (manuell)"
        viewModes={[ViewMode.MONTH]}
        localeText={{
          title: "Ignorieren",
          resources: "Ignorieren",
          today: "Ignorieren",
          viewModes: {
            [ViewMode.MONTH]: "Monat",
          },
        }}
      />,
    );

    expect(screen.getByText("Open Farm Planner")).toBeInTheDocument();
    expect(screen.getByText("Felder")).toBeInTheDocument();
  });
});
