/**
 * Gantt Chart page component for visualizing bed occupation over time.
 * 
 * Displays a timeline view of planting plans grouped by fields and beds.
 * Shows planting to harvest periods as horizontal bars in a calendar grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Gantt Chart page component
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../i18n';
import { Box, Alert, ToggleButton, ToggleButtonGroup, Paper, Tooltip } from '@mui/material';
import { plantingPlanAPI, bedAPI, fieldAPI, locationAPI, type PlantingPlan, type Bed, type Field, type Location } from '../api/client';
import './GanttChart.css';
import { useAutosizeSidebarWidth } from '../hooks/useAutosizeSidebarWidth';

type ViewMode = 'month' | 'week';

interface GanttRow {
  id: string;
  type: 'location' | 'field' | 'bed';
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  name: string;
  area?: number;
  level: number;
  plans: PlantingPlan[];
}

interface TimelineBar {
  planId: number;
  cultureName: string;
  startDate: Date;
  endDate: Date;
  areaUsage?: number;
  notes?: string;
  startCol: number;
  span: number;
  // Precise positioning within the grid (0-1 fractional values)
  leftOffset: number;  // Fraction of first column where bar starts (0 = start of month, 1 = end of month)
  width: number;       // Total width in columns (fractional, e.g., 2.5 means 2.5 months)
}

function GanttChart(): React.ReactElement {
  const { t } = useTranslation(['ganttChart', 'common']);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  
  // Timeline configuration
  const currentYear = new Date().getFullYear();
  const [displayYear, setDisplayYear] = useState(currentYear);
  
  /**
   * Fetch all required data
   */
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        
        const [locationsRes, fieldsRes, bedsRes, plansRes] = await Promise.all([
          locationAPI.list(),
          fieldAPI.list(),
          bedAPI.list(),
          plantingPlanAPI.list(),
        ]);
        
        setLocations(locationsRes.data.results);
        setFields(fieldsRes.data.results);
        setBeds(bedsRes.data.results);
        setPlantingPlans(plansRes.data.results);
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
   * Generate timeline columns based on view mode
   */
  const timelineColumns = useMemo(() => {
    const columns: { label: string; date: Date }[] = [];
    
    if (viewMode === 'month') {
      // 12 months
      const monthNames = [
        t('ganttChart:months.jan'), t('ganttChart:months.feb'), t('ganttChart:months.mar'),
        t('ganttChart:months.apr'), t('ganttChart:months.may'), t('ganttChart:months.jun'),
        t('ganttChart:months.jul'), t('ganttChart:months.aug'), t('ganttChart:months.sep'),
        t('ganttChart:months.oct'), t('ganttChart:months.nov'), t('ganttChart:months.dec'),
      ];
      
      for (let i = 0; i < 12; i++) {
        columns.push({
          label: monthNames[i],
          date: new Date(displayYear, i, 1),
        });
      }
    } else {
      // 52 weeks
      for (let i = 1; i <= 52; i++) {
        columns.push({
          label: `${t('ganttChart:weekShort')} ${i}`,
          date: new Date(displayYear, 0, 1 + (i - 1) * 7),
        });
      }
    }
    
    return columns;
  }, [viewMode, displayYear, t]);
  
  /**
   * Build hierarchy rows with planting plans
   */
  const ganttRows = useMemo<GanttRow[]>(() => {
    const rows: GanttRow[] = [];
    
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
    
    // Build hierarchy
    locations.forEach(location => {
      const locationFields = fieldsByLocation[location.id!] || [];
      
      // Add location row (header only)
      rows.push({
        id: `location-${location.id}`,
        type: 'location',
        locationId: location.id,
        name: location.name,
        level: 0,
        plans: [],
      });
      
      locationFields.forEach(field => {
        const fieldBeds = bedsByField[field.id!] || [];
        
        // Add field row (header only)
        rows.push({
          id: `field-${field.id}`,
          type: 'field',
          locationId: location.id,
          fieldId: field.id,
          name: field.name,
          area: field.area_sqm ? Number(field.area_sqm) : undefined,
          level: 1,
          plans: [],
        });
        
        fieldBeds.forEach(bed => {
          // Get planting plans for this bed
          const bedPlans = plantingPlans.filter(p => p.bed === bed.id);
          
          // Add bed row with plans
          rows.push({
            id: `bed-${bed.id}`,
            type: 'bed',
            locationId: location.id,
            fieldId: field.id,
            bedId: bed.id,
            name: bed.name,
            area: bed.area_sqm ? Number(bed.area_sqm) : undefined,
            level: 2,
            plans: bedPlans,
          });
        });
      });
    });
    
    return rows;
  }, [locations, fields, beds, plantingPlans]);

  /**
   * Measure the widest sidebar (including header) and set a CSS variable
   * so the first column width is consistent and fits the longest content.
   */
  useAutosizeSidebarWidth(containerRef, undefined, [loading, ganttRows, viewMode, displayYear]);
  
  /**
   * Calculate timeline bar position and span
   */
  const calculateBar = (plan: PlantingPlan): TimelineBar | null => {
    if (!plan.planting_date || !plan.harvest_date) return null;
    
    // Parse dates as local dates to avoid timezone issues
    // Date string format from API: "YYYY-MM-DD"
    const parseDateString = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    };
    
    const startDate = parseDateString(plan.planting_date);
    const endDate = parseDateString(plan.harvest_date);
    
    // Find start column
    let startCol = 0;
    let span = 0;
    let leftOffset = 0;
    let width = 0;
    
    if (viewMode === 'month') {
      // Calculate month positions with day-level precision
      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();
      const startDay = startDate.getDate();
      const endMonth = endDate.getMonth();
      const endYear = endDate.getFullYear();
      const endDay = endDate.getDate();
      
      // Only show if in the display year
      if (startYear > displayYear || endYear < displayYear) return null;
      
      // Calculate column and span (for backwards compatibility)
      if (startYear === displayYear) {
        startCol = startMonth;
      } else {
        startCol = 0;
      }
      
      if (endYear === displayYear) {
        span = endMonth - startCol + 1;
      } else if (endYear > displayYear) {
        span = 12 - startCol;
      } else {
        return null;
      }
      
      // Calculate precise positioning
      // Get days in the start month to calculate offset
      const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
      leftOffset = (startDay - 1) / daysInStartMonth; // 0-based day position (day 1 = start of month)
      
      // Calculate total width in fractional months
      let totalDays = 0;
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        totalDays++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate width more precisely by counting fractional months
      const startMonthFraction = (daysInStartMonth - startDay + 1) / daysInStartMonth;
      const endMonthDays = new Date(endYear, endMonth + 1, 0).getDate();
      const endMonthFraction = endDay / endMonthDays;
      
      // Width = fraction of start month + full months in between + fraction of end month
      const monthsBetween = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) - 1);
      width = startMonthFraction + monthsBetween + endMonthFraction;
      
    } else {
      // Calculate week positions with day-level precision
      const startWeek = getWeekNumber(startDate);
      const endWeek = getWeekNumber(endDate);
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const startDayOfWeek = startDate.getDay(); // 0-6
      const endDayOfWeek = endDate.getDay();
      
      // Only show if in the display year
      if (startYear > displayYear || endYear < displayYear) return null;
      
      if (startYear === displayYear && endYear === displayYear) {
        startCol = startWeek - 1;
        span = endWeek - startWeek + 1;
      } else if (startYear === displayYear && endYear > displayYear) {
        startCol = startWeek - 1;
        span = 52 - startCol;
      } else if (startYear < displayYear && endYear === displayYear) {
        startCol = 0;
        span = endWeek;
      } else {
        return null;
      }
      
      // Calculate precise positioning for week view
      // Week starts on Monday (1), Sunday is (0) which should be treated as 7
      const adjustedStartDay = startDayOfWeek === 0 ? 7 : startDayOfWeek;
      const adjustedEndDay = endDayOfWeek === 0 ? 7 : endDayOfWeek;
      
      leftOffset = (adjustedStartDay - 1) / 7; // Fraction of the first week
      
      // Calculate width in fractional weeks
      const daysInFirstWeek = 8 - adjustedStartDay; // Days remaining in first week (including start day)
      const daysInLastWeek = adjustedEndDay; // Days in last week
      const weeksBetween = Math.max(0, span - 2); // Full weeks between first and last
      
      width = (daysInFirstWeek / 7) + weeksBetween + (daysInLastWeek / 7);
    }
    
    if (span <= 0) return null;
    
    // Skip if plan doesn't have an ID
    if (!plan.id) return null;
    
    return {
      planId: plan.id,
      cultureName: plan.culture_name || '',
      startDate,
      endDate,
      areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
      notes: plan.notes,
      startCol,
      span,
      leftOffset,
      width,
    };
  };
  
  /**
   * Get ISO week number
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };
  
  /**
   * Format date for tooltip
   */
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('de-DE');
  };
  
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
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, newMode) => {
            if (newMode !== null) {
              setViewMode(newMode);
            }
          }}
          size="small"
        >
          <ToggleButton value="month">{t('ganttChart:viewModes.month')}</ToggleButton>
          <ToggleButton value="week">{t('ganttChart:viewModes.week')}</ToggleButton>
        </ToggleButtonGroup>
        
        <Box>
          <span style={{ marginRight: '1rem' }}>{t('ganttChart:year')}: {displayYear}</span>
          <button 
            onClick={() => setDisplayYear(displayYear - 1)}
            aria-label={t('ganttChart:previousYear')}
          >
            ◀
          </button>
          <button 
            onClick={() => setDisplayYear(currentYear)} 
            style={{ margin: '0 0.5rem' }}
            aria-label={t('ganttChart:today')}
          >
            {t('ganttChart:today')}
          </button>
          <button 
            onClick={() => setDisplayYear(displayYear + 1)}
            aria-label={t('ganttChart:nextYear')}
          >
            ▶
          </button>
        </Box>
      </Box>
      
      <Paper className="gantt-container" ref={containerRef}>
        <div className="gantt-grid">
          {/* Header row */}
          <div className="gantt-header">
            <div className="gantt-sidebar-header">
              <span className="gantt-sidebar-header-text">
                {t('ganttChart:field')} / {t('ganttChart:bed')}
              </span>
            </div>
            <div className="gantt-timeline-header">
              {timelineColumns.map((col, idx) => (
                <div key={idx} className="gantt-timeline-column-header">
                  {col.label}
                </div>
              ))}
            </div>
          </div>
          
          {/* Data rows */}
          {ganttRows.length === 0 ? (
            <div className="gantt-no-data">{t('ganttChart:noData')}</div>
          ) : (
            ganttRows.map(row => {
              const bars = row.plans.map(p => calculateBar(p)).filter(b => b !== null) as TimelineBar[];
              
              return (
                <div key={row.id} className={`gantt-row gantt-row-${row.type}`}>
                  <div className={`gantt-sidebar gantt-sidebar-level-${row.level}`}>
                    <span className="gantt-row-name">
                      {row.name}
                      {row.area != null && ` (${row.area} m²)`}
                    </span>
                  </div>
                  <div className="gantt-timeline">
                    {row.type === 'bed' && bars.length > 0 ? (
                      <div className="gantt-bars-container">
                        {bars.map((bar) => (
                          <Tooltip
                            key={bar.planId}
                            title={
                              <div>
                                <div><strong>{bar.cultureName}</strong></div>
                                <div>{t('ganttChart:tooltip.plantingDate')}: {formatDate(bar.startDate)}</div>
                                <div>{t('ganttChart:tooltip.harvestDate')}: {formatDate(bar.endDate)}</div>
                                {bar.areaUsage && (
                                  <div>{t('ganttChart:tooltip.areaUsage')}: {bar.areaUsage} m²</div>
                                )}
                                {bar.notes && <div>{bar.notes}</div>}
                              </div>
                            }
                          >
                            <div
                              className="gantt-bar"
                              style={{
                                position: 'absolute',
                                left: `${((bar.startCol + bar.leftOffset) / timelineColumns.length) * 100}%`,
                                width: `${(bar.width / timelineColumns.length) * 100}%`,
                                top: '4px',
                                bottom: '4px',
                              }}
                            >
                              <span className="gantt-bar-label">
                                {bar.cultureName}
                                {bar.areaUsage && ` (${bar.areaUsage}m²)`}
                              </span>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    ) : (
                      // Empty timeline grid for location/field rows
                      timelineColumns.map((_, idx) => (
                        <div key={idx} className="gantt-timeline-cell" />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Paper>
    </div>
  );
}

export default GanttChart;
