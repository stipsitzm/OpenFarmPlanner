/**
 * Gantt Chart page component for visualizing bed occupation over time.
 * 
 * Displays a timeline view of planting plans grouped by fields and beds using React-Modern-Gantt.
 * Shows planting to harvest periods as horizontal bars in a calendar grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Gantt Chart page component
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { Box, Alert, Paper, FormControlLabel, Switch, Typography } from '@mui/material';
import { plantingPlanAPI, bedAPI, fieldAPI, locationAPI, cultureAPI, yieldCalendarAPI, type PlantingPlan, type Bed, type Field, type Location, type Culture, type YieldCalendarWeek } from '../api/api';
import GanttChart, { ViewMode } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
import './GanttChart.css';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  percent?: number;
  dependencies?: string[];
  // Custom properties for our use case
  plantingPlanId?: number;
  cultureName?: string;
  areaUsage?: number;
  notes?: string;
  harvestStartDate?: Date;
  harvestEndDate?: Date;
}

interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tasks: Task[];
  // Custom properties for our use case
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  area?: number;
  isGroup?: boolean; // For hierarchy groups
  level?: number; // Hierarchy level: 0=location, 1=field, 2=bed
}

interface WeeklyYieldChartRow {
  iso_week: string;
  week_label: string;
  [key: string]: string | number;
}

interface WeeklyYieldCultureMeta {
  id: number;
  name: string;
  color: string;
  dataKey: string;
}


/**
 * Parse date string from API to local Date object
 * Date string format from API: "YYYY-MM-DD"
 */
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Generate a default color based on culture name (fallback if no display_color)
 */
function getDefaultCultureColor(cultureName: string): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];
  
  // Simple hash function to get consistent color for same culture name
  let hash = 0;
  for (let i = 0; i < cultureName.length; i++) {
    hash = cultureName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function GanttChartPage(): React.ReactElement {
  const { t } = useTranslation(['ganttChart', 'common']);
  useCommandContextTag('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);
  
  // UI state
  const [editMode, setEditMode] = useState(false);

  const calendarCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'calendar.toggleEdit',
      title: editMode ? 'Bearbeiten deaktivieren' : 'Bearbeiten aktivieren',
      keywords: ['kalender', 'bearbeiten', 'toggle'],
      shortcutHint: '—',
      contextTags: ['calendar'],
      isAvailable: () => true,
      run: () => setEditMode((value) => !value),
    },
  ], [editMode]);

  useRegisterCommands('calendar-page', calendarCommands);
  
  // Timeline configuration
  const currentYear = new Date().getFullYear();
  const [displayYear] = useState(currentYear);
  
  /**
   * Fetch all required data
   */
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
    
    fetchData();
  }, [displayYear, t]);
  
  /**
   * Format date to API format (YYYY-MM-DD)
   */
  const formatDateToAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  /**
   * Handle task updates from drag and drop
   * Only updates planting_date - backend recalculates harvest dates automatically
   */
  const handleTaskUpdate = async (_groupId: string, updatedTask: Task) => {
    try {
      // Extract the planting plan ID from the task ID
      // Format is either "plan-{id}-growth" or "plan-{id}-harvest"
      const planIdMatch = updatedTask.id.match(/^plan-(\d+)-/);
      if (!planIdMatch) {
        console.error('Could not extract plan ID from task:', updatedTask.id);
        return;
      }
      
      const planId = parseInt(planIdMatch[1], 10);
      const plan = plantingPlans.find(p => p.id === planId);
      
      if (!plan) {
        console.error('Could not find planting plan:', planId);
        return;
      }
      
      // Calculate new planting date based on which task was moved
      let newPlantingDate: string;
      const isGrowthTask = updatedTask.id.endsWith('-growth');
      
      if (isGrowthTask) {
        // Growth task moved: use the new start date as planting date
        newPlantingDate = formatDateToAPI(updatedTask.startDate);
      } else {
        // Harvest task moved: calculate backward from harvest dates
        // We need to adjust planting date to maintain the relationship
        const originalPlantingDate = parseDateString(plan.planting_date);
        const originalHarvestDate = parseDateString(plan.harvest_date!);
        const daysDifference = Math.round((originalHarvestDate.getTime() - originalPlantingDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate new planting date by going back from new harvest start
        const newPlantingDateObj = new Date(updatedTask.startDate);
        newPlantingDateObj.setDate(newPlantingDateObj.getDate() - daysDifference);
        newPlantingDate = formatDateToAPI(newPlantingDateObj);
      }
      
      // Only update planting_date - backend will recalculate harvest_date and harvest_end_date
      const updatedPlan: Partial<PlantingPlan> = {
        ...plan,
        planting_date: newPlantingDate,
      };
      
      // Send update to backend
      const response = await plantingPlanAPI.update(planId, updatedPlan as PlantingPlan);
      
      // Update local state with response from backend (includes recalculated dates)
      setPlantingPlans(prev => prev.map(p => 
        p.id === planId ? response.data : p
      ));
      
      console.log('Successfully updated planting plan:', planId, 'New planting_date:', newPlantingDate);
    } catch (err) {
      console.error('Error updating planting plan:', err);
      setError('Fehler beim Aktualisieren des Anbau plans');
    }
  };
  
  /**
   * Get color for a culture from the cultures list
   */
  const getCultureColor = (cultureId: number, cultureName: string): string => {
    const culture = cultures.find(c => c.id === cultureId);
    return culture?.display_color || getDefaultCultureColor(cultureName);
  };
  
  /**
   * Build task groups with tasks from planting plans
   * Sorted by location and field
   */
  const taskGroups = useMemo<TaskGroup[]>(() => {
    // Guard against empty or undefined data
    if (!locations.length || !fields.length || !beds.length || !plantingPlans.length) {
      return [];
    }
    
    const groups: TaskGroup[] = [];
    
    // Define visible year interval
    const visStart = new Date(displayYear, 0, 1);
    const visEnd = new Date(displayYear, 11, 31, 23, 59, 59);
    
    // Group beds by field
    const bedsByField = beds.reduce((acc, bed) => {
      if (!acc[bed.field]) {
        acc[bed.field] = [];
      }
      acc[bed.field].push(bed);
      return acc;
    }, {} as Record<number, Bed[]>);
    
    // Group fields by location
    const fieldsByLocation = fields.reduce((acc, field) => {
      if (!acc[field.location]) {
        acc[field.location] = [];
      }
      acc[field.location].push(field);
      return acc;
    }, {} as Record<number, Field[]>);
    
    // Build sorted list: Location -> Field -> Bed (no empty groups)
    locations.forEach(location => {
      const locationFields = fieldsByLocation[location.id!] || [];
      
      locationFields.forEach(field => {
        const fieldBeds = bedsByField[field.id!] || [];
        
        fieldBeds.forEach(bed => {
          // Get planting plans for this bed that overlap with display year
          const bedPlans = plantingPlans.filter(plan => {
            if (plan.bed !== bed.id) return false;
            if (!plan.planting_date || !plan.harvest_date) return false;
            
            const plantingDate = parseDateString(plan.planting_date);
            const harvestDate = parseDateString(plan.harvest_date);
            
            // Check if plan overlaps with display year
            return !(harvestDate < visStart || plantingDate > visEnd);
          });
          
          // Only add bed if it has plans
          if (bedPlans.length > 0) {
            const tasks: Task[] = [];
            
            bedPlans.forEach(plan => {
              const plantingDate = parseDateString(plan.planting_date);
              const harvestStartDate = parseDateString(plan.harvest_date!);
              
              // Get culture color
              const baseColor = getCultureColor(plan.culture, plan.culture_name || '');
              
              // Calculate harvest end date
              const harvestEndDate: Date = plan.harvest_end_date 
                ? parseDateString(plan.harvest_end_date) 
                : harvestStartDate;
              
              // Growth period task (planting to first harvest)
              tasks.push({
                id: `plan-${plan.id}-growth`,
                name: plan.culture_name || `Culture ${plan.culture}`,
                startDate: plantingDate,
                endDate: harvestStartDate,
                color: baseColor,
                percent: 100,
                plantingPlanId: plan.id,
                cultureName: plan.culture_name,
                areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
                notes: plan.notes,
                harvestStartDate,
                harvestEndDate,
              });
              
              // Harvest period task (first harvest to last harvest) - only if there's a range
              if (harvestEndDate > harvestStartDate) {
                // Use semi-transparent version for harvest
                const harvestColor = baseColor.startsWith('#') 
                  ? `${baseColor}CC` // Add alpha channel
                  : baseColor;
                
                tasks.push({
                  id: `plan-${plan.id}-harvest`,
                  name: `${plan.culture_name || `Culture ${plan.culture}`} (Ernte)`,
                  startDate: harvestStartDate,
                  endDate: harvestEndDate,
                  color: harvestColor,
                  percent: 100,
                  plantingPlanId: plan.id,
                  cultureName: plan.culture_name,
                  areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
                  notes: `Erntezeitraum: ${plan.notes || ''}`.trim(),
                  harvestStartDate,
                  harvestEndDate,
                });
              }
            });
            
            // Add bed group with tasks (no icons, no indentation)
            groups.push({
              id: `bed-${bed.id}`,
              name: bed.name,
              description: `${location.name} / ${field.name}`,
              tasks,
              locationId: location.id,
              fieldId: field.id,
              bedId: bed.id,
              area: bed.area_sqm ? Number(bed.area_sqm) : undefined,
            });
          }
        });
      });
    });
    
    return groups;
  }, [locations, fields, beds, plantingPlans, cultures, displayYear]);
  
  // Calculate start and end dates for the display year
  const startDate = useMemo(() => new Date(displayYear, 0, 1), [displayYear]);
  const endDate = useMemo(() => new Date(displayYear, 11, 31), [displayYear]);
  

  const { chartData, chartCultures } = useMemo(() => {
    const cultureMeta = new Map<number, WeeklyYieldCultureMeta>();
    const rows: WeeklyYieldChartRow[] = weeklyYield.map((week) => {
      const row: WeeklyYieldChartRow = {
        iso_week: week.iso_week,
        week_label: week.iso_week.split('-W')[1] ? `W${week.iso_week.split('-W')[1]}` : week.iso_week,
      };

      week.cultures.forEach((entry) => {
        const dataKey = `culture_${entry.culture_id}`;
        row[dataKey] = entry.yield;
        if (!cultureMeta.has(entry.culture_id)) {
          cultureMeta.set(entry.culture_id, {
            id: entry.culture_id,
            name: entry.culture_name,
            color: entry.color,
            dataKey,
          });
        }
      });

      return row;
    });

    const sortedCultures = [...cultureMeta.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { chartData: rows, chartCultures: sortedCultures };
  }, [weeklyYield]);

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
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
              color="primary"
            />
          }
          label={editMode ? "Bearbeitungsmodus" : "Ansichtsmodus"}
        />
      </Box>
      
      <Paper className="gantt-container-wrapper">
        {taskGroups.length === 0 ? (
          <div className="gantt-no-data">{t('ganttChart:noData')}</div>
        ) : (
          <GanttChart
            tasks={taskGroups}
            viewMode={ViewMode.MONTH}
            startDate={startDate}
            endDate={endDate}
            editMode={editMode}
            allowTaskResize={false}
            showProgress={false}
            darkMode={false}
            onTaskUpdate={handleTaskUpdate}
          />
        )}
      </Paper>

      <Paper className="gantt-container-wrapper" sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          Ertragsverteilung (Wochenbasis)
        </Typography>
        {chartData.length === 0 ? (
          <div className="gantt-no-data">Keine erwarteten Erträge für dieses Jahr vorhanden.</div>
        ) : (
          <Box sx={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week_label" />
                <YAxis unit=" kg" />
                <Tooltip formatter={(value: number, name: string) => [`${Number(value).toFixed(2)} kg`, chartCultures.find((culture) => culture.dataKey === name)?.name || name]} />
                <Legend formatter={(value: string) => chartCultures.find((culture) => culture.dataKey === value)?.name || value} />
                {chartCultures.map((culture) => (
                  <Bar
                    key={culture.id}
                    dataKey={culture.dataKey}
                    stackId="yield"
                    fill={culture.color}
                    name={culture.name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Paper>
    </div>
  );
}

export default GanttChartPage;
