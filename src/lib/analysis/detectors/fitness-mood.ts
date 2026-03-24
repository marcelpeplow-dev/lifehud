import { format, subDays, getISOWeek, getISOWeekYear } from "date-fns";
import { registerDetector } from "../detector-registry";
import type { UserDataBundle } from "../data-bundle";
import { mean, effectToSignificance } from "./utils";

// ── ENERGY_WORKOUT_CORRELATION: Workout days vs rest days → energy ───────────
registerDetector({
  id: "ENERGY_WORKOUT_CORRELATION",
  name: "Workout days vs rest days energy",
  requiredDomains: ["fitness", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5) return null;

    const workoutDates = new Set(data.workouts.map((w) => w.date));
    const energyWorkout: number[] = [];
    const energyRest: number[] = [];

    for (const c of data.checkins) {
      if (workoutDates.has(c.date)) energyWorkout.push(c.energy);
      else energyRest.push(c.energy);
    }

    if (energyWorkout.length < 3 || energyRest.length < 3) return null;

    const workoutAvg = Math.round(mean(energyWorkout) * 10) / 10;
    const restAvg = Math.round(mean(energyRest) * 10) / 10;
    const delta = Math.abs(workoutAvg - restAvg);
    if (delta < 1.0) return null;

    const effectSize = delta / 10;
    return {
      detectorId: "ENERGY_WORKOUT_CORRELATION",
      type: "energy_workout_correlation",
      description: `Energy is ${delta.toFixed(1)} points ${workoutAvg > restAvg ? "higher" : "lower"} on workout days vs rest days (${workoutAvg}/10 vs ${restAvg}/10). ${energyWorkout.length + energyRest.length} days analyzed.`,
      domains: ["fitness", "mood"],
      data: {
        energy_workout: workoutAvg,
        energy_rest: restAvg,
        delta,
        workout_days: energyWorkout.length,
        rest_days: energyRest.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});

// ── WORKOUT_STRESS_CORRELATION: Workout day → next-day stress ────────────────
registerDetector({
  id: "WORKOUT_STRESS_CORRELATION",
  name: "Workout vs next-day stress",
  requiredDomains: ["fitness", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    if (data.checkins.length < 5 || data.workouts.length < 5) return null;

    const workoutDates = new Set(data.workouts.map((w) => w.date));
    const stressAfterWorkout: number[] = [];
    const stressAfterRest: number[] = [];

    for (const c of data.checkins) {
      const prevDate = format(subDays(new Date(c.date), 1), "yyyy-MM-dd");
      if (workoutDates.has(prevDate)) stressAfterWorkout.push(c.stress);
      else stressAfterRest.push(c.stress);
    }

    if (stressAfterWorkout.length < 3 || stressAfterRest.length < 3) return null;

    const workoutAvg = Math.round(mean(stressAfterWorkout) * 10) / 10;
    const restAvg = Math.round(mean(stressAfterRest) * 10) / 10;
    const delta = restAvg - workoutAvg; // positive = workout reduces stress
    if (Math.abs(delta) < 1.0) return null;

    const effectSize = Math.abs(delta) / 10;
    return {
      detectorId: "WORKOUT_STRESS_CORRELATION",
      type: "workout_stress_correlation",
      description: `Stress is ${Math.abs(delta).toFixed(1)} points ${delta > 0 ? "lower" : "higher"} the day after a workout vs a rest day (${workoutAvg}/10 vs ${restAvg}/10). ${stressAfterWorkout.length + stressAfterRest.length} days analyzed.`,
      domains: ["fitness", "mood"],
      data: {
        stress_after_workout: workoutAvg,
        stress_after_rest: restAvg,
        delta,
        workout_count: stressAfterWorkout.length,
        rest_count: stressAfterRest.length,
      },
      significance: effectToSignificance(effectSize, { low: 0.10, mid: 0.20, high: 0.30 }),
      effectSize,
    };
  },
});

// ── EXERCISE_MOOD_BOOST: Mood on workout days & day-after vs rest days ────────
registerDetector({
  id: "EXERCISE_MOOD_BOOST",
  name: "Exercise mood boost",
  requiredDomains: ["fitness", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const moodWorkoutDay: number[] = [];
    const moodDayAfterWorkout: number[] = [];
    const moodRestDay: number[] = [];

    for (const [date, checkin] of data.checkinByDate) {
      const isWorkoutDay = data.workoutsByDate.has(date);
      const nextDay = format(subDays(new Date(date), -1), "yyyy-MM-dd");
      const nextCheckin = data.checkinByDate.get(nextDay);

      if (isWorkoutDay) {
        moodWorkoutDay.push(checkin.mood);
        if (nextCheckin) moodDayAfterWorkout.push(nextCheckin.mood);
      } else {
        moodRestDay.push(checkin.mood);
      }
    }

    const totalPoints = moodWorkoutDay.length + moodRestDay.length;
    if (totalPoints < 7 || moodWorkoutDay.length < 3 || moodRestDay.length < 3)
      return null;

    const workoutAvg = Math.round(mean(moodWorkoutDay) * 10) / 10;
    const restAvg = Math.round(mean(moodRestDay) * 10) / 10;
    const delta = workoutAvg - restAvg;
    if (Math.abs(delta) < 0.5) return null;

    const pctChange = Math.round((delta / restAvg) * 100);
    const afterAvg =
      moodDayAfterWorkout.length >= 3
        ? Math.round(mean(moodDayAfterWorkout) * 10) / 10
        : null;

    const effectSize = Math.abs(delta) / 10;
    return {
      detectorId: "EXERCISE_MOOD_BOOST",
      type: "exercise_mood_boost",
      description: `Your mood averages ${workoutAvg} on workout days vs ${restAvg} on rest days — a ${Math.abs(pctChange)}% ${delta > 0 ? "boost" : "drop"}.${afterAvg !== null ? ` Day-after mood: ${afterAvg}/10.` : ""} ${totalPoints} days analyzed.`,
      domains: ["fitness", "mood"],
      data: {
        mood_workout: workoutAvg,
        mood_rest: restAvg,
        mood_day_after: afterAvg,
        delta,
        pct_change: pctChange,
        workout_days: moodWorkoutDay.length,
        rest_days: moodRestDay.length,
        day_after_count: moodDayAfterWorkout.length,
      },
      significance: effectToSignificance(effectSize, {
        low: 0.08,
        mid: 0.15,
        high: 0.25,
      }),
      effectSize,
    };
  },
});

// ── WORKOUT_INTENSITY_VS_NEXT_DAY_ENERGY: Duration bucket → next-day energy ──
registerDetector({
  id: "WORKOUT_INTENSITY_VS_NEXT_DAY_ENERGY",
  name: "Workout intensity vs next-day energy",
  requiredDomains: ["fitness", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    const buckets: Record<string, number[]> = {
      short: [],
      medium: [],
      long: [],
    };

    for (const [date, workouts] of data.workoutsByDate) {
      const totalDuration = workouts.reduce(
        (sum, w) => sum + (w.duration_minutes ?? 0),
        0,
      );
      const nextDay = format(subDays(new Date(date), -1), "yyyy-MM-dd");
      const nextCheckin = data.checkinByDate.get(nextDay);
      if (!nextCheckin) continue;

      let bucket: string;
      if (totalDuration < 30) bucket = "short";
      else if (totalDuration <= 60) bucket = "medium";
      else bucket = "long";

      buckets[bucket].push(nextCheckin.energy);
    }

    const totalPoints =
      buckets.short.length + buckets.medium.length + buckets.long.length;
    if (totalPoints < 7) return null;

    const avgByBucket: Record<string, number | null> = {
      short:
        buckets.short.length >= 2
          ? Math.round(mean(buckets.short) * 10) / 10
          : null,
      medium:
        buckets.medium.length >= 2
          ? Math.round(mean(buckets.medium) * 10) / 10
          : null,
      long:
        buckets.long.length >= 2
          ? Math.round(mean(buckets.long) * 10) / 10
          : null,
    };

    // Find the bucket with lowest next-day energy for the description
    const validBuckets = Object.entries(avgByBucket).filter(
      ([, v]) => v !== null,
    ) as [string, number][];
    if (validBuckets.length < 2) return null;

    const sorted = validBuckets.sort((a, b) => a[1] - b[1]);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const delta = highest[1] - lowest[1];
    if (delta < 0.5) return null;

    const bucketLabels: Record<string, string> = {
      short: "under 30 minutes",
      medium: "30–60 minutes",
      long: "over 60 minutes",
    };

    const effectSize = delta / 10;
    return {
      detectorId: "WORKOUT_INTENSITY_VS_NEXT_DAY_ENERGY",
      type: "workout_intensity_vs_next_day_energy",
      description: `After workouts ${bucketLabels[lowest[0]]}, your next-day energy drops by ${delta.toFixed(1)} points (${lowest[1]}/10 vs ${highest[1]}/10 after ${bucketLabels[highest[0]]}). ${totalPoints} sessions analyzed.`,
      domains: ["fitness", "mood"],
      data: {
        energy_after_short: avgByBucket.short,
        energy_after_medium: avgByBucket.medium,
        energy_after_long: avgByBucket.long,
        lowest_bucket: lowest[0],
        highest_bucket: highest[0],
        delta,
        total_sessions: totalPoints,
      },
      significance: effectToSignificance(effectSize, {
        low: 0.08,
        mid: 0.15,
        high: 0.25,
      }),
      effectSize,
    };
  },
});

// ── CONSISTENCY_VS_MOOD_BASELINE: Weekly workout count → mood baseline ────────
registerDetector({
  id: "CONSISTENCY_VS_MOOD_BASELINE",
  name: "Workout consistency vs mood baseline",
  requiredDomains: ["fitness", "mood"],
  category: "cross",
  detect: (data: UserDataBundle) => {
    // Group workouts and moods by ISO week
    const weekWorkoutCounts = new Map<string, number>();
    const weekMoods = new Map<string, number[]>();

    for (const [date, workouts] of data.workoutsByDate) {
      const d = new Date(date);
      const weekKey = `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
      weekWorkoutCounts.set(
        weekKey,
        (weekWorkoutCounts.get(weekKey) ?? 0) + workouts.length,
      );
    }

    for (const [date, checkin] of data.checkinByDate) {
      const d = new Date(date);
      const weekKey = `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
      const moods = weekMoods.get(weekKey) ?? [];
      moods.push(checkin.mood);
      weekMoods.set(weekKey, moods);
    }

    // Classify weeks: active (3+ workouts) vs sedentary (0-1 workouts)
    const moodActive: number[] = [];
    const moodSedentary: number[] = [];

    for (const [weekKey, moods] of weekMoods) {
      const workoutCount = weekWorkoutCounts.get(weekKey) ?? 0;
      const weekAvg = mean(moods);
      if (workoutCount >= 3) moodActive.push(weekAvg);
      else if (workoutCount <= 1) moodSedentary.push(weekAvg);
    }

    const totalWeeks = moodActive.length + moodSedentary.length;
    if (totalWeeks < 7 || moodActive.length < 3 || moodSedentary.length < 3)
      return null;

    const activeAvg = Math.round(mean(moodActive) * 10) / 10;
    const sedentaryAvg = Math.round(mean(moodSedentary) * 10) / 10;
    const delta = activeAvg - sedentaryAvg;
    if (Math.abs(delta) < 0.5) return null;

    const effectSize = Math.abs(delta) / 10;
    return {
      detectorId: "CONSISTENCY_VS_MOOD_BASELINE",
      type: "consistency_vs_mood_baseline",
      description: `In weeks you work out 3+ times, your average mood is ${activeAvg} vs ${sedentaryAvg} in sedentary weeks. ${totalWeeks} weeks analyzed.`,
      domains: ["fitness", "mood"],
      data: {
        mood_active_weeks: activeAvg,
        mood_sedentary_weeks: sedentaryAvg,
        delta,
        active_weeks: moodActive.length,
        sedentary_weeks: moodSedentary.length,
      },
      significance: effectToSignificance(effectSize, {
        low: 0.08,
        mid: 0.15,
        high: 0.25,
      }),
      effectSize,
    };
  },
});
