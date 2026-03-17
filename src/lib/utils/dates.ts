import { format, subDays, startOfWeek, parseISO } from "date-fns";

/** Returns "YYYY-MM-DD" strings for the last N days, oldest first */
export function buildDateArray(days: number, endDate = new Date()): string[] {
  return Array.from({ length: days }, (_, i) =>
    format(subDays(endDate, days - 1 - i), "yyyy-MM-dd")
  );
}

/** Monday of the current week as "YYYY-MM-DD" */
export function getWeekStart(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Short axis label for chart: "Mon", "Tue", etc. */
export function formatChartLabel(dateStr: string): string {
  return format(parseISO(dateStr), "EEE");
}

/** Short date label: "Mar 16" */
export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d");
}

/** Relative time string used in todays display: "Today", "Yesterday", "Mar 14" */
export function formatRelativeDate(dateStr: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return format(parseISO(dateStr), "MMM d");
}
