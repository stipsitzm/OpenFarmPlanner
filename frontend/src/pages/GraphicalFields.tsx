import { useEffect, useRef, useState } from 'react';
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
  fieldId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function GraphicalFields(): React.ReactElement {
  const { loading, error, locations, fields, beds } = useHierarchyData();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [layoutsByBed, setLayoutsByBed] = useState<Record<number, BedLayoutEntry>>({});
  const saveTimers = useRef<Record<number, number>>({});
  const stageWidth = Math.min(2200, Math.max(1200, window.innerWidth - 120));

  useEffect(() => {
    locations.forEach((location) => {
      if (!location.id) return;
      layoutAPI.listByLocation(location.id).then((response) => {
        setLayoutsByBed((prev) => {
          const next = { ...prev };
          response.data.results.forEach((layout) => {
            next[layout.bed] = layout;
          });
          return next;
        });
      }).catch((err) => {
        console.error('Failed to load bed layouts', err);
      });
    });
  }, [locations]);

  const saveLayout = (locationId: number, payload: BedLayoutEntry) => {
    if (saveTimers.current[payload.bed]) {
      window.clearTimeout(saveTimers.current[payload.bed]);
    }

    saveTimers.current[payload.bed] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, [payload]);
      } catch (err) {
        console.error('Failed to save bed layout', err);
      }
    }, 250);
  };

  if (loading) {
    return <Box p={3}><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Grafische Ansicht</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {locations.map((location) => {
        if (!location.id) return null;

        const locationFields = fields.filter((f) => f.location === location.id && f.id !== undefined);
        const padding = 20;
        let fieldY = padding;

        const fieldRects = locationFields.map((field) => {
          const fieldArea = Number(field.area_sqm ?? 1);
          const size = areaToRectSize(fieldArea, 520);
          size.width = Math.min(size.width, stageWidth - 2 * padding);
          size.height = Math.max(220, size.height + 180);

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
                      bedSizeMap.set(bed.id!, areaToRectSize(Number(bed.area_sqm ?? 1), 120));
                    });

                    const missingBeds = fieldBeds
                      .map((bed) => bed.id!)
                      .filter((bedId) => !layoutsByBed[bedId]);
                    const autoLayout = initialAutoLayout(missingBeds, bedSizeMap, { width: fieldRect.width - 20, height: fieldRect.height - 50 });

                    return (
                      <Group key={fieldId}>
                        <Rect x={fieldRect.x} y={fieldRect.y} width={fieldRect.width} height={fieldRect.height} stroke="#2f855a" strokeWidth={2} cornerRadius={4} />
                        <Text x={fieldRect.x + 8} y={fieldRect.y + 8} text={`${fieldRect.field.name} (${fieldRect.field.area_sqm ?? '-'} m²)`} fontStyle="bold" />
                        {fieldBeds.map((bed) => {
                          const bedId = bed.id!;
                          const size = bedSizeMap.get(bedId)!;
                          const saved = layoutsByBed[bedId];
                          const fallback = autoLayout.get(bedId) ?? { x: 10, y: 40 };
                          const clamped = clampInsideParent(
                            { x: saved?.x ?? fallback.x, y: saved?.y ?? fallback.y },
                            size,
                            { width: fieldRect.width - 20, height: fieldRect.height - 50 },
                          );

                          const bedVm: BedViewModel = {
                            id: bedId,
                            name: bed.name,
                            area: Number(bed.area_sqm ?? 0),
                            fieldId,
                            x: clamped.x,
                            y: clamped.y,
                            width: size.width,
                            height: size.height,
                          };

                          return (
                            <Group key={bedVm.id}>
                              <Rect
                                x={fieldRect.x + 10 + bedVm.x}
                                y={fieldRect.y + 34 + bedVm.y}
                                width={bedVm.width}
                                height={bedVm.height}
                                fill="#bee3f8"
                                stroke="#2b6cb0"
                                strokeWidth={1}
                                draggable
                                onDragEnd={(event) => {
                                  const next = clampInsideParent(
                                    { x: event.target.x() - (fieldRect.x + 10), y: event.target.y() - (fieldRect.y + 34) },
                                    { width: bedVm.width, height: bedVm.height },
                                    { width: fieldRect.width - 20, height: fieldRect.height - 50 },
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
                                x={fieldRect.x + 14 + bedVm.x}
                                y={fieldRect.y + 38 + bedVm.y}
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
