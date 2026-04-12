import React from "react";
import { TaskGroup, TaskListProps } from "@/types";
import { CollisionService } from "@/services";

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
}) => {
  type ParsedHierarchy = {
    locationName?: string;
    fieldName?: string;
    bedName?: string;
  };

  // Validate task groups array
  const validTasks = Array.isArray(tasks) ? tasks : [];

  const parseHierarchyFromDescription = (
    description?: string,
  ): ParsedHierarchy | null => {
    if (!description) return null;

    const trimmed = description.trim();
    if (!trimmed) return null;

    const multiLineParts = trimmed
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
    if (multiLineParts.length >= 2) {
      return {
        locationName: multiLineParts[0],
        fieldName: multiLineParts[1],
        bedName: multiLineParts[2],
      };
    }

    const separatorPatterns = [
      /\s*>\s*/,
      /\s*›\s*/,
      /\s*→\s*/,
      /\s*->\s*/,
      /\s*\|\s*/,
      /\s*\/\s*/,
    ];

    for (const separator of separatorPatterns) {
      const parts = trimmed.split(separator).map((part) => part.trim());
      if (parts.length >= 2 && parts.every(Boolean)) {
        return {
          locationName: parts[0],
          fieldName: parts[1],
          bedName: parts[2],
        };
      }
    }

    return null;
  };

  const getHierarchy = (taskGroup: TaskGroup): ParsedHierarchy | null => {
    const explicitHierarchy: ParsedHierarchy = {
      locationName: taskGroup.locationName,
      fieldName: taskGroup.fieldName,
      bedName: taskGroup.bedName,
    };

    if (explicitHierarchy.locationName || explicitHierarchy.fieldName) {
      return explicitHierarchy;
    }

    return parseHierarchyFromDescription(taskGroup.description);
  };

  const getHierarchyLevels = (taskGroup: TaskGroup): string[] | null => {
    const explicitPath = Array.isArray(taskGroup.hierarchyPath)
      ? taskGroup.hierarchyPath
          .map((level) => level?.trim())
          .filter((level): level is string => Boolean(level))
      : [];

    if (explicitPath.length >= 2) {
      return explicitPath;
    }

    const metadataLevels = [
      taskGroup.locationName,
      taskGroup.fieldName,
      taskGroup.name || taskGroup.bedName || "Unnamed",
    ].filter((level): level is string => Boolean(level?.trim()));

    if (metadataLevels.length >= 2) {
      return metadataLevels;
    }

    const parsedHierarchy = getHierarchy(taskGroup);
    if (!parsedHierarchy) {
      return null;
    }

    const parsedLevels = [
      parsedHierarchy.locationName,
      parsedHierarchy.fieldName,
      taskGroup.name || parsedHierarchy.bedName || "Unnamed",
    ].filter((level): level is string => Boolean(level?.trim()));

    return parsedLevels.length >= 2 ? parsedLevels : null;
  };

  // Calculate height for each group based on tasks
  const getGroupHeight = (taskGroup: TaskGroup) => {
    if (!taskGroup.tasks || !Array.isArray(taskGroup.tasks)) {
      return 60; // Default height for empty groups
    }

    const taskRows = CollisionService.detectOverlaps(taskGroup.tasks, viewMode);
    return Math.max(60, taskRows.length * rowHeight + 20);
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

        return (
          <div
            key={`task-group-${taskGroup.id || "unknown"}`}
            className="rmg-task-group"
            style={{ height: `${groupHeight}px` }}
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
                >
                  {hierarchyLevels?.map((level, index) => (
                    <div
                      key={`task-group-${taskGroup.id}-level-${index}`}
                      className={`rmg-task-group-level rmg-task-group-level-depth-${index}`}
                      title={level}
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
                  title={taskGroup.name || "Unnamed"}
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
