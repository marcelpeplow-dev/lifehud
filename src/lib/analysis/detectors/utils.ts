/** Shared utilities for detectors. */

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function halfTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 4) return "flat";
  const mid = Math.floor(values.length / 2);
  const first = mean(values.slice(0, mid));
  const second = mean(values.slice(mid));
  const pct = first === 0 ? 0 : Math.abs((second - first) / first);
  if (pct < 0.03) return "flat";
  return second > first ? "up" : "down";
}

export function winRate(games: { result: string }[]): number {
  return games.length > 0
    ? games.filter((g) => g.result === "win").length / games.length
    : 0;
}

export function avgAccuracy(games: { accuracy: number | null }[]): number | null {
  const withAcc = games.filter((g) => g.accuracy !== null);
  return withAcc.length > 0 ? mean(withAcc.map((g) => g.accuracy!)) : null;
}

/**
 * Convert an effect size (absolute difference) into a 0–1 significance score.
 * - effectSize > threshold high → 0.9–1.0
 * - effectSize between mid and high → 0.7–0.8
 * - effectSize between low and mid → 0.4–0.6
 * - effectSize < low → 0.1–0.3
 */
export function effectToSignificance(
  effectSize: number,
  thresholds: { low: number; mid: number; high: number } = { low: 0.10, mid: 0.20, high: 0.30 },
): number {
  if (effectSize >= thresholds.high) return 0.9 + Math.min(0.1, (effectSize - thresholds.high) * 0.5);
  if (effectSize >= thresholds.mid) return 0.7 + 0.1 * ((effectSize - thresholds.mid) / (thresholds.high - thresholds.mid));
  if (effectSize >= thresholds.low) return 0.4 + 0.2 * ((effectSize - thresholds.low) / (thresholds.mid - thresholds.low));
  return 0.1 + 0.2 * (effectSize / thresholds.low);
}
