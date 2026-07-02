import type { Task, TaskGroup } from "react-modern-gantt";
import type {
  DemoScenario,
  FixtureDate,
  FixtureGenerator,
  FixtureTask,
  FixtureTaskGroup,
  GanttFixture,
} from "./types";

const addToDate = (
  baseDate: Date,
  {
    days = 0,
    hours = 0,
    minutes = 0,
  }: { days?: number; hours?: number; minutes?: number },
): Date => {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

export const resolveFixtureDate = (
  value: FixtureDate | undefined,
  baseDate = new Date(),
): Date | undefined => {
  if (!value) return undefined;

  if (typeof value === "string") {
    return new Date(value);
  }

  return addToDate(baseDate, {
    days: value.offsetDays ?? 0,
    hours: value.offsetHours ?? 0,
    minutes: value.offsetMinutes ?? 0,
  });
};

const normalizeTask = (task: FixtureTask, baseDate: Date): Task => ({
  ...task,
  startDate: resolveFixtureDate(task.startDate, baseDate) ?? baseDate,
  endDate: resolveFixtureDate(task.endDate, baseDate) ?? baseDate,
});

const normalizeGroup = (
  group: FixtureTaskGroup,
  baseDate: Date,
): TaskGroup => ({
  ...group,
  tasks: group.tasks.map((task) => normalizeTask(task, baseDate)),
});

const padRow = (rowNumber: number): string =>
  rowNumber.toString().padStart(3, "0");

const createGeneratedGroups = (
  generator: FixtureGenerator,
  baseDate: Date,
): TaskGroup[] => {
  return Array.from({ length: generator.count }, (_, index) => {
    const rowNumber = index + 1;
    const firstStartOffset =
      generator.startOffsetDays + index * generator.rowSpacingDays;
    const color =
      generator.colors[index % generator.colors.length] ?? "#2563eb";
    const secondColor =
      generator.colors[(index + 2) % generator.colors.length] ?? "#059669";

    const tasks: Task[] = [
      {
        id: `generated-${padRow(rowNumber)}-a`,
        name: `${generator.taskPrefix} ${padRow(rowNumber)}A`,
        startDate: addToDate(baseDate, { days: firstStartOffset }),
        endDate: addToDate(baseDate, {
          days: firstStartOffset + generator.durationDays,
        }),
        color,
        percent: (index * 7) % 100,
      },
    ];

    if ((generator.tasksPerRow ?? 1) > 1) {
      const secondStartOffset =
        firstStartOffset + (generator.secondTaskGapDays ?? 14);
      tasks.push({
        id: `generated-${padRow(rowNumber)}-b`,
        name: `${generator.taskPrefix} ${padRow(rowNumber)}B`,
        startDate: addToDate(baseDate, { days: secondStartOffset }),
        endDate: addToDate(baseDate, {
          days: secondStartOffset + (generator.secondTaskDurationDays ?? 21),
        }),
        color: secondColor,
        percent: (index * 11) % 100,
      });
    }

    return {
      id: `generated-row-${padRow(rowNumber)}`,
      name: `${generator.groupPrefix} ${padRow(rowNumber)}`,
      description: generator.groupDescription,
      tasks,
    };
  });
};

export const createDemoScenario = (
  fixture: GanttFixture,
  baseDate = new Date(),
): DemoScenario => {
  const generatedGroups =
    fixture.generators?.flatMap((generator) =>
      createGeneratedGroups(generator, baseDate),
    ) ?? [];

  return {
    fixture,
    tasks: [
      ...fixture.groups.map((group) => normalizeGroup(group, baseDate)),
      ...generatedGroups,
    ],
    startDate: resolveFixtureDate(fixture.timeline?.startDate, baseDate),
    endDate: resolveFixtureDate(fixture.timeline?.endDate, baseDate),
  };
};

export const updateScenarioTask = (
  groups: TaskGroup[],
  groupId: string,
  updatedTask: Task,
): TaskGroup[] =>
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          tasks: group.tasks.map((task) =>
            task.id === updatedTask.id ? updatedTask : task,
          ),
        }
      : group,
  );

const getDuration = (task: Task): number =>
  task.endDate.getTime() - task.startDate.getTime();

const shiftTask = (task: Task, deltaMs: number): Task => ({
  ...task,
  startDate: new Date(task.startDate.getTime() + deltaMs),
  endDate: new Date(task.endDate.getTime() + deltaMs),
});

const isMoveUpdate = (originalTask: Task, updatedTask: Task): boolean => {
  const startDelta =
    updatedTask.startDate.getTime() - originalTask.startDate.getTime();
  const endDelta =
    updatedTask.endDate.getTime() - originalTask.endDate.getTime();

  return (
    startDelta !== 0 &&
    startDelta === endDelta &&
    getDuration(originalTask) === getDuration(updatedTask)
  );
};

export const updateLinkedPeriodTask = (
  groups: TaskGroup[],
  groupId: string,
  updatedTask: Task,
  options: { preserveDurations?: boolean } = {},
): TaskGroup[] => {
  const originalGroup = groups.find((group) => group.id === groupId);
  const originalTask = originalGroup?.tasks.find(
    (task) => task.id === updatedTask.id,
  );
  const cropId = updatedTask.cropId;
  const periodType = updatedTask.periodType;

  if (!originalGroup || !originalTask || typeof cropId !== "string") {
    return updateScenarioTask(groups, groupId, updatedTask);
  }

  const moved =
    options.preserveDurations || isMoveUpdate(originalTask, updatedTask);
  const moveDeltaMs =
    updatedTask.startDate.getTime() - originalTask.startDate.getTime();
  const normalizedUpdatedTask = options.preserveDurations
    ? {
        ...updatedTask,
        endDate: new Date(
          updatedTask.startDate.getTime() + getDuration(originalTask),
        ),
      }
    : updatedTask;

  return groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          tasks: group.tasks.map((task) => {
            if (task.id === updatedTask.id) {
              return normalizedUpdatedTask;
            }

            if (task.cropId !== cropId) {
              return task;
            }

            if (moved) {
              return shiftTask(task, moveDeltaMs);
            }

            if (periodType === "growth" && task.periodType === "harvest") {
              return {
                ...task,
                startDate: new Date(updatedTask.endDate),
              };
            }

            if (periodType === "harvest" && task.periodType === "growth") {
              return {
                ...task,
                endDate: new Date(updatedTask.startDate),
              };
            }

            return task;
          }),
        }
      : group,
  );
};
