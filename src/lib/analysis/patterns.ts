import { format, subDays, startOfWeek } from "date-fns";
import type { SleepRecord, Workout, DailyMetrics, DetectedPattern } from "@/types/index";

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
}

function halfTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 4) return "flat";
  const mid = Math.floor(values.length / 2);
  const first = mean(values.slice(0, mid));
  const second = mean(values.slice(mid));
  const pct = first === 0 ? 0 : Math.abs((second - first) / first);
  if (pct < 0.03) return "flat";
  return second > first ? "up" : "down";
}

export interface PatternInput {
  sleepRecords: SleepRecord[];
  workouts: Workout[];
  dailyMetrics: DailyMetrics[];
  today: Date;
}

export function detectPatterns({ sleepRecords, workouts, dailyMetrics, today }: PatternInput): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lastWeekStart = format(startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), "yyyy-MM-dd");

  // ── 1. Sleep consistency ──────────────────────────────────────────────────
  const sleepDurations = sleepRecords
    .map((s) => s.duration_minutes)
    .filter((v): v is number => v != null);

  if (sleepDurations.length >= 5) {
    const avg = mean(sleepDurations);
    const sd = stdDev(sleepDurations);
    const cvPct = avg > 0 ? (sd / avg) * 100 : 0;

    if (sd > 75) {
      patterns.push({
        type: "sleep_consistency",
        description: `Sleep duration varies significantly (±${Math.round(sd)} min, avg ${Math.round(avg / 60 * 10) / 10}h).`,
        data: { avg_minutes: Math.round(avg), std_dev: Math.round(sd), cv_pct: Math.round(cvPct) },
        significance: sd > 120 ? "high" : "medium",
      });
    } else if (sd < 30 && sleepDurations.length >= 7) {
      patterns.push({
        type: "sleep_consistency",
        description: `Sleep duration is very consistent (±${Math.round(sd)} min, avg ${Math.round(avg / 60 * 10) / 10}h).`,
        data: { avg_minutes: Math.round(avg), std_dev: Math.round(sd), cv_pct: Math.round(cvPct) },
        significance: "low",
      });
    }
  }

  // ── 2. Sleep duration trend ───────────────────────────────────────────────
  const last14Sleep = sleepRecords.slice(-14).map((s) => s.duration_minutes ?? 0);
  if (last14Sleep.length >= 6) {
    const trend = halfTrend(last14Sleep);
    const recentAvg = mean(last14Sleep.slice(-7));
    const priorAvg = mean(last14Sleep.slice(0, 7));
    const deltaMins = Math.round(recentAvg - priorAvg);
    if (trend !== "flat") {
      patterns.push({
        type: "sleep_consistency",
        description: `Sleep duration trending ${trend} (${deltaMins > 0 ? "+" : ""}${deltaMins} min vs prior week, recent avg ${Math.round(recentAvg / 6) / 10}h).`,
        data: { trend, delta_minutes: deltaMins, recent_avg: Math.round(recentAvg), prior_avg: Math.round(priorAvg) },
        significance: Math.abs(deltaMins) > 45 ? "high" : "medium",
      });
    }
  }

  // ── 3. Workout frequency trend ────────────────────────────────────────────
  const thisWeek = workouts.filter((w) => w.date >= weekStart).length;
  const lastWeek = workouts.filter((w) => w.date >= lastWeekStart && w.date < weekStart).length;

  if (thisWeek > 0 || lastWeek > 0) {
    const delta = thisWeek - lastWeek;
    if (delta !== 0) {
      patterns.push({
        type: "workout_frequency_trend",
        description: `Workout frequency ${delta > 0 ? "increased" : "decreased"} (${thisWeek} this week vs ${lastWeek} last week).`,
        data: { this_week: thisWeek, last_week: lastWeek, delta },
        significance: Math.abs(delta) >= 2 ? "high" : "medium",
      });
    } else if (thisWeek >= 4) {
      patterns.push({
        type: "workout_frequency_trend",
        description: `Consistent workout frequency: ${thisWeek} sessions this week, same as last week.`,
        data: { this_week: thisWeek, last_week: lastWeek, delta: 0 },
        significance: "low",
      });
    }
  }

  // ── 4. Resting HR trend ───────────────────────────────────────────────────
  const hrValues = dailyMetrics
    .map((m) => m.resting_heart_rate)
    .filter((v): v is number => v != null);

  if (hrValues.length >= 7) {
    const trend = halfTrend(hrValues);
    const recentAvg = Math.round(mean(hrValues.slice(-7)));
    const priorAvg = Math.round(mean(hrValues.slice(0, 7)));
    const delta = recentAvg - priorAvg;
    if (trend !== "flat") {
      patterns.push({
        type: "resting_hr_trend",
        description: `Resting HR ${trend === "down" ? "improving (dropping)" : "rising"}: recent avg ${recentAvg} bpm vs ${priorAvg} bpm (${delta > 0 ? "+" : ""}${delta} bpm).`,
        data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta },
        significance: Math.abs(delta) >= 5 ? "high" : "medium",
      });
    }
  }

  // ── 5. HRV / recovery trend ───────────────────────────────────────────────
  const hrvValues = dailyMetrics
    .map((m) => m.hrv_average)
    .filter((v): v is number => v != null);

  if (hrvValues.length >= 7) {
    const trend = halfTrend(hrvValues);
    const recentAvg = Math.round(mean(hrvValues.slice(-7)));
    const priorAvg = Math.round(mean(hrvValues.slice(0, 7)));
    const delta = recentAvg - priorAvg;
    if (trend !== "flat") {
      patterns.push({
        type: "recovery_pattern",
        description: `HRV ${trend === "up" ? "improving" : "declining"}: recent avg ${recentAvg} ms vs ${priorAvg} ms (${delta > 0 ? "+" : ""}${delta} ms).`,
        data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta },
        significance: Math.abs(delta) >= 5 ? "high" : "medium",
      });
    }
  }

  // ── 6. Step count trend ───────────────────────────────────────────────────
  const stepValues = dailyMetrics
    .map((m) => m.steps)
    .filter((v): v is number => v != null);

  if (stepValues.length >= 7) {
    const trend = halfTrend(stepValues);
    const recentAvg = Math.round(mean(stepValues.slice(-7)));
    const priorAvg = Math.round(mean(stepValues.slice(0, 7)));
    const deltaPct = priorAvg > 0 ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100) : 0;
    if (trend !== "flat") {
      patterns.push({
        type: "step_count_trend",
        description: `Daily steps trending ${trend}: recent avg ${recentAvg.toLocaleString()} vs ${priorAvg.toLocaleString()} (${deltaPct > 0 ? "+" : ""}${deltaPct}%).`,
        data: { trend, recent_avg: recentAvg, prior_avg: priorAvg, delta_pct: deltaPct },
        significance: Math.abs(deltaPct) >= 20 ? "high" : "medium",
      });
    }
  }

  // ── 7. Sleep ↔ workout performance correlation ─────────────────────────────
  const workoutsWithSleep = workouts
    .map((w) => {
      const prevNight = sleepRecords.find((s) => s.date === format(subDays(new Date(w.date), 1), "yyyy-MM-dd"));
      return prevNight ? { sleep: prevNight.duration_minutes, intensity: w.intensity_score } : null;
    })
    .filter((x): x is { sleep: number; intensity: number } =>
      x !== null && x.sleep != null && x.intensity != null
    );

  if (workoutsWithSleep.length >= 5) {
    const goodSleep = workoutsWithSleep.filter((x) => x.sleep >= 420);
    const poorSleep = workoutsWithSleep.filter((x) => x.sleep < 420);
    if (goodSleep.length >= 2 && poorSleep.length >= 2) {
      const goodAvg = Math.round(mean(goodSleep.map((x) => x.intensity)));
      const poorAvg = Math.round(mean(poorSleep.map((x) => x.intensity)));
      const delta = goodAvg - poorAvg;
      if (Math.abs(delta) >= 8) {
        patterns.push({
          type: "sleep_performance_correlation",
          description: `Workout intensity is ${Math.abs(delta)} points ${delta > 0 ? "higher" : "lower"} after 7h+ sleep (avg ${goodAvg} vs ${poorAvg}).`,
          data: { well_rested_avg: goodAvg, fatigued_avg: poorAvg, delta, sample_size: workoutsWithSleep.length },
          significance: Math.abs(delta) >= 15 ? "high" : "medium",
        });
      }
    }
  }

  // Sort by significance
  const order = { high: 0, medium: 1, low: 2 };
  return patterns.sort((a, b) => order[a.significance] - order[b.significance]);
}
