import * as React from "react";
import GanttChart, { Task, TaskGroup } from "react-modern-gantt";
import { longLabelDemoData } from "./data";

interface DemoLongLabelsProps {
  darkMode: boolean;
}

const DemoLongLabels: React.FC<DemoLongLabelsProps> = ({ darkMode }) => {
  const [tasks, setTasks] = React.useState<TaskGroup[]>(longLabelDemoData);

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
    <GanttChart
      tasks={tasks}
      title="Long Label Demo"
      headerLabel="Locations"
      darkMode={darkMode}
      showProgress={true}
      onTaskUpdate={handleTaskUpdate}
    />
  );
};

export default DemoLongLabels;
