import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';
import { layoutAPI, type BedLayoutEntry } from '../api/api';
import { areaToRectSize, clampInsideParent, initialAutoLayout, type RectSize } from './graphicalLayoutUtils';

interface BedViewModel {
  id: number;
  name: string;
  area: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const VIEWPORT_PADDING = 120;
const FIELD_INNER_OFFSET_X = 10;
const FIELD_INNER_OFFSET_Y = 34;
const EXPANDED_STORAGE_KEY = 'graphicalFieldsExpandedLocations';

interface GraphicalFieldsProps {
  showTitle?: boolean;
}

export default function GraphicalFields({ showTitle = true }: GraphicalFieldsProps): React.ReactElement {
  const { loading, error, locations, fields, beds } = useHierarchyData();
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
      if (!raw) return {};
      const parsed: number[] = JSON.parse(raw);
      return parsed.reduce<Record<number, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {});
    } catch (storageError) {
      console.error('Failed to parse expanded locations state', storageError);
      return {};
    }
  });
  const [layoutsByBed, setLayoutsByBed] = useState<Record<number, BedLayoutEntry>>({});
  const [stageWidth, setStageWidth] = useState<number>(() => Math.min(2200, Math.max(1200, window.innerWidth - VIEWPORT_PADDING)));
  const saveTimers = useRef<Record<number, number>>({});

  useEffect(() => {
    const handleResize = () => {
      setStageWidth(Math.min(2200, Math.max(1200, window.innerWidth - VIEWPORT_PADDING)));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const expandedIds = Object.entries(expanded)
      .filter(([, isExpanded]) => isExpanded)
      .map(([locationId]) => Number(locationId));
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedIds));
  }, [expanded]);

  useEffect(() => {
    let active = true;
    const loadLayouts = async () => {
      const locationIds = locations.map((location) => location.id).filter((id): id is number => typeof id === 'number');
      if (locationIds.length === 0) return;

      try {
        const results = await Promise.all(locationIds.map((locationId) => layoutAPI.listByLocation(locationId)));
        if (!active) return;

        setLayoutsByBed((prev) => {
          const next = { ...prev };
          results.forEach((response) => {
            response.data.results.forEach((layout) => {
              next[layout.bed] = layout;
            });
          });
          return next;
        });
      } catch (layoutError) {
        console.error('Failed to load bed layouts', layoutError);
      }
    };

    void loadLayouts();
    return () => {
      active = false;
    };
  }, [locations]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const saveLayout = (locationId: number, payload: BedLayoutEntry) => {
    if (saveTimers.current[payload.bed]) {
      window.clearTimeout(saveTimers.current[payload.bed]);
    }

    saveTimers.current[payload.bed] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, [payload]);
      } catch (saveError) {
        console.error('Failed to save bed layout', saveError);
      }
    }, 250);
  };

  const fieldsByLocation = useMemo(() => {
    const map = new Map<number, typeof fields>();
    locations.forEach((location) => {
      if (!location.id) return;
      map.set(location.id, fields.filter((field) => field.location === location.id && field.id !== undefined));
    });
    return map;
  }, [fields, locations]);

  if (loading) {
    return <Box p={3}><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      {showTitle && <Typography variant="h4" gutterBottom>Grafische Ansicht</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      {locations.map((location) => {
        if (!location.id) return null;

        const locationFields = fieldsByLocation.get(location.id) ?? [];
        const padding = 20;
        let fieldY = padding;

        const fieldRects = locationFields.map((field) => {
          const fieldArea = Number(field.area_sqm ?? 1);
          const size = areaToRectSize(fieldArea, {
            baseWidth: 560,
            minWidth: 560,
            maxWidth: stageWidth - 2 * padding,
            minHeight: 220,
            scaleFactor: 12,
          });
          const y = fieldY;
          fieldY += size.height + 24;

          return {
            field,
            x: padding,
            y,
            width: size.width,
            height: size.height,
          };
        });

        const stageHeight = Math.max(320, fieldY + 20);

        return (
          <Accordion
            key={location.id}
            expanded={Boolean(expanded[location.id])}
            onChange={(_, isExpanded) => setExpanded((prev) => ({ ...prev, [location.id!]: isExpanded }))}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Standort: {location.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stage width={stageWidth} height={stageHeight}>
                <Layer>
                  {fieldRects.map((fieldRect) => {
                    const fieldId = fieldRect.field.id!;
                    const fieldBeds = beds.filter((bed) => bed.field === fieldId && bed.id !== undefined);
                    const bedSizeMap = new Map<number, RectSize>();
                    fieldBeds.forEach((bed) => {
                      bedSizeMap.set(bed.id!, areaToRectSize(Number(bed.area_sqm ?? 1)));
                    });

                    const missingBeds = fieldBeds
                      .map((bed) => bed.id!)
                      .filter((bedId) => !layoutsByBed[bedId]);
                    const fieldInnerSize = { width: fieldRect.width - 20, height: fieldRect.height - 50 };
                    const autoLayout = initialAutoLayout(missingBeds, bedSizeMap, fieldInnerSize);

                    return (
                      <Group key={fieldId}>
                        <Rect x={fieldRect.x} y={fieldRect.y} width={fieldRect.width} height={fieldRect.height} stroke="#2f855a" strokeWidth={2} cornerRadius={4} />
                        <Text x={fieldRect.x + 8} y={fieldRect.y + 8} text={`${fieldRect.field.name} (${fieldRect.field.area_sqm ?? '-'} m²)`} fontStyle="bold" />
                        {fieldBeds.map((bed) => {
                          const bedId = bed.id!;
                          const size = bedSizeMap.get(bedId)!;
                          const saved = layoutsByBed[bedId];
                          const fallback = autoLayout.get(bedId) ?? { x: 10, y: 40 };
                          const clamped = clampInsideParent({ x: saved?.x ?? fallback.x, y: saved?.y ?? fallback.y }, size, fieldInnerSize);

                          const bedVm: BedViewModel = {
                            id: bedId,
                            name: bed.name,
                            area: Number(bed.area_sqm ?? 0),
                            x: clamped.x,
                            y: clamped.y,
                            width: size.width,
                            height: size.height,
                          };

                          return (
                            <Group key={bedVm.id}>
                              <Rect
                                x={fieldRect.x + FIELD_INNER_OFFSET_X + bedVm.x}
                                y={fieldRect.y + FIELD_INNER_OFFSET_Y + bedVm.y}
                                width={bedVm.width}
                                height={bedVm.height}
                                fill="#bee3f8"
                                stroke="#2b6cb0"
                                strokeWidth={1}
                                draggable
                                onDragEnd={(event) => {
                                  const next = clampInsideParent(
                                    {
                                      x: event.target.x() - (fieldRect.x + FIELD_INNER_OFFSET_X),
                                      y: event.target.y() - (fieldRect.y + FIELD_INNER_OFFSET_Y),
                                    },
                                    { width: bedVm.width, height: bedVm.height },
                                    fieldInnerSize,
                                  );

                                  const nextLayout: BedLayoutEntry = {
                                    bed: bedVm.id,
                                    location: location.id!,
                                    x: next.x,
                                    y: next.y,
                                    version: 1,
                                  };

                                  setLayoutsByBed((prev) => ({ ...prev, [bedVm.id]: nextLayout }));
                                  saveLayout(location.id!, nextLayout);
                                }}
                              />
                              <Text
                                x={fieldRect.x + FIELD_INNER_OFFSET_X + 4 + bedVm.x}
                                y={fieldRect.y + FIELD_INNER_OFFSET_Y + 4 + bedVm.y}
                                text={`${bedVm.name} (${bedVm.area || '-'} m²)`}
                                fontSize={12}
                                width={Math.max(40, bedVm.width - 8)}
                                wrap="word"
                              />
                            </Group>
                          );
                        })}
                      </Group>
                    );
                  })}
                </Layer>
              </Stage>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
