import * as React from "react";
import GanttChart, { Task, TaskGroup } from "react-modern-gantt";
import { longLabelDemoData } from "./data";

interface DemoLongLabelsProps {
  darkMode: boolean;
}

const DemoLongLabels: React.FC<DemoLongLabelsProps> = ({ darkMode }) => {
  const [tasks, setTasks] = React.useState<TaskGroup[]>(longLabelDemoData);
  const [leftColumnWidth, setLeftColumnWidth] = React.useState(160);

  const handleTaskUpdate = (groupId: string, updatedTask: Task) => {
    setTasks((previousTasks) =>
      previousTasks.map((group) =>
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
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <label>
          Left column width:&nbsp;
          <input
            type="number"
            min={120}
            max={420}
            value={leftColumnWidth}
            onChange={(event) =>
              setLeftColumnWidth(
                Math.max(120, Number(event.target.value) || 120),
              )
            }
          />
        </label>
      </div>

      <GanttChart
        tasks={tasks}
        title="Long Label Demo"
        headerLabel="Locations"
        darkMode={darkMode}
        showProgress={true}
        leftColumnWidth={leftColumnWidth}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  );
};

export default DemoLongLabels;
