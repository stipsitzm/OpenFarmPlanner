import type { GanttChartProps, TaskGroup, ViewMode } from "react-modern-gantt";

export type FixtureDate =
  | string
  | {
      offsetDays?: number;
      offsetHours?: number;
      offsetMinutes?: number;
    };

export interface FixtureTask {
  id: string;
  name: string;
  startDate: FixtureDate;
  endDate: FixtureDate;
  color?: string;
  percent?: number;
  dependencies?: string[];
  [key: string]: unknown;
}

export interface FixtureTaskGroup {
  id: string;
  name: string;
  description?: string;
  hierarchyPath?: string[];
  locationName?: string;
  fieldName?: string;
  bedName?: string;
  tasks: FixtureTask[];
  [key: string]: unknown;
}

export interface FixtureGenerator {
  kind: "resourceRows";
  count: number;
  groupPrefix: string;
  groupDescription?: string;
  taskPrefix: string;
  tasksPerRow?: number;
  startOffsetDays: number;
  rowSpacingDays: number;
  durationDays: number;
  secondTaskGapDays?: number;
  secondTaskDurationDays?: number;
  colors: string[];
}

export interface GanttFixture {
  id: string;
  name: string;
  description: string;
  viewMode: ViewMode;
  viewModes: ViewMode[];
  timeline?: {
    startDate?: FixtureDate;
    endDate?: FixtureDate;
  };
  chart?: Pick<
    GanttChartProps,
    | "title"
    | "headerLabel"
    | "showProgress"
    | "showCurrentDateMarker"
    | "editMode"
    | "allowTaskMove"
    | "allowTaskResize"
    | "allowProgressEdit"
    | "rowHeight"
    | "leftColumnWidth"
    | "maxHeight"
    | "minuteStep"
  >;
  groups: FixtureTaskGroup[];
  generators?: FixtureGenerator[];
}

export interface DemoScenario {
  fixture: GanttFixture;
  tasks: TaskGroup[];
  startDate?: Date;
  endDate?: Date;
}
