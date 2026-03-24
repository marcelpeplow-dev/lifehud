import { format, subDays, parseISO, getISOWeek, getISOWeekYear } from "date-fns";
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

// ── REST_DAY_SLEEP_QUALITY: Sleep on rest days vs workout days ─────────────────
registerDetector({
  id: "REST_DAY_SLEEP_QUALITY",
  name: "Rest day vs workout day sleep",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const restDaySleep: { duration: number; deepPct: number }[] = [];
    const workoutDaySleep: { duration: number; deepPct: number }[] = [];

    for (const [date, sleep] of data.sleepByDate) {
      if (!sleep.duration_minutes || sleep.duration_minutes < 60) continue;
      const prevDay = format(subDays(new Date(date), 1), "yyyy-MM-dd");
      const deepPct =
        sleep.duration_minutes > 0
          ? (sleep.deep_sleep_minutes ?? 0) / sleep.duration_minutes
          : 0;
      const entry = { duration: sleep.duration_minutes, deepPct };

      if (data.workoutsByDate.has(prevDay)) {
        workoutDaySleep.push(entry);
      } else {
        restDaySleep.push(entry);
      }
    }

    if (restDaySleep.length < 7 || workoutDaySleep.length < 7) return null;

    const restDuration = mean(restDaySleep.map((s) => s.duration));
    const workoutDuration = mean(workoutDaySleep.map((s) => s.duration));
    const durationDelta = Math.round(restDuration - workoutDuration);

    const restDeepPct = mean(restDaySleep.map((s) => s.deepPct));
    const workoutDeepPct = mean(workoutDaySleep.map((s) => s.deepPct));
    const deepPctDelta = Math.round((restDeepPct - workoutDeepPct) * 100);

    const effectSize =
      Math.abs(durationDelta) / Math.max(workoutDuration, 1) +
      Math.abs(restDeepPct - workoutDeepPct);

    return {
      detectorId: "REST_DAY_SLEEP_QUALITY",
      type: "rest_day_sleep_quality",
      description: `You sleep ${Math.abs(durationDelta)} minutes ${durationDelta > 0 ? "longer" : "shorter"} on rest days. Your deep sleep is ${Math.abs(deepPctDelta)}% ${deepPctDelta > 0 ? "higher" : "lower"} after days without exercise.`,
      domains: ["sleep", "fitness"],
      data: {
        rest_day_duration_avg: Math.round(restDuration),
        workout_day_duration_avg: Math.round(workoutDuration),
        duration_delta: durationDelta,
        rest_day_deep_pct: Math.round(restDeepPct * 100),
        workout_day_deep_pct: Math.round(workoutDeepPct * 100),
        deep_pct_delta: deepPctDelta,
        rest_day_sample: restDaySleep.length,
        workout_day_sample: workoutDaySleep.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.12, high: 0.20 }),
      effectSize,
    };
  },
});

// ── MORNING_VS_EVENING_WORKOUT_SLEEP: AM vs PM workout impact on sleep ────────
registerDetector({
  id: "MORNING_VS_EVENING_WORKOUT_SLEEP",
  name: "Morning vs evening workout sleep impact",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const amSleep: { duration: number; score: number }[] = [];
    const pmSleep: { duration: number; score: number }[] = [];

    for (const [date, workouts] of data.workoutsByDate) {
      const sleep = data.sleepByDate.get(date);
      if (!sleep?.duration_minutes || sleep.duration_minutes < 60) continue;

      for (const w of workouts) {
        if (!w.started_at) continue;
        const hour = parseISO(w.started_at).getHours();
        const entry = {
          duration: sleep.duration_minutes,
          score: sleep.sleep_score ?? sleep.duration_minutes,
        };

        if (hour < 12) {
          amSleep.push(entry);
        } else {
          pmSleep.push(entry);
        }
      }
    }

    if (amSleep.length < 7 || pmSleep.length < 7) return null;

    const amDuration = mean(amSleep.map((s) => s.duration));
    const pmDuration = mean(pmSleep.map((s) => s.duration));
    const durationDelta = Math.round(amDuration - pmDuration);

    const amScore = mean(amSleep.map((s) => s.score));
    const pmScore = mean(pmSleep.map((s) => s.score));
    const scoreDelta = Math.round(amScore - pmScore);

    const effectSize = Math.abs(durationDelta) / Math.max(pmDuration, 1);

    return {
      detectorId: "MORNING_VS_EVENING_WORKOUT_SLEEP",
      type: "morning_vs_evening_workout_sleep",
      description: `You sleep ${Math.abs(durationDelta)} minutes ${durationDelta > 0 ? "longer" : "shorter"} on days you work out in the morning vs the evening.`,
      domains: ["sleep", "fitness"],
      data: {
        am_duration_avg: Math.round(amDuration),
        pm_duration_avg: Math.round(pmDuration),
        duration_delta: durationDelta,
        am_score_avg: Math.round(amScore),
        pm_score_avg: Math.round(pmScore),
        score_delta: scoreDelta,
        am_sample: amSleep.length,
        pm_sample: pmSleep.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.08, high: 0.15 }),
      effectSize,
    };
  },
});

// ── OVERTRAINING_SLEEP_SIGNAL: High-frequency training weeks vs sleep ──────────
registerDetector({
  id: "OVERTRAINING_SLEEP_SIGNAL",
  name: "Overtraining sleep signal",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    // Group workouts by ISO week
    const weekWorkoutCounts = new Map<string, number>();
    for (const [date] of data.workoutsByDate) {
      const d = new Date(date);
      const key = `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
      weekWorkoutCounts.set(key, (weekWorkoutCounts.get(key) ?? 0) + 1);
    }

    // Group sleep records by ISO week
    const weekSleep = new Map<string, { duration: number; efficiency: number }[]>();
    for (const [date, sleep] of data.sleepByDate) {
      if (!sleep.duration_minutes || sleep.duration_minutes < 60) continue;
      const d = new Date(date);
      const key = `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
      const totalTime = sleep.duration_minutes + (sleep.awake_minutes ?? 0);
      const efficiency = totalTime > 0 ? sleep.duration_minutes / totalTime : 1;
      const entries = weekSleep.get(key) ?? [];
      entries.push({ duration: sleep.duration_minutes, efficiency });
      weekSleep.set(key, entries);
    }

    const highWeeks: { avgEfficiency: number; avgDuration: number }[] = [];
    const moderateWeeks: { avgEfficiency: number; avgDuration: number }[] = [];

    for (const [week, sleeps] of weekSleep) {
      const count = weekWorkoutCounts.get(week) ?? 0;
      const avgEfficiency = mean(sleeps.map((s) => s.efficiency));
      const avgDuration = mean(sleeps.map((s) => s.duration));
      if (count >= 5) {
        highWeeks.push({ avgEfficiency, avgDuration });
      } else if (count >= 2 && count <= 3) {
        moderateWeeks.push({ avgEfficiency, avgDuration });
      }
    }

    if (highWeeks.length < 7 || moderateWeeks.length < 7) return null;

    const highEfficiency = mean(highWeeks.map((w) => w.avgEfficiency));
    const modEfficiency = mean(moderateWeeks.map((w) => w.avgEfficiency));
    const efficiencyDelta = Math.round((highEfficiency - modEfficiency) * 100);

    const highDuration = mean(highWeeks.map((w) => w.avgDuration));
    const modDuration = mean(moderateWeeks.map((w) => w.avgDuration));
    const durationDelta = Math.round(highDuration - modDuration);

    const effectSize = Math.abs(modEfficiency - highEfficiency);

    return {
      detectorId: "OVERTRAINING_SLEEP_SIGNAL",
      type: "overtraining_sleep_signal",
      description: `On weeks with 5+ workouts, your sleep efficiency drops ${Math.abs(efficiencyDelta)}%. You may be overtraining.`,
      domains: ["sleep", "fitness"],
      data: {
        high_week_efficiency: Math.round(highEfficiency * 100),
        moderate_week_efficiency: Math.round(modEfficiency * 100),
        efficiency_delta: efficiencyDelta,
        high_week_duration: Math.round(highDuration),
        moderate_week_duration: Math.round(modDuration),
        duration_delta: durationDelta,
        high_week_sample: highWeeks.length,
        moderate_week_sample: moderateWeeks.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.03, mid: 0.06, high: 0.10 }),
      effectSize,
    };
  },
});

// ── STEP_COUNT_VS_SLEEP_DEPTH: Daily steps → deep sleep correlation ───────────
registerDetector({
  id: "STEP_COUNT_VS_SLEEP_DEPTH",
  name: "Step count vs deep sleep",
  requiredDomains: ["sleep", "fitness"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const pairs: { steps: number; deepMinutes: number }[] = [];

    for (const [date, metrics] of data.metricsByDate) {
      if (!metrics.steps) continue;
      const sleep = data.sleepByDate.get(date);
      if (!sleep?.duration_minutes || sleep.duration_minutes < 60) continue;
      const deepMinutes = sleep.deep_sleep_minutes ?? 0;
      if (deepMinutes === 0) continue;
      pairs.push({ steps: metrics.steps, deepMinutes });
    }

    if (pairs.length < 7) return null;

    const medianSteps = [...pairs.map((p) => p.steps)].sort((a, b) => a - b)[
      Math.floor(pairs.length / 2)
    ];
    const threshold = Math.max(medianSteps, 10000);

    const highSteps = pairs.filter((p) => p.steps >= threshold);
    const lowSteps = pairs.filter((p) => p.steps < threshold);

    if (highSteps.length < 3 || lowSteps.length < 3) return null;

    const highDeep = mean(highSteps.map((p) => p.deepMinutes));
    const lowDeep = mean(lowSteps.map((p) => p.deepMinutes));
    const delta = Math.round(highDeep - lowDeep);

    const effectSize = Math.abs(delta) / Math.max(lowDeep, 1);

    return {
      detectorId: "STEP_COUNT_VS_SLEEP_DEPTH",
      type: "step_count_vs_sleep_depth",
      description: `On days you walk ${threshold.toLocaleString()}+ steps, your deep sleep ${delta > 0 ? "increases" : "decreases"} by ${Math.abs(delta)} minutes.`,
      domains: ["sleep", "fitness"],
      data: {
        high_step_deep_avg: Math.round(highDeep),
        low_step_deep_avg: Math.round(lowDeep),
        delta,
        step_threshold: threshold,
        high_step_sample: highSteps.length,
        low_step_sample: lowSteps.length,
        total_sample: pairs.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.05, mid: 0.12, high: 0.20 }),
      effectSize,
    };
  },
});
