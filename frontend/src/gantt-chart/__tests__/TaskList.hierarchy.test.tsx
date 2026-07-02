import React from "react";
import { render, screen } from "@testing-library/react";
import { GanttChart, ViewMode, type TaskGroup } from "../src";
import { createHierarchyDemoData } from "../example/src/data";

const createTask = (id: string, name: string) => ({
  id,
  name,
  startDate: new Date(2026, 0, 1),
  endDate: new Date(2026, 0, 10),
});

describe("TaskList hierarchy location visibility", () => {
  test("renders explicit three-level hierarchy path", () => {
    const tasks: TaskGroup[] = [
      {
        id: "group-1",
        name: "Bed 1",
        hierarchyPath: ["Location North Farm", "Field A", "Bed 1"],
        tasks: [createTask("task-1", "Carrot")],
      },
    ];

    render(
      <GanttChart tasks={tasks} viewMode={ViewMode.MONTH} viewModes={false} />,
    );

    expect(screen.getByText("Location North Farm")).toBeInTheDocument();
    expect(screen.getByText("Field A")).toBeInTheDocument();
    expect(screen.getByText("Bed 1")).toBeInTheDocument();
  });

  test("renders explicit two-level hierarchy path", () => {
    const tasks: TaskGroup[] = [
      {
        id: "group-1",
        name: "Bed 1",
        hierarchyPath: ["Field North", "Bed 1"],
        tasks: [createTask("task-1", "Carrot")],
      },
    ];

    render(
      <GanttChart tasks={tasks} viewMode={ViewMode.MONTH} viewModes={false} />,
    );

    expect(screen.queryByText("Location North Farm")).not.toBeInTheDocument();
    expect(screen.getByText("Field North")).toBeInTheDocument();
    expect(screen.getByText("Bed 1")).toBeInTheDocument();
  });

  test("does not infer visibility from dataset uniqueness when hierarchyPath includes location", () => {
    const tasks: TaskGroup[] = [
      {
        id: "group-1",
        name: "Bed 1",
        hierarchyPath: ["Location Green Farm", "Field A", "Bed 1"],
        tasks: [createTask("task-1", "Carrot")],
      },
      {
        id: "group-2",
        name: "Bed 2",
        hierarchyPath: ["Location Green Farm", "Field B", "Bed 2"],
        tasks: [createTask("task-2", "Lettuce")],
      },
    ];

    render(
      <GanttChart tasks={tasks} viewMode={ViewMode.MONTH} viewModes={false} />,
    );

    expect(screen.getAllByText("Location Green Farm")).toHaveLength(2);
  });

  test("demo toggle changes input hierarchy shape and renderer output", () => {
    const { rerender } = render(
      <GanttChart
        tasks={createHierarchyDemoData(true)}
        viewMode={ViewMode.MONTH}
        viewModes={false}
      />,
    );

    expect(screen.getAllByText("Location Green Farm")).toHaveLength(3);

    rerender(
      <GanttChart
        tasks={createHierarchyDemoData(false)}
        viewMode={ViewMode.MONTH}
        viewModes={false}
      />,
    );

    expect(screen.queryByText("Location Green Farm")).not.toBeInTheDocument();
    expect(screen.getByText("Field North")).toBeInTheDocument();
  });
});
