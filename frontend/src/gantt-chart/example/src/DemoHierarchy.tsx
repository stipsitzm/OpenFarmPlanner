import * as React from "react";
import GanttChart, { Task, TaskGroup } from "react-modern-gantt";
import { createHierarchyDemoData } from "./data";

interface DemoHierarchyProps {
  darkMode: boolean;
}

const DemoHierarchy: React.FC<DemoHierarchyProps> = ({ darkMode }) => {
  const [mode, setMode] = React.useState<"three-level" | "two-level">(
    "three-level",
  );
  const [tasks, setTasks] = React.useState<TaskGroup[]>(createHierarchyDemoData(true));

  const handleModeChange = (nextMode: "three-level" | "two-level") => {
    setMode(nextMode);
    setTasks(createHierarchyDemoData(nextMode === "three-level"));
  };

  const handleTaskUpdate = (groupId: string, updatedTask: Task) => {
    setTasks((prevTasks) =>
      prevTasks.map((group) =>
        group.id === groupId
          ? {
              ...group,
              tasks: group.tasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task,
              ),
            }
          : group,
      ),
    );
  };

  return (
    <div>
      <div className="control-panel">
        <button
          onClick={() => handleModeChange("three-level")}
          data-active={mode === "three-level"}
        >
          Location → Field → Bed
        </button>
        <button
          onClick={() => handleModeChange("two-level")}
          data-active={mode === "two-level"}
        >
          Field → Bed
        </button>
        <button
          onClick={() => setTasks(createHierarchyDemoData(mode === "three-level"))}
        >
          Reset Demo
        </button>
      </div>

      <GanttChart
        tasks={tasks}
        title="OpenFarmPlanner Hierarchy Demo"
        headerLabel="Fields"
        darkMode={darkMode}
        showProgress={true}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  );
};

export default DemoHierarchy;
