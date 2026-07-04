import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  FormControl,
  Menu,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  plantingPlanAPI,
  yieldCalendarAPI,
  type PlantingPlan,
  type YieldCalendarWeek,
} from "../api/api";
import {
  segmentedToggleButtonGroupSx,
  segmentedToggleButtonSx,
} from "../components/buttons/segmentedControlStyles";
import PageContainer from "../components/layout/PageContainer";
import PageSurface from "../components/layout/PageSurface";
import EmptyStateCard from "../components/project/EmptyStateCard";
import ProjectRequiredState from "../components/project/ProjectRequiredState";
import { useProjectRequirement } from "../hooks/useProjectRequirement";
import { useTranslation } from "../i18n";
import {
  shouldOpenCustomContextMenu,
  suppressNativeContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
  useLongPress,
} from "../utils/contextMenu";
import { ContextMenuIndicator } from "../components/contextMenu/ContextMenuIndicator";
import { contextMenuIndicatorHostSx } from "../components/contextMenu/contextMenuIndicatorStyles";
import { useFocusRegion } from "../focus/useFocusManager";
import { parseDateString } from "./ganttChartUtils";
import {
  getYieldAxisLabelStep,
  type ChartPeriod,
} from "./yieldOverviewUtils";

type YieldCalendarCulture = YieldCalendarWeek["cultures"][number];

interface YieldCultureMeta {
  id: number;
  name: string;
  color: string;
}

interface YieldChartColumn {
  id: string;
  startDate: string;
  primaryLabel: string;
  secondaryLabel: string;
  cultures: YieldCalendarCulture[];
  totalYield: number;
}

const ALL_CULTURES = "all";

function formatDateToAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoWeek(date: Date): string {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function mergeCultureYields(
  cultures: YieldCalendarCulture[],
): YieldCalendarCulture[] {
  const totals = new Map<number, YieldCalendarCulture>();

  cultures.forEach((culture) => {
    const existing = totals.get(culture.culture_id);
    totals.set(culture.culture_id, {
      ...culture,
      yield: (existing?.yield ?? 0) + culture.yield,
    });
  });

  return [...totals.values()];
}

function useYieldChartData(
  weeklyYield: YieldCalendarWeek[],
  selectedCultureId: string,
  period: ChartPeriod,
  locale: string,
) {
  return useMemo(() => {
    const cultureMeta = new Map<number, YieldCultureMeta>();
    weeklyYield.forEach((week) => {
      week.cultures.forEach((culture) => {
        cultureMeta.set(culture.culture_id, {
          id: culture.culture_id,
          name: culture.culture_name,
          color: culture.color,
        });
      });
    });

    const availableCultures = [...cultureMeta.values()].sort((left, right) =>
      left.name.localeCompare(right.name, locale),
    );
    const selectedCulture =
      selectedCultureId === ALL_CULTURES
        ? null
        : Number(selectedCultureId);
    const filterCultures = (
      cultures: YieldCalendarCulture[],
    ): YieldCalendarCulture[] =>
      selectedCulture === null
        ? cultures
        : cultures.filter((culture) => culture.culture_id === selectedCulture);

    const sortedByStart = [...weeklyYield].sort((left, right) =>
      left.week_start.localeCompare(right.week_start),
    );
    if (sortedByStart.length === 0) {
      return {
        chartData: [] as YieldChartColumn[],
        chartCultures: [] as YieldCultureMeta[],
        availableCultures,
        maxTotalYield: 0,
      };
    }

    const startDate = parseDateString(sortedByStart[0].week_start);
    const endDate = parseDateString(
      sortedByStart[sortedByStart.length - 1].week_start,
    );
    const weekMap = new Map(weeklyYield.map((week) => [week.week_start, week]));
    const weeklyColumns: YieldChartColumn[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const weekStart = formatDateToAPI(currentDate);
      const week = weekMap.get(weekStart);
      const cultures = filterCultures(week?.cultures ?? []);
      const weekStartDate = parseDateString(weekStart);
      const isoWeek = week?.iso_week ?? formatIsoWeek(weekStartDate);
      weeklyColumns.push({
        id: isoWeek,
        startDate: weekStart,
        primaryLabel: isoWeek.split("-W")[1]
          ? `W${isoWeek.split("-W")[1]}`
          : isoWeek,
        secondaryLabel: weekStartDate.toLocaleDateString(locale, {
          month: "short",
        }),
        cultures,
        totalYield: cultures.reduce((sum, culture) => sum + culture.yield, 0),
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    const chartData =
      period === "week"
        ? weeklyColumns
        : [...weeklyColumns.reduce((months, column) => {
            const sourceDate = parseDateString(column.startDate);
            const monthId = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}`;
            const existing = months.get(monthId);
            const cultures = mergeCultureYields([
              ...(existing?.cultures ?? []),
              ...column.cultures,
            ]);
            months.set(monthId, {
              id: monthId,
              startDate: `${monthId}-01`,
              primaryLabel: sourceDate.toLocaleDateString(locale, {
                month: "short",
              }),
              secondaryLabel: String(sourceDate.getFullYear()),
              cultures,
              totalYield: cultures.reduce(
                (sum, culture) => sum + culture.yield,
                0,
              ),
            });
            return months;
          }, new Map<string, YieldChartColumn>()).values()];

    const visibleCultureIds = new Set(
      chartData.flatMap((column) =>
        column.cultures.map((culture) => culture.culture_id),
      ),
    );
    const chartCultures = availableCultures.filter((culture) =>
      visibleCultureIds.has(culture.id),
    );

    return {
      chartData,
      chartCultures,
      availableCultures,
      maxTotalYield: chartData.reduce(
        (max, column) => Math.max(max, column.totalYield),
        0,
      ),
    };
  }, [locale, period, selectedCultureId, weeklyYield]);
}

interface YieldDistributionChartProps {
  weeklyYield: YieldCalendarWeek[];
  selectedCultureId: string;
  period: ChartPeriod;
}

function YieldDistributionChart({
  weeklyYield,
  selectedCultureId,
  period,
}: YieldDistributionChartProps) {
  const { t, i18n } = useTranslation(["yieldOverview", "common"]);
  const navigate = useNavigate();
  const { chartData, chartCultures, maxTotalYield } = useYieldChartData(
    weeklyYield,
    selectedCultureId,
    period,
    i18n.resolvedLanguage ?? i18n.language,
  );
  const axisRef = useRef<HTMLDivElement | null>(null);
  const chartPlotRef = useRef<HTMLDivElement | null>(null);
  useFocusRegion('yield-chart', chartPlotRef, { label: t('chart.title'), order: 3 });
  const segmentElementsRef = useRef(new Map<string, HTMLElement>());
  const [focusedSegmentKey, setFocusedSegmentKey] = useState<string | null>(null);
  const [keyboardTooltipKey, setKeyboardTooltipKey] = useState<string | null>(null);
  // MUI's Tooltip locks in "controlled" vs. "uncontrolled" mode on its first
  // render and ignores later prop changes that would flip that (e.g. going
  // from `open={undefined}` to `open={true}` later does nothing visible) —
  // so hover has to be tracked explicitly here to keep the tooltip always
  // controlled by a real boolean, letting the keyboard (Space) toggle work.
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState<string | null>(null);

  const [contextMenuState, setContextMenuState] = useState<{
    cultureId: number;
    cultureName: string;
    periodLabel: string;
    yieldValue: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenuState(null), []);

  const openContextMenu = useCallback((
    event: React.MouseEvent | React.TouchEvent,
    payload: { cultureId: number; cultureName: string; periodLabel: string; yieldValue: number },
  ) => {
    if (!shouldOpenCustomContextMenu(event.target)) return;
    suppressNativeContextMenu(event);
    const point = "changedTouches" in event
      ? event.changedTouches[0] ?? event.touches[0]
      : event;
    if (!point) return;
    setContextMenuState({ ...payload, mouseX: point.clientX + 2, mouseY: point.clientY - 6 });
  }, []);

  const isYieldContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    shouldOpenCustomContextMenu(target)
    && target instanceof HTMLElement
    && target.closest('[data-rmg-component="yield-segment"]') !== null
  ), []);

  useCloseCustomContextMenuOnNativeContextMenu(
    contextMenuState !== null,
    closeContextMenu,
    isYieldContextMenuTarget,
    (event) => setContextMenuState((current) => (
      current ? { ...current, mouseX: event.clientX + 2, mouseY: event.clientY - 6 } : current
    )),
  );

  const openCulture = useCallback((cultureId: number) => {
    navigate(`/app/cultures?cultureId=${cultureId}`);
  }, [navigate]);

  const copySegmentSummary = useCallback((payload: { cultureName: string; periodLabel: string; yieldValue: number }) => {
    const summary = `${payload.cultureName} · ${payload.periodLabel} · ${payload.yieldValue.toFixed(2)} kg`;
    void navigator.clipboard?.writeText(summary).catch(() => undefined);
  }, []);

  // Keyboard navigation between bars — the chart-region reference
  // implementation described in docs/keyboard-architecture.md. Only one
  // segment is ever part of the tab order (roving tabindex); arrow keys move
  // that "current" segment across periods (left/right) and, within a
  // period's stacked bar, across cultures (up/down).
  const getSegmentKey = useCallback((columnId: string, cultureId: number) => `${columnId}-${cultureId}`, []);

  const defaultSegmentKey = useMemo(() => {
    const firstColumn = chartData[0];
    const firstCulture = firstColumn?.cultures[0];
    return firstColumn && firstCulture ? getSegmentKey(firstColumn.id, firstCulture.culture_id) : null;
  }, [chartData, getSegmentKey]);

  const allSegmentKeys = useMemo(
    () => new Set(chartData.flatMap((column) => column.cultures.map((culture) => getSegmentKey(column.id, culture.culture_id)))),
    [chartData, getSegmentKey],
  );

  const activeSegmentKey = focusedSegmentKey && allSegmentKeys.has(focusedSegmentKey) ? focusedSegmentKey : defaultSegmentKey;

  const focusSegment = useCallback((key: string) => {
    setFocusedSegmentKey(key);
    setKeyboardTooltipKey(null);
    segmentElementsRef.current.get(key)?.focus();
  }, []);

  const handleSegmentKeyDown = useCallback((
    event: React.KeyboardEvent,
    columnIndex: number,
    cultureIndex: number,
    payload: { cultureId: number; cultureName: string; periodLabel: string; yieldValue: number },
  ) => {
    const column = chartData[columnIndex];
    if (!column) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const nextColumn = chartData[columnIndex + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!nextColumn) return;
      event.preventDefault();
      const nextCulture = nextColumn.cultures[Math.min(cultureIndex, nextColumn.cultures.length - 1)];
      if (nextCulture) focusSegment(getSegmentKey(nextColumn.id, nextCulture.culture_id));
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      // The stack renders column-reverse (first array entry at the bottom),
      // so moving "up" means the next array index.
      const nextCulture = column.cultures[cultureIndex + (event.key === "ArrowUp" ? 1 : -1)];
      if (!nextCulture) return;
      event.preventDefault();
      focusSegment(getSegmentKey(column.id, nextCulture.culture_id));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      openCulture(payload.cultureId);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      const key = getSegmentKey(column.id, payload.cultureId);
      setKeyboardTooltipKey((current) => (current === key ? null : key));
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      setContextMenuState({ ...payload, mouseX: rect.left + 2, mouseY: rect.bottom - 6 });
    }
  }, [chartData, focusSegment, getSegmentKey, openCulture]);

  // Only one segment can be pressed at a time, so a single long-press timer
  // (keyed by the currently pressed segment's payload) covers every bar.
  const [pressedSegmentKey, setPressedSegmentKey] = useState<string | null>(null);
  const pressedSegmentPayloadRef = useRef<
    { cultureId: number; cultureName: string; periodLabel: string; yieldValue: number } | null
  >(null);
  const { onTouchStart: startSegmentLongPress, onTouchEnd: clearSegmentLongPressBase, isLongPressing } = useLongPress(
    (event) => {
      const payload = pressedSegmentPayloadRef.current;
      if (payload) openContextMenu(event, payload);
    },
  );
  const handleSegmentTouchStart = useCallback((
    event: React.TouchEvent,
    payload: { cultureId: number; cultureName: string; periodLabel: string; yieldValue: number },
    segmentKey: string,
  ) => {
    pressedSegmentPayloadRef.current = payload;
    setPressedSegmentKey(segmentKey);
    startSegmentLongPress(event);
  }, [startSegmentLongPress]);
  const clearSegmentLongPress = useCallback(() => {
    clearSegmentLongPressBase();
    setPressedSegmentKey(null);
  }, [clearSegmentLongPressBase]);
  const [axisWidth, setAxisWidth] = useState(0);
  const labelStep = getYieldAxisLabelStep(
    axisWidth,
    chartData.length,
    period,
  );
  const yAxisTicks = useMemo(() => {
    const tickCount = 5;
    if (maxTotalYield <= 0) {
      return [0];
    }
    return Array.from({ length: tickCount }, (_, index) =>
      Number(((maxTotalYield / (tickCount - 1)) * index).toFixed(1)),
    );
  }, [maxTotalYield]);

  useEffect(() => {
    const axisElement = axisRef.current;
    if (!axisElement) {
      return undefined;
    }

    const updateAxisWidth = (): void => {
      setAxisWidth(axisElement.getBoundingClientRect().width);
    };

    updateAxisWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateAxisWidth);
      return () => window.removeEventListener("resize", updateAxisWidth);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      setAxisWidth(width ?? axisElement.getBoundingClientRect().width);
    });
    resizeObserver.observe(axisElement);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <>
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        borderColor: "surface.surfaceSoftBorder",
        boxShadow: "none",
      }}
    >
      <CardContent
        sx={{ p: { xs: 1.5, sm: 2, lg: 3 }, "&:last-child": { pb: 2 } }}
      >
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
          {t("chart.title")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, my: 2 }}>
          {chartCultures.map((culture) => (
            <Box
              key={culture.id}
              sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "2px",
                  backgroundColor: culture.color,
                }}
              />
              <Typography variant="body2">{culture.name}</Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "52px minmax(0, 1fr)",
              sm: "68px minmax(0, 1fr)",
            },
            gap: { xs: 0.5, sm: 1 },
            alignItems: "start",
            width: "100%",
          }}
        >
          <Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column-reverse",
                justifyContent: "space-between",
                height: { xs: 300, md: 400 },
                pr: 1,
              }}
            >
              {yAxisTicks.map((tick, index) => (
                <Typography
                  key={`${tick}-${index}`}
                  variant="caption"
                  sx={{ textAlign: "right", color: "text.secondary" }}
                >
                  {tick.toFixed(1)} kg
                </Typography>
              ))}
            </Box>
            <Box sx={{ height: 44 }} />
          </Box>

          <Box ref={axisRef} sx={{ minWidth: 0 }}>
            <Box
              ref={chartPlotRef}
              data-testid="yield-chart-plot"
              sx={{
                width: "100%",
                height: { xs: 300, md: 400 },
                px: { xs: 0.25, sm: 0.75 },
                borderLeft: "1px solid",
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "flex-end",
                gap: { xs: "1px", sm: "2px" },
              }}
            >
              {chartData.map((column, columnIndex) => (
                <Box
                  key={column.id}
                  data-testid={`yield-bar-column-${column.id}`}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 0,
                    height: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column-reverse",
                      justifyContent: "flex-start",
                    }}
                  >
                    {column.cultures.map((culture, cultureIndex) => {
                      const periodLabel = `${column.primaryLabel} ${column.secondaryLabel}`;
                      const segmentPayload = {
                        cultureId: culture.culture_id,
                        cultureName: culture.culture_name,
                        periodLabel,
                        yieldValue: culture.yield,
                      };
                      const segmentKey = getSegmentKey(column.id, culture.culture_id);
                      return (
                        <Tooltip
                          key={`${column.id}-${culture.culture_id}`}
                          // Always an explicit boolean (never `undefined`) —
                          // driven by hover and the keyboard (Space) toggle.
                          // Force-closed while a context menu is open, since
                          // the pointer may still technically be hovering
                          // the segment underneath it.
                          open={!contextMenuState && (hoveredSegmentKey === segmentKey || keyboardTooltipKey === segmentKey)}
                          slotProps={{
                            tooltip: {
                              sx: {
                                bgcolor: "background.paper",
                                color: "text.primary",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                boxShadow: 3,
                                p: 1,
                                minWidth: "12rem",
                                maxWidth: 320,
                              },
                            },
                          }}
                          title={
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                {culture.culture_name}
                              </Typography>
                              <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1, rowGap: 0.25 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                                  {t("chart.tooltipPeriod")}:
                                </Typography>
                                <Typography variant="caption">{periodLabel}</Typography>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                                  {t("chart.tooltipYield")}:
                                </Typography>
                                <Typography variant="caption">{culture.yield.toFixed(2)} kg</Typography>
                              </Box>
                            </Box>
                          }
                        >
                          <Box
                            ref={(element: HTMLElement | null) => {
                              if (element) segmentElementsRef.current.set(segmentKey, element);
                              else segmentElementsRef.current.delete(segmentKey);
                            }}
                            data-testid={`yield-bar-${column.id}-${culture.culture_id}`}
                            data-rmg-component="yield-segment"
                            role="button"
                            tabIndex={segmentKey === activeSegmentKey ? 0 : -1}
                            aria-label={`${culture.culture_name}, ${periodLabel}, ${culture.yield.toFixed(2)} kg`}
                            onFocus={() => setFocusedSegmentKey(segmentKey)}
                            onKeyDown={(event) => handleSegmentKeyDown(event, columnIndex, cultureIndex, segmentPayload)}
                            onMouseEnter={() => setHoveredSegmentKey(segmentKey)}
                            onMouseLeave={() => setHoveredSegmentKey((current) => (current === segmentKey ? null : current))}
                            data-long-pressing={pressedSegmentKey === `${column.id}-${culture.culture_id}` && isLongPressing ? "true" : undefined}
                            onContextMenu={(event) => openContextMenu(event, segmentPayload)}
                            onTouchStart={(event) => handleSegmentTouchStart(event, segmentPayload, `${column.id}-${culture.culture_id}`)}
                            onTouchEnd={clearSegmentLongPress}
                            onTouchMove={clearSegmentLongPress}
                            sx={{
                              position: "relative",
                              width: "100%",
                              height: `${maxTotalYield > 0 ? (culture.yield / maxTotalYield) * 100 : 0}%`,
                              minHeight: culture.yield > 0 ? "2px" : 0,
                              backgroundColor: culture.color,
                              filter: pressedSegmentKey === `${column.id}-${culture.culture_id}` && isLongPressing
                                ? "brightness(0.9)"
                                : undefined,
                              transition: "filter 0.15s ease",
                              ...contextMenuIndicatorHostSx,
                            }}
                          >
                            <ContextMenuIndicator
                              label={t('common:actions.actions')}
                              tabIndex={-1}
                              onClick={(event) => openContextMenu(event, segmentPayload)}
                              withBackdrop
                              sx={{ position: "absolute", top: -2, right: -2 }}
                            />
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                height: 44,
                px: { xs: 0.25, sm: 0.75 },
                display: "flex",
                gap: { xs: "1px", sm: "2px" },
              }}
            >
              {chartData.map((column, index) => (
                <Box
                  key={`${column.id}-axis`}
                  data-testid={`yield-axis-column-${column.id}`}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 0,
                    textAlign: "center",
                    overflow: "visible",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      visibility:
                        index % labelStep === 0 ? "visible" : "hidden",
                      fontWeight: 600,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {column.primaryLabel}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      visibility:
                        index % labelStep === 0 ? "visible" : "hidden",
                      color: "text.secondary",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {column.secondaryLabel}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
    <Menu
      open={contextMenuState !== null}
      onClose={closeContextMenu}
      hideBackdrop
      sx={{ pointerEvents: "none" }}
      slotProps={{
        paper: {
          className: "ofp-custom-context-menu",
          sx: { pointerEvents: "auto" },
        },
      }}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenuState !== null
          ? { top: contextMenuState.mouseY, left: contextMenuState.mouseX }
          : undefined
      }
    >
      <MenuItem
        onClick={() => {
          if (!contextMenuState) return;
          closeContextMenu();
          openCulture(contextMenuState.cultureId);
        }}
      >
        {t("contextMenu.openCulture")}
      </MenuItem>
      <Divider role="separator" />
      <MenuItem
        onClick={() => {
          if (!contextMenuState) return;
          closeContextMenu();
          copySegmentSummary(contextMenuState);
        }}
      >
        {t("common:actions.copyRow")}
      </MenuItem>
    </Menu>
    </>
  );
}

interface YieldFilterBarProps {
  cultures: YieldCultureMeta[];
  selectedCultureId: string;
  selectedYear: number;
  period: ChartPeriod;
  onCultureChange: (cultureId: string) => void;
  onYearChange: (year: number) => void;
  onPeriodChange: (period: ChartPeriod) => void;
}

function YieldFilterBar({
  cultures,
  selectedCultureId,
  selectedYear,
  period,
  onCultureChange,
  onYearChange,
  onPeriodChange,
}: YieldFilterBarProps) {
  const { t } = useTranslation("yieldOverview");
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: 6 },
    (_, index) => currentYear - 2 + index,
  );

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      sx={{ width: "100%", flexWrap: "wrap" }}
    >
      <Stack spacing={0.5} sx={{ minWidth: { sm: 220 } }}>
        <Typography
          id="yield-culture-filter-label"
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.culture")}
        </Typography>
        <FormControl size="small" fullWidth>
          <Select
            labelId="yield-culture-filter-label"
            value={selectedCultureId}
            onChange={(event) => onCultureChange(String(event.target.value))}
          >
            <MenuItem value={ALL_CULTURES}>{t("filters.allCultures")}</MenuItem>
            {cultures.map((culture) => (
              <MenuItem key={culture.id} value={String(culture.id)}>
                {culture.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={0.5} sx={{ minWidth: { sm: 120 } }}>
        <Typography
          id="yield-year-filter-label"
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.year")}
        </Typography>
        <FormControl size="small" fullWidth>
          <Select
            labelId="yield-year-filter-label"
            value={String(selectedYear)}
            onChange={(event) => onYearChange(Number(event.target.value))}
          >
            {yearOptions.map((year) => (
              <MenuItem key={year} value={String(year)}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={0.5}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.period")}
        </Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          size="small"
          color="primary"
          aria-label={t("filters.period")}
          sx={{ ...segmentedToggleButtonGroupSx, height: 40 }}
          onChange={(_, value: ChartPeriod | null) => {
            if (value !== null) {
              onPeriodChange(value);
            }
          }}
        >
          <ToggleButton value="week" sx={segmentedToggleButtonSx}>
            {t("filters.week")}
          </ToggleButton>
          <ToggleButton value="month" sx={segmentedToggleButtonSx}>
            {t("filters.month")}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Stack>
  );
}

export default function YieldOverviewPage() {
  const { t, i18n } = useTranslation("yieldOverview");
  const { shouldShowProjectRequiredState, missingProjectReason } =
    useProjectRequirement();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedCultureId, setSelectedCultureId] = useState(ALL_CULTURES);
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setLoading(false);
      setError(null);
      setPlantingPlans([]);
      setWeeklyYield([]);
      return;
    }

    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const [plansRes, weeklyYieldRes] = await Promise.all([
          plantingPlanAPI.list(),
          yieldCalendarAPI.list(selectedYear),
        ]);
        setPlantingPlans(plansRes.data.results);
        setWeeklyYield(weeklyYieldRes.data);
      } catch (err) {
        console.error("Error fetching yield overview data:", err);
        setError(t("errors.load"));
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [selectedYear, shouldShowProjectRequiredState, t]);

  const cultures = useMemo(() => {
    const cultureMap = new Map<number, YieldCultureMeta>();
    weeklyYield.forEach((week) => {
      week.cultures.forEach((culture) => {
        cultureMap.set(culture.culture_id, {
          id: culture.culture_id,
          name: culture.culture_name,
          color: culture.color,
        });
      });
    });
    return [...cultureMap.values()].sort((left, right) =>
      left.name.localeCompare(
        right.name,
        i18n.resolvedLanguage ?? i18n.language,
      ),
    );
  }, [i18n.language, i18n.resolvedLanguage, weeklyYield]);

  useEffect(() => {
    if (
      selectedCultureId !== ALL_CULTURES &&
      !cultures.some(
        (culture) => String(culture.id) === selectedCultureId,
      )
    ) {
      setSelectedCultureId(ALL_CULTURES);
    }
  }, [cultures, selectedCultureId]);

  if (loading) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace" sx={{ py: 2 }}>
          <Typography variant="body1">{t("loading")}</Typography>
        </PageSurface>
      </PageContainer>
    );
  }

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  const hasPlantingPlans = plantingPlans.length > 0;
  const hasYieldData = weeklyYield.length > 0;

  return (
    <PageContainer variant="workspacePage">
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      <PageSurface variant="fullWorkspace">
        <Stack spacing={2}>
          <YieldFilterBar
            cultures={cultures}
            selectedCultureId={selectedCultureId}
            selectedYear={selectedYear}
            period={period}
            onCultureChange={setSelectedCultureId}
            onYearChange={setSelectedYear}
            onPeriodChange={setPeriod}
          />

          {!hasPlantingPlans ? (
            <EmptyStateCard
              title={t("empty.noPlansTitle")}
              description={t("empty.description")}
              actions={[
                {
                  label: t("empty.createPlanAction"),
                  to: "/app/anbauplaene?action=create",
                  icon: <AddIcon fontSize="small" />,
                },
              ]}
              containerSx={{ maxWidth: "none", mb: 0 }}
            />
          ) : hasYieldData ? (
            <YieldDistributionChart
              weeklyYield={weeklyYield}
              selectedCultureId={selectedCultureId}
              period={period}
            />
          ) : (
            <EmptyStateCard
              title={t("empty.noYieldTitle", { year: selectedYear })}
              description={t("empty.noYieldDescription", { year: selectedYear })}
              actions={[
                { label: t("empty.openPlansAction"), to: "/app/anbauplaene" },
              ]}
              containerSx={{ maxWidth: "none", mb: 0 }}
            />
          )}
        </Stack>
      </PageSurface>
    </PageContainer>
  );
}
