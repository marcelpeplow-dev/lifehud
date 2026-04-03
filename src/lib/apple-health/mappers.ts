import { format } from "date-fns";
import type { ParsedSleepSession, ParsedDailyMetrics, ParsedWorkout } from "./xml-parser";

// Re-use the same insert interfaces as the Whoop integration
export type {
  SleepInsert,
  WorkoutInsert,
  DailyMetricsInsert,
} from "@/lib/whoop/mappers";

import type { SleepInsert, WorkoutInsert, DailyMetricsInsert } from "@/lib/whoop/mappers";

const SOURCE = "apple_health";

// ── Sleep ────────────────────────────────────────────────────────────────────

export function mapAppleHealthSleep(
  userId: string,
  session: ParsedSleepSession
): SleepInsert {
  const efficiency =
    session.inBedMinutes > 0
      ? Math.round((session.totalSleepMinutes / session.inBedMinutes) * 100)
      : null;

  return {
    user_id: userId,
    date: session.date,
    bedtime: session.bedtime,
    wake_time: session.wakeTime,
    duration_minutes: session.inBedMinutes,
    deep_sleep_minutes: session.deepSleepMinutes > 0 ? session.deepSleepMinutes : null,
    rem_sleep_minutes: session.remSleepMinutes > 0 ? session.remSleepMinutes : null,
    light_sleep_minutes: session.lightSleepMinutes > 0 ? session.lightSleepMinutes : null,
    awake_minutes: session.awakeMinutes > 0 ? session.awakeMinutes : null,
    sleep_score: efficiency,
    avg_heart_rate: null,
    avg_hrv: null,
    source: SOURCE,
    raw_data: session as unknown as Record<string, unknown>,
  };
}

// ── Daily metrics ────────────────────────────────────────────────────────────

export function mapAppleHealthMetrics(
  userId: string,
  day: ParsedDailyMetrics
): DailyMetricsInsert {
  const caloriesTotal =
    day.activeCalories != null || day.basalCalories != null
      ? (day.activeCalories ?? 0) + (day.basalCalories ?? 0)
      : null;

  return {
    user_id: userId,
    date: day.date,
    steps: day.steps != null ? Math.round(day.steps) : null,
    active_minutes: null, // Apple Health doesn't export this as a single metric
    resting_heart_rate: day.restingHeartRate,
    hrv_average: day.hrvAverage,
    calories_total: caloriesTotal != null ? Math.round(caloriesTotal) : null,
    calories_active:
      day.activeCalories != null ? Math.round(day.activeCalories) : null,
    stress_score: null,
    recovery_score: null,
    source: SOURCE,
    raw_data: {
      ...day,
      spo2: day.spo2,
      vo2_max: day.vo2Max,
      respiratory_rate: day.respiratoryRate,
      avg_heart_rate: day.avgHeartRate,
    } as unknown as Record<string, unknown>,
  };
}

// ── Workouts ─────────────────────────────────────────────────────────────────

type WorkoutCategory = "strength" | "cardio" | "flexibility" | "sport" | "other";

function classifyWorkout(type: string): WorkoutCategory {
  const lower = type.toLowerCase();
  if (/running|cycling|walking|swimming|hiking|hiit|elliptical|rowing|stair|cardio/.test(lower))
    return "cardio";
  if (/strength|weight|functional|resistance|core/.test(lower)) return "strength";
  if (/yoga|pilates|stretch|flex/.test(lower)) return "flexibility";
  if (/tennis|golf|soccer|basketball|volleyball|sport|dance/.test(lower)) return "sport";
  return "other";
}

export function mapAppleHealthWorkout(
  userId: string,
  workout: ParsedWorkout
): WorkoutInsert {
  const date = format(new Date(workout.startTime), "yyyy-MM-dd");

  return {
    user_id: userId,
    date,
    started_at: workout.startTime,
    ended_at: workout.endTime,
    duration_minutes: workout.durationMinutes,
    workout_type: classifyWorkout(workout.type),
    activity_name: workout.type,
    calories_burned: workout.calories,
    avg_heart_rate: workout.avgHeartRate,
    max_heart_rate: workout.maxHeartRate,
    distance_meters: workout.distance,
    intensity_score: null,
    source: SOURCE,
    raw_data: workout as unknown as Record<string, unknown>,
  };
}
