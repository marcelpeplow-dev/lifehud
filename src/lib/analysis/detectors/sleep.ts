import { getDay } from "date-fns";
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

// ── DEEP_SLEEP_RATIO: Deep sleep percentage trend ────────────────────────────
registerDetector({
  id: "DEEP_SLEEP_RATIO",
  name: "Deep sleep ratio trend",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const withDeep = data.sleepRecords.filter(
      (s) => s.duration_minutes && s.duration_minutes > 0 && s.deep_sleep_minutes != null,
    );
    if (withDeep.length < 7) return null;

    const ratios = withDeep.map((s) => s.deep_sleep_minutes! / s.duration_minutes!);
    const last7 = ratios.slice(-7);
    const avg30 = mean(ratios);
    const avg7 = mean(last7);
    const delta = avg7 - avg30;

    if (Math.abs(delta) < 0.03) return null; // less than 3% change

    const pct30 = Math.round(avg30 * 100);
    const pct7 = Math.round(avg7 * 100);
    const effectSize = Math.abs(delta);

    return {
      detectorId: "DEEP_SLEEP_RATIO",
      type: "DEEP_SLEEP_RATIO",
      description: `Deep sleep ratio ${delta > 0 ? "improving" : "declining"}: ${pct7}% this week vs ${pct30}% 30-day average. ${withDeep.length} nights analyzed.`,
      domains: ["sleep"],
      data: { ratio_7d: pct7, ratio_30d: pct30, delta_pct: Math.round(delta * 100), nights: withDeep.length },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.06, high: 0.10 }),
      effectSize,
    };
  },
});

// ── SLEEP_DEBT_ACCUMULATION: Weekly sleep debt ───────────────────────────────
registerDetector({
  id: "SLEEP_DEBT_ACCUMULATION",
  name: "Sleep debt accumulation",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const durations = data.sleepRecords
      .map((s) => s.duration_minutes)
      .filter((v): v is number => v != null);
    if (durations.length < 7) return null;

    const target = durations.length >= 14 ? mean(durations) : 450; // 7.5h default
    const lastWeek = durations.slice(-7);
    const debtMinutes = lastWeek.reduce((sum, d) => sum + Math.max(0, target - d), 0);
    const debtHours = Math.round((debtMinutes / 60) * 10) / 10;

    if (debtHours < 3) return null; // not significant

    const effectSize = debtHours / 10; // normalize to rough 0-1
    return {
      detectorId: "SLEEP_DEBT_ACCUMULATION",
      type: "SLEEP_DEBT_ACCUMULATION",
      description: `You have accumulated ${debtHours} hours of sleep debt this week vs your ${Math.round(target / 6) / 10}h average target.`,
      domains: ["sleep"],
      data: { debt_hours: debtHours, debt_minutes: Math.round(debtMinutes), target_minutes: Math.round(target), nights: lastWeek.length },
      significance: effectToSignificance(effectSize, { low: 0.3, mid: 0.5, high: 0.8 }),
      effectSize,
    };
  },
});

// ── WEEKEND_SLEEP_SHIFT: Weekend vs weekday sleep difference ─────────────────
registerDetector({
  id: "WEEKEND_SLEEP_SHIFT",
  name: "Weekend sleep shift",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const weekday: number[] = [];
    const weekend: number[] = [];

    for (const s of data.sleepRecords) {
      if (s.duration_minutes == null) continue;
      const dow = getDay(new Date(s.date));
      if (dow === 0 || dow === 6) weekend.push(s.duration_minutes);
      else weekday.push(s.duration_minutes);
    }

    if (weekday.length < 5 || weekend.length < 2) return null;

    const weekdayAvg = mean(weekday);
    const weekendAvg = mean(weekend);
    const deltaMins = Math.round(weekendAvg - weekdayAvg);

    if (Math.abs(deltaMins) < 45) return null;

    const weekdayH = Math.round((weekdayAvg / 60) * 10) / 10;
    const weekendH = Math.round((weekendAvg / 60) * 10) / 10;
    const effectSize = Math.abs(deltaMins) / weekdayAvg;

    return {
      detectorId: "WEEKEND_SLEEP_SHIFT",
      type: "WEEKEND_SLEEP_SHIFT",
      description: `You sleep ${Math.abs(deltaMins)} minutes ${deltaMins > 0 ? "more" : "less"} on weekends (${weekendH}h) vs weekdays (${weekdayH}h). ${weekday.length + weekend.length} nights analyzed.`,
      domains: ["sleep"],
      data: { weekday_avg_h: weekdayH, weekend_avg_h: weekendH, delta_minutes: deltaMins, weekday_nights: weekday.length, weekend_nights: weekend.length },
      significance: effectToSignificance(effectSize, { low: 0.08, mid: 0.15, high: 0.25 }),
      effectSize,
    };
  },
});

// ── SLEEP_EFFICIENCY: Time in bed vs actual sleep ────────────────────────────
registerDetector({
  id: "SLEEP_EFFICIENCY",
  name: "Sleep efficiency",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const withAwake = data.sleepRecords.filter(
      (s) => s.duration_minutes != null && s.awake_minutes != null && s.bedtime != null && s.wake_time != null,
    );
    if (withAwake.length < 7) return null;

    const efficiencies = withAwake.map((s) => {
      const timeInBed = (new Date(s.wake_time!).getTime() - new Date(s.bedtime!).getTime()) / 60000;
      if (timeInBed <= 0) return null;
      return s.duration_minutes! / timeInBed;
    }).filter((v): v is number => v !== null && v > 0 && v <= 1);

    if (efficiencies.length < 7) return null;

    const avgEff = mean(efficiencies);
    const pct = Math.round(avgEff * 100);

    // Only flag if notably low
    if (avgEff > 0.90) return null;

    const trend = halfTrend(efficiencies.slice(-14));
    const effectSize = 1 - avgEff; // how far below 100%

    return {
      detectorId: "SLEEP_EFFICIENCY",
      type: "SLEEP_EFFICIENCY",
      description: `Sleep efficiency is ${pct}% — you spend significant time awake in bed. Trend: ${trend}. ${efficiencies.length} nights analyzed.`,
      domains: ["sleep"],
      data: { efficiency_pct: pct, trend, nights: efficiencies.length },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.18, high: 0.25 }),
      effectSize,
    };
  },
});

// ── HRV_DURING_SLEEP_TREND: Heart rate variability during sleep ──────────────
registerDetector({
  id: "HRV_DURING_SLEEP_TREND",
  name: "Sleep HRV trend",
  requiredDomains: ["sleep"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const hrvValues = data.sleepRecords
      .map((s) => s.avg_hrv)
      .filter((v): v is number => v != null);

    if (hrvValues.length < 7) return null;

    const trend = halfTrend(hrvValues);
    if (trend === "flat") return null;

    const recentAvg = Math.round(mean(hrvValues.slice(-7)));
    const priorAvg = Math.round(mean(hrvValues.slice(0, Math.min(7, hrvValues.length))));
    const delta = recentAvg - priorAvg;

    if (Math.abs(delta) < 3) return null;

    const effectSize = Math.abs(delta) / Math.max(priorAvg, 1);
    return {
      detectorId: "HRV_DURING_SLEEP_TREND",
      type: "HRV_DURING_SLEEP_TREND",
      description: `Sleep heart rate variability ${trend === "up" ? "improving" : "declining"}: recent avg ${recentAvg}ms vs ${priorAvg}ms (${delta > 0 ? "+" : ""}${delta}ms). ${hrvValues.length} nights analyzed.`,
      domains: ["sleep"],
      data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta, nights: hrvValues.length },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.10, high: 0.18 }),
      effectSize,
    };
  },
});
