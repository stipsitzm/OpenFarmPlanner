import React from "react";
import type { TaskGroup, TaskListProps } from "../../types";
import { CollisionService } from "../../services";
import {
  estimateLabelHeight,
  getHierarchyLevels,
  getLabelLinesSource,
  normalizeLeftColumnWidth,
} from "../../utils";

/**
 * TaskList Component - Displays the list of task groups on the left side of the Gantt chart
 */
const TREE_INDENT_PX = 20;

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    className={`rmg-task-group-chevron-icon ${expanded ? "rmg-task-group-chevron-icon-expanded" : ""}`}
    aria-hidden="true"
  >
    <path d="M5 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TaskList: React.FC<TaskListProps> = ({
  tasks = [],
  headerLabel = "Resources",
  showIcon = false,
  showTaskCount = false,
  showDescription = true,
  rowHeight = 40,
  className = "",
  onGroupClick,
  onGroupContextMenu,
  onToggleGroupExpand,
  hoveredGroupId = null,
  viewMode,
  showTimelineHeader = true,
  leftColumnWidth = 160,
}) => {
  // Validate task groups array
  const validTasks = Array.isArray(tasks) ? tasks : [];

  const normalizedLeftColumnWidth = normalizeLeftColumnWidth(leftColumnWidth);

  // Calculate height for each group based on tasks
  const getGroupHeight = (taskGroup: TaskGroup) => {
    if (taskGroup.rowHeightOverride !== undefined) {
      return taskGroup.rowHeightOverride;
    }

    const isTreeRow = taskGroup.depth !== undefined;
    const hierarchyLevels = isTreeRow ? null : getHierarchyLevels(taskGroup);
    const labelLinesSource = isTreeRow
      ? [taskGroup.name || "Unnamed"]
      : getLabelLinesSource(taskGroup, hierarchyLevels, showDescription);
    const estimatedHeight = estimateLabelHeight(
      labelLinesSource,
      normalizedLeftColumnWidth - (isTreeRow ? (taskGroup.depth ?? 0) * TREE_INDENT_PX : 0),
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

  const handleChevronClick = (event: React.MouseEvent, groupId: string) => {
    event.stopPropagation();
    onToggleGroupExpand?.(groupId);
  };

  const longPressTimeoutRef = React.useRef<number | null>(null);
  const handleGroupTouchStart = (event: React.TouchEvent, group: TaskGroup) => {
    if (!onGroupContextMenu) return;
    const touch = event.touches[0];
    if (!touch) return;
    longPressTimeoutRef.current = window.setTimeout(() => {
      onGroupContextMenu(event, group);
    }, 550);
  };
  const clearGroupLongPress = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
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
        const isTreeRow = taskGroup.depth !== undefined;

        if (isTreeRow) {
          const depth = taskGroup.depth ?? 0;
          const isExpanded = Boolean(taskGroup.isExpanded);
          const displayName = taskGroup.name || "Unnamed";

          return (
            <div
              key={`task-group-${taskGroup.id || "unknown"}`}
              className="rmg-task-group rmg-task-group-tree-row"
              style={{ minHeight: `${groupHeight}px` }}
              onClick={() => handleGroupClick(taskGroup)}
              onContextMenu={
                onGroupContextMenu ? (event) => onGroupContextMenu(event, taskGroup) : undefined
              }
              onTouchStart={(event) => handleGroupTouchStart(event, taskGroup)}
              onTouchEnd={clearGroupLongPress}
              onTouchMove={clearGroupLongPress}
              data-testid={`task-group-${taskGroup.id || "unknown"}`}
              data-rmg-component="task-group"
              data-group-id={taskGroup.id}
              data-depth={depth}
              data-expanded={taskGroup.isExpandable ? isExpanded : undefined}
              data-hover-linked={hoveredGroupId === taskGroup.id ? "true" : undefined}
            >
              <div
                className="rmg-task-group-content rmg-task-group-tree-content"
                style={{ paddingLeft: `${depth * TREE_INDENT_PX}px` }}
              >
                {taskGroup.isExpandable ? (
                  <button
                    type="button"
                    className="rmg-task-group-chevron"
                    onClick={(event) => handleChevronClick(event, taskGroup.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    data-rmg-component="task-group-chevron"
                  >
                    <ChevronIcon expanded={isExpanded} />
                  </button>
                ) : (
                  <span className="rmg-task-group-chevron-spacer" aria-hidden="true" />
                )}

                {showIcon && taskGroup.icon && (
                  <span
                    className="rmg-task-group-icon"
                    dangerouslySetInnerHTML={{ __html: taskGroup.icon }}
                    data-rmg-component="task-group-icon"
                  />
                )}

                <span
                  className="rmg-task-group-name rmg-task-group-tree-name"
                  data-rmg-component="task-group-name"
                  title={displayName}
                >
                  {displayName}
                </span>
              </div>

              {taskGroup.emptyRowLabel && (
                <div
                  className="rmg-task-group-meta"
                  data-rmg-component="task-group-meta"
                >
                  {taskGroup.emptyRowLabel}
                </div>
              )}

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
        }

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

export default React.memo(TaskList);
