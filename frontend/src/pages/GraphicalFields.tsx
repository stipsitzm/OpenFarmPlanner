import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';
import { layoutAPI, type BedLayoutEntry, type FieldLayoutEntry } from '../api/api';
import { clampInsideParent, getBedRectSize, getFieldRectSize, initialAutoLayout, type RectSize } from './graphicalLayoutUtils';

interface Point {
  x: number;
  y: number;
}

interface SnapSize {
  width: number;
  height: number;
}

interface RectViewModel {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BedViewModel extends RectViewModel {
  id: number;
  name: string;
  area: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GuideLine {
  orientation: 'vertical' | 'horizontal';
  value: number;
  start: number;
  end: number;
}

interface SnapResult {
  x: number;
  y: number;
  guides: GuideLine[];
}

const VIEWPORT_PADDING = 120;
const FIELD_INNER_OFFSET_X = 10;
const FIELD_INNER_OFFSET_Y = 34;
const SNAP_THRESHOLD = 8;
const FIELD_SNAP_THRESHOLD = 14;
const EXPANDED_STORAGE_KEY = 'graphicalFieldsExpandedLocations';

interface GraphicalFieldsProps {
  showTitle?: boolean;
}

const snapToNeighbors = (
  currentId: number,
  position: Point,
  size: SnapSize,
  neighbors: RectViewModel[],
  threshold: number = SNAP_THRESHOLD
): SnapResult => {
  let snappedX = position.x;
  let snappedY = position.y;
  let bestXDelta = threshold + 1;
  let bestYDelta = threshold + 1;
  const guides: GuideLine[] = [];

  const currentXPoints = [
    { key: 'left', value: position.x },
    { key: 'centerX', value: position.x + (size.width / 2) },
    { key: 'right', value: position.x + size.width },
  ];
  const currentYPoints = [
    { key: 'top', value: position.y },
    { key: 'centerY', value: position.y + (size.height / 2) },
    { key: 'bottom', value: position.y + size.height },
  ];

  neighbors
    .filter((neighbor) => neighbor.id !== currentId)
    .forEach((neighbor) => {
      const neighborXPoints = [
        { key: 'left', value: neighbor.x },
        { key: 'centerX', value: neighbor.x + (neighbor.width / 2) },
        { key: 'right', value: neighbor.x + neighbor.width },
      ];
      const neighborYPoints = [
        { key: 'top', value: neighbor.y },
        { key: 'centerY', value: neighbor.y + (neighbor.height / 2) },
        { key: 'bottom', value: neighbor.y + neighbor.height },
      ];

      currentXPoints.forEach((currentPoint) => {
        neighborXPoints.forEach((neighborPoint) => {
          const delta = neighborPoint.value - currentPoint.value;
          const absDelta = Math.abs(delta);
          if (absDelta <= threshold && absDelta < bestXDelta) {
            bestXDelta = absDelta;
            snappedX = position.x + delta;
            guides.push({
              orientation: 'vertical',
              value: neighborPoint.value,
              start: Math.min(position.y, neighbor.y),
              end: Math.max(position.y + size.height, neighbor.y + neighbor.height),
            });
          }
        });
      });

      currentYPoints.forEach((currentPoint) => {
        neighborYPoints.forEach((neighborPoint) => {
          const delta = neighborPoint.value - currentPoint.value;
          const absDelta = Math.abs(delta);
          if (absDelta <= threshold && absDelta < bestYDelta) {
            bestYDelta = absDelta;
            snappedY = position.y + delta;
            guides.push({
              orientation: 'horizontal',
              value: neighborPoint.value,
              start: Math.min(position.x, neighbor.x),
              end: Math.max(position.x + size.width, neighbor.x + neighbor.width),
            });
          }
        });
      });
    });

  const latestVerticalGuide = [...guides].reverse().find((guide) => guide.orientation === 'vertical');
  const latestHorizontalGuide = [...guides].reverse().find((guide) => guide.orientation === 'horizontal');

  return {
    x: snappedX,
    y: snappedY,
    guides: [
      ...(latestVerticalGuide ? [latestVerticalGuide] : []),
      ...(latestHorizontalGuide ? [latestHorizontalGuide] : []),
    ],
  };
};

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
  const [layoutsByField, setLayoutsByField] = useState<Record<number, FieldLayoutEntry>>({});
  const [stageWidth, setStageWidth] = useState<number>(() => Math.min(2200, Math.max(1200, window.innerWidth - VIEWPORT_PADDING)));
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const saveTimers = useRef<Record<string, number>>({});

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
            response.data.bed_layouts.forEach((layout) => {
              next[layout.bed] = layout;
            });
          });
          return next;
        });

        setLayoutsByField((prev) => {
          const next = { ...prev };
          results.forEach((response) => {
            response.data.field_layouts.forEach((layout) => {
              next[layout.field] = layout;
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

  const saveBedLayout = (locationId: number, payload: BedLayoutEntry) => {
    const timerKey = `bed-${payload.bed}`;
    if (saveTimers.current[timerKey]) {
      window.clearTimeout(saveTimers.current[timerKey]);
    }

    saveTimers.current[timerKey] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, { bed_layouts: [payload], field_layouts: [] });
      } catch (saveError) {
        console.error('Failed to save bed layout', saveError);
      }
    }, 250);
  };

  const saveFieldLayout = (locationId: number, payload: FieldLayoutEntry) => {
    const timerKey = `field-${payload.field}`;
    if (saveTimers.current[timerKey]) {
      window.clearTimeout(saveTimers.current[timerKey]);
    }

    saveTimers.current[timerKey] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, { bed_layouts: [], field_layouts: [payload] });
      } catch (saveError) {
        console.error('Failed to save field layout', saveError);
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

        const defaultFieldRects = locationFields.map((field) => {
          const fieldArea = Number(field.area_sqm ?? 1);
          const fieldPxPerMeter = Math.max(12, Math.min(30, (stageWidth - 2 * padding) / 40));
          const size = getFieldRectSize(field, fieldPxPerMeter, {
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
            width: size.width,
            height: size.height,
            defaultX: padding,
            defaultY: y,
          };
        });

        const stageHeight = Math.max(320, fieldY + 20);

        const fieldViewModels: RectViewModel[] = defaultFieldRects.map((baseRect) => {
          const fieldId = baseRect.field.id!;
          const savedFieldLayout = layoutsByField[fieldId];
          const clamped = clampInsideParent(
            {
              x: savedFieldLayout?.x ?? baseRect.defaultX,
              y: savedFieldLayout?.y ?? baseRect.defaultY,
            },
            { width: baseRect.width, height: baseRect.height },
            { width: stageWidth, height: stageHeight },
          );

          return {
            id: fieldId,
            x: clamped.x,
            y: clamped.y,
            width: baseRect.width,
            height: baseRect.height,
          };
        });

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
                  {defaultFieldRects.map((baseRect) => {
                    const fieldId = baseRect.field.id!;
                    const currentFieldRect = fieldViewModels.find((fieldRect) => fieldRect.id === fieldId);
                    if (!currentFieldRect) {
                      return null;
                    }
                    const fieldClamped = { x: currentFieldRect.x, y: currentFieldRect.y };

                    const fieldBeds = beds.filter((bed) => bed.field === fieldId && bed.id !== undefined);
                    const bedSizeMap = new Map<number, RectSize>();
                    const pxPerMeter = Math.max(10, Math.min(36, (baseRect.width - 20) / 40));
                    fieldBeds.forEach((bed) => {
                      bedSizeMap.set(bed.id!, getBedRectSize(bed, pxPerMeter));
                    });

                    const missingBeds = fieldBeds
                      .map((bed) => bed.id!)
                      .filter((bedId) => !layoutsByBed[bedId]);
                    const fieldInnerSize = { width: baseRect.width - 20, height: baseRect.height - 50 };
                    const autoLayout = initialAutoLayout(missingBeds, bedSizeMap, fieldInnerSize);

                    const bedViewModels: BedViewModel[] = fieldBeds.map((bed) => {
                      const bedId = bed.id!;
                      const size = bedSizeMap.get(bedId)!;
                      const saved = layoutsByBed[bedId];
                      const fallback = autoLayout.get(bedId) ?? { x: 10, y: 40 };
                      const clamped = clampInsideParent({ x: saved?.x ?? fallback.x, y: saved?.y ?? fallback.y }, size, fieldInnerSize);
                      return {
                        id: bedId,
                        name: bed.name,
                        area: Number(bed.area_sqm ?? 0),
                        x: clamped.x,
                        y: clamped.y,
                        width: size.width,
                        height: size.height,
                      };
                    });

                    return (
                      <Group key={fieldId}>
                        <Rect
                          x={fieldClamped.x}
                          y={fieldClamped.y}
                          width={baseRect.width}
                          height={baseRect.height}
                          stroke="#2f855a"
                          strokeWidth={2}
                          cornerRadius={4}
                          draggable
                          onDragMove={(event: KonvaEventObject<Event>) => {
                            const raw = { x: event.target.x(), y: event.target.y() };
                            const clampedRaw = clampInsideParent(
                              raw,
                              { width: baseRect.width, height: baseRect.height },
                              { width: stageWidth, height: stageHeight },
                            );
                            const snapped = snapToNeighbors(
                              fieldId,
                              clampedRaw,
                              { width: baseRect.width, height: baseRect.height },
                              fieldViewModels,
                              FIELD_SNAP_THRESHOLD,
                            );
                            const finalClamped = clampInsideParent(
                              { x: snapped.x, y: snapped.y },
                              { width: baseRect.width, height: baseRect.height },
                              { width: stageWidth, height: stageHeight },
                            );

                            event.target.position({ x: finalClamped.x, y: finalClamped.y });
                            setActiveGuides(snapped.guides);
                          }}
                          onDragEnd={(event: KonvaEventObject<Event>) => {
                            const next = clampInsideParent(
                              { x: event.target.x(), y: event.target.y() },
                              { width: baseRect.width, height: baseRect.height },
                              { width: stageWidth, height: stageHeight },
                            );
                            const snapped = snapToNeighbors(
                              fieldId,
                              next,
                              { width: baseRect.width, height: baseRect.height },
                              fieldViewModels,
                              FIELD_SNAP_THRESHOLD,
                            );
                            const finalClamped = clampInsideParent(
                              { x: snapped.x, y: snapped.y },
                              { width: baseRect.width, height: baseRect.height },
                              { width: stageWidth, height: stageHeight },
                            );

                            event.target.position({ x: finalClamped.x, y: finalClamped.y });

                            const nextLayout: FieldLayoutEntry = {
                              field: fieldId,
                              location: location.id!,
                              x: finalClamped.x,
                              y: finalClamped.y,
                              version: 1,
                            };

                            setActiveGuides([]);
                            setLayoutsByField((prev) => ({ ...prev, [fieldId]: nextLayout }));
                            saveFieldLayout(location.id!, nextLayout);
                          }}
                        />
                        <Text x={fieldClamped.x + 8} y={fieldClamped.y + 8} text={`${baseRect.field.name} (${baseRect.field.area_sqm ?? '-'} m²)`} fontStyle="bold" listening={false} />
                        {bedViewModels.map((bedVm) => (
                          <Group key={bedVm.id}>
                            <Rect
                              x={fieldClamped.x + FIELD_INNER_OFFSET_X + bedVm.x}
                              y={fieldClamped.y + FIELD_INNER_OFFSET_Y + bedVm.y}
                              width={bedVm.width}
                              height={bedVm.height}
                              fill="#bee3f8"
                              stroke="#2b6cb0"
                              strokeWidth={1}
                              draggable
                              onDragMove={(event: KonvaEventObject<Event>) => {
                                const raw = {
                                  x: event.target.x() - (fieldClamped.x + FIELD_INNER_OFFSET_X),
                                  y: event.target.y() - (fieldClamped.y + FIELD_INNER_OFFSET_Y),
                                };
                                const clampedRaw = clampInsideParent(raw, { width: bedVm.width, height: bedVm.height }, fieldInnerSize);
                                const snapped = snapToNeighbors(
                                  bedVm.id,
                                  clampedRaw,
                                  { width: bedVm.width, height: bedVm.height },
                                  bedViewModels,
                                );
                                const finalClamped = clampInsideParent(
                                  { x: snapped.x, y: snapped.y },
                                  { width: bedVm.width, height: bedVm.height },
                                  fieldInnerSize,
                                );

                                event.target.position({
                                  x: fieldClamped.x + FIELD_INNER_OFFSET_X + finalClamped.x,
                                  y: fieldClamped.y + FIELD_INNER_OFFSET_Y + finalClamped.y,
                                });

                                setActiveGuides(
                                  snapped.guides.map((guide) => ({
                                    ...guide,
                                    value: guide.orientation === 'vertical'
                                      ? fieldClamped.x + FIELD_INNER_OFFSET_X + guide.value
                                      : fieldClamped.y + FIELD_INNER_OFFSET_Y + guide.value,
                                    start: guide.orientation === 'vertical'
                                      ? fieldClamped.y + FIELD_INNER_OFFSET_Y + guide.start
                                      : fieldClamped.x + FIELD_INNER_OFFSET_X + guide.start,
                                    end: guide.orientation === 'vertical'
                                      ? fieldClamped.y + FIELD_INNER_OFFSET_Y + guide.end
                                      : fieldClamped.x + FIELD_INNER_OFFSET_X + guide.end,
                                  })),
                                );
                              }}
                              onDragEnd={(event: KonvaEventObject<Event>) => {
                                const next = clampInsideParent(
                                  {
                                    x: event.target.x() - (fieldClamped.x + FIELD_INNER_OFFSET_X),
                                    y: event.target.y() - (fieldClamped.y + FIELD_INNER_OFFSET_Y),
                                  },
                                  { width: bedVm.width, height: bedVm.height },
                                  fieldInnerSize,
                                );
                                const snapped = snapToNeighbors(
                                  bedVm.id,
                                  next,
                                  { width: bedVm.width, height: bedVm.height },
                                  bedViewModels,
                                );
                                const finalClamped = clampInsideParent(
                                  { x: snapped.x, y: snapped.y },
                                  { width: bedVm.width, height: bedVm.height },
                                  fieldInnerSize,
                                );

                                event.target.position({
                                  x: fieldClamped.x + FIELD_INNER_OFFSET_X + finalClamped.x,
                                  y: fieldClamped.y + FIELD_INNER_OFFSET_Y + finalClamped.y,
                                });

                                const nextLayout: BedLayoutEntry = {
                                  bed: bedVm.id,
                                  location: location.id!,
                                  x: finalClamped.x,
                                  y: finalClamped.y,
                                  version: 1,
                                };

                                setActiveGuides([]);
                                setLayoutsByBed((prev) => ({ ...prev, [bedVm.id]: nextLayout }));
                                saveBedLayout(location.id!, nextLayout);
                              }}
                            />
                            <Text
                              x={fieldClamped.x + FIELD_INNER_OFFSET_X + 4 + bedVm.x}
                              y={fieldClamped.y + FIELD_INNER_OFFSET_Y + 4 + bedVm.y}
                              text={`${bedVm.name} (${bedVm.area || '-'} m²)`}
                              fontSize={12}
                              width={Math.max(40, bedVm.width - 8)}
                              wrap="word"
                              listening={false}
                            />
                          </Group>
                        ))}
                      </Group>
                    );
                  })}

                  {activeGuides.map((guide, index) => (
                    <Rect
                      key={`${guide.orientation}-${guide.value}-${index}`}
                      x={guide.orientation === 'vertical' ? guide.value - 0.75 : guide.start}
                      y={guide.orientation === 'vertical' ? guide.start : guide.value - 0.75}
                      width={guide.orientation === 'vertical' ? 1.5 : Math.max(1, guide.end - guide.start)}
                      height={guide.orientation === 'vertical' ? Math.max(1, guide.end - guide.start) : 1.5}
                      fill="#e53e3e"
                      opacity={0.8}
                    />
                  ))}
                </Layer>
              </Stage>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
