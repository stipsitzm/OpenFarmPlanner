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

const CALENDAR_VIEW_STORAGE_KEY = 'openFarmPlanner.ganttChart.view';
const CALENDAR_TIMELINE_VIEW_MODE_STORAGE_KEY = 'openFarmPlanner.ganttChart.timelineViewMode';
const DEFAULT_TIMELINE_VIEW_MODE = ViewMode.MONTH;
const GANTT_HEADER_VIEW_MODES = [
  ViewMode.DAY,
  ViewMode.WEEK,
  ViewMode.MONTH,
  ViewMode.QUARTER,
  ViewMode.YEAR,
] as const;

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

function getStoredTimelineViewMode(storageKey: string): ViewMode | null {
  const storedValue = window.localStorage.getItem(storageKey);
  return isTimelineViewMode(storedValue) ? storedValue : null;
}

function storeTimelineViewMode(storageKey: string, mode: ViewMode): void {
  window.localStorage.setItem(storageKey, mode);
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
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';
  });
  const [timelineViewMode, setTimelineViewMode] = useState<ViewMode>(() => (
    timelineViewModeStorageKey
      ? getStoredTimelineViewMode(timelineViewModeStorageKey) ?? DEFAULT_TIMELINE_VIEW_MODE
      : DEFAULT_TIMELINE_VIEW_MODE
  ));
  const [editMode, setEditMode] = useState(false);
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (!isCalendarViewParam(viewParam) && isAuthLoading) {
      return;
    }

    const nextMode = isCalendarViewParam(viewParam)
      ? getCalendarModeFromViewParam(viewParam)
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';

    setCalendarMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));

    if (isCalendarViewParam(viewParam)) {
      if (calendarViewStorageKey) {
        storeCalendarMode(calendarViewStorageKey, nextMode);
      }
      return;
    }

    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    }, { replace: true });
  }, [calendarViewStorageKey, isAuthLoading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!timelineViewModeStorageKey || isAuthLoading) {
      return;
    }

    const nextViewMode = getStoredTimelineViewMode(timelineViewModeStorageKey) ?? DEFAULT_TIMELINE_VIEW_MODE;
    setTimelineViewMode((currentViewMode) => (currentViewMode === nextViewMode ? currentViewMode : nextViewMode));
  }, [isAuthLoading, timelineViewModeStorageKey]);

  const handleCalendarModeChange = useCallback((nextMode: CalendarMode) => {
    setCalendarMode(nextMode);
    if (calendarViewStorageKey) {
      storeCalendarMode(calendarViewStorageKey, nextMode);
    }
    setSearchParams((currentSearchParams) => {
      if (currentSearchParams.get('view') === getViewParamFromCalendarMode(nextMode)) {
        return currentSearchParams;
      }
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    });
  }, [calendarViewStorageKey, setSearchParams]);

  const handleTimelineViewModeChange = useCallback((
    nextViewMode: ViewMode,
    applyViewModeChange: (mode: ViewMode) => void,
  ) => {
    setTimelineViewMode(nextViewMode);
    if (timelineViewModeStorageKey) {
      storeTimelineViewMode(timelineViewModeStorageKey, nextViewMode);
    }
    applyViewModeChange(nextViewMode);
  }, [timelineViewModeStorageKey]);

  const calendarCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'calendar.toggleEdit',
      label: editMode
        ? t('ganttChart:moveModeCommandDeactivate')
        : t('ganttChart:moveModeCommandActivate'),
      group: 'navigation',
      keywords: ['kalender', 'verschieben', 'drag-and-drop'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['calendar'],
      isEnabled: () => calendarMode === 'occupancy',
      action: () => setEditMode((value) => !value),
    },
  ], [calendarMode, editMode, t]);

  useRegisterCommands('calendar-page', calendarCommands);

  const currentYear = new Date().getFullYear();
  const [displayYear] = useState(currentYear);

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
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    };

    void fetchData();
  }, [displayYear, shouldShowProjectRequiredState, t]);

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

  const startDate = useMemo(() => new Date(displayYear, 0, 1), [displayYear]);
  const endDate = useMemo(() => new Date(displayYear, 11, 31), [displayYear]);
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

  useEffect(() => {
    setGanttScrollTop(0);
    if (ganttViewportRef.current) {
      ganttViewportRef.current.scrollTop = 0;
    }
  }, [calendarMode, activeProjectId]);

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

  useTopbarContextActions(setTopbarContextActions, viewModeActions);



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
              onScroll={(event) => setGanttScrollTop(event.currentTarget.scrollTop)}
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
                    <GanttChart
                      key={`${calendarMode}-${ganttRenderKey}`}
                      tasks={renderedTaskGroups}
                      locale={resolvedLocale}
                      localeText={ganttLocaleText}
                      viewMode={timelineViewMode}
                      leftColumnWidth={220}
                      startDate={startDate}
                      endDate={endDate}
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
