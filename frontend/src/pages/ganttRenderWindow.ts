import type { GanttTaskGroup } from './ganttChartUtils';

export const GANTT_ESTIMATED_ROW_HEIGHT = 72;
export const GANTT_OVERSCAN_ROWS = 5;
export const GANTT_MAX_RENDERED_TASKS = 500;

export interface GanttRenderWindow {
  groups: GanttTaskGroup[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
}

export function getGanttRenderWindow(
  taskGroups: GanttTaskGroup[],
  scrollTop: number,
  viewportHeight: number,
): GanttRenderWindow {
  if (taskGroups.length === 0) {
    return {
      groups: [],
      startIndex: 0,
      endIndex: 0,
      totalHeight: 0,
    };
  }

  const firstVisibleIndex = Math.floor(
    Math.max(0, scrollTop) / GANTT_ESTIMATED_ROW_HEIGHT,
  );
  const visibleRowCount = Math.max(
    1,
    Math.ceil(Math.max(1, viewportHeight) / GANTT_ESTIMATED_ROW_HEIGHT),
  );
  const startIndex = Math.max(0, firstVisibleIndex - GANTT_OVERSCAN_ROWS);
  const targetEndIndex = Math.min(
    taskGroups.length,
    firstVisibleIndex + visibleRowCount + GANTT_OVERSCAN_ROWS,
  );

  const groups: GanttTaskGroup[] = [];
  let renderedTaskCount = 0;
  let endIndex = startIndex;

  for (let index = startIndex; index < targetEndIndex; index += 1) {
    const group = taskGroups[index];
    if (!group) {
      continue;
    }
    if (
      groups.length > 0
      && renderedTaskCount + group.tasks.length > GANTT_MAX_RENDERED_TASKS
    ) {
      break;
    }
    groups.push(group);
    renderedTaskCount += group.tasks.length;
    endIndex = index + 1;
  }

  if (groups.length === 0) {
    groups.push(taskGroups[startIndex]);
    endIndex = startIndex + 1;
  }

  return {
    groups,
    startIndex,
    endIndex,
    totalHeight: taskGroups.length * GANTT_ESTIMATED_ROW_HEIGHT,
  };
}
