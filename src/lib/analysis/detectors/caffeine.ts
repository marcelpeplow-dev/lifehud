import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

/** Simple linear regression slope over an index series. */
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

// ── CAFFEINE_DOSING_PATTERN: Is caffeine intake trending up, down, or stable? ─
registerDetector({
  id: "CAFFEINE_DOSING_PATTERN",
  name: "Caffeine intake trend",
  requiredDomains: ["caffeine"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    // Collect caffeine_total_daily values in date order
    const points: { date: string; value: number }[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const val = metrics.get("caffeine_total_daily");
      if (val != null) points.push({ date, value: val });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 7) return null;

    const values = points.map((p) => p.value);
    const slope = regressionSlope(values);
    const avg = mean(values);
    if (avg === 0) return null;

    const totalChange = slope * (values.length - 1);
    const pctChange = totalChange / avg;
    const absPct = Math.abs(pctChange);

    if (absPct < 0.05) return null;

    const direction = pctChange > 0 ? "risen" : "fallen";
    const firstAvg = Math.round(mean(values.slice(0, Math.ceil(values.length / 2))));
    const lastAvg = Math.round(mean(values.slice(Math.floor(values.length / 2))));

    const effectSize = Math.min(absPct, 1);
    const significance = effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.35 });

    return {
      detectorId: "CAFFEINE_DOSING_PATTERN",
      type: "CAFFEINE_DOSING_PATTERN",
      description: `Your caffeine intake has ${direction} ${Math.round(absPct * 100)}% this month, from ~${firstAvg}mg to ~${lastAvg}mg daily.`,
      domains: ["caffeine"],
      data: { first_avg_mg: firstAvg, last_avg_mg: lastAvg, pct_change: Math.round(pctChange * 100), days: points.length },
      significance,
      effectSize,
    };
  },
});

// ── CAFFEINE_TIMING_PATTERN: Is the last caffeine dose getting later? ─────────
registerDetector({
  id: "CAFFEINE_TIMING_PATTERN",
  name: "Caffeine timing shift",
  requiredDomains: ["caffeine"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const points: { date: string; lastDose: number }[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const lastDose = metrics.get("caffeine_last_dose");
      if (lastDose != null) points.push({ date, lastDose });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 7) return null;

    const last7 = points.slice(-7).map((p) => p.lastDose);
    const all30 = points.map((p) => p.lastDose);

    const avg7 = mean(last7);
    const avg30 = mean(all30);
    const shiftHours = avg7 - avg30;
    const absShift = Math.abs(shiftHours);

    if (absShift < 0.25) return null; // less than 15 min, not interesting

    const toTimeStr = (decimal: number) => {
      const h = Math.floor(decimal);
      const m = Math.round((decimal - h) * 60);
      const period = h >= 12 ? "pm" : "am";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${displayH}:${m.toString().padStart(2, "0")}${period}`;
    };

    const direction = shiftHours > 0 ? "later" : "earlier";
    const shiftMins = Math.round(absShift * 60);

    const effectSize = Math.min(absShift / 3, 1); // 3 hours = max effect
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.17, high: 0.33 });

    return {
      detectorId: "CAFFEINE_TIMING_PATTERN",
      type: "CAFFEINE_TIMING_PATTERN",
      description: `Your last coffee has shifted ${shiftMins} minutes ${direction} — from ${toTimeStr(avg30)} average to ${toTimeStr(avg7)} recently.`,
      domains: ["caffeine"],
      data: {
        avg30_last_dose: Math.round(avg30 * 100) / 100,
        avg7_last_dose: Math.round(avg7 * 100) / 100,
        shift_hours: Math.round(shiftHours * 100) / 100,
        shift_minutes: shiftMins,
        days: points.length,
      },
      significance,
      effectSize,
    };
  },
});
