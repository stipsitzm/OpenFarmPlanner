import * as React from "react";
import GanttChart, { Task, TaskGroup } from "react-modern-gantt";
import { createHierarchyDemoData } from "./data";

interface DemoHierarchyProps {
  darkMode: boolean;
}

const DemoHierarchy: React.FC<DemoHierarchyProps> = ({ darkMode }) => {
  const [showLocationLevel, setShowLocationLevel] = React.useState(true);
  const [tasks, setTasks] = React.useState<TaskGroup[]>(
    createHierarchyDemoData(true),
  );

  React.useEffect(() => {
    setTasks(createHierarchyDemoData(showLocationLevel));
  }, [showLocationLevel]);

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
        <label style={{ display: "inline-flex", gap: "8px", marginRight: "8px" }}>
          <input
            type="checkbox"
            checked={showLocationLevel}
            onChange={(event) => setShowLocationLevel(event.target.checked)}
          />
          Show location level
        </label>
        <button
          onClick={() => setTasks(createHierarchyDemoData(showLocationLevel))}
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
