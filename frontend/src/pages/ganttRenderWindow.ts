import type { GanttTaskGroup } from './ganttChartUtils';

export const MAX_GANTT_GROUPS_PER_WINDOW = 120;
export const MAX_GANTT_TASKS_PER_WINDOW = 800;

export function buildGanttRenderWindows(
  taskGroups: GanttTaskGroup[],
  maxGroups = MAX_GANTT_GROUPS_PER_WINDOW,
  maxTasks = MAX_GANTT_TASKS_PER_WINDOW,
): GanttTaskGroup[][] {
  if (taskGroups.length === 0) {
    return [[]];
  }

  const windows: GanttTaskGroup[][] = [];
  let currentWindow: GanttTaskGroup[] = [];
  let currentTaskCount = 0;

  taskGroups.forEach((group) => {
    const groupTaskCount = group.tasks.length;
    const exceedsGroupLimit = currentWindow.length >= maxGroups;
    const exceedsTaskLimit = currentWindow.length > 0
      && currentTaskCount + groupTaskCount > maxTasks;

    if (exceedsGroupLimit || exceedsTaskLimit) {
      windows.push(currentWindow);
      currentWindow = [];
      currentTaskCount = 0;
    }

    currentWindow.push(group);
    currentTaskCount += groupTaskCount;
  });

  if (currentWindow.length > 0) {
    windows.push(currentWindow);
  }

  return windows;
}
