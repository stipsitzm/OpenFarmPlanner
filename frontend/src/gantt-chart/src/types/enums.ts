export const ViewMode = {
  MINUTE: "minute",
  HOUR: "hour",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  QUARTER: "quarter",
  YEAR: "year",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export const DateDisplayFormat = {
  MONTH_YEAR: "month-year",
  FULL_DATE: "full-date",
  SHORT_DATE: "short-date",
} as const;
export type DateDisplayFormat = (typeof DateDisplayFormat)[keyof typeof DateDisplayFormat];
