import { getDay } from "date-fns";
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

// ── WORKOUT_CONSISTENCY_PATTERN: Day-of-week consistency ─────────────────────
registerDetector({
  id: "WORKOUT_CONSISTENCY_PATTERN",
  name: "Workout day consistency",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.workouts.length < 7) return null;

    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    for (const w of data.workouts) {
      dayCounts[getDay(new Date(w.date))]++;
    }

    const total = data.workouts.length;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Find top 3 days
    const sorted = dayCounts
      .map((count, i) => ({ day: dayNames[i], count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    const topDaysPct = sorted.slice(0, 3).reduce((s, d) => s + d.count, 0) / total;

    // Entropy: low = consistent, high = random
    const probs = dayCounts.map((c) => c / total).filter((p) => p > 0);
    const entropy = -probs.reduce((s, p) => s + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(7); // ~2.81 for uniform distribution
    const normalizedEntropy = entropy / maxEntropy; // 0 = one day only, 1 = perfectly uniform

    const consistency = 1 - normalizedEntropy; // 0 = random, 1 = consistent

    const topDays = sorted.filter((d) => d.count >= 2).slice(0, 3).map((d) => d.day);
    const topDayStr = topDays.join("/");
    const topPct = Math.round(topDaysPct * 100);

    const effectSize = consistency;
    return {
      detectorId: "WORKOUT_CONSISTENCY_PATTERN",
      type: "WORKOUT_CONSISTENCY_PATTERN",
      description: consistency > 0.5
        ? `You work out on ${topDayStr} ${topPct}% of the time. Consistency is a strength.`
        : `Your workout schedule is spread across the week with no strong pattern. ${total} workouts analyzed.`,
      domains: ["fitness"],
      data: { top_days: topDays, top_days_pct: topPct, consistency: Math.round(consistency * 100), entropy: Math.round(entropy * 100) / 100, total_workouts: total },
      significance: effectToSignificance(effectSize, { low: 0.3, mid: 0.5, high: 0.7 }),
      effectSize,
    };
  },
});

// ── CARDIO_VS_STRENGTH_BALANCE: Training type distribution ───────────────────
registerDetector({
  id: "CARDIO_VS_STRENGTH_BALANCE",
  name: "Cardio vs strength balance",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.workouts.length < 7) return null;

    let cardio = 0;
    let strength = 0;
    for (const w of data.workouts) {
      if (w.workout_type === "cardio") cardio++;
      else if (w.workout_type === "strength") strength++;
    }

    const total = cardio + strength;
    if (total < 5) return null;

    const cardioPct = Math.round((cardio / total) * 100);
    const strengthPct = Math.round((strength / total) * 100);
    const imbalance = Math.abs(cardioPct - 50) / 50; // 0 = balanced, 1 = all one type

    if (imbalance < 0.6) return null; // 80/20 threshold

    const dominant = cardioPct > strengthPct ? "cardio" : "strength";
    const dominantPct = Math.max(cardioPct, strengthPct);

    return {
      detectorId: "CARDIO_VS_STRENGTH_BALANCE",
      type: "CARDIO_VS_STRENGTH_BALANCE",
      description: `${dominantPct}% of your workouts are ${dominant}. ${cardio} cardio vs ${strength} strength sessions in 30 days.`,
      domains: ["fitness"],
      data: { cardio_count: cardio, strength_count: strength, cardio_pct: cardioPct, strength_pct: strengthPct, total },
      significance: effectToSignificance(imbalance, { low: 0.6, mid: 0.75, high: 0.9 }),
      effectSize: imbalance,
    };
  },
});

// ── WORKOUT_DURATION_TREND: Are workouts getting longer or shorter? ──────────
registerDetector({
  id: "WORKOUT_DURATION_TREND",
  name: "Workout duration trend",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const durations = data.workouts
      .map((w) => w.duration_minutes)
      .filter((v): v is number => v != null);

    if (durations.length < 7) return null;

    const trend = halfTrend(durations);
    if (trend === "flat") return null;

    const recentAvg = Math.round(mean(durations.slice(-Math.ceil(durations.length / 2))));
    const priorAvg = Math.round(mean(durations.slice(0, Math.floor(durations.length / 2))));
    const delta = recentAvg - priorAvg;

    if (Math.abs(delta) < 5) return null;

    const effectSize = Math.abs(delta) / Math.max(priorAvg, 1);
    return {
      detectorId: "WORKOUT_DURATION_TREND",
      type: "WORKOUT_DURATION_TREND",
      description: `Workout duration trending ${trend}: recent avg ${recentAvg} min vs ${priorAvg} min (${delta > 0 ? "+" : ""}${delta} min). ${durations.length} workouts analyzed.`,
      domains: ["fitness"],
      data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta, workouts: durations.length },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.12, high: 0.20 }),
      effectSize,
    };
  },
});

// ── HEART_RATE_RECOVERY: Active HR vs resting HR gap ─────────────────────────
registerDetector({
  id: "HEART_RATE_RECOVERY",
  name: "Heart rate recovery gap",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const pairs = data.workouts
      .map((w) => {
        const metrics = data.metricsByDate.get(w.date);
        if (!w.avg_heart_rate || !metrics?.resting_heart_rate) return null;
        return { active: w.avg_heart_rate, resting: metrics.resting_heart_rate, date: w.date };
      })
      .filter((x): x is { active: number; resting: number; date: string } => x !== null);

    if (pairs.length < 7) return null;

    const gaps = pairs.map((p) => p.active - p.resting);
    const trend = halfTrend(gaps);
    const avgGap = Math.round(mean(gaps));
    const recentGap = Math.round(mean(gaps.slice(-Math.ceil(gaps.length / 2))));
    const priorGap = Math.round(mean(gaps.slice(0, Math.floor(gaps.length / 2))));
    const delta = recentGap - priorGap;

    if (trend === "flat" && Math.abs(delta) < 3) return null;

    const effectSize = Math.abs(delta) / Math.max(priorGap, 1);
    return {
      detectorId: "HEART_RATE_RECOVERY",
      type: "HEART_RATE_RECOVERY",
      description: `Active-to-resting heart rate gap is ${trend === "up" ? "growing" : "shrinking"} (avg ${avgGap} bpm, ${delta > 0 ? "+" : ""}${delta} bpm recent trend). A ${delta > 0 ? "growing" : "shrinking"} gap indicates ${delta > 0 ? "improving" : "declining"} fitness. ${pairs.length} workouts analyzed.`,
      domains: ["fitness"],
      data: { avg_gap: avgGap, recent_gap: recentGap, prior_gap: priorGap, delta, trend, workouts: pairs.length },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.06, high: 0.10 }),
      effectSize,
    };
  },
});

// ── ACTIVE_MINUTES_VS_SEDENTARY: Daily active time percentage ────────────────
registerDetector({
  id: "ACTIVE_MINUTES_VS_SEDENTARY",
  name: "Daily active minutes",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    const activeMinutes = data.dailyMetrics
      .map((m) => m.active_minutes)
      .filter((v): v is number => v != null);

    if (activeMinutes.length < 7) return null;

    const avg = Math.round(mean(activeMinutes));
    const WAKING_MINUTES = 960; // 16 hours
    const activePct = Math.round((avg / WAKING_MINUTES) * 100);
    const trend = halfTrend(activeMinutes);

    const effectSize = avg / WAKING_MINUTES;
    return {
      detectorId: "ACTIVE_MINUTES_VS_SEDENTARY",
      type: "ACTIVE_MINUTES_VS_SEDENTARY",
      description: `You average ${avg} active minutes per day — ${activePct}% of your waking hours. Trend: ${trend}. ${activeMinutes.length} days analyzed.`,
      domains: ["fitness"],
      data: { avg_active_min: avg, active_pct: activePct, trend, days: activeMinutes.length },
      significance: 0.2,
      effectSize,
    };
  },
});

// ── PERSONAL_BESTS_FREQUENCY: PR frequency tracking ──────────────────────────
registerDetector({
  id: "PERSONAL_BESTS_FREQUENCY",
  name: "Personal bests frequency",
  requiredDomains: ["fitness"],
  category: "single",
  detect: (data: UserDataBundle) => {
    if (data.workouts.length < 10) return null;

    // Group by activity, track bests for duration and calories
    const bestByActivity = new Map<string, { maxCalories: number; maxDuration: number; firstDate: string }>();
    let recentPRs = 0; // last 14 days
    let olderPRs = 0;
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);

    const sorted = [...data.workouts].sort((a, b) => a.date.localeCompare(b.date));

    for (const w of sorted) {
      const key = w.activity_name ?? w.workout_type ?? "unknown";
      const existing = bestByActivity.get(key);

      if (!existing) {
        bestByActivity.set(key, {
          maxCalories: w.calories_burned ?? 0,
          maxDuration: w.duration_minutes ?? 0,
          firstDate: w.date,
        });
        continue;
      }

      let isPR = false;
      if (w.calories_burned != null && w.calories_burned > existing.maxCalories) {
        existing.maxCalories = w.calories_burned;
        isPR = true;
      }
      if (w.duration_minutes != null && w.duration_minutes > existing.maxDuration) {
        existing.maxDuration = w.duration_minutes;
        isPR = true;
      }

      if (isPR) {
        if (new Date(w.date) >= cutoff14) recentPRs++;
        else olderPRs++;
      }
    }

    const totalPRs = recentPRs + olderPRs;
    if (totalPRs < 1) return null;

    const effectSize = recentPRs / Math.max(1, data.workouts.length / 4); // PRs per week normalized
    return {
      detectorId: "PERSONAL_BESTS_FREQUENCY",
      type: "PERSONAL_BESTS_FREQUENCY",
      description: recentPRs > olderPRs
        ? `You set ${recentPRs} personal records in the last 2 weeks vs ${olderPRs} in the prior 2 weeks. You are on a roll.`
        : `${totalPRs} personal records this month across ${bestByActivity.size} activities. Recent PRs: ${recentPRs}.`,
      domains: ["fitness"],
      data: { recent_prs: recentPRs, older_prs: olderPRs, total_prs: totalPRs, activities_tracked: bestByActivity.size },
      significance: effectToSignificance(effectSize, { low: 0.1, mid: 0.3, high: 0.5 }),
      effectSize,
    };
  },
});
