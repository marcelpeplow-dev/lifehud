import { format, subDays } from "date-fns";
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
