/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  Alert,
  Box,
  Paper,
  Tab,
  Tabs,
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
import PageHelp from '../components/help/PageHelp';
import ModeToggle from '../components/ModeToggle';
import type { CommandSpec } from '../commands/types';
import {
  buildFieldOccupancyTaskGroups,
  buildOccupancyTooltipDetails,
  buildSeedlingTaskGroups,
  buildSeedlingTooltipDetails,
  formatSeedlingTooltipTitle,
  parseDateString,
  type GanttTask,
  type GanttTaskGroup,
} from './ganttChartUtils';

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

function formatIsoWeek(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function GanttChartPage(): React.ReactElement {
  const { t, i18n } = useTranslation(['ganttChart', 'common']);
  useCommandContextTag('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);

  const [calendarMode, setCalendarMode] = useState<CalendarMode>('occupancy');
  const [editMode, setEditMode] = useState(false);

  const calendarCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'calendar.toggleEdit',
      label: editMode ? 'Bearbeitungsmodus deaktivieren' : 'Bearbeitungsmodus aktivieren',
      group: 'navigation',
      keywords: ['kalender', 'bearbeiten', 'toggle'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['calendar'],
      isEnabled: () => calendarMode === 'occupancy',
      action: () => setEditMode((value) => !value),
    },
  ], [calendarMode, editMode]);

  useRegisterCommands('calendar-page', calendarCommands);

  const currentYear = new Date().getFullYear();
  const [displayYear] = useState(currentYear);

  useEffect(() => {
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
  }, [displayYear, t]);

  const refreshWeeklyYield = useCallback(async (): Promise<void> => {
    try {
      const weeklyYieldRes = await yieldCalendarAPI.list(displayYear);
      setWeeklyYield(weeklyYieldRes.data);
    } catch (err) {
      console.error('Error refreshing weekly yield data:', err);
    }
  }, [displayYear]);

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

      await refreshWeeklyYield();
    } catch (err) {
      console.error('Error updating planting plan:', err);
      setError(t('ganttChart:errors.updatePlan'));
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
    locations,
    fields,
    beds,
    plantingPlans,
    cultures,
    displayYear,
  }), [beds, cultures, displayYear, fields, locations, plantingPlans]);

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
    title: t('ganttChart:chartLocaleText.title'),
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

  const activeTaskGroups = calendarMode === 'occupancy' ? occupancyTaskGroups : seedlingTaskGroups;

  const renderOccupancyTooltip = useCallback(({ task }: { task: GanttTask }) => (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
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
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
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

    const sortedCultures = [...cultureMeta.values()].sort((left, right) => left.name.localeCompare(right.name));
    const maxYield = rows.reduce((max, row) => Math.max(max, row.totalYield), 0);

    return {
      chartData: rows,
      chartCultures: sortedCultures,
      maxTotalYield: maxYield,
    };
  }, [weeklyYield]);

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
      <div className="page-container">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <h1>{t('ganttChart:title')}</h1>
          <PageHelp pageKey="calendar" />
        </Box>
        <p>{t('ganttChart:loading')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <h1>{t('ganttChart:title')}</h1>
        <PageHelp pageKey="calendar" />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Tabs
          value={calendarMode}
          onChange={(_, value: CalendarMode) => setCalendarMode(value)}
          aria-label={t('ganttChart:viewSelectorAriaLabel')}
        >
          <Tab label={t('ganttChart:modes.occupancy')} value="occupancy" />
          <Tab label={t('ganttChart:modes.seedlings')} value="seedlings" />
        </Tabs>
      </Box>

      {calendarMode === 'occupancy' ? (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ModeToggle
            label={t('ganttChart:modeLabel')}
            ariaLabel={t('ganttChart:modeAriaLabel')}
            viewLabel={t('ganttChart:modeViewOption')}
            editLabel={t('ganttChart:modeEditOption')}
            value={editMode ? 'edit' : 'view'}
            onChange={(selectedMode) => setEditMode(selectedMode === 'edit')}
            fullWidth={false}
          />
        </Box>
      ) : null}

      <Paper className="gantt-container-wrapper">
        {activeTaskGroups.length === 0 ? (
          <div className="gantt-no-data">
            {calendarMode === 'occupancy'
              ? t('ganttChart:noData')
              : t('ganttChart:seedlings.emptyState')}
          </div>
        ) : (
          <GanttRenderBoundary fallback={<Alert severity="error">{t('ganttChart:errors.render')}</Alert>}>
            <GanttChart
              tasks={activeTaskGroups}
              locale={resolvedLocale}
              localeText={ganttLocaleText}
              viewMode={ViewMode.MONTH}
              startDate={startDate}
              endDate={endDate}
              editMode={calendarMode === 'occupancy' ? editMode : false}
              allowTaskResize={false}
              allowTaskMove={calendarMode === 'occupancy'}
              showProgress={false}
              darkMode={false}
              onTaskUpdate={calendarMode === 'occupancy' ? handleTaskUpdate : undefined}
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
                        {task.name}
                      </Typography>
                    </Box>
                  )
                : undefined}
            />
          </GanttRenderBoundary>
        )}
      </Paper>

      {calendarMode === 'occupancy' ? (
        <Paper className="gantt-container-wrapper" sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            {t('ganttChart:yieldDistributionTitle')}
          </Typography>
          {chartData.length === 0 ? (
            <div className="gantt-no-data">{t('ganttChart:noYieldData')}</div>
          ) : (
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
          )}
        </Paper>
      ) : null}
    </div>
  );
}

export default GanttChartPage;
