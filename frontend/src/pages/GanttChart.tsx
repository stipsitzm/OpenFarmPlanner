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
import { Box, Alert, Paper, Tooltip, IconButton } from '@mui/material';
import { ExpandMore, ChevronRight } from '@mui/icons-material';
import { plantingPlanAPI, bedAPI, fieldAPI, locationAPI, type PlantingPlan, type Bed, type Field, type Location } from '../api/client';
import './GanttChart.css';
import { useAutosizeSidebarWidth } from '../hooks/useAutosizeSidebarWidth';

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
  leftPct: number;   // Left position as percentage of year (0-100)
  widthPct: number;  // Width as percentage of year (0-100)
  harvestStartDate?: Date;
  harvestEndDate?: Date;
  harvestLeftPct?: number;
  harvestWidthPct?: number;
}

/**
 * Helper: Clamp a date between min and max
 */
function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return new Date(date);
}

/**
 * Helper: Calculate days between two dates (exclusive end)
 * Uses UTC midnight to avoid DST issues
 */
function daysBetween(start: Date, endExclusive: Date): number {
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate());
  const days = Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Helper: Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function GanttChart(): React.ReactElement {
  const { t } = useTranslation(['ganttChart', 'common']);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
  
  // Expand/collapse state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
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
   * Initialize all rows as expanded
   */
  useEffect(() => {
    if (locations.length > 0 || fields.length > 0) {
      const initialExpanded = new Set<string>();
      locations.forEach(loc => {
        if (loc.id) initialExpanded.add(`location-${loc.id}`);
      });
      fields.forEach(field => {
        if (field.id) initialExpanded.add(`field-${field.id}`);
      });
      setExpandedRows(initialExpanded);
    }
  }, [locations, fields]);
  
  /**
   * Toggle expand/collapse state for a row
   */
  const toggleExpand = (rowId: string): void => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };
  
  /**
   * Generate timeline columns (12 months only)
   */
  const timelineColumns = useMemo(() => {
    const columns: { label: string; date: Date }[] = [];
    
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
    
    return columns;
  }, [displayYear, t]);
  
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
      
      // Only show fields if location is expanded
      if (expandedRows.has(`location-${location.id}`)) {
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
          
          // Only show beds if field is expanded
          if (expandedRows.has(`field-${field.id}`)) {
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
          }
        });
      }
    });
    
    return rows;
  }, [locations, fields, beds, plantingPlans, expandedRows]);

  /**
   * Measure the widest sidebar (including header) and set a CSS variable
   * so the first column width is consistent and fits the longest content.
   * Dependencies: only re-measure when actual data changes, NOT on expand/collapse
   */
  useAutosizeSidebarWidth(containerRef, undefined, [locations, fields, beds, displayYear]);
  
  /**
   * Calculate timeline bar position and span using year-clamping with half-open intervals
   */
  const calculateBar = (plan: PlantingPlan): TimelineBar | null => {
    if (!plan.planting_date || !plan.harvest_date || !plan.id) return null;
    
    // Parse dates as local dates to avoid timezone issues
    // Date string format from API: "YYYY-MM-DD"
    const parseDateString = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    };
    
    const startDate = parseDateString(plan.planting_date);
    const endDate = parseDateString(plan.harvest_date);
    
    // Define visible interval [visStart, visEndExclusive)
    const visStart = new Date(displayYear, 0, 1);  // Jan 1
    const visEndExclusive = new Date(displayYear + 1, 0, 1);  // Jan 1 of next year
    
    // Treat planting as [startDate, endDateExclusive) to include full end day
    const endDateExclusive = addDays(endDate, 1);
    
    // Skip if plan is completely outside the visible year
    if (endDateExclusive <= visStart || startDate >= visEndExclusive) return null;
    
    // Clamp dates to visible interval
    const s = clampDate(startDate, visStart, visEndExclusive);
    const e = clampDate(endDateExclusive, visStart, visEndExclusive);
    
    // Calculate positions using exclusive end (NO -1 adjustments)
    const totalDays = daysBetween(visStart, visEndExclusive); // 365 or 366
    const leftDays = daysBetween(visStart, s);
    const widthDays = daysBetween(s, e);
    
    // Calculate percentages
    const leftPct = (leftDays / totalDays) * 100;
    const widthPct = (widthDays / totalDays) * 100;
    
    // Calculate harvest period overlay
    let harvestStartDate: Date | undefined;
    let harvestEndDate: Date | undefined;
    let harvestLeftPct: number | undefined;
    let harvestWidthPct: number | undefined;
    
    // Only need harvest_date to exist - harvest_end_date defaults to harvest_date
    if (plan.harvest_date) {
      // Parse harvest dates from API
      harvestStartDate = parseDateString(plan.harvest_date);
      // Default to harvest_date if harvest_end_date is missing (single-day harvest window)
      harvestEndDate = plan.harvest_end_date ? parseDateString(plan.harvest_end_date) : harvestStartDate;
      
      // Treat harvest as [harvestStartDate, harvestEndDateExclusive)
      const harvestEndDateExclusive = addDays(harvestEndDate, 1);
      
      // Only calculate harvest bar if it's within the visible year
      if (!(harvestEndDateExclusive <= visStart || harvestStartDate >= visEndExclusive)) {
        const hs = clampDate(harvestStartDate, visStart, visEndExclusive);
        const he = clampDate(harvestEndDateExclusive, visStart, visEndExclusive);
        
        const harvestLeftDays = daysBetween(visStart, hs);
        const harvestWidthDays = daysBetween(hs, he);
        
        harvestLeftPct = (harvestLeftDays / totalDays) * 100;
        harvestWidthPct = Math.max(0.3, (harvestWidthDays / totalDays) * 100); // Minimum 0.3% width for visibility
      }
    }
    
    return {
      planId: plan.id,
      cultureName: plan.culture_name || '',
      startDate,
      endDate,
      areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
      notes: plan.notes,
      leftPct,
      widthPct,
      harvestStartDate,
      harvestEndDate,
      harvestLeftPct,
      harvestWidthPct,
    };
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
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                    {(row.type === 'location' || row.type === 'field') && (
                      <IconButton
                        className="gantt-expand-icon"
                        size="small"
                        onClick={() => toggleExpand(row.id)}
                        sx={{ padding: '2px', marginRight: '4px' }}
                      >
                        {expandedRows.has(row.id) ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
                      </IconButton>
                    )}
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
                                {bar.harvestStartDate && bar.harvestEndDate && (
                                  <>
                                    <div>{t('ganttChart:tooltip.firstHarvest')}: {formatDate(bar.harvestStartDate)}</div>
                                    <div>{t('ganttChart:tooltip.lastHarvest')}: {formatDate(bar.harvestEndDate)}</div>
                                  </>
                                )}
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
                                left: `${bar.leftPct}%`,
                                width: `${bar.widthPct}%`,
                                top: '4px',
                                bottom: '4px',
                              }}
                            >
                              <span className="gantt-bar-label">
                                {bar.cultureName}
                                {bar.areaUsage && ` (${bar.areaUsage}m²)`}
                              </span>
                              
                              {/* Harvest period overlay */}
                              {bar.harvestLeftPct !== undefined && bar.harvestWidthPct !== undefined && bar.widthPct > 0 && (
                                <div
                                  className="gantt-bar-harvest"
                                  style={{
                                    position: 'absolute',
                                    left: `${Math.max(0, ((bar.harvestLeftPct - bar.leftPct) / bar.widthPct) * 100)}%`,
                                    width: `${Math.min(100, (bar.harvestWidthPct / bar.widthPct) * 100)}%`,
                                    top: 0,
                                    bottom: 0,
                                  }}
                                />
                              )}
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
