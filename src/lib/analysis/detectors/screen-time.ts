import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

function regressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── SCREEN_TIME_TREND: Is screen time trending up or down? ────────────────────
registerDetector({
  id: "SCREEN_TIME_TREND",
  name: "Screen time trend",
  requiredDomains: ["screen_time"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const points: { date: string; hours: number }[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const hours = metrics.get("screen_time_total");
      if (hours != null) points.push({ date, hours });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 7) return null;

    const values = points.map((p) => p.hours);
    const slope = regressionSlope(values);
    const avg = mean(values);
    if (avg === 0) return null;

    const totalChange = slope * (values.length - 1);
    const pctChange = totalChange / avg;
    const absPct = Math.abs(pctChange);

    if (absPct < 0.05) return null;

    const firstAvg = Math.round(mean(values.slice(0, Math.ceil(values.length / 2))) * 10) / 10;
    const lastAvg = Math.round(mean(values.slice(Math.floor(values.length / 2))) * 10) / 10;
    const direction = pctChange > 0 ? "increased" : "decreased";

    const effectSize = Math.min(absPct, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.15, high: 0.25 });

    return {
      detectorId: "SCREEN_TIME_TREND",
      type: "SCREEN_TIME_TREND",
      description: `Your daily screen time has ${direction} from ${firstAvg} to ${lastAvg} hours over the past month.`,
      domains: ["screen_time"],
      data: { first_avg_hours: firstAvg, last_avg_hours: lastAvg, pct_change: Math.round(pctChange * 100), days: points.length },
      significance,
      effectSize,
    };
  },
});
