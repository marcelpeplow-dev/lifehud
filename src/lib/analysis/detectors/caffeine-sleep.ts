import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import type { SleepRecord } from "@/types/index";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

/** Sleep efficiency: duration / (duration + awake). Returns null if data insufficient. */
function sleepEfficiency(s: SleepRecord): number | null {
  if (s.duration_minutes == null || s.awake_minutes == null) return null;
  const total = s.duration_minutes + s.awake_minutes;
  return total > 0 ? s.duration_minutes / total : null;
}

// ── CAFFEINE_VS_SLEEP_EFFICIENCY: High caffeine → lower sleep efficiency ──────
registerDetector({
  id: "CAFFEINE_VS_SLEEP_EFFICIENCY",
  name: "Caffeine vs sleep efficiency",
  requiredDomains: ["caffeine", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const highEff: number[] = [];
    const lowEff: number[] = [];

    // Gather all days with both caffeine and sleep data
    const caffeineValues: number[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const c = metrics.get("caffeine_total_daily");
      const sleep = data.sleepByDate.get(date);
      if (c == null || sleep == null) continue;
      const eff = sleepEfficiency(sleep);
      if (eff == null) continue;
      caffeineValues.push(c);
    }

    if (caffeineValues.length < 7) return null;

    const median = [...caffeineValues].sort((a, b) => a - b)[Math.floor(caffeineValues.length / 2)];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const c = metrics.get("caffeine_total_daily");
      const sleep = data.sleepByDate.get(date);
      if (c == null || sleep == null) continue;
      const eff = sleepEfficiency(sleep);
      if (eff == null) continue;
      if (c > median) highEff.push(eff);
      else lowEff.push(eff);
    }

    if (highEff.length < 3 || lowEff.length < 3) return null;

    const highAvg = mean(highEff);
    const lowAvg = mean(lowEff);
    const delta = lowAvg - highAvg; // positive = high caffeine hurts
    const absDelta = Math.abs(delta);

    if (absDelta < 0.02) return null; // < 2% difference — not meaningful

    const effectSize = Math.min(absDelta * 5, 1);
    const significance = effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.35 });

    const highPct = Math.round(highAvg * 100);
    const lowPct = Math.round(lowAvg * 100);
    const medianMg = Math.round(median);

    return {
      detectorId: "CAFFEINE_VS_SLEEP_EFFICIENCY",
      type: "CAFFEINE_VS_SLEEP_EFFICIENCY",
      description: `On days you consume ${medianMg}mg+ caffeine, your sleep efficiency drops from ${lowPct}% to ${highPct}%.`,
      domains: ["caffeine", "sleep"],
      data: {
        high_caffeine_efficiency_pct: highPct,
        low_caffeine_efficiency_pct: lowPct,
        delta_pct: Math.round(delta * 100),
        median_caffeine_mg: medianMg,
        high_days: highEff.length,
        low_days: lowEff.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── CAFFEINE_VS_SLEEP_LATENCY: High caffeine → more time awake in bed ─────────
registerDetector({
  id: "CAFFEINE_VS_SLEEP_LATENCY",
  name: "Caffeine vs sleep quality",
  requiredDomains: ["caffeine", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const allPoints: { caffeine: number; awakeMin: number }[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const c = metrics.get("caffeine_total_daily");
      const sleep = data.sleepByDate.get(date);
      if (c == null || sleep == null || sleep.awake_minutes == null) continue;
      allPoints.push({ caffeine: c, awakeMin: sleep.awake_minutes });
    }

    if (allPoints.length < 7) return null;

    const sorted = [...allPoints].sort((a, b) => a.caffeine - b.caffeine);
    const median = sorted[Math.floor(sorted.length / 2)].caffeine;

    const highAwake = allPoints.filter((p) => p.caffeine > median).map((p) => p.awakeMin);
    const lowAwake = allPoints.filter((p) => p.caffeine <= median).map((p) => p.awakeMin);

    if (highAwake.length < 3 || lowAwake.length < 3) return null;

    const highAvg = mean(highAwake);
    const lowAvg = mean(lowAwake);
    const delta = highAvg - lowAvg; // positive = high caffeine = more awake time

    if (delta < 4) return null; // < 4 min difference — skip

    const effectSize = Math.min(delta / 60, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.17, high: 0.25 });

    return {
      detectorId: "CAFFEINE_VS_SLEEP_LATENCY",
      type: "CAFFEINE_VS_SLEEP_LATENCY",
      description: `High caffeine days add ${Math.round(delta)} minutes of awake time during sleep vs low-caffeine days (${Math.round(highAvg)} min vs ${Math.round(lowAvg)} min).`,
      domains: ["caffeine", "sleep"],
      data: {
        high_caffeine_awake_min: Math.round(highAvg),
        low_caffeine_awake_min: Math.round(lowAvg),
        delta_minutes: Math.round(delta),
        median_caffeine_mg: Math.round(median),
        high_days: highAwake.length,
        low_days: lowAwake.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── LATE_CAFFEINE_VS_SLEEP: Late last dose → worse sleep efficiency ────────────
registerDetector({
  id: "LATE_CAFFEINE_VS_SLEEP",
  name: "Late caffeine vs sleep",
  requiredDomains: ["caffeine", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const EARLY_CUTOFF = 14; // before 2pm
    const LATE_CUTOFF = 16;  // after 4pm

    const earlyEff: number[] = [];
    const lateEff: number[] = [];
    const earlyAwake: number[] = [];
    const lateAwake: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const lastDose = metrics.get("caffeine_last_dose");
      const sleep = data.sleepByDate.get(date);
      if (lastDose == null || sleep == null) continue;

      const eff = sleepEfficiency(sleep);
      if (eff != null) {
        if (lastDose < EARLY_CUTOFF) earlyEff.push(eff);
        else if (lastDose > LATE_CUTOFF) lateEff.push(eff);
      }
      if (sleep.awake_minutes != null) {
        if (lastDose < EARLY_CUTOFF) earlyAwake.push(sleep.awake_minutes);
        else if (lastDose > LATE_CUTOFF) lateAwake.push(sleep.awake_minutes);
      }
    }

    if (earlyEff.length < 3 || lateEff.length < 3) {
      if (earlyAwake.length < 3 || lateAwake.length < 3) return null;
    }

    const effDelta = earlyEff.length >= 3 && lateEff.length >= 3
      ? mean(earlyEff) - mean(lateEff) : 0;
    const awakeDelta = earlyAwake.length >= 3 && lateAwake.length >= 3
      ? mean(lateAwake) - mean(earlyAwake) : 0;

    if (effDelta < 0.03 && awakeDelta < 8) return null;

    const earlyEffPct = earlyEff.length >= 3 ? Math.round(mean(earlyEff) * 100) : null;
    const lateEffPct = lateEff.length >= 3 ? Math.round(mean(lateEff) * 100) : null;
    const earlyAwakeMin = earlyAwake.length >= 3 ? Math.round(mean(earlyAwake)) : null;
    const lateAwakeMin = lateAwake.length >= 3 ? Math.round(mean(lateAwake)) : null;

    const parts: string[] = [];
    if (earlyEffPct != null && lateEffPct != null && effDelta >= 0.03)
      parts.push(`sleep efficiency drops from ${earlyEffPct}% to ${lateEffPct}%`);
    if (earlyAwakeMin != null && lateAwakeMin != null && awakeDelta >= 8)
      parts.push(`you spend ${Math.round(awakeDelta)} more minutes awake (${lateAwakeMin} min vs ${earlyAwakeMin} min before 2pm)`);

    if (parts.length === 0) return null;

    const effectSize = Math.min(Math.max(effDelta * 5, awakeDelta / 60), 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    return {
      detectorId: "LATE_CAFFEINE_VS_SLEEP",
      type: "LATE_CAFFEINE_VS_SLEEP",
      description: `When your last coffee is after 4pm, ${parts.join(" and ")}.`,
      domains: ["caffeine", "sleep"],
      data: {
        early_eff_pct: earlyEffPct,
        late_eff_pct: lateEffPct,
        eff_delta_pct: effDelta > 0 ? Math.round(effDelta * 100) : null,
        early_awake_min: earlyAwakeMin,
        late_awake_min: lateAwakeMin,
        awake_delta_min: awakeDelta > 0 ? Math.round(awakeDelta) : null,
        early_days: Math.max(earlyEff.length, earlyAwake.length),
        late_days: Math.max(lateEff.length, lateAwake.length),
      },
      significance,
      effectSize,
    };
  },
});

// ── CAFFEINE_VS_HRV: High caffeine → lower overnight HRV ─────────────────────
registerDetector({
  id: "CAFFEINE_VS_HRV",
  name: "Caffeine vs sleep HRV",
  requiredDomains: ["caffeine", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const allPoints: { caffeine: number; hrv: number }[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const c = metrics.get("caffeine_total_daily");
      const sleep = data.sleepByDate.get(date);
      if (c == null || sleep == null || sleep.avg_hrv == null) continue;
      allPoints.push({ caffeine: c, hrv: sleep.avg_hrv });
    }

    if (allPoints.length < 7) return null;

    const sorted = [...allPoints].sort((a, b) => a.caffeine - b.caffeine);
    const median = sorted[Math.floor(sorted.length / 2)].caffeine;

    const highHrv = allPoints.filter((p) => p.caffeine > median).map((p) => p.hrv);
    const lowHrv = allPoints.filter((p) => p.caffeine <= median).map((p) => p.hrv);

    if (highHrv.length < 3 || lowHrv.length < 3) return null;

    const highAvg = mean(highHrv);
    const lowAvg = mean(lowHrv);
    const delta = lowAvg - highAvg; // positive = high caffeine suppresses HRV
    const pctDiff = lowAvg > 0 ? delta / lowAvg : 0;

    if (pctDiff < 0.03) return null;

    const effectSize = Math.min(pctDiff * 3, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    return {
      detectorId: "CAFFEINE_VS_HRV",
      type: "CAFFEINE_VS_HRV",
      description: `Your sleep HRV averages ${Math.round(highAvg)}ms on high-caffeine days vs ${Math.round(lowAvg)}ms on low-caffeine days.`,
      domains: ["caffeine", "sleep"],
      data: {
        high_caffeine_hrv: Math.round(highAvg),
        low_caffeine_hrv: Math.round(lowAvg),
        delta_ms: Math.round(delta),
        pct_diff: Math.round(pctDiff * 100),
        median_caffeine_mg: Math.round(median),
        high_days: highHrv.length,
        low_days: lowHrv.length,
      },
      significance,
      effectSize,
    };
  },
});
