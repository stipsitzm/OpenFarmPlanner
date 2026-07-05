/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TuneIcon from '@mui/icons-material/Tune';
import { useTranslation } from '../i18n';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  shouldOpenCustomContextMenu,
  suppressNativeContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
} from '../utils/contextMenu';
import {
  bedAPI,
  cultureAPI,
  fieldAPI,
  locationAPI,
  plantingPlanAPI,
  type Bed,
  type Culture,
  type Field,
  type Location,
  type PlantingPlan,
} from '../api/api';
import GanttChart, { ViewMode } from '../gantt-chart/src';
import { CollisionService } from '../gantt-chart/src/services/CollisionService';
import { estimateTaskGroupLabelHeight } from '../gantt-chart/src/utils';
import './GanttChart.css';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import type { CommandSpec } from '../commands/types';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import { extractApiErrorMessage } from '../api/errors';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import { useTopbarTitleActions } from '../hooks/useTopbarTitleActions';
import EmptyStateCard from '../components/project/EmptyStateCard';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { AuthContext } from '../auth/authContextShared';
import {
  buildFieldOccupancyHierarchy,
  buildOccupancyTooltipDetails,
  buildSeedlingTaskGroups,
  buildSeedlingTooltipDetails,
  formatCultureDisplayLabel,
  formatGanttDate,
  formatSeedlingTooltipTitle,
  formatPlantCount,
  parseDateString,
  type GanttTask,
  type GanttTaskGroup,
  type OccupancyHierarchyNode,
} from './ganttChartUtils';
import { getFirstMissingCultivationPlanRequirement, getProjectSetupActions } from './requirementFlow';
import {
  getSegmentedActionButtonSx,
  segmentedButtonGroupSx,
} from '../components/buttons/segmentedControlStyles';
import { getGanttRenderWindow } from './ganttRenderWindow';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { collectVisibleIdsWithAncestors, flattenTreeRows } from '../components/hierarchy/utils/treeRows';

type CalendarMode = 'occupancy' | 'seedlings';
const GanttChartWithFocusMode = GanttChart as React.ComponentType<
  React.ComponentProps<typeof GanttChart> & { focusMode?: boolean }
>;

const CALENDAR_VIEW_STORAGE_KEY = 'openFarmPlanner.ganttChart.view';
const CALENDAR_TIMELINE_VIEW_MODE_STORAGE_KEY = 'openFarmPlanner.ganttChart.timelineViewMode';
const GANTT_STATE_STORAGE_PREFIX = 'openfarmplanner:gantt';
const DEFAULT_TIMELINE_VIEW_MODE = ViewMode.MONTH;
const GANTT_LEFT_COLUMN_WIDTH = 220;
const GANTT_ROW_HEIGHT = 32;
const GANTT_VIEWPORT_MAX_HEIGHT_SX = { xs: '70svh', sm: '72svh', lg: '76svh' } as const;
// Above this many combined location+field+bed nodes, default to
// locations-expanded/fields-collapsed instead of fully expanding the tree.
const OCCUPANCY_TREE_AUTO_EXPAND_ALL_THRESHOLD = 30;
// Compact row height for Standort/Parzelle rows, which show a meta-text
// summary (as a title tooltip, not a second visible line — see
// TaskList.tsx) instead of bars. Beet rows keep the normal, task-count-
// based height computed by the Gantt library itself. Must be tall enough
// to fit the sidebar's single content line (chevron + name, ~17px) plus
// its ~8px vertical padding without TaskList's minHeight being exceeded
// by actual content — otherwise the sidebar row silently renders taller
// than TaskRow's timeline row and the two columns drift out of sync row
// by row.
const OCCUPANCY_COMPACT_ROW_HEIGHT = 32;
const GANTT_HEADER_VIEW_MODES = [
  ViewMode.DAY,
  ViewMode.WEEK,
  ViewMode.MONTH,
  ViewMode.QUARTER,
  ViewMode.YEAR,
] as const;
const GANTT_UNIT_WIDTH_BY_VIEW_MODE: Record<ViewMode, number> = {
  [ViewMode.MINUTE]: 60,
  [ViewMode.HOUR]: 80,
  [ViewMode.DAY]: 50,
  [ViewMode.WEEK]: 80,
  [ViewMode.MONTH]: 150,
  [ViewMode.QUARTER]: 180,
  [ViewMode.YEAR]: 200,
};

function getCalendarGanttRowHeight(group: GanttTaskGroup, viewMode: ViewMode): number {
  if (group.rowHeightOverride !== undefined) {
    return group.rowHeightOverride;
  }

  const estimatedLabelHeight = estimateTaskGroupLabelHeight(group, GANTT_LEFT_COLUMN_WIDTH);
  const taskRows = CollisionService.detectOverlaps(group.tasks, viewMode);
  return Math.max(estimatedLabelHeight, taskRows.length * GANTT_ROW_HEIGHT + 12);
}

const CALENDAR_SHORTCUT_VIEW_MODES: Array<{ mode: ViewMode; shortcut: string; labelKey: string }> = [
  { mode: ViewMode.DAY, shortcut: '1', labelKey: 'dayView' },
  { mode: ViewMode.WEEK, shortcut: '2', labelKey: 'weekView' },
  { mode: ViewMode.MONTH, shortcut: '3', labelKey: 'monthView' },
  { mode: ViewMode.QUARTER, shortcut: '4', labelKey: 'quarterView' },
  { mode: ViewMode.YEAR, shortcut: '5', labelKey: 'yearView' },
];

interface StoredGanttState {
  calendarMode?: CalendarMode;
  timelineViewMode?: ViewMode;
  referenceDate?: string;
  rowScrollTop?: number;
}

function getCalendarModeFromViewParam(viewParam: string | null): CalendarMode {
  return viewParam === 'seedlings' ? 'seedlings' : 'occupancy';
}

function getViewParamFromCalendarMode(mode: CalendarMode): string {
  return mode === 'seedlings' ? 'seedlings' : 'field';
}

function isCalendarViewParam(value: string | null): value is 'field' | 'seedlings' {
  return value === 'field' || value === 'seedlings';
}

function getCalendarViewStorageKey(activeProjectId: number | null): string {
  return activeProjectId ? `${CALENDAR_VIEW_STORAGE_KEY}.${activeProjectId}` : CALENDAR_VIEW_STORAGE_KEY;
}

function getTimelineViewModeStorageKey(activeProjectId: number | null): string {
  return activeProjectId
    ? `${CALENDAR_TIMELINE_VIEW_MODE_STORAGE_KEY}.${activeProjectId}`
    : CALENDAR_TIMELINE_VIEW_MODE_STORAGE_KEY;
}

function getGanttStateStorageKey(activeProjectId: number | null): string | null {
  return activeProjectId ? `${GANTT_STATE_STORAGE_PREFIX}:${activeProjectId}:state` : null;
}

function getStoredCalendarMode(storageKey: string): CalendarMode | null {
  const storedValue = window.localStorage.getItem(storageKey);
  return isCalendarViewParam(storedValue) ? getCalendarModeFromViewParam(storedValue) : null;
}

function storeCalendarMode(storageKey: string, mode: CalendarMode): void {
  window.localStorage.setItem(storageKey, getViewParamFromCalendarMode(mode));
}

function isTimelineViewMode(value: string | null): value is ViewMode {
  return value !== null && (GANTT_HEADER_VIEW_MODES as readonly string[]).includes(value);
}

function storeTimelineViewMode(storageKey: string, mode: ViewMode): void {
  window.localStorage.setItem(storageKey, mode);
}

function getStoredGanttState(storageKey: string | null): StoredGanttState | null {
  if (!storageKey) {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return null;
    }
    const parsed = JSON.parse(storedValue) as StoredGanttState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      calendarMode: parsed.calendarMode === 'occupancy' || parsed.calendarMode === 'seedlings'
        ? parsed.calendarMode
        : undefined,
      timelineViewMode: isTimelineViewMode(parsed.timelineViewMode ?? null)
        ? parsed.timelineViewMode
        : undefined,
      referenceDate: typeof parsed.referenceDate === 'string' ? parsed.referenceDate : undefined,
      rowScrollTop: typeof parsed.rowScrollTop === 'number' && Number.isFinite(parsed.rowScrollTop)
        ? parsed.rowScrollTop
        : undefined,
    };
  } catch {
    return null;
  }
}

function storeGanttState(storageKey: string | null, nextState: StoredGanttState): void {
  if (!storageKey) {
    return;
  }

  const currentState = getStoredGanttState(storageKey) ?? {};
  window.localStorage.setItem(storageKey, JSON.stringify({
    ...currentState,
    ...nextState,
  }));
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function clampDate(date: Date, startDate: Date, endDate: Date): Date {
  if (date < startDate) {
    return new Date(startDate);
  }
  if (date > endDate) {
    return new Date(endDate);
  }
  return date;
}

function getStoredReferenceDate(state: StoredGanttState | null, startDate: Date, endDate: Date): Date | null {
  if (!state?.referenceDate) {
    return null;
  }

  const date = parseDateString(state.referenceDate);
  if (!isValidDate(date) || date < startDate || date > endDate) {
    return null;
  }
  return date;
}

function getStoredTimelineViewModeFromState(state: StoredGanttState | null): ViewMode | null {
  return state?.referenceDate && state.timelineViewMode ? state.timelineViewMode : null;
}

function getInitialTimelineReferenceDate(state: StoredGanttState | null, startDate: Date, endDate: Date): Date {
  return getStoredReferenceDate(state, startDate, endDate) ?? clampDate(new Date(), startDate, endDate);
}

function getGanttUnitWidth(viewMode: ViewMode): number {
  return GANTT_UNIT_WIDTH_BY_VIEW_MODE[viewMode] ?? GANTT_UNIT_WIDTH_BY_VIEW_MODE[ViewMode.MONTH];
}

function getDatePosition(date: Date, viewMode: ViewMode, startDate: Date): number {
  const unitWidth = getGanttUnitWidth(viewMode);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  switch (viewMode) {
    case ViewMode.DAY: {
      const days = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return days * unitWidth + unitWidth / 2;
    }
    case ViewMode.WEEK: {
      const days = Math.max(0, (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return (days / 7) * unitWidth;
    }
    case ViewMode.MONTH:
      return ((date.getMonth() - start.getMonth()) + ((date.getDate() - 1) / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())) * unitWidth;
    case ViewMode.QUARTER: {
      const quarterIndex = Math.floor(date.getMonth() / 3) - Math.floor(start.getMonth() / 3);
      const monthInQuarter = date.getMonth() % 3;
      return (quarterIndex + monthInQuarter / 3) * unitWidth;
    }
    case ViewMode.YEAR:
      return ((date.getFullYear() - start.getFullYear()) + date.getMonth() / 12) * unitWidth;
    default:
      return 0;
  }
}

function getReferenceDateFromScroll(scrollLeft: number, containerWidth: number, viewMode: ViewMode, startDate: Date, endDate: Date): Date {
  const unitWidth = getGanttUnitWidth(viewMode);
  const timelineViewportWidth = Math.max(0, containerWidth - GANTT_LEFT_COLUMN_WIDTH);
  const centerPosition = Math.max(0, scrollLeft + timelineViewportWidth / 2);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const nextDate = new Date(start);

  switch (viewMode) {
    case ViewMode.DAY:
      nextDate.setDate(start.getDate() + Math.floor(centerPosition / unitWidth));
      break;
    case ViewMode.WEEK:
      nextDate.setDate(start.getDate() + Math.floor((centerPosition / unitWidth) * 7));
      break;
    case ViewMode.MONTH:
      nextDate.setMonth(start.getMonth() + Math.floor(centerPosition / unitWidth), 1);
      break;
    case ViewMode.QUARTER:
      nextDate.setMonth(start.getMonth() + Math.floor(centerPosition / unitWidth) * 3, 1);
      break;
    case ViewMode.YEAR:
      nextDate.setFullYear(start.getFullYear() + Math.floor(centerPosition / unitWidth), 0, 1);
      break;
    default:
      break;
  }

  return clampDate(nextDate, startDate, endDate);
}

function getTimelineScrollLeftForDate(date: Date, viewMode: ViewMode, startDate: Date, container: HTMLElement): number {
  const position = getDatePosition(date, viewMode, startDate);
  const timelineViewportWidth = Math.max(0, container.clientWidth - GANTT_LEFT_COLUMN_WIDTH);
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  return Math.max(0, Math.min(maxScroll, position - timelineViewportWidth / 2));
}

function addTimelinePeriod(date: Date, viewMode: ViewMode, direction: -1 | 1): Date {
  const nextDate = new Date(date);

  switch (viewMode) {
    case ViewMode.DAY:
      nextDate.setDate(nextDate.getDate() + direction);
      break;
    case ViewMode.WEEK:
      nextDate.setDate(nextDate.getDate() + direction * 7);
      break;
    case ViewMode.MONTH:
      nextDate.setMonth(nextDate.getMonth() + direction);
      break;
    case ViewMode.QUARTER:
      nextDate.setMonth(nextDate.getMonth() + direction * 3);
      break;
    case ViewMode.YEAR:
      nextDate.setFullYear(nextDate.getFullYear() + direction);
      break;
    default:
      break;
  }

  return nextDate;
}

function addTimelinePeriodLarge(date: Date, viewMode: ViewMode, direction: -1 | 1): Date {
  const nextDate = new Date(date);

  switch (viewMode) {
    case ViewMode.DAY:
      nextDate.setDate(nextDate.getDate() + direction * 7);
      break;
    case ViewMode.WEEK:
      nextDate.setMonth(nextDate.getMonth() + direction);
      break;
    case ViewMode.MONTH:
      nextDate.setFullYear(nextDate.getFullYear() + direction);
      break;
    case ViewMode.QUARTER:
      nextDate.setFullYear(nextDate.getFullYear() + direction);
      break;
    case ViewMode.YEAR:
      nextDate.setFullYear(nextDate.getFullYear() + direction * 5);
      break;
    default:
      break;
  }

  return nextDate;
}

class GanttRenderBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Gantt render failed', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function formatDateToAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPrimaryTouch(event: TouchEvent): Touch | null {
  return event.touches[0] ?? event.changedTouches[0] ?? null;
}

interface SyntheticMousePoint {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

function toSyntheticMousePoint(touch: Touch): SyntheticMousePoint {
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    screenX: touch.screenX,
    screenY: touch.screenY,
  };
}

function dispatchSyntheticMouseEvent(
  target: EventTarget,
  type: 'mousedown' | 'mousemove' | 'mouseup',
  point: SyntheticMousePoint,
): void {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: point.screenX,
    screenY: point.screenY,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
  }));
}



function GanttChartPage() {
  const { t, i18n } = useTranslation(['ganttChart', 'common']);
  const theme = useTheme();
  const useMobileFilterLayout = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authContext = useContext(AuthContext);
  const activeProjectId = authContext?.activeProjectId ?? null;
  const isAuthLoading = authContext?.isLoading ?? false;
  const canUseStoredCalendarView = Boolean(authContext);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  useCommandContextTag('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);

  // Standort/Parzelle/Beet tree: filter + search state for the occupancy view
  const [occupancySearchText, setOccupancySearchText] = useState('');
  const [occupancyLocationFilter, setOccupancyLocationFilter] = useState<number | 'all'>('all');
  const [occupancyFieldFilter, setOccupancyFieldFilter] = useState<number | 'all'>('all');
  const [onlyOccupiedBeds, setOnlyOccupiedBeds] = useState(true);

  // Seedling (Anzucht) view: search-only, no hierarchy/location filters —
  // it's a flat, culture-grouped list, not tied to a specific bed/field.
  const [seedlingSearchText, setSeedlingSearchText] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [calendarFilterAnchorEl, setCalendarFilterAnchorEl] = useState<HTMLElement | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => {
    if (useMobileFilterLayout) {
      setMobileSearchOpen(true);
    }
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [useMobileFilterLayout]);
  useEffect(() => {
    if (!mobileSearchOpen) {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileSearchOpen]);

  const occupancyTreeStorageKey = activeProjectId
    ? `occupancyTree.${activeProjectId}`
    : 'occupancyTree';
  const {
    expandedRows: expandedHierarchyIds,
    hasPersistedState: hasPersistedHierarchyExpansion,
    toggleExpand: toggleHierarchyExpand,
    expandAll: expandAllHierarchy,
  } = useExpandedState(occupancyTreeStorageKey);
  const hasInitiallyExpandedHierarchyRef = useRef(false);

  const [ganttRenderKey, setGanttRenderKey] = useState(0);
  const [ganttScrollTop, setGanttScrollTop] = useState(0);
  const [ganttViewportHeight, setGanttViewportHeight] = useState(640);
  const ganttViewportRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredTimelineRef = useRef(false);
  const latestReferenceDateRef = useRef<Date | null>(null);
  const currentYear = new Date().getFullYear();
  const [displayYear] = useState(currentYear);
  const startDate = useMemo(() => new Date(displayYear, 0, 1), [displayYear]);
  const endDate = useMemo(() => new Date(displayYear, 11, 31), [displayYear]);

  const ganttStateStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getGanttStateStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const storedGanttState = useMemo(
    () => getStoredGanttState(ganttStateStorageKey),
    [ganttStateStorageKey],
  );
  const calendarViewStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getCalendarViewStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const timelineViewModeStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getTimelineViewModeStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    const viewParam = searchParams.get('view');
    return isCalendarViewParam(viewParam)
      ? getCalendarModeFromViewParam(viewParam)
      : storedGanttState?.calendarMode
        ? storedGanttState.calendarMode
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';
  });
  const [timelineViewMode, setTimelineViewMode] = useState<ViewMode>(() => (
    getStoredTimelineViewModeFromState(storedGanttState) ?? DEFAULT_TIMELINE_VIEW_MODE
  ));
  const [editMode, setEditMode] = useState(false);
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const setTopbarTitleActions = outletContext?.setTopbarTitleActions;

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (!isCalendarViewParam(viewParam) && isAuthLoading) {
      return;
    }

    const nextMode = isCalendarViewParam(viewParam)
      ? getCalendarModeFromViewParam(viewParam)
      : storedGanttState?.calendarMode
        ? storedGanttState.calendarMode
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';

    setCalendarMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));

    if (isCalendarViewParam(viewParam)) {
      if (calendarViewStorageKey) {
        storeCalendarMode(calendarViewStorageKey, nextMode);
      }
      storeGanttState(ganttStateStorageKey, { calendarMode: nextMode });
      return;
    }

    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    }, { replace: true });
  }, [calendarViewStorageKey, ganttStateStorageKey, isAuthLoading, searchParams, setSearchParams, storedGanttState?.calendarMode]);

  useEffect(() => {
    if (!timelineViewModeStorageKey || isAuthLoading) {
      return;
    }

    const nextViewMode = getStoredTimelineViewModeFromState(storedGanttState) ?? DEFAULT_TIMELINE_VIEW_MODE;
    setTimelineViewMode((currentViewMode) => (currentViewMode === nextViewMode ? currentViewMode : nextViewMode));
  }, [isAuthLoading, storedGanttState, timelineViewModeStorageKey]);

  const handleCalendarModeChange = useCallback((nextMode: CalendarMode) => {
    setCalendarMode(nextMode);
    if (calendarViewStorageKey) {
      storeCalendarMode(calendarViewStorageKey, nextMode);
    }
    storeGanttState(ganttStateStorageKey, { calendarMode: nextMode });
    setSearchParams((currentSearchParams) => {
      if (currentSearchParams.get('view') === getViewParamFromCalendarMode(nextMode)) {
        return currentSearchParams;
      }
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    });
  }, [calendarViewStorageKey, ganttStateStorageKey, setSearchParams]);

  const handleTimelineViewModeChange = useCallback((
    nextViewMode: ViewMode,
    applyViewModeChange: (mode: ViewMode) => void,
  ) => {
    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    const currentReferenceDate = scrollContainer
      ? getReferenceDateFromScroll(scrollContainer.scrollLeft, scrollContainer.clientWidth, timelineViewMode, startDate, endDate)
      : latestReferenceDateRef.current;
    setTimelineViewMode(nextViewMode);
    if (timelineViewModeStorageKey) {
      storeTimelineViewMode(timelineViewModeStorageKey, nextViewMode);
    }
    storeGanttState(ganttStateStorageKey, {
      timelineViewMode: nextViewMode,
      referenceDate: formatDateToAPI(currentReferenceDate ?? getInitialTimelineReferenceDate(storedGanttState, startDate, endDate)),
    });
    hasRestoredTimelineRef.current = false;
    applyViewModeChange(nextViewMode);
  }, [endDate, ganttStateStorageKey, startDate, storedGanttState, timelineViewMode, timelineViewModeStorageKey]);

  const getCurrentTimelineReferenceDate = useCallback((): Date => {
    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (scrollContainer) {
      return getReferenceDateFromScroll(
        scrollContainer.scrollLeft,
        scrollContainer.clientWidth,
        timelineViewMode,
        startDate,
        endDate,
      );
    }

    return latestReferenceDateRef.current
      ?? getInitialTimelineReferenceDate(getStoredGanttState(ganttStateStorageKey), startDate, endDate);
  }, [endDate, ganttStateStorageKey, startDate, timelineViewMode]);

  const scrollToTimelineReferenceDate = useCallback((date: Date): void => {
    const referenceDate = clampDate(date, startDate, endDate);
    latestReferenceDateRef.current = referenceDate;
    storeGanttState(ganttStateStorageKey, {
      calendarMode,
      timelineViewMode,
      referenceDate: formatDateToAPI(referenceDate),
    });

    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollLeft = getTimelineScrollLeftForDate(referenceDate, timelineViewMode, startDate, scrollContainer);
  }, [calendarMode, endDate, ganttStateStorageKey, startDate, timelineViewMode]);

  const handleShortcutTimelineViewModeChange = useCallback((nextViewMode: ViewMode): void => {
    const referenceDate = getCurrentTimelineReferenceDate();
    setTimelineViewMode(nextViewMode);
    if (timelineViewModeStorageKey) {
      storeTimelineViewMode(timelineViewModeStorageKey, nextViewMode);
    }
    storeGanttState(ganttStateStorageKey, {
      timelineViewMode: nextViewMode,
      referenceDate: formatDateToAPI(referenceDate),
    });
    latestReferenceDateRef.current = referenceDate;
    hasRestoredTimelineRef.current = false;
  }, [ganttStateStorageKey, getCurrentTimelineReferenceDate, timelineViewModeStorageKey]);

  const toggleCalendarEditMode = useCallback((): void => {
    if (calendarMode !== 'occupancy') {
      return;
    }
    setEditMode((value) => !value);
  }, [calendarMode]);

  const fetchCalendarData = useCallback(async (options: { showLoading?: boolean } = {}): Promise<void> => {
    const { showLoading = true } = options;
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const [locationsRes, fieldsRes, bedsRes, plansRes, culturesRes] = await Promise.all([
        locationAPI.listAll(),
        fieldAPI.listAll(),
        bedAPI.listAll(),
        plantingPlanAPI.listAll(),
        cultureAPI.listAll(),
      ]);

      setLocations(locationsRes.results);
      setFields(fieldsRes.results);
      setBeds(bedsRes.results);
      setPlantingPlans(plansRes.results);
      setCultures(culturesRes.results);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('ganttChart:errors.load'));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setLoading(false);
      setError(null);
      setLocations([]);
      setFields([]);
      setBeds([]);
      setPlantingPlans([]);
      setCultures([]);
      return;
    }

    void fetchCalendarData();
  }, [displayYear, fetchCalendarData, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return undefined;
    }

    const refreshVisibleCalendar = (): void => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      void fetchCalendarData({ showLoading: false });
    };

    window.addEventListener('focus', refreshVisibleCalendar);
    document.addEventListener('visibilitychange', refreshVisibleCalendar);

    return () => {
      window.removeEventListener('focus', refreshVisibleCalendar);
      document.removeEventListener('visibilitychange', refreshVisibleCalendar);
    };
  }, [fetchCalendarData, shouldShowProjectRequiredState]);

  const refreshPlantingPlans = useCallback(async (): Promise<void> => {
    const plans = await plantingPlanAPI.listAll();
    setPlantingPlans(plans.results);
  }, []);

  const handleTaskUpdate = async (_groupId: string, updatedTask: GanttTask) => {
    try {
      const planIdMatch = updatedTask.id.match(/^plan-(\d+)-/);
      if (!planIdMatch) {
        console.error('Could not extract plan ID from task:', updatedTask.id);
        return;
      }

      const planId = parseInt(planIdMatch[1], 10);
      const plan = plantingPlans.find((entry) => entry.id === planId);
      if (!plan) {
        console.error('Could not find planting plan:', planId);
        return;
      }

      let newPlantingDate: string;
      const isGrowthTask = updatedTask.id.endsWith('-growth');

      if (isGrowthTask) {
        newPlantingDate = formatDateToAPI(updatedTask.startDate);
      } else {
        const originalPlantingDate = parseDateString(plan.planting_date);
        const originalHarvestDate = parseDateString(plan.harvest_date!);
        const daysDifference = Math.round(
          (originalHarvestDate.getTime() - originalPlantingDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        const newPlantingDateObj = new Date(updatedTask.startDate);
        newPlantingDateObj.setDate(newPlantingDateObj.getDate() - daysDifference);
        newPlantingDate = formatDateToAPI(newPlantingDateObj);
      }

      const updatedPlan: Partial<PlantingPlan> = {
        ...plan,
        planting_date: newPlantingDate,
      };

      // Apply the new date optimistically before awaiting the API response.
      // TaskRow clears its local drag/preview state as soon as the mouse is
      // released, so without this the bar would immediately re-render from
      // the still-stale `plantingPlans` prop (briefly snapping back to its
      // pre-drag position) until the request resolves and moving again.
      setPlantingPlans((previous) => previous.map((entry) => (
        entry.id === planId ? { ...entry, ...updatedPlan } as PlantingPlan : entry
      )));

      const response = await plantingPlanAPI.update(planId, updatedPlan as PlantingPlan);
      setPlantingPlans((previous) => previous.map((entry) => (
        entry.id === planId ? response.data : entry
      )));
      setError(null);
    } catch (err) {
      console.error('Error updating planting plan:', err);
      setError(extractApiErrorMessage(err, t, t('ganttChart:errors.updatePlan')));
      try {
        await refreshPlantingPlans();
      } catch (refreshError) {
        console.error('Error reloading planting plans after failed update:', refreshError);
      }
      setGanttRenderKey((value) => value + 1);
    }
  };

  // ---------------------------------------------------------------------
  // Context navigation: right-click (desktop) / long-press (mobile) on a
  // bar or a Standort/Parzelle/Beet row opens a menu with "open X" links
  // into the relevant page plus edit/copy/delete. Double-click on a bar
  // is a shortcut for its "Anbauplan öffnen" action.
  // ---------------------------------------------------------------------
  type GanttContextMenuTarget =
    | { type: 'task'; task: GanttTask; group: GanttTaskGroup }
    | { type: 'group'; group: GanttTaskGroup };
  interface GanttContextMenuAction {
    id: string;
    label: string;
    group: 'navigate' | 'edit' | 'danger';
    onClick: () => void;
  }

  const [contextMenuState, setContextMenuState] = useState<{
    target: GanttContextMenuTarget;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  const openContextMenu = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    target: GanttContextMenuTarget,
  ) => {
    if (!shouldOpenCustomContextMenu(event.target)) return;
    suppressNativeContextMenu(event);
    const point = 'changedTouches' in event
      ? event.changedTouches[0] ?? event.touches[0]
      : event;
    if (!point) return;
    setContextMenuState({
      target,
      mouseX: point.clientX + 2,
      mouseY: point.clientY - 6,
    });
  }, []);

  const handleTaskContextMenu = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    task: GanttTask,
    group: GanttTaskGroup,
  ) => {
    openContextMenu(event, { type: 'task', task, group });
  }, [openContextMenu]);

  const handleGroupContextMenu = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    group: GanttTaskGroup,
  ) => {
    openContextMenu(event, { type: 'group', group });
  }, [openContextMenu]);

  const isGanttContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    shouldOpenCustomContextMenu(target)
    && target instanceof HTMLElement
    && target.closest('[data-rmg-component="task"], [data-rmg-component="task-group"]') !== null
  ), []);

  useCloseCustomContextMenuOnNativeContextMenu(
    contextMenuState !== null,
    closeContextMenu,
    isGanttContextMenuTarget,
    (event) => setContextMenuState((current) => (
      current ? { ...current, mouseX: event.clientX + 2, mouseY: event.clientY - 6 } : current
    )),
  );

  const openPlantingPlanFromTask = useCallback((task: GanttTask, options?: { edit?: boolean }) => {
    if (task.plantingPlanId) {
      const query = options?.edit ? `planId=${task.plantingPlanId}&edit=true` : `planId=${task.plantingPlanId}`;
      navigate(`/app/planting-plans?${query}`);
      return;
    }
    navigate('/app/planting-plans');
  }, [navigate]);

  // Stable (task, group) => void wrapper so it can be passed directly as a
  // GanttChartProps callback without a fresh inline arrow on every render.
  const handleTaskDoubleClickToPlan = useCallback((task: GanttTask) => {
    openPlantingPlanFromTask(task);
  }, [openPlantingPlanFromTask]);

  const openCultureFromTask = useCallback((task: GanttTask) => {
    const plan = plantingPlans.find((entry) => entry.id === task.plantingPlanId);
    if (plan?.culture) {
      navigate(`/app/cultures?cultureId=${plan.culture}`);
    }
  }, [navigate, plantingPlans]);

  const addPlantingPlanForBed = useCallback((group: GanttTaskGroup) => {
    if (group.bedId) {
      navigate(`/app/planting-plans?bedId=${group.bedId}&create=true`);
    }
  }, [navigate]);

  // Navigates to the areas (Anbauflächen) page and, if a target is given,
  // deep-links to the matching Standort/Parzelle/Beet row: FieldsBedsHierarchy
  // expands its ancestors, scrolls it into view, and briefly flashes it.
  const openAreasPage = useCallback((highlight?: { type: 'location' | 'field' | 'bed'; id: number }) => {
    navigate(highlight ? `/app/fields-beds?highlight=${highlight.type}:${highlight.id}` : '/app/fields-beds');
  }, [navigate]);

  const copyTaskSummary = useCallback((task: GanttTask, group: GanttTaskGroup) => {
    const parts = [
      task.cultureName ? formatCultureDisplayLabel(task.cultureName, task.cultureVariety) : task.name,
      group.name,
      `${formatGanttDate(task.startDate)} – ${formatGanttDate(task.endDate)}`,
    ].filter(Boolean);
    void navigator.clipboard?.writeText(parts.join(' · ')).catch(() => undefined);
  }, []);

  const deletePlantingPlanFromTask = useCallback(async (task: GanttTask) => {
    if (!task.plantingPlanId) return;
    const confirmed = window.confirm(t('ganttChart:contextMenu.confirmDeletePlan'));
    if (!confirmed) return;
    try {
      await plantingPlanAPI.delete(task.plantingPlanId);
      setPlantingPlans((previous) => previous.filter((entry) => entry.id !== task.plantingPlanId));
    } catch (err) {
      setError(extractApiErrorMessage(err, t, t('ganttChart:errors.updatePlan')));
    }
  }, [t]);

  const getContextMenuActions = useCallback((target: GanttContextMenuTarget): GanttContextMenuAction[] => {
    if (target.type === 'task') {
      const { task, group } = target;
      const actions: GanttContextMenuAction[] = [
        { id: 'open-plan', label: t('ganttChart:contextMenu.openPlan'), group: 'navigate', onClick: () => openPlantingPlanFromTask(task) },
      ];
      if (task.cultureName) {
        actions.push({ id: 'open-culture', label: t('ganttChart:contextMenu.openCulture'), group: 'navigate', onClick: () => openCultureFromTask(task) });
      }
      if (group.bedId) {
        const bedId = group.bedId;
        actions.push({ id: 'open-bed', label: t('ganttChart:contextMenu.openBed'), group: 'navigate', onClick: () => openAreasPage({ type: 'bed', id: bedId }) });
      }
      if (group.fieldId) {
        const fieldId = group.fieldId;
        actions.push({ id: 'open-field', label: t('ganttChart:contextMenu.openField'), group: 'navigate', onClick: () => openAreasPage({ type: 'field', id: fieldId }) });
      }
      if (group.locationId) {
        const locationId = group.locationId;
        actions.push({ id: 'open-location', label: t('ganttChart:contextMenu.openLocation'), group: 'navigate', onClick: () => openAreasPage({ type: 'location', id: locationId }) });
      }
      actions.push(
        { id: 'edit', label: t('common:actions.edit'), group: 'edit', onClick: () => openPlantingPlanFromTask(task, { edit: true }) },
        { id: 'copy', label: t('common:actions.copyRow'), group: 'edit', onClick: () => copyTaskSummary(task, group) },
        { id: 'delete', label: t('common:actions.delete'), group: 'danger', onClick: () => { void deletePlantingPlanFromTask(task); } },
      );
      return actions;
    }

    const { group } = target;
    if (group.bedId) {
      const bedId = group.bedId;
      return [
        { id: 'open-bed', label: t('ganttChart:contextMenu.openBed'), group: 'navigate', onClick: () => openAreasPage({ type: 'bed', id: bedId }) },
        { id: 'edit-bed', label: t('ganttChart:contextMenu.editBed'), group: 'edit', onClick: () => openAreasPage({ type: 'bed', id: bedId }) },
        { id: 'add-plan', label: t('ganttChart:contextMenu.addPlan'), group: 'edit', onClick: () => addPlantingPlanForBed(group) },
      ];
    }
    if (group.fieldId) {
      const fieldId = group.fieldId;
      return [
        { id: 'open-field', label: t('ganttChart:contextMenu.openField'), group: 'navigate', onClick: () => openAreasPage({ type: 'field', id: fieldId }) },
        { id: 'edit-field', label: t('ganttChart:contextMenu.editField'), group: 'edit', onClick: () => openAreasPage({ type: 'field', id: fieldId }) },
      ];
    }
    if (group.locationId) {
      const locationId = group.locationId;
      return [
        { id: 'open-location', label: t('ganttChart:contextMenu.openLocation'), group: 'navigate', onClick: () => openAreasPage({ type: 'location', id: locationId }) },
        { id: 'edit-location', label: t('ganttChart:contextMenu.editLocation'), group: 'edit', onClick: () => openAreasPage({ type: 'location', id: locationId }) },
      ];
    }
    return [];
  }, [addPlantingPlanForBed, copyTaskSummary, deletePlantingPlanFromTask, openAreasPage, openCultureFromTask, openPlantingPlanFromTask, t]);

  const contextMenuActions = contextMenuState ? getContextMenuActions(contextMenuState.target) : [];

  const occupancyHierarchyNodes = useMemo<OccupancyHierarchyNode[]>(() => buildFieldOccupancyHierarchy({
    locations,
    fields,
    beds,
    plantingPlans,
    cultures,
    displayYear,
  }), [beds, cultures, displayYear, fields, locations, plantingPlans]);

  // Default expansion — once per project, until the user manually
  // expands/collapses something (which then persists via useExpandedState's
  // sessionStorage backing). For small farms (few locations/fields/beds
  // combined), fully expanding is more useful than hiding everything behind
  // a chevron. Once the tree grows past a size where that would get
  // unwieldy, fall back to locations-open/fields-collapsed so the view
  // stays scannable.
  useEffect(() => {
    if (
      !hasPersistedHierarchyExpansion
      && !hasInitiallyExpandedHierarchyRef.current
      && occupancyHierarchyNodes.length > 0
    ) {
      const canFullyExpand = occupancyHierarchyNodes.length <= OCCUPANCY_TREE_AUTO_EXPAND_ALL_THRESHOLD;
      const idsToExpand = occupancyHierarchyNodes
        .filter((node) => node.type === 'location' || (canFullyExpand && node.type === 'field'))
        .map((node) => node.id);
      expandAllHierarchy(idsToExpand);
      hasInitiallyExpandedHierarchyRef.current = true;
    }
  }, [expandAllHierarchy, hasPersistedHierarchyExpansion, occupancyHierarchyNodes]);

  const occupancyFieldOptions = useMemo(
    () => (occupancyLocationFilter === 'all'
      ? []
      : occupancyHierarchyNodes.filter(
        (node) => node.type === 'field' && node.locationId === occupancyLocationFilter,
      )),
    [occupancyHierarchyNodes, occupancyLocationFilter],
  );
  const activeHierarchyFilterCount = [
    occupancyLocationFilter !== 'all',
    occupancyFieldFilter !== 'all',
    onlyOccupiedBeds,
  ].filter(Boolean).length;
  const activeSearchText = calendarMode === 'occupancy' ? occupancySearchText.trim() : seedlingSearchText.trim();
  const isCalendarFilterPopoverOpen = Boolean(calendarFilterAnchorEl);
  const resetOccupancyHierarchyFilters = useCallback(() => {
    setOccupancyLocationFilter('all');
    setOccupancyFieldFilter('all');
    setOnlyOccupiedBeds(false);
  }, []);
  const clearActiveSearch = useCallback(() => {
    if (calendarMode === 'occupancy') {
      setOccupancySearchText('');
    } else {
      setSeedlingSearchText('');
    }
    setMobileSearchOpen(false);
  }, [calendarMode]);

  const occupancyTaskGroups = useMemo<GanttTaskGroup[]>(() => {
    // Structural filter: "only occupied beds" removes empty beds (and any
    // now-childless field/location ancestors) from the tree entirely,
    // independent of expand/collapse state.
    const structurallyVisibleIds = onlyOccupiedBeds
      ? collectVisibleIdsWithAncestors(
        occupancyHierarchyNodes,
        new Set(
          occupancyHierarchyNodes
            .filter((node) => node.type === 'bed' && node.occupiedBedCount > 0)
            .map((node) => node.id),
        ),
      )
      : null;
    const prunedNodes = structurallyVisibleIds
      ? occupancyHierarchyNodes.filter((node) => structurallyVisibleIds.has(node.id))
      : occupancyHierarchyNodes;

    const fieldNameById = new Map<number, string>(
      prunedNodes
        .filter((node): node is OccupancyHierarchyNode & { fieldId: number } => node.type === 'field' && node.fieldId !== undefined)
        .map((node) => [node.fieldId, node.name]),
    );
    const locationNameById = new Map<number, string>(
      prunedNodes.filter((node) => node.type === 'location').map((node) => [node.locationId, node.name]),
    );

    const normalizedSearch = occupancySearchText.trim().toLowerCase();
    const isActivelyFiltering = Boolean(normalizedSearch)
      || occupancyLocationFilter !== 'all'
      || occupancyFieldFilter !== 'all';

    let visibleIds: Set<string | number> | null = null;
    if (isActivelyFiltering) {
      const matchedBedIds = new Set(
        prunedNodes
          .filter((node) => {
            if (node.type !== 'bed') {
              return false;
            }
            if (occupancyLocationFilter !== 'all' && node.locationId !== occupancyLocationFilter) {
              return false;
            }
            if (occupancyFieldFilter !== 'all' && node.fieldId !== occupancyFieldFilter) {
              return false;
            }
            if (!normalizedSearch) {
              return true;
            }
            const haystack = [
              node.name,
              node.fieldId !== undefined ? fieldNameById.get(node.fieldId) : undefined,
              locationNameById.get(node.locationId),
              ...node.tasks.map((task) => task.cultureName),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(normalizedSearch);
          })
          .map((node) => node.id),
      );
      visibleIds = collectVisibleIdsWithAncestors(prunedNodes, matchedBedIds);
    }

    const flatRows = flattenTreeRows(prunedNodes, {
      expandedIds: expandedHierarchyIds,
      visibleIds,
    });

    return flatRows.map(({ node, depth, hasChildren }) => {
      const isExpandable = node.type !== 'bed' && hasChildren;
      const isExpanded = expandedHierarchyIds.has(node.id);

      let emptyRowLabel: string | undefined;
      if (node.type === 'field') {
        emptyRowLabel = `${node.bedCount} Beet${node.bedCount === 1 ? '' : 'e'} · ${node.occupiedBedCount} belegt`;
      } else if (node.type === 'location') {
        const fieldCount = prunedNodes.filter(
          (candidate) => candidate.type === 'field' && candidate.parentId === node.id,
        ).length;
        emptyRowLabel = `${fieldCount} Parzelle${fieldCount === 1 ? '' : 'n'} · ${node.bedCount} Beet${node.bedCount === 1 ? '' : 'e'} · ${node.occupiedBedCount} belegt`;
      }

      const group: GanttTaskGroup = {
        id: node.id,
        name: node.name,
        tasks: node.tasks,
        depth,
        isExpandable,
        isExpanded,
        emptyRowLabel,
        // Standort/Parzelle rows have no bars of their own, so they don't
        // need a full task-row height — Beet rows keep the normal,
        // task-count-based height (rowHeightOverride left unset).
        rowHeightOverride: node.type === 'bed' ? undefined : OCCUPANCY_COMPACT_ROW_HEIGHT,
        locationId: node.locationId,
        fieldId: node.fieldId,
        bedId: node.bedId,
        area: node.area,
      };
      return group;
    });
  }, [
    expandedHierarchyIds,
    occupancyFieldFilter,
    occupancyHierarchyNodes,
    occupancyLocationFilter,
    occupancySearchText,
    onlyOccupiedBeds,
  ]);

  const handleToggleGroupExpand = useCallback((groupId: string) => {
    toggleHierarchyExpand(groupId);
  }, [toggleHierarchyExpand]);

  const seedlingTaskGroups = useMemo<GanttTaskGroup[]>(() => {
    const allGroups = buildSeedlingTaskGroups({
      locations: [],
      fields: [],
      beds: [],
      plantingPlans,
      cultures,
      displayYear,
    });

    const normalizedSearch = seedlingSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return allGroups;
    }

    return allGroups.filter((group) => (
      (group.name || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [cultures, displayYear, plantingPlans, seedlingSearchText]);

  const resolvedLocale = useMemo(() => {
    const language = i18n.resolvedLanguage || i18n.language || 'de';
    if (language === 'de') {
      return 'de-DE';
    }
    if (language === 'en') {
      return 'en-US';
    }
    return language;
  }, [i18n.language, i18n.resolvedLanguage]);
  const ganttLocaleText = useMemo(() => ({
    title: calendarMode === 'seedlings'
      ? t('ganttChart:chartLocaleText.titleSeedlings')
      : t('ganttChart:chartLocaleText.titleOccupancy'),
    resources: calendarMode === 'seedlings'
      ? t('ganttChart:chartLocaleText.resourcesSeedlings')
      : t('ganttChart:chartLocaleText.resources'),
    today: t('ganttChart:chartLocaleText.today'),
    viewModes: {
      [ViewMode.MINUTE]: t('ganttChart:chartLocaleText.viewModes.minute'),
      [ViewMode.HOUR]: t('ganttChart:chartLocaleText.viewModes.hour'),
      [ViewMode.DAY]: t('ganttChart:chartLocaleText.viewModes.day'),
      [ViewMode.WEEK]: t('ganttChart:chartLocaleText.viewModes.week'),
      [ViewMode.MONTH]: t('ganttChart:chartLocaleText.viewModes.month'),
      [ViewMode.QUARTER]: t('ganttChart:chartLocaleText.viewModes.quarter'),
      [ViewMode.YEAR]: t('ganttChart:chartLocaleText.viewModes.year'),
    },
  }), [calendarMode, t]);
  const renderGanttHeader = useCallback(({
    title,
    viewMode,
    onViewModeChange,
    showViewModeSelector,
  }: {
    title: string;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    showViewModeSelector: boolean;
  }) => (
    <Box className="rmg-header">
      <Box
        className="rmg-header-content"
        sx={{
          gap: 1.5,
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 2.5 },
            minWidth: 0,
            flex: '0 1 auto',
            overflow: 'hidden',
          }}
        >
          <Typography
            component="h1"
            className="rmg-title"
            sx={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
          {calendarMode === 'occupancy' ? (
            <Tooltip title={t('ganttChart:moveModeOption')}>
              <Button
                size="small"
                variant={editMode ? 'contained' : 'outlined'}
                color={editMode ? 'success' : 'inherit'}
                aria-label={t('ganttChart:moveModeOption')}
                aria-pressed={editMode}
                onClick={() => setEditMode((value) => !value)}
                sx={{
                  flexShrink: 0,
                  gap: { xs: 0, md: 0.75 },
                  minWidth: { xs: 44, md: 'auto' },
                  width: { xs: 44, md: 'auto' },
                  height: { xs: 44, md: 'auto' },
                  px: { xs: 0, md: 1.25 },
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  ...(editMode
                    ? {}
                    : {
                      borderColor: 'success.main',
                      color: 'success.dark',
                      bgcolor: 'background.paper',
                      '&:hover': {
                        borderColor: 'success.dark',
                        bgcolor: 'success.50',
                      },
                    }),
                }}
              >
                <SwapHorizIcon
                  sx={{ display: { xs: 'inline-flex', md: editMode ? 'none' : 'inline-flex' } }}
                  fontSize="small"
                />
                {editMode ? (
                  <CheckCircleOutlineIcon
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                    fontSize="small"
                  />
                ) : null}
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {editMode ? t('ganttChart:moveModeActiveOption') : t('ganttChart:moveModeOption')}
                </Box>
              </Button>
            </Tooltip>
          ) : null}
        </Box>
        {showViewModeSelector ? (
          <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            <Select
              size="small"
              value={viewMode}
              onChange={(event) => handleTimelineViewModeChange(event.target.value as ViewMode, onViewModeChange)}
              inputProps={{ 'aria-label': t('ganttChart:viewSelectorAriaLabel') }}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                width: 'auto',
                minWidth: 0,
                bgcolor: 'background.paper',
                color: 'text.primary',
                '& .MuiSelect-select': {
                  width: 'auto',
                  minWidth: 0,
                  py: 0.75,
                  pl: 1,
                  pr: '26px !important',
                },
              }}
            >
              {GANTT_HEADER_VIEW_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {t(`ganttChart:chartLocaleText.viewModes.${mode}`)}
                </MenuItem>
              ))}
            </Select>
            <ButtonGroup
              size="small"
              variant="outlined"
              sx={{
                ...segmentedButtonGroupSx,
                display: { xs: 'none', md: 'inline-flex' },
              }}
              aria-label={t('ganttChart:chartLocaleText.titleOccupancy')}
            >
              {GANTT_HEADER_VIEW_MODES.map((mode) => (
                <Button
                  key={mode}
                  onClick={() => handleTimelineViewModeChange(mode, onViewModeChange)}
                  aria-pressed={viewMode === mode}
                  variant={viewMode === mode ? 'contained' : 'outlined'}
                  color={viewMode === mode ? 'success' : 'inherit'}
                  sx={{ ...getSegmentedActionButtonSx({ active: viewMode === mode }) }}
                >
                  {t(`ganttChart:chartLocaleText.viewModes.${mode}`)}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        ) : null}
      </Box>
    </Box>
  ), [calendarMode, editMode, handleTimelineViewModeChange, t]);

  const activeTaskGroups = calendarMode === 'occupancy' ? occupancyTaskGroups : seedlingTaskGroups;
  const getActiveGanttRowHeight = useCallback(
    (group: GanttTaskGroup): number => getCalendarGanttRowHeight(group, timelineViewMode),
    [timelineViewMode],
  );
  const renderWindow = useMemo(
    () => getGanttRenderWindow(
      activeTaskGroups,
      ganttScrollTop,
      ganttViewportHeight,
      getActiveGanttRowHeight,
    ),
    [activeTaskGroups, ganttScrollTop, ganttViewportHeight, getActiveGanttRowHeight],
  );
  const renderedTaskGroups = renderWindow.groups;
  const isGanttRenderWindowVirtualized = renderWindow.startIndex > 0 || renderWindow.endIndex < activeTaskGroups.length;
  const totalTimelineItems = useMemo(
    // For occupancy mode, count tasks across the full tree (every bed),
    // not just the currently visible/expanded rows — collapsing a field
    // shouldn't make the dataset look smaller than it is.
    () => (calendarMode === 'occupancy'
      ? occupancyHierarchyNodes.reduce((total, node) => total + node.tasks.length, 0)
      : activeTaskGroups.reduce((total, group) => total + group.tasks.length, 0)),
    [activeTaskGroups, calendarMode, occupancyHierarchyNodes],
  );
  const renderedTimelineItems = useMemo(
    () => renderedTaskGroups.reduce((total, group) => total + group.tasks.length, 0),
    [renderedTaskGroups],
  );
  const hasFields = fields.length > 0;
  const hasCultures = cultures.length > 0;
  const hasBeds = beds.length > 0;
  const hasPlantingPlans = plantingPlans.length > 0;
  const firstMissingPrerequisite = getFirstMissingCultivationPlanRequirement({
    hasFields,
    hasBeds,
    hasCultures,
  });
  const firstMissingRequirement = firstMissingPrerequisite ?? (hasPlantingPlans ? null : 'plans');
  const hasCalendarRequirements = firstMissingRequirement === null;
  const requirementActions = firstMissingRequirement
    ? getProjectSetupActions(firstMissingRequirement)
    : [];
  const calendarCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'calendar.today',
      label: t('ganttChart:shortcuts.today'),
      group: 'navigation',
      keywords: ['kalender', 'heute', 'aktuell', 'periode'],
      shortcutHint: 'T',
      keys: { key: 't' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(new Date()),
    },
    {
      id: 'calendar.previousPeriod',
      label: t('ganttChart:shortcuts.previousPeriod'),
      group: 'navigation',
      keywords: ['kalender', 'vorherige', 'periode', 'zurück'],
      shortcutHint: '←',
      keys: { key: 'ArrowLeft' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriod(getCurrentTimelineReferenceDate(), timelineViewMode, -1)),
    },
    {
      id: 'calendar.nextPeriod',
      label: t('ganttChart:shortcuts.nextPeriod'),
      group: 'navigation',
      keywords: ['kalender', 'nächste', 'periode', 'weiter'],
      shortcutHint: '→',
      keys: { key: 'ArrowRight' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriod(getCurrentTimelineReferenceDate(), timelineViewMode, 1)),
    },
    {
      id: 'calendar.previousLargePeriod',
      label: t('ganttChart:shortcuts.previousLargePeriod'),
      group: 'navigation',
      keywords: ['kalender', 'vorherige', 'große', 'periode', 'sprung', 'zurück'],
      shortcutHint: 'Shift+←',
      keys: { shift: true, key: 'ArrowLeft' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriodLarge(getCurrentTimelineReferenceDate(), timelineViewMode, -1)),
    },
    {
      id: 'calendar.nextLargePeriod',
      label: t('ganttChart:shortcuts.nextLargePeriod'),
      group: 'navigation',
      keywords: ['kalender', 'nächste', 'große', 'periode', 'sprung', 'weiter'],
      shortcutHint: 'Shift+→',
      keys: { shift: true, key: 'ArrowRight' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriodLarge(getCurrentTimelineReferenceDate(), timelineViewMode, 1)),
    },
    ...CALENDAR_SHORTCUT_VIEW_MODES.map<CommandSpec>(({ mode, shortcut, labelKey }) => ({
      id: `calendar.viewMode.${mode}`,
      label: t(`ganttChart:shortcuts.${labelKey}`),
      group: 'navigation',
      keywords: ['kalender', 'ansicht', mode],
      shortcutHint: shortcut,
      keys: { key: shortcut },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleShortcutTimelineViewModeChange(mode),
    })),
    {
      id: 'calendar.focusSearch',
      label: t('ganttChart:shortcuts.focusSearch'),
      group: 'navigation',
      keywords: ['kalender', 'suchen', 'search', 'filter'],
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: focusSearch,
    },
    {
      id: 'calendar.showOccupancy',
      label: t('ganttChart:shortcuts.showOccupancy'),
      group: 'navigation',
      keywords: ['kalender', 'feldbelegung', 'felder'],
      shortcutHint: 'F',
      keys: { key: 'f' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleCalendarModeChange('occupancy'),
    },
    {
      id: 'calendar.showSeedlings',
      label: t('ganttChart:shortcuts.showSeedlings'),
      group: 'navigation',
      keywords: ['kalender', 'anzucht', 'jungpflanzen'],
      shortcutHint: 'A',
      keys: { key: 'a' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleCalendarModeChange('seedlings'),
    },
    {
      id: 'calendar.toggleEdit',
      label: editMode
        ? t('ganttChart:moveModeCommandDeactivate')
        : t('ganttChart:moveModeCommandActivate'),
      group: 'navigation',
      keywords: ['kalender', 'verschieben', 'drag-and-drop'],
      shortcutHint: 'Alt+E / Z',
      keys: { alt: true, key: 'e' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements && calendarMode === 'occupancy',
      action: toggleCalendarEditMode,
    },
    {
      id: 'calendar.toggleEditPlain',
      label: editMode
        ? t('ganttChart:moveModeCommandDeactivate')
        : t('ganttChart:moveModeCommandActivate'),
      group: 'navigation',
      keywords: ['kalender', 'verschieben', 'drag-and-drop'],
      shortcutHint: 'Z',
      keys: { key: 'z' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements && calendarMode === 'occupancy',
      action: toggleCalendarEditMode,
    },
  ], [
    calendarMode,
    editMode,
    focusSearch,
    getCurrentTimelineReferenceDate,
    handleCalendarModeChange,
    handleShortcutTimelineViewModeChange,
    hasCalendarRequirements,
    scrollToTimelineReferenceDate,
    t,
    timelineViewMode,
    toggleCalendarEditMode,
  ]);

  useRegisterCommands('calendar-page', calendarCommands);

  useEffect(() => {
    if (loading || !hasCalendarRequirements) {
      return;
    }

    const storedRowScrollTop = storedGanttState?.rowScrollTop;
    const requestedScrollTop = typeof storedRowScrollTop === 'number' && Number.isFinite(storedRowScrollTop)
      ? Math.max(0, storedRowScrollTop)
      : 0;
    // The stored offset is shared across calendar modes/projects with differing row
    // counts, so it can exceed what's actually scrollable here. Assign it to the DOM
    // first and read back the browser-clamped value, otherwise the absolutely
    // positioned chart content (top: ganttScrollTop) renders offset past the visible
    // viewport, leaving a blank gap above it instead of starting at the top.
    let appliedScrollTop = requestedScrollTop;
    if (ganttViewportRef.current) {
      ganttViewportRef.current.scrollTop = requestedScrollTop;
      appliedScrollTop = ganttViewportRef.current.scrollTop;
    }
    setGanttScrollTop(appliedScrollTop);
    hasRestoredTimelineRef.current = false;
  }, [activeProjectId, calendarMode, hasCalendarRequirements, loading, storedGanttState?.rowScrollTop]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements) {
      return undefined;
    }

    let timeoutId: number | null = null;
    let animationFrameId: number | null = null;
    let isCancelled = false;
    let attempt = 0;

    const restoreTimelineScroll = (): void => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (isCancelled) {
          return;
        }

        const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
        if (!scrollContainer) {
          return;
        }

        const referenceDate = getInitialTimelineReferenceDate(
          getStoredGanttState(ganttStateStorageKey),
          startDate,
          endDate,
        );
        const nextScrollLeft = getTimelineScrollLeftForDate(referenceDate, timelineViewMode, startDate, scrollContainer);
        const previousScrollBehavior = scrollContainer.style.scrollBehavior;
        scrollContainer.style.scrollBehavior = 'auto';
        scrollContainer.scrollLeft = nextScrollLeft;
        scrollContainer.style.scrollBehavior = previousScrollBehavior;

        if (nextScrollLeft > 0 && scrollContainer.scrollLeft === 0 && attempt < 5) {
          attempt += 1;
          timeoutId = window.setTimeout(restoreTimelineScroll, 50);
          return;
        }

        latestReferenceDateRef.current = referenceDate;
        hasRestoredTimelineRef.current = true;
        storeGanttState(ganttStateStorageKey, {
          calendarMode,
          timelineViewMode,
          referenceDate: formatDateToAPI(referenceDate),
        });
      });
    };

    timeoutId = window.setTimeout(restoreTimelineScroll, 0);

    return () => {
      isCancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    activeProjectId,
    calendarMode,
    endDate,
    ganttStateStorageKey,
    hasCalendarRequirements,
    loading,
    startDate,
    timelineViewMode,
  ]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements) {
      return undefined;
    }

    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (!scrollContainer) {
      return undefined;
    }

    const handleTimelineScroll = (): void => {
      if (!hasRestoredTimelineRef.current) {
        return;
      }
      const referenceDate = getReferenceDateFromScroll(
        scrollContainer.scrollLeft,
        scrollContainer.clientWidth,
        timelineViewMode,
        startDate,
        endDate,
      );
      latestReferenceDateRef.current = referenceDate;
      storeGanttState(ganttStateStorageKey, {
        calendarMode,
        timelineViewMode,
        referenceDate: formatDateToAPI(referenceDate),
      });
    };

    scrollContainer.addEventListener('scroll', handleTimelineScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleTimelineScroll);
  }, [calendarMode, endDate, ganttStateStorageKey, hasCalendarRequirements, loading, startDate, timelineViewMode]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements || calendarMode !== 'occupancy' || !editMode) {
      return undefined;
    }

    const viewport = ganttViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    let activeTouchId: number | null = null;
    let activeTaskTarget: HTMLElement | null = null;
    let isMouseDragReady = false;
    let dragReadyAnimationFrame: number | null = null;
    let pendingMovePoint: SyntheticMousePoint | null = null;
    let pendingEndPoint: SyntheticMousePoint | null = null;

    const resetTouchDrag = (): void => {
      activeTouchId = null;
      activeTaskTarget = null;
      isMouseDragReady = false;
      pendingMovePoint = null;
      pendingEndPoint = null;
      if (dragReadyAnimationFrame !== null) {
        window.cancelAnimationFrame(dragReadyAnimationFrame);
        dragReadyAnimationFrame = null;
      }
    };

    const flushPendingTouchDrag = (): void => {
      isMouseDragReady = true;
      dragReadyAnimationFrame = null;
      if (pendingMovePoint) {
        const moveTarget = document.elementFromPoint?.(pendingMovePoint.clientX, pendingMovePoint.clientY)
          ?? activeTaskTarget
          ?? document;
        dispatchSyntheticMouseEvent(moveTarget, 'mousemove', pendingMovePoint);
        pendingMovePoint = null;
      }
      if (pendingEndPoint) {
        dispatchSyntheticMouseEvent(document, 'mouseup', pendingEndPoint);
        resetTouchDrag();
      }
    };

    const getTrackedTouch = (event: TouchEvent): Touch | null => {
      if (activeTouchId === null) {
        return getPrimaryTouch(event);
      }

      const touches = Array.from(event.touches);
      return touches.find((touch) => touch.identifier === activeTouchId) ?? getPrimaryTouch(event);
    };

    const handleTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        return;
      }

      const target = event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-rmg-component="task"]')
        : null;
      const touch = getPrimaryTouch(event);
      if (!target || !touch) {
        return;
      }

      activeTouchId = touch.identifier;
      activeTaskTarget = target;
      isMouseDragReady = false;
      event.preventDefault();
      dispatchSyntheticMouseEvent(target, 'mousedown', toSyntheticMousePoint(touch));
      dragReadyAnimationFrame = window.requestAnimationFrame(flushPendingTouchDrag);
    };

    const handleTouchMove = (event: TouchEvent): void => {
      if (activeTouchId === null || !activeTaskTarget) {
        return;
      }

      const touch = getTrackedTouch(event);
      if (!touch) {
        return;
      }

      event.preventDefault();
      const point = toSyntheticMousePoint(touch);
      if (!isMouseDragReady) {
        pendingMovePoint = point;
        return;
      }
      const moveTarget = document.elementFromPoint?.(point.clientX, point.clientY)
        ?? activeTaskTarget
        ?? document;
      dispatchSyntheticMouseEvent(moveTarget, 'mousemove', point);
    };

    const finishTouchDrag = (event: TouchEvent): void => {
      if (activeTouchId === null || !activeTaskTarget) {
        return;
      }

      const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === activeTouchId)
        ?? getPrimaryTouch(event);
      if (touch) {
        event.preventDefault();
        const point = toSyntheticMousePoint(touch);
        if (!isMouseDragReady) {
          pendingEndPoint = point;
          return;
        }
        dispatchSyntheticMouseEvent(document, 'mouseup', point);
      }
      resetTouchDrag();
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', finishTouchDrag, { passive: false });
    viewport.addEventListener('touchcancel', finishTouchDrag, { passive: false });

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', finishTouchDrag);
      viewport.removeEventListener('touchcancel', finishTouchDrag);
      resetTouchDrag();
    };
  }, [calendarMode, editMode, hasCalendarRequirements, loading]);

  useEffect(() => {
    const viewport = ganttViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateViewportHeight = (): void => {
      setGanttViewportHeight(viewport.clientHeight);
    };
    updateViewportHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportHeight);
      return () => window.removeEventListener('resize', updateViewportHeight);
    }
    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || loading) {
      return;
    }

    console.debug('[Gantt diagnostics]', {
      beds: beds.length,
      plantingPlans: plantingPlans.length,
      totalRows: activeTaskGroups.length,
      totalTimelineItems,
      renderedRows: renderedTaskGroups.length,
      renderedTimelineItems,
      firstRenderedRow: renderWindow.startIndex,
      lastRenderedRow: renderWindow.endIndex,
    });
  }, [
    activeTaskGroups.length,
    beds.length,
    loading,
    plantingPlans.length,
    renderWindow.endIndex,
    renderWindow.startIndex,
    renderedTaskGroups.length,
    renderedTimelineItems,
    totalTimelineItems,
  ]);
  const viewModeActions = useMemo<TopbarContextAction[]>(() => (hasCalendarRequirements ? [
    {
      id: 'calendar-view-mode-occupancy',
      label: t('ganttChart:modes.occupancy'),
      ariaLabel: t('ganttChart:modes.occupancy'),
      onClick: () => handleCalendarModeChange('occupancy'),
      active: calendarMode === 'occupancy',
      groupId: 'calendar-view-mode',
      tooltip: t('ganttChart:modeTooltips.occupancy'),
    },
    {
      id: 'calendar-view-mode-seedlings',
      label: t('ganttChart:modes.seedlings'),
      ariaLabel: t('ganttChart:modes.seedlings'),
      onClick: () => handleCalendarModeChange('seedlings'),
      active: calendarMode === 'seedlings',
      groupId: 'calendar-view-mode',
      tooltip: t('ganttChart:modeTooltips.seedlings'),
    },
  ] : []), [calendarMode, handleCalendarModeChange, hasCalendarRequirements, t]);
  const requirementEmptyStateTitleKey = firstMissingRequirement === 'cultures'
    ? 'ganttChart:emptyStates.states.cultures.title'
    : firstMissingRequirement === 'plans'
      ? 'ganttChart:emptyStates.states.plans.title'
      : 'ganttChart:emptyStates.requirementsTitle';
  const requirementEmptyStateDescriptionKey = firstMissingRequirement === 'cultures'
    ? 'ganttChart:emptyStates.states.cultures.description'
    : firstMissingRequirement === 'plans'
      ? 'ganttChart:emptyStates.states.plans.description'
      : 'ganttChart:emptyStates.requirementsDescription';

  const renderOccupancyTooltip = useCallback(({ task }: { task: GanttTask }) => (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {formatSeedlingTooltipTitle(task)}
      </Typography>
      {buildOccupancyTooltipDetails(task).map((detail) => (
        <Typography key={`${task.id}-${detail.labelKey}`} variant="body2" sx={{ display: 'block', lineHeight: 1.4 }}>
          {t(`ganttChart:tooltip.${detail.labelKey}`)}: {detail.value}
        </Typography>
      ))}
    </Box>
  ), [t]);

  const renderSeedlingTooltip = useCallback(({ task }: { task: GanttTask }) => (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {formatSeedlingTooltipTitle(task)}
      </Typography>
      {buildSeedlingTooltipDetails(task).map((detail) => (
        <Typography key={`${task.id}-${detail.labelKey}`} variant="body2" sx={{ display: 'block', lineHeight: 1.4 }}>
          {t(`ganttChart:tooltip.${detail.labelKey}`)}: {detail.labelKey === 'propagationDuration'
            ? `${detail.value} ${t('ganttChart:days')}`
            : detail.value}
        </Typography>
      ))}
    </Box>
  ), [t]);

  const contextActions = useMemo<TopbarContextAction[]>(() => [], []);

  useTopbarContextActions(setTopbarContextActions, contextActions);
  useTopbarTitleActions(setTopbarTitleActions, viewModeActions);

  const calendarGanttChart = (
    <GanttRenderBoundary fallback={<Alert severity="error">{t('ganttChart:errors.render')}</Alert>}>
      <GanttChartWithFocusMode
        key={`${calendarMode}-${ganttRenderKey}`}
        tasks={renderedTaskGroups}
        locale={resolvedLocale}
        localeText={ganttLocaleText}
        viewMode={timelineViewMode}
        leftColumnWidth={GANTT_LEFT_COLUMN_WIDTH}
        rowHeight={GANTT_ROW_HEIGHT}
        startDate={startDate}
        endDate={endDate}
        focusMode={false}
        editMode={calendarMode === 'occupancy' ? editMode : false}
        allowTaskResize={false}
        allowTaskMove={calendarMode === 'occupancy' && editMode}
        showProgress={false}
        darkMode={false}
        onTaskUpdate={calendarMode === 'occupancy' && editMode ? handleTaskUpdate : undefined}
        onToggleGroupExpand={calendarMode === 'occupancy' ? handleToggleGroupExpand : undefined}
        onTaskDoubleClick={handleTaskDoubleClickToPlan}
        onTaskContextMenu={handleTaskContextMenu}
        onGroupContextMenu={calendarMode === 'occupancy' ? handleGroupContextMenu : undefined}
        renderHeader={renderGanttHeader}
        renderTooltip={({ task }: { task: GanttTask }) => (calendarMode === 'seedlings'
          ? renderSeedlingTooltip({ task })
          : renderOccupancyTooltip({ task }))}
        renderTask={calendarMode === 'seedlings'
          ? ({ task }: { task: GanttTask; leftPx: number; widthPx: number; topPx: number }) => (
              <Box
                sx={{
                  width: '100%',
                  height: 26,
                  px: 1,
                  borderRadius: 1,
                  backgroundColor: task.color || '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  boxSizing: 'border-box',
                  cursor: 'default',
                }}
              >
                <Typography
                  variant="caption"
                  className="rmg-task-item-name-maskable"
                  sx={{ color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                >
                  {typeof task.plantsCount === 'number' && task.plantsCount > 0
                    ? `${task.name} · ${formatPlantCount(task.plantsCount)} ${t('ganttChart:seedlings.plantsUnit')}`
                    : task.name}
                </Typography>
              </Box>
            )
          : undefined}
      />
    </GanttRenderBoundary>
  );

  if (loading) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace" sx={{ py: 2 }}>
          <Typography variant="body1">{t('ganttChart:loading')}</Typography>
        </PageSurface>
      </PageContainer>
    );
  }

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="workspacePage">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!hasCalendarRequirements ? (
          <PageSurface variant="fullWorkspace" sx={{ mt: 0.5 }}>
          <Box className="gantt-container-wrapper" sx={{ border: '1px solid', borderColor: 'surface.surfaceSoftBorder', borderRadius: 2, bgcolor: 'surface.surfaceBackground' }}>
            <Box sx={{ p: 2 }}>
              <EmptyStateCard
                title={t(requirementEmptyStateTitleKey)}
                description={t(requirementEmptyStateDescriptionKey)}
                checklist={[
                  ...(firstMissingRequirement === 'beds' ? [{ label: t('ganttChart:requirements.bed.label'), done: false, missingLabel: t('ganttChart:requirements.bed.missing') }] : []),
                  ...(firstMissingRequirement === 'cultures' ? [{ label: t('ganttChart:requirements.culture.label'), done: false, missingLabel: t('ganttChart:requirements.culture.missing') }] : []),
                ]}
                actions={requirementActions.map((action) => ({ label: t(action.labelKey), to: action.to }))}
              />
            </Box>
          </Box>
          </PageSurface>
        ) : (
          <PageSurface variant="fullWorkspace" sx={{ mt: 0.5 }}>
          {calendarMode === 'occupancy' && (
            <Box
              data-testid="occupancy-tree-filters"
              sx={{
                mb: { xs: 0, md: 1.5 },
              }}
            >
              {useMobileFilterLayout ? (
                <Stack spacing={0}>
                  {mobileSearchOpen || activeSearchText ? (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <TextField
                        size="small"
                        placeholder={t('ganttChart:treeFilters.searchPlaceholder')}
                        value={occupancySearchText}
                        onChange={(event) => setOccupancySearchText(event.target.value)}
                        inputRef={searchInputRef}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{ flex: '1 1 auto', minWidth: 0 }}
                      />
                      <Tooltip title={t('ganttChart:treeFilters.clearSearch')}>
                        <IconButton
                          size="small"
                          aria-label={t('ganttChart:treeFilters.clearSearch')}
                          onClick={clearActiveSearch}
                          sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<TuneIcon fontSize="small" />}
                        onClick={(event) => setCalendarFilterAnchorEl(event.currentTarget)}
                        aria-expanded={isCalendarFilterPopoverOpen}
                        aria-haspopup="dialog"
                        aria-controls={isCalendarFilterPopoverOpen ? 'calendar-filters-popover' : undefined}
                        sx={{
                          minHeight: 40,
                          minWidth: 0,
                          px: 1,
                          whiteSpace: 'nowrap',
                          borderColor: activeHierarchyFilterCount > 0 ? 'text.secondary' : 'divider',
                          bgcolor: activeHierarchyFilterCount > 0 ? 'action.selected' : 'transparent',
                        }}
                      >
                        {activeHierarchyFilterCount > 0
                          ? t('ganttChart:treeFilters.filterButtonWithCount', { count: activeHierarchyFilterCount })
                          : t('ganttChart:treeFilters.filterButton')}
                      </Button>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Tooltip title={t('common:actions.search')}>
                        <IconButton
                          size="small"
                          aria-label={t('common:actions.search')}
                          onClick={() => setMobileSearchOpen(true)}
                          sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
                        >
                          <SearchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<TuneIcon fontSize="small" />}
                        onClick={(event) => setCalendarFilterAnchorEl(event.currentTarget)}
                        aria-expanded={isCalendarFilterPopoverOpen}
                        aria-haspopup="dialog"
                        aria-controls={isCalendarFilterPopoverOpen ? 'calendar-filters-popover' : undefined}
                        sx={{
                          minHeight: 40,
                          whiteSpace: 'nowrap',
                          borderColor: activeHierarchyFilterCount > 0 ? 'text.secondary' : 'divider',
                          bgcolor: activeHierarchyFilterCount > 0 ? 'action.selected' : 'transparent',
                        }}
                      >
                        {activeHierarchyFilterCount > 0
                          ? t('ganttChart:treeFilters.filterButtonWithCount', { count: activeHierarchyFilterCount })
                          : t('ganttChart:treeFilters.filterButton')}
                      </Button>
                    </Stack>
                  )}
                  <Popover
                    id="calendar-filters-popover"
                    open={isCalendarFilterPopoverOpen}
                    anchorEl={calendarFilterAnchorEl}
                    onClose={() => setCalendarFilterAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{ sx: { width: 'min(92vw, 360px)', p: 1.5 } }}
                  >
                    <Stack spacing={1.25}>
                      <FormControl size="small" sx={{ minWidth: '100%' }}>
                        <InputLabel id="calendar-location-filter-label">{t('ganttChart:treeFilters.locationLabel')}</InputLabel>
                        <Select
                          labelId="calendar-location-filter-label"
                          value={occupancyLocationFilter === 'all' ? 'all' : String(occupancyLocationFilter)}
                          label={t('ganttChart:treeFilters.locationLabel')}
                          onChange={(event) => {
                            const { value } = event.target;
                            setOccupancyLocationFilter(value === 'all' ? 'all' : Number(value));
                            setOccupancyFieldFilter('all');
                          }}
                        >
                          <MenuItem value="all">{t('ganttChart:treeFilters.allLocations')}</MenuItem>
                          {locations.filter((location) => location.id).map((location) => (
                            <MenuItem key={location.id} value={String(location.id)}>{location.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: '100%' }}>
                        <InputLabel id="calendar-field-filter-label">{t('ganttChart:treeFilters.fieldLabel')}</InputLabel>
                        <Select
                          labelId="calendar-field-filter-label"
                          value={occupancyFieldFilter === 'all' ? 'all' : String(occupancyFieldFilter)}
                          label={t('ganttChart:treeFilters.fieldLabel')}
                          onChange={(event) => {
                            const { value } = event.target;
                            setOccupancyFieldFilter(value === 'all' ? 'all' : Number(value));
                          }}
                          disabled={occupancyLocationFilter === 'all'}
                        >
                          <MenuItem value="all">{t('ganttChart:treeFilters.allFields')}</MenuItem>
                          {occupancyFieldOptions.map((field) => (
                            <MenuItem key={field.id} value={String(field.fieldId)}>{field.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            size="small"
                            checked={onlyOccupiedBeds}
                            onChange={(event) => setOnlyOccupiedBeds(event.target.checked)}
                          />
                        )}
                        label={t('ganttChart:treeFilters.onlyOccupiedBeds')}
                      />
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => {
                          resetOccupancyHierarchyFilters();
                          setCalendarFilterAnchorEl(null);
                        }}
                        sx={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                      >
                        {t('ganttChart:treeFilters.resetFilters')}
                      </Button>
                    </Stack>
                  </Popover>
                </Stack>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    size="small"
                    placeholder={t('ganttChart:treeFilters.searchPlaceholder')}
                    value={occupancySearchText}
                    onChange={(event) => setOccupancySearchText(event.target.value)}
                    inputRef={searchInputRef}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ minWidth: 240, flex: '1 1 240px' }}
                  />
                  <Select
                    size="small"
                    value={occupancyLocationFilter === 'all' ? 'all' : String(occupancyLocationFilter)}
                    onChange={(event) => {
                      const { value } = event.target;
                      setOccupancyLocationFilter(value === 'all' ? 'all' : Number(value));
                      setOccupancyFieldFilter('all');
                    }}
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="all">{t('ganttChart:treeFilters.allLocations')}</MenuItem>
                    {locations.filter((location) => location.id).map((location) => (
                      <MenuItem key={location.id} value={String(location.id)}>{location.name}</MenuItem>
                    ))}
                  </Select>
                  <Select
                    size="small"
                    value={occupancyFieldFilter === 'all' ? 'all' : String(occupancyFieldFilter)}
                    onChange={(event) => {
                      const { value } = event.target;
                      setOccupancyFieldFilter(value === 'all' ? 'all' : Number(value));
                    }}
                    disabled={occupancyLocationFilter === 'all'}
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="all">{t('ganttChart:treeFilters.allFields')}</MenuItem>
                    {occupancyFieldOptions.map((field) => (
                      <MenuItem key={field.id} value={String(field.fieldId)}>{field.name}</MenuItem>
                    ))}
                  </Select>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        size="small"
                        checked={onlyOccupiedBeds}
                        onChange={(event) => setOnlyOccupiedBeds(event.target.checked)}
                      />
                    )}
                    label={t('ganttChart:treeFilters.onlyOccupiedBeds')}
                  />
                </Box>
              )}
            </Box>
          )}
          {calendarMode === 'seedlings' && (
            <Box
              data-testid="seedling-filters"
              sx={{
                mb: { xs: 0, md: 1.5 },
              }}
            >
              {useMobileFilterLayout ? (
                <Stack spacing={0}>
                  {mobileSearchOpen || activeSearchText ? (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <TextField
                        size="small"
                        placeholder={t('ganttChart:treeFilters.searchPlaceholderSeedlings')}
                        value={seedlingSearchText}
                        onChange={(event) => setSeedlingSearchText(event.target.value)}
                        inputRef={searchInputRef}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{ flex: '1 1 auto', minWidth: 0 }}
                      />
                      <Tooltip title={t('ganttChart:treeFilters.clearSearch')}>
                        <IconButton
                          size="small"
                          aria-label={t('ganttChart:treeFilters.clearSearch')}
                          onClick={clearActiveSearch}
                          sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <Tooltip title={t('common:actions.search')}>
                      <IconButton
                        size="small"
                        aria-label={t('common:actions.search')}
                        onClick={() => setMobileSearchOpen(true)}
                        sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    size="small"
                    placeholder={t('ganttChart:treeFilters.searchPlaceholderSeedlings')}
                    value={seedlingSearchText}
                    onChange={(event) => setSeedlingSearchText(event.target.value)}
                    inputRef={searchInputRef}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ minWidth: 240, flex: '1 1 240px' }}
                  />
                </Box>
              )}
            </Box>
          )}
          <Box
            className={`gantt-container-wrapper gantt-container-wrapper--${calendarMode}`}
            sx={{
              mt: { xs: 0.75, md: 2 },
              border: '1px solid',
              borderColor: 'surface.surfaceSoftBorder',
              borderRadius: 2,
              bgcolor: 'surface.surfaceBackground',
            }}
          >
            <Box
              ref={ganttViewportRef}
              data-testid="gantt-virtual-viewport"
              onScroll={(event) => {
                const nextScrollTop = event.currentTarget.scrollTop;
                setGanttScrollTop(nextScrollTop);
                storeGanttState(ganttStateStorageKey, {
                  calendarMode,
                  timelineViewMode,
                  rowScrollTop: nextScrollTop,
                });
              }}
              sx={{
                position: 'relative',
                maxHeight: GANTT_VIEWPORT_MAX_HEIGHT_SX,
                overflowY: 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
              }}
            >
              {isGanttRenderWindowVirtualized ? (
                <Box sx={{ height: renderWindow.totalHeight, position: 'relative' }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: ganttScrollTop,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {calendarGanttChart}
                  </Box>
                </Box>
              ) : calendarGanttChart}
            </Box>
          </Box>
          </PageSurface>
        )}

      <Menu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        hideBackdrop
        sx={{ pointerEvents: 'none' }}
        slotProps={{
          paper: {
            className: 'ofp-custom-context-menu',
            sx: { pointerEvents: 'auto' },
          },
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuState !== null
            ? { top: contextMenuState.mouseY, left: contextMenuState.mouseX }
            : undefined
        }
      >
        {contextMenuActions.flatMap((action, index) => {
          const previousAction = contextMenuActions[index - 1];
          const shouldSeparateGroup = previousAction !== undefined && previousAction.group !== action.group;
          const menuItem = (
            <MenuItem
              key={action.id}
              onClick={() => {
                closeContextMenu();
                action.onClick();
              }}
              sx={{ color: action.group === 'danger' ? 'error.main' : undefined }}
            >
              {action.label}
            </MenuItem>
          );
          return shouldSeparateGroup
            ? [<Divider key={`${action.id}-divider`} role="separator" />, menuItem]
            : [menuItem];
        })}
      </Menu>
    </PageContainer>
  );
}

export default GanttChartPage;
