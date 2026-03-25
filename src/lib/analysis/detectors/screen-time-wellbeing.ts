import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";
import { format, subDays } from "date-fns";

// ── SCREEN_TIME_VS_MOOD: High screen time → lower mood ────────────────────────
registerDetector({
  id: "SCREEN_TIME_VS_MOOD",
  name: "Screen time vs mood",
  requiredDomains: ["screen_time", "wellbeing"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");

    // Gather all days with both screen time and mood data
    const allPoints: { screenTime: number; mood: number }[] = [];

    for (const [date, metrics] of data.manualByDateAndMetric) {
      if (date < cutoff) continue;
      const screenTime = metrics.get("screen_time_total");
      if (screenTime == null) continue;

      const manual = data.manualByDateAndMetric.get(date);
      const mood = manual?.get("wellbeing_mood") ?? data.checkinByDate.get(date)?.mood;
      if (mood == null) continue;

      allPoints.push({ screenTime, mood });
    }

    if (allPoints.length < 7) return null;

    const screenTimes = allPoints.map((p) => p.screenTime).sort((a, b) => a - b);
    const median = screenTimes[Math.floor(screenTimes.length / 2)];

    const highMood = allPoints.filter((p) => p.screenTime > median).map((p) => p.mood);
    const lowMood = allPoints.filter((p) => p.screenTime <= median).map((p) => p.mood);

    if (highMood.length < 3 || lowMood.length < 3) return null;

    const highAvg = mean(highMood);
    const lowAvg = mean(lowMood);
    const delta = lowAvg - highAvg; // positive = high screen time → lower mood

    if (Math.abs(delta) < 0.5) return null;

    const medianHours = Math.round(median * 10) / 10;
    const highMoodAvg = Math.round(highAvg * 10) / 10;
    const lowMoodAvg = Math.round(lowAvg * 10) / 10;

    const effectSize = Math.min(Math.abs(delta) / 10, 1);
    const significance = effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.15 });

    return {
      detectorId: "SCREEN_TIME_VS_MOOD",
      type: "SCREEN_TIME_VS_MOOD",
      description: `On days with ${medianHours}+ hours of screen time, your mood averages ${highMoodAvg} vs ${lowMoodAvg} on lighter days.`,
      domains: ["screen_time", "wellbeing"],
      data: {
        high_screen_mood: highMoodAvg,
        low_screen_mood: lowMoodAvg,
        delta: Math.round(delta * 10) / 10,
        median_screen_hours: medianHours,
        high_screen_days: highMood.length,
        low_screen_days: lowMood.length,
      },
      significance,
      effectSize,
    };
  },
});
