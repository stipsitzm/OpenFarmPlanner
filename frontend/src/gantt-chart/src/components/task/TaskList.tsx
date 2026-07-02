import React from "react";
import { TaskGroup, TaskListProps } from "@/types";
import { CollisionService } from "@/services";
import {
  estimateLabelHeight,
  getHierarchyLevels,
  getLabelLinesSource,
  normalizeLeftColumnWidth,
} from "@/utils";

/**
 * TaskList Component - Displays the list of task groups on the left side of the Gantt chart
 */
const TaskList: React.FC<TaskListProps> = ({
  tasks = [],
  headerLabel = "Resources",
  showIcon = false,
  showTaskCount = false,
  showDescription = true,
  rowHeight = 40,
  className = "",
  onGroupClick,
  viewMode,
  showTimelineHeader = true,
  leftColumnWidth = 160,
}) => {
  // Validate task groups array
  const validTasks = Array.isArray(tasks) ? tasks : [];

  const normalizedLeftColumnWidth = normalizeLeftColumnWidth(leftColumnWidth);

  // Calculate height for each group based on tasks
  const getGroupHeight = (taskGroup: TaskGroup) => {
    const hierarchyLevels = getHierarchyLevels(taskGroup);
    const labelLinesSource = getLabelLinesSource(
      taskGroup,
      hierarchyLevels,
      showDescription,
    );
    const estimatedHeight = estimateLabelHeight(
      labelLinesSource,
      normalizedLeftColumnWidth,
    );

    if (!taskGroup.tasks || !Array.isArray(taskGroup.tasks)) {
      return estimatedHeight;
    }

    const taskRows = CollisionService.detectOverlaps(taskGroup.tasks, viewMode);
    const taskHeight = Math.max(60, taskRows.length * rowHeight + 20);
    return Math.max(taskHeight, estimatedHeight);
  };

  // Handle group click
  const handleGroupClick = (group: TaskGroup) => {
    if (onGroupClick) {
      onGroupClick(group);
    }
  };

  return (
    <div
      className={`rmg-task-list ${className}`}
      data-rmg-component="task-list"
      style={{
        width: `${normalizedLeftColumnWidth}px`,
        minWidth: `${normalizedLeftColumnWidth}px`,
        maxWidth: `${normalizedLeftColumnWidth}px`,
      }}
    >
      {/* Header - CSS handles the height adjustment based on view mode */}
      <div
        className="rmg-task-list-header"
        data-show-timeline-header={showTimelineHeader}
      >
        {headerLabel}
      </div>

      {/* Task Groups */}
      {validTasks.map((taskGroup) => {
        if (!taskGroup) return null;

        const groupHeight = getGroupHeight(taskGroup);
        const hierarchyLevels = getHierarchyLevels(taskGroup);
        const hasHierarchy = Boolean(hierarchyLevels);
        const fullLabelTitle = (
          taskGroup.name ||
          hierarchyLevels?.join(" / ") ||
          "Unnamed"
        ).trim();

        return (
          <div
            key={`task-group-${taskGroup.id || "unknown"}`}
            className="rmg-task-group"
            style={{ minHeight: `${groupHeight}px` }}
            onClick={() => handleGroupClick(taskGroup)}
            data-testid={`task-group-${taskGroup.id || "unknown"}`}
            data-rmg-component="task-group"
            data-group-id={taskGroup.id}
          >
            <div className="rmg-task-group-content">
              {/* Icon (if enabled) */}
              {showIcon && taskGroup.icon && (
                <span
                  className="rmg-task-group-icon"
                  dangerouslySetInnerHTML={{ __html: taskGroup.icon }}
                  data-rmg-component="task-group-icon"
                />
              )}

              {hasHierarchy ? (
                <div
                  className="rmg-task-group-hierarchy"
                  data-rmg-component="task-group-hierarchy"
                  title={fullLabelTitle}
                >
                  {hierarchyLevels?.map((level, index) => (
                    <div
                      key={`task-group-${taskGroup.id}-level-${index}`}
                      className={`rmg-task-group-level rmg-task-group-level-depth-${index}`}
                      title={fullLabelTitle || level}
                      data-rmg-component={
                        index === hierarchyLevels.length - 1
                          ? "task-group-name"
                          : undefined
                      }
                    >
                      {level}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="rmg-task-group-name"
                  data-rmg-component="task-group-name"
                  title={fullLabelTitle}
                >
                  {taskGroup.name || "Unnamed"}
                </div>
              )}
            </div>

            {/* Description (if available and enabled) */}
            {showDescription && taskGroup.description && !hasHierarchy && (
              <div
                className="rmg-task-group-description"
                data-rmg-component="task-group-description"
                title={taskGroup.description}
              >
                {taskGroup.description}
              </div>
            )}

            {/* Task count (if enabled) */}
            {showTaskCount && taskGroup.tasks && taskGroup.tasks.length > 0 && (
              <div
                className="rmg-task-group-count"
                data-rmg-component="task-group-count"
              >
                {taskGroup.tasks.length}{" "}
                {taskGroup.tasks.length === 1 ? "task" : "tasks"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TaskList;
