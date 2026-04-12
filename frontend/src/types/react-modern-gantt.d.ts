declare module 'react-modern-gantt' {
  import type { ComponentType, ReactNode } from 'react';

  export enum ViewMode {
    MINUTE = 'minute',
    HOUR = 'hour',
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month',
    QUARTER = 'quarter',
    YEAR = 'year',
  }

  export interface GanttTaskLike {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    color?: string;
    percent?: number;
    dependencies?: string[];
  }

  export interface GanttTaskGroupLike {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    hierarchyPath?: string[];
    locationName?: string;
    fieldName?: string;
    bedName?: string;
    tasks: GanttTaskLike[];
  }

  export interface GanttTooltipProps {
    task: GanttTaskLike;
  }

  export interface GanttTaskRenderProps {
    task: GanttTaskLike;
    leftPx: number;
    widthPx: number;
    topPx: number;
    isHovered?: boolean;
    isDragging?: boolean;
    editMode?: boolean;
    showProgress?: boolean;
  }

  export interface GanttLocaleText {
    title?: string;
    resources?: string;
    today?: string;
    viewModes?: Partial<Record<ViewMode, string>>;
  }

  export interface GanttChartProps {
    tasks?: GanttTaskGroupLike[];
    locale?: string;
    localeText?: GanttLocaleText;
    viewMode?: ViewMode;
    startDate?: Date;
    endDate?: Date;
    editMode?: boolean;
    allowTaskResize?: boolean;
    allowTaskMove?: boolean;
    showProgress?: boolean;
    darkMode?: boolean;
    onTaskUpdate?: (groupId: string, task: GanttTaskLike) => void | Promise<void>;
    renderTaskList?: (props: {
      tasks: GanttTaskGroupLike[];
      headerLabel?: string;
      onGroupClick?: (group: GanttTaskGroupLike) => void;
      viewMode: ViewMode;
    }) => ReactNode;
    renderTooltip?: (props: GanttTooltipProps) => ReactNode;
    renderTask?: (props: GanttTaskRenderProps) => ReactNode;
  }

  const GanttChart: ComponentType<GanttChartProps>;

  export function detectTaskOverlaps(tasks: GanttTaskLike[], viewMode?: ViewMode): GanttTaskLike[][];

  export default GanttChart;
}

declare module 'react-modern-gantt/dist/index.css';