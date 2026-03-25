import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

// ── HYDRATION_VS_WORKOUT: Hydration → workout duration / heart rate ───────────
registerDetector({
  id: "HYDRATION_VS_WORKOUT",
  name: "Hydration vs workout performance",
  requiredDomains: ["hydration", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const HIGH_HYDRATION = 2.5;
    const LOW_HYDRATION = 2.0;

    const highDuration: number[] = [];
    const lowDuration: number[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const intake = metrics.get("hydration_water_intake");
      const workouts = data.workoutsByDate.get(date);
      if (intake == null || !workouts || workouts.length === 0) continue;

      const durations = workouts.map((w) => w.duration_minutes).filter((d): d is number => d != null);
      if (durations.length === 0) continue;

      const totalDuration = durations.reduce((a, b) => a + b, 0);

      if (intake >= HIGH_HYDRATION) highDuration.push(totalDuration);
      else if (intake < LOW_HYDRATION) lowDuration.push(totalDuration);
    }

    if (highDuration.length < 3 || lowDuration.length < 3) return null;

    const highAvg = mean(highDuration);
    const lowAvg = mean(lowDuration);
    const delta = highAvg - lowAvg; // positive = better hydration → longer workouts
    const pctDiff = lowAvg > 0 ? Math.abs(delta / lowAvg) : 0;

    if (pctDiff < 0.05) return null;

    const effectSize = Math.min(pctDiff * 2, 1);
    const significance = effectToSignificance(effectSize, { low: 0.08, mid: 0.20, high: 0.35 });

    const direction = delta > 0 ? "longer" : "shorter";

    return {
      detectorId: "HYDRATION_VS_WORKOUT",
      type: "HYDRATION_VS_WORKOUT",
      description: `On days you drink ${HIGH_HYDRATION}L+ water, your workouts last ${Math.round(Math.abs(delta))} minutes ${direction} on average (${Math.round(highAvg)} min vs ${Math.round(lowAvg)} min).`,
      domains: ["hydration", "fitness"],
      data: {
        high_hydration_duration_min: Math.round(highAvg),
        low_hydration_duration_min: Math.round(lowAvg),
        delta_minutes: Math.round(delta),
        pct_diff: Math.round(pctDiff * 100),
        high_hydration_days: highDuration.length,
        low_hydration_days: lowDuration.length,
      },
      significance,
      effectSize,
    };
  },
});
