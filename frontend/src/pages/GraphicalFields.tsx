import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useHierarchyData } from "../components/hierarchy/hooks/useHierarchyData";
import {
  layoutAPI,
  type BedLayoutEntry,
  type FieldLayoutEntry,
} from "../api/api";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTranslation } from "../i18n";
import {
  clampInsideParent,
  getBedRectSizeWithinField,
  getFieldRectSize,
  initialAutoLayout,
  type RectSize,
} from "./graphicalLayoutUtils";
import {
  fitContentToStage,
  getVisibleElements,
  panViewport,
  shouldShowBedLabel,
  shouldShowFieldLabel,
  startPanSession,
  type PanSession,
  type ViewportState,
  zoomAroundPoint,
} from "./graphicalViewport";

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
}

interface GuideLine {
  orientation: "vertical" | "horizontal";
  value: number;
  start: number;
  end: number;
}

interface SnapResult {
  x: number;
  y: number;
  guides: GuideLine[];
}

interface SelectedElement {
  type: "field" | "bed";
  name: string;
  area: number | null;
  locationName: string;
  parentName?: string;
}

interface GraphicalFieldsProps {
  showTitle?: boolean;
}

type InteractionMode = "view" | "edit";

const VIEWPORT_PADDING = 24;
const FIELD_INNER_OFFSET_X = 10;
const FIELD_LABEL_HEIGHT = 24;
const FIELD_INNER_OFFSET_Y = FIELD_INNER_OFFSET_X + FIELD_LABEL_HEIGHT;
const FIELD_INNER_BOTTOM_PADDING = FIELD_INNER_OFFSET_X;
const SNAP_THRESHOLD = 8;
const FIELD_SNAP_THRESHOLD = 14;
const EXPANDED_STORAGE_KEY = "graphicalFieldsExpandedLocations";
const DEFAULT_STAGE_HEIGHT = 420;
const MIN_STAGE_HEIGHT = 320;
const MAX_STAGE_HEIGHT = 560;
const ZOOM_STEP = 1.2;

const snapToNeighbors = (
  currentId: number,
  position: Point,
  size: SnapSize,
  neighbors: RectViewModel[],
  threshold: number = SNAP_THRESHOLD,
): SnapResult => {
  let snappedX = position.x;
  let snappedY = position.y;
  let bestXDelta = threshold + 1;
  let bestYDelta = threshold + 1;
  const guides: GuideLine[] = [];

  const currentXPoints = [
    { value: position.x },
    { value: position.x + size.width / 2 },
    { value: position.x + size.width },
  ];
  const currentYPoints = [
    { value: position.y },
    { value: position.y + size.height / 2 },
    { value: position.y + size.height },
  ];

  neighbors
    .filter((neighbor) => neighbor.id !== currentId)
    .forEach((neighbor) => {
      const neighborXPoints = [
        { value: neighbor.x },
        { value: neighbor.x + neighbor.width / 2 },
        { value: neighbor.x + neighbor.width },
      ];
      const neighborYPoints = [
        { value: neighbor.y },
        { value: neighbor.y + neighbor.height / 2 },
        { value: neighbor.y + neighbor.height },
      ];

      currentXPoints.forEach((currentPoint) => {
        neighborXPoints.forEach((neighborPoint) => {
          const delta = neighborPoint.value - currentPoint.value;
          const absDelta = Math.abs(delta);
          if (absDelta <= threshold && absDelta < bestXDelta) {
            bestXDelta = absDelta;
            snappedX = position.x + delta;
            guides.push({
              orientation: "vertical",
              value: neighborPoint.value,
              start: Math.min(position.y, neighbor.y),
              end: Math.max(
                position.y + size.height,
                neighbor.y + neighbor.height,
              ),
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
              orientation: "horizontal",
              value: neighborPoint.value,
              start: Math.min(position.x, neighbor.x),
              end: Math.max(
                position.x + size.width,
                neighbor.x + neighbor.width,
              ),
            });
          }
        });
      });
    });

  const latestVerticalGuide = [...guides]
    .reverse()
    .find((guide) => guide.orientation === "vertical");
  const latestHorizontalGuide = [...guides]
    .reverse()
    .find((guide) => guide.orientation === "horizontal");

  return {
    x: snappedX,
    y: snappedY,
    guides: [
      ...(latestVerticalGuide ? [latestVerticalGuide] : []),
      ...(latestHorizontalGuide ? [latestHorizontalGuide] : []),
    ],
  };
};

export default function GraphicalFields({
  showTitle = true,
}: GraphicalFieldsProps): React.ReactElement {
  const { t } = useTranslation(["fields", "common"]);
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
      console.error("Failed to parse expanded locations state", storageError);
      return {};
    }
  });
  const [layoutsByBed, setLayoutsByBed] = useState<
    Record<number, BedLayoutEntry>
  >({});
  const [layoutsByField, setLayoutsByField] = useState<
    Record<number, FieldLayoutEntry>
  >({});
  const [stageWidth, setStageWidth] = useState<number>(() =>
    Math.max(320, window.innerWidth - 48),
  );
  const [stageHeight, setStageHeight] = useState<number>(() =>
    Math.max(
      MIN_STAGE_HEIGHT,
      Math.min(MAX_STAGE_HEIGHT, Math.round(window.innerHeight * 0.45)),
    ),
  );
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("view");
  const [viewportByLocation, setViewportByLocation] = useState<
    Record<number, ViewportState>
  >({});
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRefs = useRef<Record<number, Konva.Stage | null>>({});
  const saveTimers = useRef<Record<string, number>>({});
  const panSessionRef = useRef<Record<number, PanSession | null>>({});
  const pinchStateRef = useRef<
    Record<number, { distance: number; center: Point } | null>
  >({});
  const resetTransientInteractionState = (): void => {
    setActiveGuides([]);
    Object.keys(panSessionRef.current).forEach((key) => {
      panSessionRef.current[Number(key)] = null;
    });
    Object.keys(pinchStateRef.current).forEach((key) => {
      pinchStateRef.current[Number(key)] = null;
    });
  };

  const stopKonvaDragging = (): void => {
    Object.values(stageRefs.current).forEach((stage) => {
      stage?.stopDrag?.();
      stage?.find?.(".graphical-editable").forEach((node: Konva.Node) => {
        node.stopDrag?.();
      });
      stage?.batchDraw?.();
    });
  };

  useEffect(() => {
    const handleResize = (): void => {
      const containerWidth =
        containerRef.current?.clientWidth ?? window.innerWidth;
      setStageWidth(Math.max(320, Math.round(containerWidth - 8)));
      setStageHeight(
        Math.max(
          MIN_STAGE_HEIGHT,
          Math.min(MAX_STAGE_HEIGHT, Math.round(window.innerHeight * 0.45)),
        ),
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const expandedIds = Object.entries(expanded)
      .filter(([, isExpanded]) => isExpanded)
      .map(([locationId]) => Number(locationId));
    window.localStorage.setItem(
      EXPANDED_STORAGE_KEY,
      JSON.stringify(expandedIds),
    );
  }, [expanded]);

  useEffect(() => {
    let active = true;
    const loadLayouts = async (): Promise<void> => {
      const locationIds = locations
        .map((location) => location.id)
        .filter((id): id is number => typeof id === "number");
      if (locationIds.length === 0) return;

      try {
        const results = await Promise.all(
          locationIds.map((locationId) => layoutAPI.listByLocation(locationId)),
        );
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
        console.error("Failed to load bed layouts", layoutError);
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

  useEffect(() => {
    resetTransientInteractionState();
    if (interactionMode === "view") {
      stopKonvaDragging();
    }
  }, [interactionMode]);

  useKeyboardShortcuts(
    [
      {
        id: "graphical-fields.toggle-edit-mode",
        title: t("fields:graphical.editMode"),
        keys: { alt: true, key: "e" },
        contexts: [],
        action: () => {
          setInteractionMode((previous) =>
            previous === "edit" ? "view" : "edit",
          );
        },
      },
    ],
    true,
    { currentContexts: [] },
  );

  const saveBedLayout = (locationId: number, payload: BedLayoutEntry): void => {
    const timerKey = `bed-${payload.bed}`;
    if (saveTimers.current[timerKey]) {
      window.clearTimeout(saveTimers.current[timerKey]);
    }

    saveTimers.current[timerKey] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, {
          bed_layouts: [payload],
          field_layouts: [],
        });
      } catch (saveError) {
        console.error("Failed to save bed layout", saveError);
      }
    }, 250);
  };

  const saveFieldLayout = (
    locationId: number,
    payload: FieldLayoutEntry,
  ): void => {
    const timerKey = `field-${payload.field}`;
    if (saveTimers.current[timerKey]) {
      window.clearTimeout(saveTimers.current[timerKey]);
    }

    saveTimers.current[timerKey] = window.setTimeout(async () => {
      try {
        await layoutAPI.saveByLocation(locationId, {
          bed_layouts: [],
          field_layouts: [payload],
        });
      } catch (saveError) {
        console.error("Failed to save field layout", saveError);
      }
    }, 250);
  };

  const fieldsByLocation = useMemo(() => {
    const map = new Map<number, typeof fields>();
    locations.forEach((location) => {
      if (!location.id) return;
      map.set(
        location.id,
        fields.filter(
          (field) => field.location === location.id && field.id !== undefined,
        ),
      );
    });
    return map;
  }, [fields, locations]);

  const locationLayouts = useMemo(() => {
    return locations.flatMap((location) => {
      if (!location.id) return [];
      const locationFields = fieldsByLocation.get(location.id) ?? [];
      const padding = 20;
      let fieldY = padding;

      const defaultFieldRects = locationFields.map((field) => {
        const fieldPxPerMeter = Math.max(
          12,
          Math.min(30, (stageWidth - 2 * padding) / 40),
        );
        const size = getFieldRectSize(field, fieldPxPerMeter, {
          baseWidth: 560,
          minWidth: 560,
          maxWidth: Math.max(560, stageWidth - 2 * padding),
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

      const contentHeight = Math.max(DEFAULT_STAGE_HEIGHT, fieldY + 20);
      const contentWidth = Math.max(
        stageWidth,
        ...defaultFieldRects.map(
          (rect) => rect.width + rect.defaultX + padding,
        ),
      );
      const fieldViewModels: RectViewModel[] = defaultFieldRects.map(
        (baseRect) => {
          const fieldId = baseRect.field.id!;
          const savedFieldLayout = layoutsByField[fieldId];
          const clamped = clampInsideParent(
            {
              x: savedFieldLayout?.x ?? baseRect.defaultX,
              y: savedFieldLayout?.y ?? baseRect.defaultY,
            },
            { width: baseRect.width, height: baseRect.height },
            { width: contentWidth, height: contentHeight },
          );

          return {
            id: fieldId,
            x: clamped.x,
            y: clamped.y,
            width: baseRect.width,
            height: baseRect.height,
          };
        },
      );

      return [
        {
          location,
          defaultFieldRects,
          fieldViewModels,
          contentWidth,
          contentHeight,
        },
      ];
    });
  }, [fieldsByLocation, layoutsByField, locations, stageWidth]);

  const resetViewport = (locationId: number): void => {
    const layout = locationLayouts.find(
      (item) => item.location.id === locationId,
    );
    if (!layout) {
      return;
    }

    setViewportByLocation((prev) => ({
      ...prev,
      [locationId]: fitContentToStage(
        { width: layout.contentWidth, height: layout.contentHeight },
        { width: stageWidth, height: stageHeight },
        VIEWPORT_PADDING,
      ),
    }));
  };

  useEffect(() => {
    setViewportByLocation((prev) => {
      const next = { ...prev };
      locationLayouts.forEach((layout) => {
        const locationId = layout.location.id;
        if (!locationId || next[locationId]) {
          return;
        }
        next[locationId] = fitContentToStage(
          { width: layout.contentWidth, height: layout.contentHeight },
          { width: stageWidth, height: stageHeight },
          VIEWPORT_PADDING,
        );
      });
      return next;
    });
  }, [locationLayouts, stageHeight, stageWidth]);

  const updateViewport = (
    locationId: number,
    updater: (current: ViewportState) => ViewportState,
  ): void => {
    setViewportByLocation((prev) => {
      const current =
        prev[locationId] ??
        fitContentToStage(
          { width: stageWidth, height: stageHeight },
          { width: stageWidth, height: stageHeight },
          VIEWPORT_PADDING,
        );
      return { ...prev, [locationId]: updater(current) };
    });
  };

  const handleZoom = (locationId: number, factor: number): void => {
    updateViewport(locationId, (current) =>
      zoomAroundPoint(current, current.scale * factor, {
        x: stageWidth / 2,
        y: stageHeight / 2,
      }),
    );
  };

  const handleStageWheel = (
    locationId: number,
    event: KonvaEventObject<WheelEvent>,
  ): void => {
    event.evt.preventDefault();
    const pointer = stageRefs.current[locationId]?.getPointerPosition();
    if (!pointer) {
      return;
    }
    const direction = event.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    updateViewport(locationId, (current) =>
      zoomAroundPoint(current, current.scale * direction, pointer),
    );
  };

  const handleStageDoubleTap = (locationId: number): void => {
    handleZoom(locationId, ZOOM_STEP);
  };

  const handleStageDragStart = (
    locationId: number,
    viewport: ViewportState,
  ): void => {
    if (interactionMode !== "view") {
      return;
    }

    const pointer = stageRefs.current[locationId]?.getPointerPosition();
    if (!pointer) {
      return;
    }

    panSessionRef.current[locationId] = startPanSession(viewport, pointer);
  };

  const handleStageDragMove = (
    locationId: number,
    viewport: ViewportState,
    event: KonvaEventObject<DragEvent>,
  ): void => {
    const stage = stageRefs.current[locationId];
    const panSession = panSessionRef.current[locationId];
    const pointer = stage?.getPointerPosition();
    if (!stage || !panSession || !pointer || interactionMode !== "view") {
      return;
    }

    const nextViewport = panViewport(panSession, pointer, viewport.scale);
    event.target.position({ x: nextViewport.x, y: nextViewport.y });
    setViewportByLocation((prev) => ({ ...prev, [locationId]: nextViewport }));
  };

  const handleStageDragEnd = (
    locationId: number,
    viewport: ViewportState,
    event: KonvaEventObject<DragEvent>,
  ): void => {
    handleStageDragMove(locationId, viewport, event);
    panSessionRef.current[locationId] = null;
  };

  const handleStageTouchMove = (
    locationId: number,
    event: KonvaEventObject<TouchEvent>,
  ): void => {
    const stage = stageRefs.current[locationId];
    const touches = event.evt.touches;
    if (!stage || touches.length !== 2) {
      pinchStateRef.current[locationId] = null;
      return;
    }

    event.evt.preventDefault();
    const first = touches[0];
    const second = touches[1];
    const center = {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    };
    const distance = Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );
    const lastPinch = pinchStateRef.current[locationId];

    if (!lastPinch) {
      pinchStateRef.current[locationId] = { center, distance };
      return;
    }

    const scaleFactor = distance / Math.max(lastPinch.distance, 1);
    updateViewport(locationId, (current) => {
      const zoomed = zoomAroundPoint(
        current,
        current.scale * scaleFactor,
        center,
      );
      return {
        ...zoomed,
        x: zoomed.x + (center.x - lastPinch.center.x),
        y: zoomed.y + (center.y - lastPinch.center.y),
      };
    });

    pinchStateRef.current[locationId] = { center, distance };
  };

  const getFieldInteractionProps = (
    fieldId: number,
    baseRect: (typeof locationLayouts)[number]["defaultFieldRects"][number],
    contentBounds: { width: number; height: number },
    fieldViewModels: RectViewModel[],
    locationName: string,
    locationId: number,
  ) => {
    if (interactionMode === "view") {
      return {
        draggable: false,
        onClick: () => {
          setSelectedElement({
            type: "field",
            name: baseRect.field.name,
            area: Number(baseRect.field.area_sqm ?? 0),
            locationName,
          });
        },
        onTap: () => {
          setSelectedElement({
            type: "field",
            name: baseRect.field.name,
            area: Number(baseRect.field.area_sqm ?? 0),
            locationName,
          });
        },
      };
    }

    return {
      draggable: true,
      onDragMove: (event: KonvaEventObject<Event>) => {
        const raw = { x: event.target.x(), y: event.target.y() };
        const clampedRaw = clampInsideParent(
          raw,
          { width: baseRect.width, height: baseRect.height },
          contentBounds,
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
          contentBounds,
        );
        event.target.position(finalClamped);
        setActiveGuides(snapped.guides);
      },
      onDragEnd: (event: KonvaEventObject<Event>) => {
        const next = clampInsideParent(
          { x: event.target.x(), y: event.target.y() },
          { width: baseRect.width, height: baseRect.height },
          contentBounds,
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
          contentBounds,
        );
        event.target.position(finalClamped);
        const nextLayout: FieldLayoutEntry = {
          field: fieldId,
          location: locationId,
          x: finalClamped.x,
          y: finalClamped.y,
          version: 1,
        };
        setActiveGuides([]);
        setLayoutsByField((prev) => ({ ...prev, [fieldId]: nextLayout }));
        saveFieldLayout(locationId, nextLayout);
      },
    };
  };

  const getBedInteractionProps = (
    bedVm: BedViewModel,
    currentFieldRect: RectViewModel,
    fieldInnerSize: { width: number; height: number },
    bedViewModels: BedViewModel[],
    locationName: string,
    fieldName: string,
    locationId: number,
  ) => {
    if (interactionMode === "view") {
      return {
        draggable: false,
        onClick: () => {
          setSelectedElement({
            type: "bed",
            name: bedVm.name,
            area: bedVm.area,
            locationName,
            parentName: fieldName,
          });
        },
        onTap: () => {
          setSelectedElement({
            type: "bed",
            name: bedVm.name,
            area: bedVm.area,
            locationName,
            parentName: fieldName,
          });
        },
      };
    }

    return {
      draggable: true,
      onDragMove: (event: KonvaEventObject<Event>) => {
        const raw = {
          x: event.target.x() - (currentFieldRect.x + FIELD_INNER_OFFSET_X),
          y: event.target.y() - (currentFieldRect.y + FIELD_INNER_OFFSET_Y),
        };
        const clampedRaw = clampInsideParent(
          raw,
          { width: bedVm.width, height: bedVm.height },
          fieldInnerSize,
        );
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
          x: currentFieldRect.x + FIELD_INNER_OFFSET_X + finalClamped.x,
          y: currentFieldRect.y + FIELD_INNER_OFFSET_Y + finalClamped.y,
        });
        setActiveGuides(
          snapped.guides.map((guide) => ({
            ...guide,
            value:
              guide.orientation === "vertical"
                ? currentFieldRect.x + FIELD_INNER_OFFSET_X + guide.value
                : currentFieldRect.y + FIELD_INNER_OFFSET_Y + guide.value,
            start:
              guide.orientation === "vertical"
                ? currentFieldRect.y + FIELD_INNER_OFFSET_Y + guide.start
                : currentFieldRect.x + FIELD_INNER_OFFSET_X + guide.start,
            end:
              guide.orientation === "vertical"
                ? currentFieldRect.y + FIELD_INNER_OFFSET_Y + guide.end
                : currentFieldRect.x + FIELD_INNER_OFFSET_X + guide.end,
          })),
        );
      },
      onDragEnd: (event: KonvaEventObject<Event>) => {
        const next = {
          x: event.target.x() - (currentFieldRect.x + FIELD_INNER_OFFSET_X),
          y: event.target.y() - (currentFieldRect.y + FIELD_INNER_OFFSET_Y),
        };
        const clampedNext = clampInsideParent(
          next,
          { width: bedVm.width, height: bedVm.height },
          fieldInnerSize,
        );
        const snapped = snapToNeighbors(
          bedVm.id,
          clampedNext,
          { width: bedVm.width, height: bedVm.height },
          bedViewModels,
        );
        const finalClamped = clampInsideParent(
          { x: snapped.x, y: snapped.y },
          { width: bedVm.width, height: bedVm.height },
          fieldInnerSize,
        );
        event.target.position({
          x: currentFieldRect.x + FIELD_INNER_OFFSET_X + finalClamped.x,
          y: currentFieldRect.y + FIELD_INNER_OFFSET_Y + finalClamped.y,
        });
        const nextLayout: BedLayoutEntry = {
          bed: bedVm.id,
          location: locationId,
          x: finalClamped.x,
          y: finalClamped.y,
          version: 1,
        };
        setActiveGuides([]);
        setLayoutsByBed((prev) => ({ ...prev, [bedVm.id]: nextLayout }));
        saveBedLayout(locationId, nextLayout);
      },
    };
  };

  const handleStageTouchEnd = (locationId: number): void => {
    pinchStateRef.current[locationId] = null;
  };

  if (loading) {
    return (
      <Box p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3} ref={containerRef}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          {showTitle ? (
            <Typography variant="h4" gutterBottom>
              {t("fields:graphical.title")}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {interactionMode === "view"
              ? t("fields:graphical.viewModeDescription")
              : t("fields:graphical.editModeDescription")}
          </Typography>
        </Box>
        <Tooltip title={t("fields:graphical.editModeShortcut")} placement="top">
          <FormControlLabel
            control={
              <Switch
                checked={interactionMode === "edit"}
                onChange={(_, checked) =>
                  setInteractionMode(checked ? "edit" : "view")
                }
                color="primary"
                inputProps={{
                  "aria-label": t("fields:graphical.editMode"),
                  "aria-description": t("fields:graphical.editModeShortcut"),
                }}
              />
            }
            label={t("fields:graphical.editMode")}
            sx={{ mr: 0 }}
          />
        </Tooltip>
      </Stack>

      {interactionMode === "edit" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("fields:graphical.editModeBanner")}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      {locationLayouts.map(
        ({
          location,
          defaultFieldRects,
          fieldViewModels,
          contentWidth,
          contentHeight,
        }) => {
          if (!location.id) {
            return null;
          }

          const locationId = location.id;
          const viewport =
            viewportByLocation[locationId] ??
            fitContentToStage(
              { width: contentWidth, height: contentHeight },
              { width: stageWidth, height: stageHeight },
              VIEWPORT_PADDING,
            );
          const visibility = getVisibleElements(viewport.scale);

          return (
            <Accordion
              key={locationId}
              expanded={Boolean(expanded[locationId])}
              onChange={(_, isExpanded) =>
                setExpanded((prev) => ({ ...prev, [locationId]: isExpanded }))
              }
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  {t("fields:graphical.locationTitle", { name: location.name })}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 1, flexWrap: "wrap" }}
                >
                  <Button
                    size="large"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleZoom(locationId, ZOOM_STEP)}
                    aria-label={t("fields:graphical.zoomIn")}
                  >
                    {t("fields:graphical.zoomIn")}
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    startIcon={<RemoveIcon />}
                    onClick={() => handleZoom(locationId, 1 / ZOOM_STEP)}
                    aria-label={t("fields:graphical.zoomOut")}
                  >
                    {t("fields:graphical.zoomOut")}
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    startIcon={<FitScreenIcon />}
                    onClick={() => resetViewport(locationId)}
                    aria-label={t("fields:graphical.fitToView")}
                  >
                    {t("fields:graphical.fitToView")}
                  </Button>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ alignSelf: "center", ml: 1 }}
                  >
                    {t("fields:graphical.zoomLevel", {
                      value: viewport.scale.toFixed(2),
                    })}
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    touchAction: "none",
                  }}
                >
                  <Stage
                    width={stageWidth}
                    height={stageHeight}
                    draggable={interactionMode === "view"}
                    x={viewport.x}
                    y={viewport.y}
                    scaleX={viewport.scale}
                    scaleY={viewport.scale}
                    onDragStart={() =>
                      handleStageDragStart(locationId, viewport)
                    }
                    onDragMove={(event: KonvaEventObject<DragEvent>) =>
                      handleStageDragMove(locationId, viewport, event)
                    }
                    onDragEnd={(event: KonvaEventObject<DragEvent>) =>
                      handleStageDragEnd(locationId, viewport, event)
                    }
                    onWheel={(event) => handleStageWheel(locationId, event)}
                    onDblTap={() => handleStageDoubleTap(locationId)}
                    onDblClick={() => handleStageDoubleTap(locationId)}
                    onTouchMove={(event) =>
                      handleStageTouchMove(locationId, event)
                    }
                    onTouchEnd={() => handleStageTouchEnd(locationId)}
                    ref={(node) => {
                      stageRefs.current[locationId] = node;
                    }}
                  >
                    <Layer>
                      {defaultFieldRects.map((baseRect) => {
                        const fieldId = baseRect.field.id!;
                        const currentFieldRect = fieldViewModels.find(
                          (fieldRect) => fieldRect.id === fieldId,
                        );
                        if (!currentFieldRect) {
                          return null;
                        }

                        const fieldBeds = beds.filter(
                          (bed) =>
                            bed.field === fieldId && bed.id !== undefined,
                        );
                        const bedSizeMap = new Map<number, RectSize>();
                        const fieldInnerSize = {
                          width: baseRect.width - FIELD_INNER_OFFSET_X * 2,
                          height:
                            baseRect.height -
                            FIELD_INNER_OFFSET_Y -
                            FIELD_INNER_BOTTOM_PADDING,
                        };
                        fieldBeds.forEach((bed) => {
                          bedSizeMap.set(
                            bed.id!,
                            getBedRectSizeWithinField(
                              bed,
                              baseRect.field,
                              fieldInnerSize,
                            ),
                          );
                        });

                        const missingBeds = fieldBeds
                          .map((bed) => bed.id!)
                          .filter((bedId) => !layoutsByBed[bedId]);
                        const autoLayout = initialAutoLayout(
                          missingBeds,
                          bedSizeMap,
                          fieldInnerSize,
                        );
                        const bedViewModels: BedViewModel[] = fieldBeds.map(
                          (bed) => {
                            const bedId = bed.id!;
                            const size = bedSizeMap.get(bedId)!;
                            const saved = layoutsByBed[bedId];
                            const fallback = autoLayout.get(bedId) ?? {
                              x: 10,
                              y: 10,
                            };
                            const clamped = clampInsideParent(
                              {
                                x: saved?.x ?? fallback.x,
                                y: saved?.y ?? fallback.y,
                              },
                              size,
                              fieldInnerSize,
                            );
                            return {
                              id: bedId,
                              name: bed.name,
                              area: Number(bed.area_sqm ?? 0),
                              x: clamped.x,
                              y: clamped.y,
                              width: size.width,
                              height: size.height,
                            };
                          },
                        );

                        return (
                          <Group key={fieldId}>
                            <Rect
                              x={currentFieldRect.x}
                              y={currentFieldRect.y}
                              width={baseRect.width}
                              height={baseRect.height}
                              stroke="#2f855a"
                              strokeWidth={2}
                              cornerRadius={4}
                              name="graphical-editable"
                              _useStrictMode
                              data-testid={`field-rect-${fieldId}`}
                              {...getFieldInteractionProps(
                                fieldId,
                                baseRect,
                                { width: contentWidth, height: contentHeight },
                                fieldViewModels,
                                location.name,
                                locationId,
                              )}
                            />
                            {shouldShowFieldLabel(
                              {
                                width: baseRect.width,
                                height: baseRect.height,
                              },
                              viewport.scale,
                            ) ? (
                              <Text
                                x={currentFieldRect.x + 8}
                                y={currentFieldRect.y + 8}
                                text={baseRect.field.name}
                                fontStyle="bold"
                                listening={false}
                                scaleX={1 / viewport.scale}
                                scaleY={1 / viewport.scale}
                              />
                            ) : null}
                            {visibility.showBeds
                              ? bedViewModels.map((bedVm) => (
                                  <Group key={bedVm.id}>
                                    <Rect
                                      x={
                                        currentFieldRect.x +
                                        FIELD_INNER_OFFSET_X +
                                        bedVm.x
                                      }
                                      y={
                                        currentFieldRect.y +
                                        FIELD_INNER_OFFSET_Y +
                                        bedVm.y
                                      }
                                      width={bedVm.width}
                                      height={bedVm.height}
                                      fill="#bee3f8"
                                      stroke="#2b6cb0"
                                      strokeWidth={1}
                                      name="graphical-editable"
                                      _useStrictMode
                                      data-testid={`bed-rect-${bedVm.id}`}
                                      {...getBedInteractionProps(
                                        bedVm,
                                        currentFieldRect,
                                        fieldInnerSize,
                                        bedViewModels,
                                        location.name,
                                        baseRect.field.name,
                                        locationId,
                                      )}
                                    />
                                    {visibility.showBedLabels &&
                                    shouldShowBedLabel(
                                      {
                                        width: bedVm.width,
                                        height: bedVm.height,
                                      },
                                      viewport.scale,
                                    ) ? (
                                      <Text
                                        x={
                                          currentFieldRect.x +
                                          FIELD_INNER_OFFSET_X +
                                          4 +
                                          bedVm.x
                                        }
                                        y={
                                          currentFieldRect.y +
                                          FIELD_INNER_OFFSET_Y +
                                          4 +
                                          bedVm.y
                                        }
                                        text={
                                          visibility.showDetailedBedLabels
                                            ? `${bedVm.name} (${bedVm.area || "-"} m²)`
                                            : bedVm.name
                                        }
                                        fontSize={12}
                                        width={Math.max(40, bedVm.width - 8)}
                                        wrap="word"
                                        listening={false}
                                        scaleX={1 / viewport.scale}
                                        scaleY={1 / viewport.scale}
                                      />
                                    ) : null}
                                  </Group>
                                ))
                              : null}
                          </Group>
                        );
                      })}

                      {activeGuides.map((guide, index) => (
                        <Rect
                          key={`${guide.orientation}-${guide.value}-${index}`}
                          x={
                            guide.orientation === "vertical"
                              ? guide.value - 0.75
                              : guide.start
                          }
                          y={
                            guide.orientation === "vertical"
                              ? guide.start
                              : guide.value - 0.75
                          }
                          width={
                            guide.orientation === "vertical"
                              ? 1.5
                              : Math.max(1, guide.end - guide.start)
                          }
                          height={
                            guide.orientation === "vertical"
                              ? Math.max(1, guide.end - guide.start)
                              : 1.5
                          }
                          fill="#e53e3e"
                          opacity={0.8}
                        />
                      ))}
                    </Layer>
                  </Stage>
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        },
      )}

      <Dialog
        open={Boolean(selectedElement)}
        onClose={() => setSelectedElement(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {selectedElement
            ? t(`fields:graphical.details.${selectedElement.type}`)
            : ""}
        </DialogTitle>
        <DialogContent>
          {selectedElement ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography>
                {t("common:fields.name")}: {selectedElement.name}
              </Typography>
              <Typography>
                {t("fields:graphical.location")}: {selectedElement.locationName}
              </Typography>
              {selectedElement.parentName ? (
                <Typography>
                  {t("fields:graphical.parentField")}:{" "}
                  {selectedElement.parentName}
                </Typography>
              ) : null}
              {selectedElement.area !== null ? (
                <Typography>
                  {t("fields:graphical.area")}: {selectedElement.area} m²
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedElement(null)}>
            {t("common:actions.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
