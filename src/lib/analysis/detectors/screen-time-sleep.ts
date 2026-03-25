import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import type { SleepRecord } from "@/types/index";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

function sleepEfficiency(s: SleepRecord): number | null {
  if (s.duration_minutes == null || s.awake_minutes == null) return null;
  const total = s.duration_minutes + s.awake_minutes;
  return total > 0 ? s.duration_minutes / total : null;
}

// ── SCREEN_BEFORE_BED_VS_SLEEP_LATENCY: Pre-bed screen → more awake time ──────
registerDetector({
  id: "SCREEN_BEFORE_BED_VS_SLEEP_LATENCY",
  name: "Pre-bed screen time vs sleep",
  requiredDomains: ["screen_time", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const HIGH_THRESHOLD = 1;   // > 1 hour pre-bed screen
    const LOW_THRESHOLD = 0.5;  // < 30 min pre-bed screen

    const highAwake: number[] = [];
    const lowAwake: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const preBed = metrics.get("screen_time_before_bed");
      const sleep = data.sleepByDate.get(date);
      if (preBed == null || sleep == null || sleep.awake_minutes == null) continue;

      if (preBed > HIGH_THRESHOLD) highAwake.push(sleep.awake_minutes);
      else if (preBed < LOW_THRESHOLD) lowAwake.push(sleep.awake_minutes);
    }

    if (highAwake.length < 3 || lowAwake.length < 3) return null;

    const highAvg = mean(highAwake);
    const lowAvg = mean(lowAwake);
    const delta = highAvg - lowAvg; // positive = more screen time → more awake time

    if (delta < 6) return null;

    const effectSize = Math.min(delta / 60, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.17, high: 0.25 });

    return {
      detectorId: "SCREEN_BEFORE_BED_VS_SLEEP_LATENCY",
      type: "SCREEN_BEFORE_BED_VS_SLEEP_LATENCY",
      description: `When you have 1+ hour of screen time before bed, you spend ${Math.round(highAvg)} minutes awake vs ${Math.round(lowAvg)} minutes without.`,
      domains: ["screen_time", "sleep"],
      data: {
        high_screen_awake_min: Math.round(highAvg),
        low_screen_awake_min: Math.round(lowAvg),
        delta_minutes: Math.round(delta),
        high_screen_days: highAwake.length,
        low_screen_days: lowAwake.length,
      },
      significance,
      effectSize,
    };
  },
});

// ── SCREEN_BEFORE_BED_VS_SLEEP_QUALITY: Pre-bed screen → sleep quality ────────
registerDetector({
  id: "SCREEN_BEFORE_BED_VS_SLEEP_QUALITY",
  name: "Pre-bed screen vs sleep quality",
  requiredDomains: ["screen_time", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const HIGH_THRESHOLD = 1;
    const LOW_THRESHOLD = 0.5;

    const highEff: number[] = [];
    const lowEff: number[] = [];
    const highDeep: number[] = [];
    const lowDeep: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const preBed = metrics.get("screen_time_before_bed");
      const sleep = data.sleepByDate.get(date);
      if (preBed == null || sleep == null) continue;

      const eff = sleepEfficiency(sleep);
      if (eff != null) {
        if (preBed > HIGH_THRESHOLD) highEff.push(eff);
        else if (preBed < LOW_THRESHOLD) lowEff.push(eff);
      }

      if (sleep.deep_sleep_minutes != null && sleep.duration_minutes != null && sleep.duration_minutes > 0) {
        const deepPct = sleep.deep_sleep_minutes / sleep.duration_minutes;
        if (preBed > HIGH_THRESHOLD) highDeep.push(deepPct);
        else if (preBed < LOW_THRESHOLD) lowDeep.push(deepPct);
      }
    }

    const hasEff = highEff.length >= 3 && lowEff.length >= 3;
    const hasDeep = highDeep.length >= 3 && lowDeep.length >= 3;

    if (!hasEff && !hasDeep) return null;

    const effDelta = hasEff ? mean(lowEff) - mean(highEff) : 0;
    const deepDelta = hasDeep ? mean(lowDeep) - mean(highDeep) : 0;

    if (effDelta < 0.02 && deepDelta < 0.02) return null;

    const parts: string[] = [];
    if (hasEff && effDelta >= 0.02)
      parts.push(`sleep efficiency drops ${Math.round(effDelta * 100)}% (${Math.round(mean(lowEff) * 100)}% vs ${Math.round(mean(highEff) * 100)}%)`);
    if (hasDeep && deepDelta >= 0.02)
      parts.push(`deep sleep falls ${Math.round(deepDelta * 100)}% (${Math.round(mean(lowDeep) * 100)}% vs ${Math.round(mean(highDeep) * 100)}%)`);

    if (parts.length === 0) return null;

    const effectSize = Math.min(Math.max(effDelta * 5, deepDelta * 5), 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    return {
      detectorId: "SCREEN_BEFORE_BED_VS_SLEEP_QUALITY",
      type: "SCREEN_BEFORE_BED_VS_SLEEP_QUALITY",
      description: `Pre-bed screen time ${parts.join(" and ")}.`,
      domains: ["screen_time", "sleep"],
      data: {
        high_screen_eff_pct: hasEff ? Math.round(mean(highEff) * 100) : null,
        low_screen_eff_pct: hasEff ? Math.round(mean(lowEff) * 100) : null,
        eff_delta_pct: hasEff ? Math.round(effDelta * 100) : null,
        high_screen_deep_pct: hasDeep ? Math.round(mean(highDeep) * 100) : null,
        low_screen_deep_pct: hasDeep ? Math.round(mean(lowDeep) * 100) : null,
        deep_delta_pct: hasDeep ? Math.round(deepDelta * 100) : null,
        high_days: Math.max(highEff.length, highDeep.length),
        low_days: Math.max(lowEff.length, lowDeep.length),
      },
      significance,
      effectSize,
    };
  },
});
