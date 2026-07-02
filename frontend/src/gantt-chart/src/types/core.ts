export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  percent?: number;
  dependencies?: string[];
  [key: string]: any;
}

export interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  /**
   * Optional structured hierarchy metadata for rendering resource trees,
   * e.g. Location -> Field -> Bed.
   */
  hierarchyPath?: string[];
  locationName?: string;
  fieldName?: string;
  bedName?: string;
  icon?: string;
  tasks: Task[];
  [key: string]: any;
}

export interface GanttStyles {
  container?: string;
  title?: string;
  header?: string;
  taskList?: string;
  timeline?: string;
  todayMarker?: string;
  taskRow?: string;
  taskItem?: string;
  tooltip?: string;
}
