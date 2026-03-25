import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

// ── HYDRATION_TREND: Is the user consistently hitting hydration targets? ──────
registerDetector({
  id: "HYDRATION_TREND",
  name: "Hydration consistency",
  requiredDomains: ["hydration"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const TARGET_L = 2.5;
    const LOW_L = 2.0;

    const values: number[] = [];
    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const intake = metrics.get("hydration_water_intake");
      if (intake != null) values.push(intake);
    }

    if (values.length < 7) return null;

    const metTarget = values.filter((v) => v >= TARGET_L).length;
    const pctMet = metTarget / values.length;
    const lowDays = values.filter((v) => v < LOW_L).length;

    if (pctMet >= 0.85) return null; // all good, not interesting

    const effectSize = 1 - pctMet; // higher miss rate = higher effect
    const significance = effectToSignificance(effectSize, { low: 0.15, mid: 0.30, high: 0.50 });

    return {
      detectorId: "HYDRATION_TREND",
      type: "HYDRATION_TREND",
      description: `You've hit your ${TARGET_L}L water target on only ${Math.round(pctMet * 100)}% of days this month. ${lowDays} days were under ${LOW_L}L.`,
      domains: ["hydration"],
      data: {
        pct_met_target: Math.round(pctMet * 100),
        days_met_target: metTarget,
        days_below_low: lowDays,
        total_days: values.length,
        target_litres: TARGET_L,
      },
      significance,
      effectSize,
    };
  },
});
