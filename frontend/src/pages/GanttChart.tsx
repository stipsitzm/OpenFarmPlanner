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
import { Box, Alert, Paper, FormControlLabel, Switch } from '@mui/material';
import { plantingPlanAPI, bedAPI, fieldAPI, locationAPI, cultureAPI, type PlantingPlan, type Bed, type Field, type Location, type Culture } from '../api/api';
import GanttChart, { ViewMode } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
import './GanttChart.css';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);
  
  // UI state
  const [editMode, setEditMode] = useState(false);
  
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
        
        const [locationsRes, fieldsRes, bedsRes, plansRes, culturesRes] = await Promise.all([
          locationAPI.list(),
          fieldAPI.list(),
          bedAPI.list(),
          plantingPlanAPI.list(),
          cultureAPI.list(),
        ]);
        
        setLocations(locationsRes.data.results);
        setFields(fieldsRes.data.results);
        setBeds(bedsRes.data.results);
        setPlantingPlans(plansRes.data.results);
        setCultures(culturesRes.data.results);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(t('ganttChart:errors.load'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [t]);
  
  /**
   * Get color for a culture from the cultures list
   */
  const getCultureColor = (cultureId: number, cultureName: string): string => {
    const culture = cultures.find(c => c.id === cultureId);
    return culture?.display_color || getDefaultCultureColor(cultureName);
  };
  
  /**
   * Build hierarchical task groups with tasks from planting plans
   * Uses description field to show hierarchy: "Location / Field"
   * Creates separate tasks for growth and harvest periods
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
    
    // Build hierarchy: Location -> Field -> Bed
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
          
          // Only create group if there are plans for this bed
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
                // Darken the color for harvest period by reducing brightness
                const harvestColor = baseColor.startsWith('#') 
                  ? `${baseColor}CC` // Add alpha channel for slight transparency
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
            
            // Add bed group with tasks
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
            showProgress={false}
            darkMode={false}
          />
        )}
      </Paper>
    </div>
  );
}

export default GanttChartPage;
