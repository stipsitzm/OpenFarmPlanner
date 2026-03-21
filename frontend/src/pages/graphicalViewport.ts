import type { RectSize } from './graphicalLayoutUtils';

export const GRAPHICAL_MIN_SCALE = 0.55;
export const GRAPHICAL_MAX_SCALE = 3;
export const ZOOM_LEVEL_OVERVIEW = 0.9;
export const ZOOM_LEVEL_MEDIUM = 1.25;
export const ZOOM_LEVEL_DETAIL = 1.8;
export const FIELD_LABEL_MIN_WIDTH = 110;
export const FIELD_LABEL_MIN_HEIGHT = 48;
export const BED_LABEL_MIN_WIDTH = 88;
export const BED_LABEL_MIN_HEIGHT = 36;

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

export interface PanSession {
  startPointerX: number;
  startPointerY: number;
  startTranslateX: number;
  startTranslateY: number;
}

export interface VisibilityState {
  showBeds: boolean;
  showBedLabels: boolean;
  showDetailedBedLabels: boolean;
}

export function clampScale(scale: number): number {
  return Math.min(GRAPHICAL_MAX_SCALE, Math.max(GRAPHICAL_MIN_SCALE, scale));
}

export function getVisibleElements(scale: number): VisibilityState {
  if (scale < ZOOM_LEVEL_OVERVIEW) {
    return {
      showBeds: false,
      showBedLabels: false,
      showDetailedBedLabels: false,
    };
  }

  if (scale < ZOOM_LEVEL_DETAIL) {
    return {
      showBeds: true,
      showBedLabels: true,
      showDetailedBedLabels: false,
    };
  }

  return {
    showBeds: true,
    showBedLabels: true,
    showDetailedBedLabels: true,
  };
}

export function shouldShowFieldLabel(size: RectSize, scale: number): boolean {
  return size.width >= FIELD_LABEL_MIN_WIDTH && size.height >= FIELD_LABEL_MIN_HEIGHT && scale >= GRAPHICAL_MIN_SCALE;
}

export function shouldShowBedLabel(size: RectSize, scale: number): boolean {
  return scale >= ZOOM_LEVEL_MEDIUM && size.width >= BED_LABEL_MIN_WIDTH && size.height >= BED_LABEL_MIN_HEIGHT;
}

export function fitContentToStage(contentSize: RectSize, stageSize: RectSize, padding = 24): ViewportState {
  const safeWidth = Math.max(contentSize.width, 1);
  const safeHeight = Math.max(contentSize.height, 1);
  const scaleX = Math.max(0.01, (stageSize.width - padding * 2) / safeWidth);
  const scaleY = Math.max(0.01, (stageSize.height - padding * 2) / safeHeight);
  const scale = clampScale(Math.min(scaleX, scaleY));
  const scaledWidth = safeWidth * scale;
  const scaledHeight = safeHeight * scale;

  return {
    scale,
    x: (stageSize.width - scaledWidth) / 2,
    y: (stageSize.height - scaledHeight) / 2,
  };
}

export function zoomAroundPoint(viewport: ViewportState, nextScale: number, anchor: { x: number; y: number }): ViewportState {
  const clampedScale = clampScale(nextScale);
  const stagePoint = {
    x: (anchor.x - viewport.x) / viewport.scale,
    y: (anchor.y - viewport.y) / viewport.scale,
  };

  return {
    scale: clampedScale,
    x: anchor.x - stagePoint.x * clampedScale,
    y: anchor.y - stagePoint.y * clampedScale,
  };
}

export function startPanSession(viewport: ViewportState, pointer: { x: number; y: number }): PanSession {
  return {
    startPointerX: pointer.x,
    startPointerY: pointer.y,
    startTranslateX: viewport.x,
    startTranslateY: viewport.y,
  };
}

export function panViewport(session: PanSession, pointer: { x: number; y: number }, scale: number): ViewportState {
  const safeScale = clampScale(scale);
  const deltaX = pointer.x - session.startPointerX;
  const deltaY = pointer.y - session.startPointerY;

  return {
    scale: safeScale,
    x: session.startTranslateX + deltaX,
    y: session.startTranslateY + deltaY,
  };
}
