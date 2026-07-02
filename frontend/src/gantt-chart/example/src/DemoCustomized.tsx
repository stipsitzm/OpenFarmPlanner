import * as React from "react";
import { useState } from "react";
import GanttChart, { Task, TaskGroup } from "react-modern-gantt";
import { complexDemoData } from "./data";
import { format } from "date-fns";

interface DemoCustomizedProps {
    darkMode: boolean;
}

const DemoCustomized: React.FC<DemoCustomizedProps> = ({ darkMode }: DemoCustomizedProps) => {
    const [tasks, setTasks] = useState<TaskGroup[]>(complexDemoData);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Handle task updates
    const handleTaskUpdate = (groupId: string, updatedTask: Task) => {
        setTasks(prevTasks =>
            prevTasks.map(group =>
                group.id === groupId
                    ? {
                          ...group,
                          tasks: group.tasks.map(task => (task.id === updatedTask.id ? updatedTask : task)),
                      }
                    : group
            )
        );
    };

    // Handle task selection
    const handleTaskSelect = (task: Task, isSelected: boolean) => {
        setSelectedTaskId(isSelected ? task.id : null);
    };

    // Custom task color function
    const getTaskColor = ({
        task,
        isHovered: _isHovered,
        isDragging: _isDragging,
    }: {
        task: Task;
        isHovered: boolean;
        isDragging: boolean;
    }) => {
        // Highlight selected task
        if (task.id === selectedTaskId) {
            return {
                backgroundColor: "bg-yellow-400",
                borderColor: "border-yellow-600",
                textColor: "text-gray-900",
            };
        }

        // Special color for completed tasks
        if (task.percent === 100) {
            return {
                backgroundColor: "bg-emerald-600",
                borderColor: "border-emerald-800",
                textColor: "text-white",
            };
        }

        // Tasks with dependencies
        if (task.dependencies && task.dependencies.length > 0) {
            return {
                backgroundColor: task.color || "bg-blue-500",
                borderColor: "border-blue-700",
                textColor: "text-white",
            };
        }

        // Default colors
        return {
            backgroundColor: task.color || "bg-blue-500",
            textColor: "text-white",
        };
    };

    // Custom task renderer
    const renderTask = ({
        task,
        leftPx,
        widthPx,
        topPx,
        isHovered,
        isDragging,
        showProgress,
    }: {
        task: Task;
        leftPx: number;
        widthPx: number;
        topPx: number;
        isHovered: boolean;
        isDragging: boolean;
        showProgress?: boolean;
    }) => {
        // Get colors from the custom color function
        const { backgroundColor, borderColor, textColor } = getTaskColor({
            task,
            isHovered,
            isDragging,
        });

        // Define dynamic classes
        const bgClass = backgroundColor.startsWith("bg-") ? backgroundColor : "";
        const textClass = textColor || "text-white";
        const borderClass = borderColor || "";

        // Apply inline styles for any non-class colors
        const styles: React.CSSProperties = {
            left: `${Math.max(0, leftPx)}px`,
            width: `${Math.max(20, widthPx)}px`,
            top: `${topPx}px`,
            backgroundColor: !backgroundColor.startsWith("bg-") ? backgroundColor : undefined,
            borderColor: borderColor && !borderColor.startsWith("border-") ? borderColor : undefined,
        };

        return (
            <div
                className={`absolute h-8 rounded ${bgClass} ${borderClass} ${textClass}
          flex items-center px-2 text-xs font-medium
          ${isHovered ? "ring-2 ring-white" : ""}
          ${isDragging ? "shadow-lg" : ""}
          ${task.id === selectedTaskId ? "ring-2 ring-white" : ""}
          ${borderClass ? "border" : ""}
        `}
                style={styles}>
                <div className="truncate">{task.name}</div>

                {/* Custom progress indicator */}
                {showProgress && typeof task.percent === "number" && (
                    <div className="absolute bottom-1 left-1 right-1 h-1 bg-black bg-opacity-20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white bg-opacity-80 rounded-full"
                            style={{ width: `${task.percent}%` }}
                        />
                    </div>
                )}

                {/* Show dependencies indicator if they exist */}
                {task.dependencies && task.dependencies.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
            </div>
        );
    };

    // Custom tooltip renderer
    const renderTooltip = ({
        task,
        position: _position,
        dragType,
        startDate,
        endDate,
    }: {
        task: Task;
        position: { x: number; y: number };
        dragType: "move" | "resize-left" | "resize-right" | null;
        startDate: Date;
        endDate: Date;
    }) => {
        return (
            <div
                className={`bg-gray-800 dark:bg-gray-700 text-white p-3 rounded shadow-lg
          border border-gray-700 dark:border-gray-600
        `}
                style={{
                    minWidth: "220px",
                    maxWidth: "280px",
                }}>
                <div className="text-sm font-bold mb-1">{task.name}</div>

                {dragType && (
                    <div className="text-xs text-blue-300 mb-2">
                        {dragType === "move"
                            ? "Moving task..."
                            : dragType === "resize-left"
                            ? "Adjusting start date..."
                            : "Adjusting end date..."}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <div className="text-gray-400">Start:</div>
                    <div>{format(startDate, "MMM d, yyyy")}</div>

                    <div className="text-gray-400">End:</div>
                    <div>{format(endDate, "MMM d, yyyy")}</div>

                    <div className="text-gray-400">Progress:</div>
                    <div>{task.percent || 0}%</div>

                    {task.dependencies && task.dependencies.length > 0 && (
                        <>
                            <div className="text-gray-400">Dependencies:</div>
                            <div>{task.dependencies.join(", ")}</div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="control-panel">
                <button onClick={() => setTasks(complexDemoData)}>Reset Demo</button>
                {selectedTaskId && <button onClick={() => setSelectedTaskId(null)}>Clear Selection</button>}
            </div>

            <div style={{ marginBottom: "20px" }}>
                <p>
                    This demo showcases custom task rendering, custom tooltips, and dynamic task colors based on
                    progress and dependencies.
                </p>
                <p>Click on a task to select it and see it highlighted with a yellow color.</p>
            </div>

            <GanttChart
                tasks={tasks}
                title="Customized Gantt Chart"
                darkMode={darkMode}
                showProgress={true}
                onTaskUpdate={handleTaskUpdate}
                onTaskSelect={handleTaskSelect}
                getTaskColor={getTaskColor}
                renderTask={renderTask}
                renderTooltip={renderTooltip}
                styles={{
                    container: "border-2 border-indigo-200 dark:border-indigo-800",
                    title: "text-2xl font-bold text-indigo-800 dark:text-indigo-300",
                    todayMarker: "bg-pink-500",
                    taskList: "bg-gray-50 dark:bg-gray-800",
                }}
            />
        </div>
    );
};

export default DemoCustomized;
