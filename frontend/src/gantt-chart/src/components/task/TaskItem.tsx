import React, { useRef, useEffect, useState } from "react";
import type { TaskItemProps } from "../../types";
import { ContextMenuIndicator } from "../../../../components/contextMenu/ContextMenuIndicator";

/**
 * TaskItem Component - Renders an individual task bar in the Gantt chart
 */
const TaskItem: React.FC<TaskItemProps> = ({
  task,
  leftPx,
  widthPx,
  topPx,
  isHovered,
  isDragging,
  editMode,
  allowProgressEdit = true,
  allowTaskResize = true,
  allowTaskMove = true,
  showProgress = false,
  instanceId,
  renderTask,
  getTaskColor,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
  onContextMenu,
  onProgressUpdate,
}) => {
  // Show resize handles only when hovered or dragging, in edit mode, AND resizing is allowed
  const showResizeHandles =
    (isHovered || isDragging) && editMode && allowTaskResize;

  // Progress editing requires: editMode=true, showProgress=true, AND allowProgressEdit=true
  const canEditProgress = editMode && showProgress && allowProgressEdit;

  // Task movement requires: editMode=true AND allowTaskMove=true
  const canMoveTask = editMode && allowTaskMove;
  const taskRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(task?.percent || 0);
  const [showProgressTooltip, setShowProgressTooltip] = useState(false);

  const isValidTask = Boolean(task && task.id);

  // Get task colors - either from custom function or default
  let backgroundColor = task.color || "var(--rmg-task-color)";
  let borderColor = "";
  let textColor = "var(--rmg-task-text-color)";

  if (getTaskColor) {
    const colors = getTaskColor({ task, isHovered, isDragging });
    backgroundColor = colors.backgroundColor;
    borderColor = colors.borderColor || "";
    textColor = colors.textColor || textColor;
  }

  // Handle resize interactions
  const handleResizeLeft = (e: React.MouseEvent) => {
    if (!allowTaskResize) return; // Check if resizing is allowed
    e.stopPropagation();
    onMouseDown(e, task, "resize-left");
  };

  const handleResizeRight = (e: React.MouseEvent) => {
    if (!allowTaskResize) return; // Check if resizing is allowed
    e.stopPropagation();
    onMouseDown(e, task, "resize-right");
  };

  // Handle task movement
  const handleTaskMouseDown = (e: React.MouseEvent) => {
    if (!canMoveTask) return; // Check if movement is allowed
    onMouseDown(e, task, "move");
  };

  // Progress bubble drag handlers with improved smoothness and separated from task drag
  const handleProgressMouseDown = (e: React.MouseEvent) => {
    if (!canEditProgress) return; // Check if progress editing is allowed

    // CRITICAL: Stop all propagation to prevent task drag
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();

    setIsDraggingProgress(true);
    setShowProgressTooltip(true);

    // Apply a smooth transition during drag for better visual feedback
    if (progressBarRef.current) {
      progressBarRef.current.style.transition = "width 0.05s ease-out";
    }

    // Store initial mouse position to ensure we have valid task reference
    const taskElement = taskRef.current;
    if (!taskElement) return;

    let currentPercent = progressPercent;

    // Add global event listeners with high priority - INLINE to avoid closure issues
    const handleMove = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      if (!taskElement) return;

      // Get progress bar bounds
      const taskRect = taskElement.getBoundingClientRect();

      // Calculate new progress percentage based on mouse position
      const barWidth = taskRect.width - 2; // Account for 1px padding on each side
      const clickX = Math.max(
        0,
        Math.min(barWidth, ev.clientX - taskRect.left),
      );
      const newPercent = Math.round((clickX / barWidth) * 100);

      // Update progress value with constraints
      currentPercent = Math.max(0, Math.min(100, newPercent));
      setProgressPercent(currentPercent);
    };

    const handleUp = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      setIsDraggingProgress(false);
      setShowProgressTooltip(false);

      // Remove event listeners
      document.removeEventListener("mousemove", handleMove, true);
      document.removeEventListener("mouseup", handleUp, true);

      // Reset transition after update for normal behavior
      if (progressBarRef.current) {
        progressBarRef.current.style.transition = "";
      }

      // Call update handler with the final progress value
      if (onProgressUpdate && currentPercent !== task.percent) {
        onProgressUpdate(task, currentPercent);
      }
    };

    // Use capture phase to intercept before task handlers
    document.addEventListener("mousemove", handleMove, true);
    document.addEventListener("mouseup", handleUp, true);
  };

  // Update progress state when task changes. progressPercent also tracks
  // in-progress drag state (see handleProgressMouseDown), so it can't be
  // derived directly from props during render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressPercent(task?.percent || 0);
  }, [task?.percent]);

  // Long-press (touch) opens the same context menu as a desktop right-click.
  const longPressTimeoutRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onContextMenu) return;
    const touch = e.touches[0];
    if (!touch) return;
    longPressTimeoutRef.current = window.setTimeout(() => {
      onContextMenu(e as unknown as React.MouseEvent, task);
    }, 550);
  };
  const clearLongPress = () => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  if (!isValidTask) {
    return null;
  }

  // Use custom render function if provided
  if (renderTask) {
    const customTaskContent = renderTask({
      task,
      leftPx,
      widthPx,
      topPx,
      isHovered,
      isDragging,
      editMode,
      showProgress,
    });

    return (
      <div
        ref={taskRef}
        className="rmg-task-item-custom"
        style={{
          position: "absolute",
          left: `${Math.max(0, leftPx)}px`,
          width: `${Math.max(20, widthPx)}px`,
          top: `${topPx}px`,
        }}
        onClick={(e) => onClick(e, task)}
        onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, task) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, task) : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        onMouseDown={canMoveTask ? handleTaskMouseDown : undefined}
        onMouseEnter={(e) => onMouseEnter(e, task)}
        onMouseLeave={onMouseLeave}
        data-testid={`task-${task.id}`}
        data-task-id={task.id}
        data-instance-id={instanceId}
        data-dragging={isDragging ? "true" : "false"}
        data-rmg-component="task"
      >
        {customTaskContent}
        {onContextMenu && (
          <ContextMenuIndicator
            label="Aktionen"
            tabIndex={-1}
            onClick={(e) => onContextMenu(e, task)}
            withBackdrop
            sx={{ position: "absolute", top: 2, right: 2 }}
          />
        )}
      </div>
    );
  }

  // Inline styles based on received task colors. CSS enforces a 20px
  // min-width on .rmg-task-item so very short tasks stay clickable/visible
  // without distorting the actual date range in the data.
  const taskStyles: React.CSSProperties = {
    left: `${leftPx}px`,
    top: `${topPx}px`,
    width: `${widthPx}px`,
    backgroundColor,
    color: textColor,
    cursor: isDragging ? "grabbing" : canMoveTask ? "grab" : "default",
  };

  if (borderColor) {
    taskStyles.borderColor = borderColor;
    taskStyles.borderWidth = "1px";
    taskStyles.borderStyle = "solid";
  }

  return (
    <div
      ref={taskRef}
      className={`rmg-task-item ${isDragging ? "rmg-task-item-dragging" : ""}`}
      style={taskStyles}
      onClick={(e) => onClick(e, task)}
      onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, task) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, task) : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onMouseDown={canMoveTask ? handleTaskMouseDown : undefined}
      onMouseEnter={(e) => onMouseEnter(e, task)}
      onMouseLeave={onMouseLeave}
      data-testid={`task-${task.id}`}
      data-task-id={task.id}
      data-instance-id={instanceId}
      data-dragging={isDragging ? "true" : "false"}
      data-rmg-component="task"
    >
      {/* Left resize handle */}
      {showResizeHandles && (
        <div
          className="rmg-resize-handle rmg-resize-handle-left"
          onMouseDown={handleResizeLeft}
          data-rmg-component="resize-handle"
          data-rmg-handle="left"
          style={{ cursor: "ew-resize" }}
        />
      )}

      {/* Task name */}
      <div className={`rmg-task-item-name${onContextMenu ? " rmg-task-item-name-maskable" : ""}`}>
        {task.name || "Unnamed Task"}
      </div>

      {onContextMenu && (
        <ContextMenuIndicator
          label="Aktionen"
          tabIndex={-1}
          onClick={(e) => onContextMenu(e, task)}
          withBackdrop
          sx={{ position: "absolute", top: 2, right: 2 }}
        />
      )}

      {/* Progress bar with interactive bubble */}
      {showProgress && typeof progressPercent === "number" && (
        <div
          ref={progressBarRef}
          className="rmg-progress-bar"
          onClick={(e) => {
            if (canEditProgress && onProgressUpdate) {
              e.stopPropagation();
              const barWidth = e.currentTarget.clientWidth;
              const clickX = e.nativeEvent.offsetX;
              const newPercent = Math.round((clickX / barWidth) * 100);
              setProgressPercent(newPercent);
              onProgressUpdate(task, newPercent);
            }
          }}
          data-rmg-component="progress-bar"
        >
          <div
            className="rmg-progress-fill"
            style={{
              width: `${progressPercent}%`,
              transition: isDraggingProgress ? "none" : "width 0.3s ease-out",
            }}
            data-rmg-component="progress-fill"
          >
            {/* Progress bubble handle - IMPROVED: Better visibility and positioning */}
            {canEditProgress && (isHovered || isDraggingProgress) && (
              <>
                <div
                  className={`rmg-progress-handle ${isDraggingProgress ? "rmg-progress-handle-dragging" : ""}`}
                  onMouseDown={handleProgressMouseDown}
                  style={{
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    zIndex: 1000,
                  }}
                  title="Drag to adjust progress"
                  data-rmg-component="progress-handle"
                />
                {/* Progress percentage tooltip */}
                {(showProgressTooltip || isDraggingProgress) && (
                  <div
                    className="rmg-progress-tooltip"
                    data-rmg-component="progress-tooltip"
                  >
                    {progressPercent}%
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Right resize handle */}
      {showResizeHandles && (
        <div
          className="rmg-resize-handle rmg-resize-handle-right"
          onMouseDown={handleResizeRight}
          data-rmg-component="resize-handle"
          data-rmg-handle="right"
          style={{ cursor: "ew-resize" }}
        />
      )}
    </div>
  );
};

export default React.memo(TaskItem);
