import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, halfTrend, effectToSignificance } from "./utils";

// ── SLEEP_DURATION_STAT: Average sleep duration summary ──────────────────────
registerDetector({
  id: "SLEEP_DURATION_STAT",
  name: "Average sleep duration",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const durations = data.sleepRecords
      .map((s) => s.duration_minutes)
      .filter((v): v is number => v != null);

    if (durations.length < 3) return null;

    const avg = mean(durations);
    const avgH = Math.round((avg / 60) * 10) / 10;
    return {
      detectorId: "SLEEP_DURATION_STAT",
      type: "SLEEP_DURATION_STAT",
      description: `Average sleep over the last ${durations.length} nights: ${avgH}h.`,
      domains: ["sleep"],
      data: { avg_minutes: Math.round(avg), avg_hours: avgH, nights: durations.length },
      significance: 0.15,
      effectSize: 0,
    };
  },
});

// ── SLEEP_DURATION_TREND: Sleep duration week-over-week change ───────────────
registerDetector({
  id: "SLEEP_DURATION_TREND",
  name: "Sleep duration trend",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const durations = data.sleepRecords
      .map((s) => s.duration_minutes)
      .filter((v): v is number => v != null);

    if (durations.length < 6) return null;

    const trend = halfTrend(durations.slice(-14));
    const last7 = durations.slice(-7);
    const prior7 = durations.slice(-14, -7);
    if (last7.length < 3 || prior7.length < 3) return null;

    const recentAvg = mean(last7);
    const priorAvg = mean(prior7);
    const deltaMins = Math.round(recentAvg - priorAvg);

    if (trend === "flat" || Math.abs(deltaMins) < 20) return null;

    const effectSize = Math.abs(deltaMins) / priorAvg;
    return {
      detectorId: "SLEEP_DURATION_TREND",
      type: "SLEEP_DURATION_TREND",
      description: `Sleep duration trending ${trend}: ${deltaMins > 0 ? "+" : ""}${deltaMins} min vs prior week (recent avg ${Math.round(recentAvg / 6) / 10}h).`,
      domains: ["sleep"],
      data: { trend, delta_minutes: deltaMins, recent_avg: Math.round(recentAvg), prior_avg: Math.round(priorAvg) },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.07, high: 0.12 }),
      effectSize,
    };
  },
});

// ── BEDTIME_CONSISTENCY: Bedtime variability ─────────────────────────────────
registerDetector({
  id: "BEDTIME_CONSISTENCY",
  name: "Bedtime consistency",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const bedtimes = data.sleepRecords
      .filter((s) => s.bedtime != null)
      .map((s) => {
        const bt = new Date(s.bedtime!);
        const h = bt.getUTCHours() + bt.getUTCMinutes() / 60;
        return h < 6 ? h + 24 : h;
      });

    if (bedtimes.length < 7) return null;

    const avg = mean(bedtimes);
    const sd = Math.sqrt(mean(bedtimes.map((b) => (b - avg) ** 2)));

    if (sd <= 0.5) return null;

    const avgH = Math.floor(avg % 24);
    const avgM = Math.round((avg % 1) * 60);
    const effectSize = sd; // hours of variance

    return {
      detectorId: "BEDTIME_CONSISTENCY",
      type: "BEDTIME_CONSISTENCY",
      description: `Bedtime varies significantly (±${Math.round(sd * 60)} min, avg ${avgH}:${avgM.toString().padStart(2, "0")}).`,
      domains: ["sleep"],
      data: { avg_bedtime_hhmm: `${avgH}:${avgM.toString().padStart(2, "0")}`, std_dev_mins: Math.round(sd * 60) },
      significance: effectToSignificance(effectSize, { low: 0.5, mid: 0.75, high: 1.0 }),
      effectSize,
    };
  },
});
