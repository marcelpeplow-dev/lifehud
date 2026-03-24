import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, halfTrend, effectToSignificance } from "./utils";

// ── WORKOUT_FREQUENCY_STAT: Workout count summary ────────────────────────────
registerDetector({
  id: "WORKOUT_FREQUENCY_STAT",
  name: "Workout frequency stat",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.workouts.length === 0) return null;

    const perWeek = (data.workouts.length / 4).toFixed(1);
    return {
      detectorId: "WORKOUT_FREQUENCY_STAT",
      type: "WORKOUT_FREQUENCY_STAT",
      description: `${data.workouts.length} workouts in 30 days (~${perWeek}/week average).`,
      domains: ["fitness"],
      data: { total: data.workouts.length, per_week: parseFloat(perWeek) },
      significance: 0.15,
      effectSize: 0,
    };
  },
});

// ── RESTING_HR_TREND: Resting heart rate trend ───────────────────────────────
registerDetector({
  id: "RESTING_HR_TREND",
  name: "Resting heart rate trend",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const hrValues = data.dailyMetrics
      .map((m) => m.resting_heart_rate)
      .filter((v): v is number => v != null);

    if (hrValues.length < 7) return null;

    const trend = halfTrend(hrValues);
    const recentAvg = Math.round(mean(hrValues.slice(-7)));
    const priorAvg = Math.round(mean(hrValues.slice(0, 7)));
    const delta = recentAvg - priorAvg;

    if (trend === "flat") {
      // Stable HR — still a stat summary
      return {
        detectorId: "RESTING_HR_TREND",
        type: "RESTING_HR_TREND",
        description: `Resting heart rate stable at ~${recentAvg} bpm over the last 30 days.`,
        domains: ["fitness"],
        data: { avg: recentAvg },
        significance: 0.1,
        effectSize: 0,
      };
    }

    const effectSize = Math.abs(delta) / priorAvg;
    return {
      detectorId: "RESTING_HR_TREND",
      type: "RESTING_HR_TREND",
      description: `Resting HR ${trend === "down" ? "dropping" : "rising"}: recent avg ${recentAvg} bpm vs ${priorAvg} bpm (${delta > 0 ? "+" : ""}${delta} bpm over 30 days).`,
      domains: ["fitness"],
      data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.06, high: 0.10 }),
      effectSize,
    };
  },
});
