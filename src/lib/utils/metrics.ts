import type { TrendDirection } from "@/types/index";

/** Convert minutes to a human-readable duration string: "7h 23m" or "45m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a numeric value with a unit for display: "62 bpm", "45 ms" */
export function formatMetric(
  value: number | null | undefined,
  unit: string
): string {
  if (value == null) return "—";
  return `${Math.round(value)} ${unit}`;
}

/** Calculate trend direction and formatted delta string between two values.
 *  Returns direction and a string like "+12 min vs avg" */
export function calcTrend(
  current: number | null | undefined,
  baseline: number | null | undefined,
  unit = ""
): { direction: TrendDirection; label: string } {
  if (current == null || baseline == null) {
    return { direction: "flat", label: "no data" };
  }
  const delta = current - baseline;
  const absDelta = Math.abs(Math.round(delta));
  if (absDelta < 1) return { direction: "flat", label: `~avg${unit ? " " + unit : ""}` };
  const sign = delta > 0 ? "+" : "−";
  const direction: TrendDirection = delta > 0 ? "up" : "down";
  return {
    direction,
    label: `${sign}${absDelta}${unit ? " " + unit : ""} vs avg`,
  };
}

/** Calculate a simple percentage clamped to 0–100 */
export function calcProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

/**
 * Format a delta value for display in stat cards.
 * Applies smart rounding based on metric unit type:
 *  - Integer units (steps, kcal, bpm, ms, elo, count, /10): no decimals, with locale separators
 *  - Decimal units (hours, %, L, /game, min, mg): 1 decimal place
 */
export function formatDeltaDisplay(delta: number, unit: string, unitLabel: string): string {
  const sign = delta >= 0 ? "+" : "-";
  const abs = Math.abs(delta);

  const intUnits = new Set(["steps", "kcal", "bpm", "ms", "elo", "count", "games"]);
  const isIntUnit = intUnits.has(unit) || unit === "/10";

  const numStr = isIntUnit
    ? Math.round(abs).toLocaleString()
    : abs.toFixed(1);

  // For percentage metrics, suffix "pp" (percentage points) instead of "%" to avoid ambiguity
  const displayLabel = unit === "%" ? " pp" : (unitLabel && unitLabel !== "—" ? ` ${unitLabel}` : "");
  return `${sign}${numStr}${displayLabel}`;
}

/** Average an array of numbers, ignoring nulls */
export function average(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
