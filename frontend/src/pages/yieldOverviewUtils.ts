export type ChartPeriod = "week" | "month";

const WEEK_LABEL_MIN_WIDTH = 36;
const MONTH_LABEL_MIN_WIDTH = 56;

export function getYieldAxisLabelStep(
  availableWidth: number,
  columnCount: number,
  period: ChartPeriod,
): number {
  if (availableWidth <= 0 || columnCount <= 1) {
    return 1;
  }

  const minimumLabelWidth =
    period === "week" ? WEEK_LABEL_MIN_WIDTH : MONTH_LABEL_MIN_WIDTH;
  const columnWidth = availableWidth / columnCount;
  return Math.max(1, Math.ceil(minimumLabelWidth / columnWidth));
}
