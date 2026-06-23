import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  plantingPlanAPI,
  yieldCalendarAPI,
  type PlantingPlan,
  type YieldCalendarWeek,
} from "../api/api";
import PageContainer from "../components/layout/PageContainer";
import PageSurface from "../components/layout/PageSurface";
import EmptyStateCard from "../components/project/EmptyStateCard";
import ProjectRequiredState from "../components/project/ProjectRequiredState";
import { useProjectRequirement } from "../hooks/useProjectRequirement";
import { useTranslation } from "../i18n";
import { parseDateString } from "./ganttChartUtils";

interface WeeklyYieldCultureMeta {
  id: number;
  name: string;
  color: string;
}

interface WeeklyYieldChartColumn {
  isoWeek: string;
  weekLabel: string;
  monthLabel: string;
  cultures: YieldCalendarWeek["cultures"];
  totalYield: number;
}

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

function useWeeklyYieldChartData(weeklyYield: YieldCalendarWeek[]) {
  return useMemo(() => {
    const cultureMeta = new Map<number, WeeklyYieldCultureMeta>();
    const weekMap = new Map(weeklyYield.map((week) => [week.week_start, week]));
    const sortedByStart = [...weeklyYield].sort((left, right) =>
      left.week_start.localeCompare(right.week_start),
    );
    if (sortedByStart.length === 0) {
      return {
        chartData: [] as WeeklyYieldChartColumn[],
        chartCultures: [] as WeeklyYieldCultureMeta[],
        maxTotalYield: 0,
      };
    }

    const startDateRange = parseDateString(sortedByStart[0].week_start);
    const endDateRange = parseDateString(
      sortedByStart[sortedByStart.length - 1].week_start,
    );

    const rows: WeeklyYieldChartColumn[] = [];
    const currentDate = new Date(startDateRange);
    while (currentDate <= endDateRange) {
      const weekStart = formatDateToAPI(currentDate);
      const week = weekMap.get(weekStart);
      const weekCultures = week?.cultures || [];
      const culturesForWeek = weekCultures.map((entry) => {
        if (!cultureMeta.has(entry.culture_id)) {
          cultureMeta.set(entry.culture_id, {
            id: entry.culture_id,
            name: entry.culture_name,
            color: entry.color,
          });
        }
        return entry;
      });
      const totalYield = culturesForWeek.reduce(
        (sum, item) => sum + item.yield,
        0,
      );
      const weekStartDate = parseDateString(weekStart);
      const monthLabel = weekStartDate.toLocaleDateString("de-DE", {
        month: "short",
      });
      const isoWeek = week?.iso_week || formatIsoWeek(weekStartDate);
      rows.push({
        isoWeek,
        weekLabel: isoWeek.split("-W")[1]
          ? `W${isoWeek.split("-W")[1]}`
          : isoWeek,
        monthLabel,
        cultures: culturesForWeek,
        totalYield,
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    const sortedCultures = [...cultureMeta.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "de"),
    );
    const maxYield = rows.reduce(
      (max, row) => Math.max(max, row.totalYield),
      0,
    );

    return {
      chartData: rows,
      chartCultures: sortedCultures,
      maxTotalYield: maxYield,
    };
  }, [weeklyYield]);
}

function YieldDistributionChart({
  weeklyYield,
}: {
  weeklyYield: YieldCalendarWeek[];
}) {
  const { t } = useTranslation("yieldOverview");
  const { chartData, chartCultures, maxTotalYield } =
    useWeeklyYieldChartData(weeklyYield);
  const yAxisTicks = useMemo(() => {
    const tickCount = 5;
    if (maxTotalYield <= 0) {
      return [0];
    }
    return Array.from({ length: tickCount }, (_, idx) =>
      Number(((maxTotalYield / (tickCount - 1)) * idx).toFixed(1)),
    );
  }, [maxTotalYield]);

  return (
    <Card
      variant="outlined"
      sx={{ borderColor: "surface.surfaceSoftBorder", boxShadow: "none" }}
    >
      <CardContent
        sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {t("chart.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("chart.description")}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
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
              xs: "56px minmax(0, 1fr)",
              sm: "72px minmax(0, 1fr)",
            },
            gap: 1,
            alignItems: "start",
          }}
        >
          <Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column-reverse",
                justifyContent: "space-between",
                height: 260,
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

          <Box sx={{ overflowX: "auto", pb: 0.5 }}>
            <Box sx={{ width: Math.max(chartData.length * 40, 360) }}>
              <Box
                sx={{
                  borderLeft: "1px solid #d1d5db",
                  borderBottom: "1px solid #d1d5db",
                  height: 260,
                  px: 1,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 0.75,
                }}
              >
                {chartData.map((week) => (
                  <Box
                    key={week.isoWeek}
                    sx={{
                      width: 34,
                      flex: "0 0 34px",
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
                      {week.cultures.map((culture) => (
                        <Tooltip
                          key={`${week.isoWeek}-${culture.culture_id}`}
                          title={`${culture.culture_name}: ${culture.yield.toFixed(2)} kg`}
                        >
                          <Box
                            sx={{
                              width: "100%",
                              height: `${maxTotalYield > 0 ? (culture.yield / maxTotalYield) * 100 : 0}%`,
                              minHeight: culture.yield > 0 ? "2px" : 0,
                              backgroundColor: culture.color,
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  height: 44,
                  px: 1,
                  display: "flex",
                  gap: 0.75,
                  alignItems: "flex-start",
                }}
              >
                {chartData.map((week) => (
                  <Box
                    key={`${week.isoWeek}-axis`}
                    sx={{ width: 34, flex: "0 0 34px", textAlign: "center" }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                    >
                      {week.weekLabel}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "text.secondary",
                        lineHeight: 1.2,
                      }}
                    >
                      {week.monthLabel}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function FutureWidgetsPlaceholder() {
  const { t } = useTranslation("yieldOverview");
  return (
    <Card
      variant="outlined"
      sx={{
        borderStyle: "dashed",
        borderColor: "surface.surfaceSoftBorder",
        boxShadow: "none",
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <AssessmentOutlinedIcon color="success" />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t("future.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("future.description")}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function YieldOverviewPage() {
  const { t } = useTranslation("yieldOverview");
  const { shouldShowProjectRequiredState, missingProjectReason } =
    useProjectRequirement();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [weeklyYield, setWeeklyYield] = useState<YieldCalendarWeek[]>([]);
  const displayYear = new Date().getFullYear();

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
          yieldCalendarAPI.list(displayYear),
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
  }, [displayYear, shouldShowProjectRequiredState, t]);

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
        <Stack spacing={3}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, mb: 0.75 }}
            >
              {t("title")}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 840 }}
            >
              {t("intro")}
            </Typography>
          </Box>

          {!hasPlantingPlans ? (
            <EmptyStateCard
              title={t("empty.noPlansTitle")}
              description={t("empty.noPlansDescription")}
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
            <YieldDistributionChart weeklyYield={weeklyYield} />
          ) : (
            <EmptyStateCard
              title={t("empty.noYieldTitle")}
              description={t("empty.noYieldDescription")}
              actions={[
                { label: t("empty.openPlansAction"), to: "/app/anbauplaene" },
              ]}
              containerSx={{ maxWidth: "none", mb: 0 }}
            />
          )}

          <FutureWidgetsPlaceholder />

          <Box
            sx={{
              display: "flex",
              justifyContent: { xs: "stretch", sm: "flex-start" },
            }}
          >
            <Button
              component={RouterLink}
              to="/app/gantt-chart"
              variant="outlined"
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {t("backToCalendar")}
            </Button>
          </Box>
        </Stack>
      </PageSurface>
    </PageContainer>
  );
}
