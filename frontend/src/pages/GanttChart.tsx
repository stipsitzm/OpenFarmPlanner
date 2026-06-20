/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
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
  yieldCalendarAPI,
  type Bed,
  type Culture,
  type Field,
  type Location,
  type PlantingPlan,
  type YieldCalendarWeek,
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
import RuntimeErrorState from '../components/runtime/RuntimeErrorState';
import { showsDetailedRuntimeErrors } from '../config/environment';

interface WeeklyYieldCultureMeta {
  id: number;
  name: string;
  color: string;
}

interface WeeklyYieldChartColumn {
  isoWeek: string;
  weekLabel: string;
  monthLabel: string;
  cultures: YieldCalendarWeek['cultures'];
  totalYield: number;
}

type CalendarMode = 'occupancy' | 'seedlings';

const CALENDAR_VIEW_STORAGE_KEY = 'openFarmPlanner.ganttChart.view';
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

function getStoredCalendarMode(storageKey: string): CalendarMode | null {
  const storedValue = window.localStorage.getItem(storageKey);
  return isCalendarViewParam(storedValue) ? getCalendarModeFromViewParam(storedValue) : null;
}

function storeCalendarMode(storageKey: string, mode: CalendarMode): void {
  window.localStorage.setItem(storageKey, getViewParamFromCalendarMode(mode));
}

class GanttRenderBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { error: unknown; componentStack?: string }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Gantt render failed', error, info);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render(): React.ReactNode {
    if (this.state.error) {
      if (showsDetailedRuntimeErrors) {
        return (
          <RuntimeErrorState
            variant="routeError"
            error={this.state.error}
            componentStack={this.state.componentStack}
            layout="inline"
          />
        );
      }
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

function formatIsoWeek(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
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
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);
  const [ganttRenderKey, setGanttRenderKey] = useState(0);

  const calendarViewStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getCalendarViewStorageKey(activeProjectId) : null),
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
      setWeeklyYield([]);
      return;
    }
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const [locationsRes, fieldsRes, bedsRes, plansRes, culturesRes, weeklyYieldRes] = await Promise.all([
          locationAPI.list(),
          fieldAPI.list(),
          bedAPI.list(),
          plantingPlanAPI.list(),
          cultureAPI.list(),
          yieldCalendarAPI.list(displayYear),
        ]);

        setLocations(locationsRes.data.results);
        setFields(fieldsRes.data.results);
        setBeds(bedsRes.data.results);
        setPlantingPlans(plansRes.data.results);
        setCultures(culturesRes.data.results);
        setWeeklyYield(weeklyYieldRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(t('ganttChart:errors.load'));
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [displayYear, shouldShowProjectRequiredState, t]);

  const refreshWeeklyYield = useCallback(async (): Promise<void> => {
    try {
      const weeklyYieldRes = await yieldCalendarAPI.list(displayYear);
      setWeeklyYield(weeklyYieldRes.data);
    } catch (err) {
      console.error('Error refreshing weekly yield data:', err);
    }
  }, [displayYear]);

  const refreshPlantingPlans = useCallback(async (): Promise<void> => {
    const plansRes = await plantingPlanAPI.list();
    setPlantingPlans(plansRes.data.results);
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

      await refreshWeeklyYield();
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
                  onChange={(event) => onViewModeChange(event.target.value as ViewMode)}
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
                onClick={() => onViewModeChange(mode)}
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
  ), [calendarMode, editMode, t]);

  const activeTaskGroups = calendarMode === 'occupancy' ? occupancyTaskGroups : seedlingTaskGroups;
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

  const { chartData, chartCultures, maxTotalYield } = useMemo(() => {
    const cultureMeta = new Map<number, WeeklyYieldCultureMeta>();
    const weekMap = new Map(weeklyYield.map((week) => [week.week_start, week]));
    const sortedByStart = [...weeklyYield].sort((left, right) => left.week_start.localeCompare(right.week_start));
    if (sortedByStart.length === 0) {
      return {
        chartData: [] as WeeklyYieldChartColumn[],
        chartCultures: [] as WeeklyYieldCultureMeta[],
        maxTotalYield: 0,
      };
    }

    const startDateRange = parseDateString(sortedByStart[0].week_start);
    const endDateRange = parseDateString(sortedByStart[sortedByStart.length - 1].week_start);

    const rows: WeeklyYieldChartColumn[] = [];
    const currentDate = new Date(startDateRange);
    while (currentDate <= endDateRange) {
      const weekStart = formatDateToAPI(currentDate);
      const week = weekMap.get(weekStart);
      const weekCultures = week?.cultures || [];
      const culturesForWeek = weekCultures.map((entry) => {
        if (!cultureMeta.has(entry.culture_id)) {
          cultureMeta.set(entry.culture_id, {
            id: entry.culture_id,
            name: entry.culture_name,
            color: entry.color,
          });
        }
        return entry;
      });
      const totalYield = culturesForWeek.reduce((sum, item) => sum + item.yield, 0);
      const weekStartDate = parseDateString(weekStart);
      const monthLabel = weekStartDate.toLocaleDateString('de-DE', { month: 'short' });
      const isoWeek = week?.iso_week || formatIsoWeek(weekStartDate);
      rows.push({
        isoWeek,
        weekLabel: isoWeek.split('-W')[1] ? `W${isoWeek.split('-W')[1]}` : isoWeek,
        monthLabel,
        cultures: culturesForWeek,
        totalYield,
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    const sortedCultures = [...cultureMeta.values()].sort((left, right) => left.name.localeCompare(right.name, 'de'));
    const maxYield = rows.reduce((max, row) => Math.max(max, row.totalYield), 0);

    return {
      chartData: rows,
      chartCultures: sortedCultures,
      maxTotalYield: maxYield,
    };
  }, [weeklyYield]);
  const hasYieldData = chartData.length > 0;

  useTopbarContextActions(setTopbarContextActions, viewModeActions);

  const yAxisTicks = useMemo(() => {
    const tickCount = 5;
    if (maxTotalYield <= 0) {
      return [0];
    }
    return Array.from({ length: tickCount }, (_, idx) => {
      const value = (maxTotalYield / (tickCount - 1)) * idx;
      return Number(value.toFixed(1));
    });
  }, [maxTotalYield]);


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
            <GanttRenderBoundary fallback={<Alert severity="error">{t('ganttChart:errors.render')}</Alert>}>
              <GanttChart
                key={`${calendarMode}-${ganttRenderKey}`}
                tasks={activeTaskGroups}
                locale={resolvedLocale}
                localeText={ganttLocaleText}
                viewMode={ViewMode.MONTH}
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
          </PageSurface>
        )}

        {hasCalendarRequirements && calendarMode === 'occupancy' && hasYieldData ? (
          <PageSurface variant="fullWorkspace" sx={{ mt: 3 }}>
          <Box className="gantt-container-wrapper" sx={{ p: 2, border: '1px solid', borderColor: 'surface.surfaceSoftBorder', borderRadius: 2, bgcolor: 'surface.surfaceBackground' }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              {t('ganttChart:yieldDistributionTitle')}
            </Typography>
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {chartCultures.map((culture) => (
                    <Box key={culture.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: culture.color }} />
                      <Typography variant="body2">{culture.name}</Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 1, alignItems: 'start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', height: 260, pr: 1 }}>
                      {yAxisTicks.map((tick, index) => (
                        <Typography key={`${tick}-${index}`} variant="caption" sx={{ textAlign: 'right', color: 'text.secondary' }}>
                          {tick.toFixed(1)} kg
                        </Typography>
                      ))}
                    </Box>
                    <Box sx={{ height: 44 }} />
                  </Box>

                  <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
                    <Box sx={{ width: Math.max(chartData.length * 40, 420) }}>
                      <Box sx={{ borderLeft: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', height: 260, px: 1, display: 'flex', alignItems: 'flex-end', gap: 0.75 }}>
                        {chartData.map((week) => (
                          <Box key={week.isoWeek} sx={{ width: 34, flex: '0 0 34px', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-start' }}>
                              {week.cultures.map((culture) => (
                                <Tooltip key={`${week.isoWeek}-${culture.culture_id}`} title={`${culture.culture_name}: ${culture.yield.toFixed(2)} kg`}>
                                  <Box
                                    sx={{
                                      width: '100%',
                                      height: `${maxTotalYield > 0 ? (culture.yield / maxTotalYield) * 100 : 0}%`,
                                      minHeight: culture.yield > 0 ? '2px' : 0,
                                      backgroundColor: culture.color,
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>

                      <Box sx={{ height: 44, px: 1, display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                        {chartData.map((week) => (
                          <Box key={`${week.isoWeek}-axis`} sx={{ width: 34, flex: '0 0 34px', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, lineHeight: 1.2 }}>{week.weekLabel}</Typography>
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.2 }}>{week.monthLabel}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
          </Box>
          </PageSurface>
        ) : null}
    </PageContainer>
  );
}

export default GanttChartPage;
