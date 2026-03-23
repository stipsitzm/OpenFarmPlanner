/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  Alert,
  Box,
  FormControlLabel,
  Paper,
  Switch,
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
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
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

function formatDateToAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function GanttChartPage(): React.ReactElement {
  const { t } = useTranslation(['ganttChart', 'common']);
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

    const rows: WeeklyYieldChartColumn[] = weeklyYield.map((week) => {
      const culturesForWeek = week.cultures.map((entry) => {
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
      const weekStartDate = parseDateString(week.week_start);
      const monthLabel = weekStartDate.toLocaleDateString('de-DE', { month: 'short' });

      return {
        isoWeek: week.iso_week,
        weekLabel: week.iso_week.split('-W')[1] ? `W${week.iso_week.split('-W')[1]}` : week.iso_week,
        monthLabel,
        cultures: culturesForWeek,
        totalYield,
      };
    });

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
        <h1>{t('ganttChart:title')}</h1>
        <p>{t('ganttChart:loading')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>{t('ganttChart:title')}</h1>

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
          <FormControlLabel
            control={(
              <Switch
                checked={editMode}
                onChange={(event) => setEditMode(event.target.checked)}
                color="primary"
              />
            )}
            label={editMode ? t('ganttChart:editMode') : t('ganttChart:viewMode')}
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
          <GanttChart
            tasks={activeTaskGroups}
            viewMode={ViewMode.MONTH}
            startDate={startDate}
            endDate={endDate}
            editMode={calendarMode === 'occupancy' ? editMode : false}
            allowTaskResize={false}
            allowTaskMove={calendarMode === 'occupancy'}
            showProgress={false}
            darkMode={false}
            onTaskUpdate={calendarMode === 'occupancy' ? handleTaskUpdate : undefined}
            renderTooltip={({ task }) => (calendarMode === 'seedlings'
              ? renderSeedlingTooltip({ task: task as GanttTask })
              : renderOccupancyTooltip({ task: task as GanttTask }))}
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
