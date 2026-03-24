import { format, subDays } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";

// ── SLEEP_PERFORMANCE_CORRELATION: Sleep duration → workout intensity ────────
registerDetector({
  id: "SLEEP_PERFORMANCE_CORRELATION",
  name: "Sleep vs workout performance",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const workoutsWithSleep = data.workouts
      .map((w) => {
        const prevDate = format(subDays(new Date(w.date), 1), "yyyy-MM-dd");
        const prevNight = data.sleepByDate.get(prevDate);
        return prevNight
          ? { sleep: prevNight.duration_minutes, intensity: w.intensity_score }
          : null;
      })
      .filter(
        (x): x is { sleep: number; intensity: number } =>
          x !== null && x.sleep != null && x.intensity != null,
      );

    if (workoutsWithSleep.length < 5) return null;

    const goodSleep = workoutsWithSleep.filter((x) => x.sleep >= 420);
    const poorSleep = workoutsWithSleep.filter((x) => x.sleep < 420);
    if (goodSleep.length < 2 || poorSleep.length < 2) return null;

    const goodAvg = Math.round(mean(goodSleep.map((x) => x.intensity)));
    const poorAvg = Math.round(mean(poorSleep.map((x) => x.intensity)));
    const delta = goodAvg - poorAvg;
    if (Math.abs(delta) < 8) return null;

    const effectSize = Math.abs(delta) / Math.max(poorAvg, 1);
    return {
      detectorId: "SLEEP_PERFORMANCE_CORRELATION",
      type: "sleep_performance_correlation",
      description: `Workout intensity is ${Math.abs(delta)} points ${delta > 0 ? "higher" : "lower"} after 7h+ sleep vs under 7h (avg ${goodAvg} vs ${poorAvg}). ${workoutsWithSleep.length} workouts analyzed.`,
      domains: ["sleep", "fitness"],
      data: {
        well_rested_avg: goodAvg,
        fatigued_avg: poorAvg,
        delta,
        sample_size: workoutsWithSleep.length,
        good_sleep_sample: goodSleep.length,
        poor_sleep_sample: poorSleep.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});

// ── SLEEP_QUALITY_CORRELATION: Deep+REM % → workout intensity ────────────────
registerDetector({
  id: "SLEEP_QUALITY_CORRELATION",
  name: "Sleep quality vs workout performance",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const sleepQualityVsWorkout = data.workouts
      .map((w) => {
        const prevDate = format(subDays(new Date(w.date), 1), "yyyy-MM-dd");
        const prevNight = data.sleepByDate.get(prevDate);
        if (!prevNight?.duration_minutes || !w.intensity_score) return null;
        const deepRem =
          (prevNight.deep_sleep_minutes ?? 0) + (prevNight.rem_sleep_minutes ?? 0);
        if (prevNight.duration_minutes < 60 || deepRem === 0) return null;
        const qualityPct = deepRem / prevNight.duration_minutes;
        return { qualityPct, intensity: w.intensity_score };
      })
      .filter(
        (x): x is { qualityPct: number; intensity: number } => x !== null,
      );

    if (sleepQualityVsWorkout.length < 5) return null;

    const highQuality = sleepQualityVsWorkout.filter((x) => x.qualityPct >= 0.45);
    const lowQuality = sleepQualityVsWorkout.filter((x) => x.qualityPct < 0.35);
    if (highQuality.length < 2 || lowQuality.length < 2) return null;

    const highAvg = Math.round(mean(highQuality.map((x) => x.intensity)));
    const lowAvg = Math.round(mean(lowQuality.map((x) => x.intensity)));
    const delta = highAvg - lowAvg;
    if (Math.abs(delta) < 8) return null;

    const avgHighPct = Math.round(mean(highQuality.map((x) => x.qualityPct)) * 100);
    const avgLowPct = Math.round(mean(lowQuality.map((x) => x.qualityPct)) * 100);
    const effectSize = Math.abs(delta) / Math.max(lowAvg, 1);

    return {
      detectorId: "SLEEP_QUALITY_CORRELATION",
      type: "sleep_quality_correlation",
      description: `Workout intensity is ${Math.abs(delta)} points higher after high-quality sleep (${avgHighPct}% deep+REM) vs shallow nights (${avgLowPct}% deep+REM) — avg intensity ${highAvg} vs ${lowAvg}. ${sleepQualityVsWorkout.length} workouts analyzed.`,
      domains: ["sleep", "fitness"],
      data: {
        high_quality_avg: highAvg,
        low_quality_avg: lowAvg,
        delta,
        high_pct: avgHighPct,
        low_pct: avgLowPct,
        sample_size: sleepQualityVsWorkout.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});
