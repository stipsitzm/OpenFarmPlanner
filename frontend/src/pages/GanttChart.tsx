/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useTranslation } from '../i18n';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
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
import GanttChart, { ViewMode } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
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
  buildFieldOccupancyTaskGroups,
  buildOccupancyTooltipDetails,
  buildSeedlingTaskGroups,
  buildSeedlingTooltipDetails,
  formatSeedlingTooltipTitle,
  formatPlantCount,
  parseDateString,
  type GanttTask,
  type GanttTaskGroup,
} from './ganttChartUtils';
import { getFirstMissingCultivationPlanRequirement, getProjectSetupActions } from './requirementFlow';
import {
  getSegmentedActionButtonSx,
  segmentedButtonGroupSx,
} from '../components/buttons/segmentedControlStyles';
import { getGanttRenderWindow } from './ganttRenderWindow';

type CalendarMode = 'occupancy' | 'seedlings';
const GanttChartWithFocusMode = GanttChart as React.ComponentType<
  React.ComponentProps<typeof GanttChart> & { focusMode?: boolean }
>;

const CALENDAR_VIEW_STORAGE_KEY = 'openFarmPlanner.ganttChart.view';
const CALENDAR_TIMELINE_VIEW_MODE_STORAGE_KEY = 'openFarmPlanner.ganttChart.timelineViewMode';
const GANTT_STATE_STORAGE_PREFIX = 'openfarmplanner:gantt';
const DEFAULT_TIMELINE_VIEW_MODE = ViewMode.MONTH;
const GANTT_LEFT_COLUMN_WIDTH = 220;
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



function GanttChartPage() {
  const { t, i18n } = useTranslation(['ganttChart', 'common']);
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

  const occupancyTaskGroups = useMemo<GanttTaskGroup[]>(() => buildFieldOccupancyTaskGroups({
    locations,
    fields,
    beds,
    plantingPlans,
    cultures,
    displayYear,
  }), [beds, cultures, displayYear, fields, locations, plantingPlans]);

  const seedlingTaskGroups = useMemo<GanttTaskGroup[]>(() => buildSeedlingTaskGroups({
    locations: [],
    fields: [],
    beds: [],
    plantingPlans,
    cultures,
    displayYear,
  }), [cultures, displayYear, plantingPlans]);

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
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: { xs: 'space-between', md: 'flex-start' },
            gap: { xs: 1.5, md: 2.5 },
            minWidth: 0,
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <Typography
            component="h1"
            className="rmg-title"
            sx={{
              flex: { xs: '1 1 auto', md: '0 1 auto' },
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
          {showViewModeSelector || calendarMode === 'occupancy' ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
              {showViewModeSelector ? (
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
              ) : null}
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
                      minWidth: { xs: 34, md: 'auto' },
                      width: { xs: 34, md: 'auto' },
                      height: { xs: 34, md: 'auto' },
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
          ) : null}
        </Box>
        {showViewModeSelector ? (
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
        ) : null}
      </Box>
    </Box>
  ), [calendarMode, editMode, handleTimelineViewModeChange, t]);

  const activeTaskGroups = calendarMode === 'occupancy' ? occupancyTaskGroups : seedlingTaskGroups;
  const renderWindow = useMemo(
    () => getGanttRenderWindow(
      activeTaskGroups,
      ganttScrollTop,
      ganttViewportHeight,
    ),
    [activeTaskGroups, ganttScrollTop, ganttViewportHeight],
  );
  const renderedTaskGroups = renderWindow.groups;
  const totalTimelineItems = useMemo(
    () => activeTaskGroups.reduce((total, group) => total + group.tasks.length, 0),
    [activeTaskGroups],
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
    const nextScrollTop = typeof storedRowScrollTop === 'number' && Number.isFinite(storedRowScrollTop)
      ? Math.max(0, storedRowScrollTop)
      : 0;
    setGanttScrollTop(nextScrollTop);
    if (ganttViewportRef.current) {
      ganttViewportRef.current.scrollTop = nextScrollTop;
    }
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
          <Box
            className={`gantt-container-wrapper gantt-container-wrapper--${calendarMode}`}
            sx={{
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
                height: 'calc(100vh - 220px)',
                minHeight: 420,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <Box sx={{ height: Math.max(renderWindow.totalHeight, ganttViewportHeight), position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: ganttScrollTop,
                    left: 0,
                    right: 0,
                  }}
                >
                  <GanttRenderBoundary fallback={<Alert severity="error">{t('ganttChart:errors.render')}</Alert>}>
                    <GanttChartWithFocusMode
                      key={`${calendarMode}-${ganttRenderKey}`}
                      tasks={renderedTaskGroups}
                      locale={resolvedLocale}
                      localeText={ganttLocaleText}
                      viewMode={timelineViewMode}
                      leftColumnWidth={GANTT_LEFT_COLUMN_WIDTH}
                      startDate={startDate}
                      endDate={endDate}
                      focusMode={false}
                      editMode={calendarMode === 'occupancy' ? editMode : false}
                      allowTaskResize={false}
                      allowTaskMove={calendarMode === 'occupancy' && editMode}
                      showProgress={false}
                      darkMode={false}
                      onTaskUpdate={calendarMode === 'occupancy' && editMode ? handleTaskUpdate : undefined}
                      renderHeader={renderGanttHeader}
                      renderTooltip={({ task }: { task: GanttTask }) => (calendarMode === 'seedlings'
                        ? renderSeedlingTooltip({ task })
                        : renderOccupancyTooltip({ task }))}
                      renderTask={calendarMode === 'seedlings'
                        ? ({ task, leftPx, widthPx, topPx }: { task: GanttTask; leftPx: number; widthPx: number; topPx: number }) => (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${leftPx}px`,
                                top: `${topPx}px`,
                                width: `${widthPx}px`,
                                minWidth: `${widthPx}px`,
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
                              <Typography variant="caption" sx={{ color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {typeof task.plantsCount === 'number' && task.plantsCount > 0
                                  ? `${task.name} · ${formatPlantCount(task.plantsCount)} ${t('ganttChart:seedlings.plantsUnit')}`
                                  : task.name}
                              </Typography>
                            </Box>
                          )
                        : undefined}
                    />
                  </GanttRenderBoundary>
                </Box>
              </Box>
            </Box>
          </Box>
          </PageSurface>
        )}

    </PageContainer>
  );
}

export default GanttChartPage;
