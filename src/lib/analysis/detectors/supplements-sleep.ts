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

// ── MAGNESIUM_VS_SLEEP: Supplement nights → better sleep efficiency & deep ────
registerDetector({
  id: "MAGNESIUM_VS_SLEEP",
  name: "Supplements vs sleep quality",
  requiredDomains: ["supplements", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const suppEff: number[] = [];
    const noSuppEff: number[] = [];
    const suppDeep: number[] = [];
    const noSuppDeep: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const taken = metrics.get("supplements_taken");
      const sleep = data.sleepByDate.get(date);
      if (taken == null || sleep == null) continue;

      const eff = sleepEfficiency(sleep);
      if (eff != null) {
        if (taken === 1) suppEff.push(eff);
        else noSuppEff.push(eff);
      }

      if (sleep.deep_sleep_minutes != null && sleep.duration_minutes != null && sleep.duration_minutes > 0) {
        const deepPct = sleep.deep_sleep_minutes / sleep.duration_minutes;
        if (taken === 1) suppDeep.push(deepPct);
        else noSuppDeep.push(deepPct);
      }
    }

    const hasEff = suppEff.length >= 3 && noSuppEff.length >= 3;
    const hasDeep = suppDeep.length >= 3 && noSuppDeep.length >= 3;

    if (!hasEff && !hasDeep) return null;

    const effDelta = hasEff ? mean(suppEff) - mean(noSuppEff) : 0;
    const deepDelta = hasDeep ? mean(suppDeep) - mean(noSuppDeep) : 0;

    if (effDelta < 0.01 && deepDelta < 0.01) return null;

    const parts: string[] = [];
    if (hasEff && effDelta >= 0.01) {
      const suppPct = Math.round(mean(suppEff) * 100);
      const noSuppPct = Math.round(mean(noSuppEff) * 100);
      parts.push(`sleep efficiency ${suppPct}% vs ${noSuppPct}% without`);
    }
    if (hasDeep && deepDelta >= 0.01) {
      const suppPct = Math.round(mean(suppDeep) * 100);
      const noSuppPct = Math.round(mean(noSuppDeep) * 100);
      parts.push(`deep sleep ${suppPct}% vs ${noSuppPct}%`);
    }

    if (parts.length === 0) return null;

    const effectSize = Math.min(Math.max(effDelta * 5, deepDelta * 5), 1);
    const significance = effectToSignificance(effectSize, { low: 0.05, mid: 0.15, high: 0.25 });

    return {
      detectorId: "MAGNESIUM_VS_SLEEP",
      type: "MAGNESIUM_VS_SLEEP",
      description: `On nights you take your supplements: ${parts.join(", ")}.`,
      domains: ["supplements", "sleep"],
      data: {
        supp_eff_pct: hasEff ? Math.round(mean(suppEff) * 100) : null,
        no_supp_eff_pct: hasEff ? Math.round(mean(noSuppEff) * 100) : null,
        eff_delta_pct: hasEff ? Math.round(effDelta * 100) : null,
        supp_deep_pct: hasDeep ? Math.round(mean(suppDeep) * 100) : null,
        no_supp_deep_pct: hasDeep ? Math.round(mean(noSuppDeep) * 100) : null,
        deep_delta_pct: hasDeep ? Math.round(deepDelta * 100) : null,
        supp_nights: Math.max(suppEff.length, suppDeep.length),
        no_supp_nights: Math.max(noSuppEff.length, noSuppDeep.length),
      },
      significance,
      effectSize,
    };
  },
});

// ── MELATONIN_VS_SLEEP_LATENCY: Supplement nights → less awake time ───────────
registerDetector({
  id: "MELATONIN_VS_SLEEP_LATENCY",
  name: "Supplements vs time to sleep",
  requiredDomains: ["supplements", "sleep"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const suppAwake: number[] = [];
    const noSuppAwake: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const taken = metrics.get("supplements_taken");
      const sleep = data.sleepByDate.get(date);
      if (taken == null || sleep == null || sleep.awake_minutes == null) continue;

      if (taken === 1) suppAwake.push(sleep.awake_minutes);
      else noSuppAwake.push(sleep.awake_minutes);
    }

    if (suppAwake.length < 3 || noSuppAwake.length < 3) return null;

    const suppAvg = mean(suppAwake);
    const noSuppAvg = mean(noSuppAwake);
    const delta = noSuppAvg - suppAvg; // positive = supplements reduce awake time

    if (delta < 4) return null;

    const effectSize = Math.min(delta / 60, 1);
    const significance = effectToSignificance(effectSize, { low: 0.05, mid: 0.12, high: 0.20 });

    return {
      detectorId: "MELATONIN_VS_SLEEP_LATENCY",
      type: "MELATONIN_VS_SLEEP_LATENCY",
      description: `You spend ${Math.round(delta)} fewer minutes awake on nights you take supplements (${Math.round(suppAvg)} min vs ${Math.round(noSuppAvg)} min without).`,
      domains: ["supplements", "sleep"],
      data: {
        supp_awake_min: Math.round(suppAvg),
        no_supp_awake_min: Math.round(noSuppAvg),
        delta_minutes: Math.round(delta),
        supp_nights: suppAwake.length,
        no_supp_nights: noSuppAwake.length,
      },
      significance,
      effectSize,
    };
  },
});
