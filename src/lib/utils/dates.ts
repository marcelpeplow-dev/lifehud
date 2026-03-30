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

/**
 * Get the current date string (YYYY-MM-DD) in the given IANA timezone.
 * Falls back to the local date if the timezone is invalid.
 */
export function localDateStr(timezone?: string | null): string {
  if (timezone) {
    try {
      // en-CA locale formats as YYYY-MM-DD
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
    } catch { /* fall through */ }
  }
  return format(new Date(), "yyyy-MM-dd");
}

/** Relative time string used in today's display: "Today", "Yesterday", "Mar 14".
 *  Pass the user's IANA timezone so comparisons are correct for their locale. */
export function formatRelativeDate(dateStr: string, timezone?: string | null): string {
  const todayStr = localDateStr(timezone);
  const yesterday = format(subDays(parseISO(todayStr), 1), "yyyy-MM-dd");
  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return format(parseISO(dateStr), "MMM d");
}
