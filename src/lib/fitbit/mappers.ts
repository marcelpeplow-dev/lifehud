import type { Workout } from "@/types/index";

// ── Fitbit API response types ────────────────────────────────────────────────

interface FitbitSleepLog {
  dateOfSleep: string; // "2026-03-18"
  startTime: string;   // ISO timestamp
  endTime: string;
  duration: number;    // milliseconds
  efficiency: number;  // 0-100
  levels?: {
    summary?: {
      deep?: { minutes: number };
      rem?: { minutes: number };
      light?: { minutes: number };
      wake?: { minutes: number };
    };
  };
  minutesAsleep?: number;
  minutesAwake?: number;
  isMainSleep?: boolean;
}

interface FitbitActivity {
  logId: number;
  activityName: string;
  startTime: string;      // "HH:mm"
  startDate: string;      // "yyyy-MM-dd"
  duration: number;        // milliseconds
  activeDuration: number;  // milliseconds
  calories: number;
  averageHeartRate?: number;
  distance?: number;       // km
  distanceUnit?: string;
  activityTypeId?: number;
  steps?: number;
}

// ── Workout type mapping ─────────────────────────────────────────────────────

const CARDIO_ACTIVITIES = new Set([
  "run", "running", "walk", "walking", "bike", "biking", "cycling", "swim",
  "swimming", "elliptical", "treadmill", "stair", "rowing", "aerobics",
  "hiking", "hike", "dance", "dancing", "kickboxing", "jump rope",
]);

const STRENGTH_ACTIVITIES = new Set([
  "weights", "weight training", "weightlifting", "strength", "crossfit",
  "circuit training", "bodyweight", "resistance",
]);

const FLEXIBILITY_ACTIVITIES = new Set([
  "yoga", "pilates", "stretching", "tai chi", "barre",
]);

const SPORT_ACTIVITIES = new Set([
  "tennis", "basketball", "soccer", "football", "volleyball", "baseball",
  "golf", "hockey", "rugby", "badminton", "squash", "racquetball",
  "martial arts", "boxing", "fencing",
]);

function mapWorkoutType(activityName: string): Workout["workout_type"] {
  const name = activityName.toLowerCase();
  for (const keyword of CARDIO_ACTIVITIES) {
    if (name.includes(keyword)) return "cardio";
  }
  for (const keyword of STRENGTH_ACTIVITIES) {
    if (name.includes(keyword)) return "strength";
  }
  for (const keyword of FLEXIBILITY_ACTIVITIES) {
    if (name.includes(keyword)) return "flexibility";
  }
  for (const keyword of SPORT_ACTIVITIES) {
    if (name.includes(keyword)) return "sport";
  }
  return "other";
}

// ── Sleep mapper ─────────────────────────────────────────────────────────────

export interface SleepInsert {
  user_id: string;
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null;
  avg_heart_rate: number | null;
  avg_hrv: number | null;
  source: string;
  raw_data: Record<string, unknown>;
}

export function mapFitbitSleep(userId: string, log: FitbitSleepLog): SleepInsert | null {
  if (!log.dateOfSleep) return null;

  const stages = log.levels?.summary;

  return {
    user_id: userId,
    date: log.dateOfSleep,
    bedtime: log.startTime ?? null,
    wake_time: log.endTime ?? null,
    duration_minutes: log.duration ? Math.round(log.duration / 60000) : (log.minutesAsleep ?? null),
    deep_sleep_minutes: stages?.deep?.minutes ?? null,
    rem_sleep_minutes: stages?.rem?.minutes ?? null,
    light_sleep_minutes: stages?.light?.minutes ?? null,
    awake_minutes: stages?.wake?.minutes ?? log.minutesAwake ?? null,
    sleep_score: log.efficiency ?? null,
    avg_heart_rate: null, // Not in sleep endpoint; would need separate HR call
    avg_hrv: null,
    source: "fitbit",
    raw_data: log as unknown as Record<string, unknown>,
  };
}

// ── Activity/workout mapper ──────────────────────────────────────────────────

export interface WorkoutInsert {
  user_id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  workout_type: Workout["workout_type"];
  activity_name: string | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  distance_meters: number | null;
  intensity_score: number | null;
  source: string;
  raw_data: Record<string, unknown>;
}

export function mapFitbitActivity(userId: string, activity: FitbitActivity): WorkoutInsert | null {
  if (!activity.startDate) return null;

  const durationMs = activity.activeDuration || activity.duration;
  const durationMin = durationMs ? Math.round(durationMs / 60000) : null;

  // Skip very short activities (under 5 minutes) — likely tracker noise
  if (durationMin != null && durationMin < 5) return null;

  // Build ISO start timestamp
  const startedAt = activity.startTime
    ? `${activity.startDate}T${activity.startTime}`
    : null;

  // Distance: Fitbit returns km, convert to meters
  const distanceMeters = activity.distance != null
    ? Math.round(activity.distance * 1000)
    : null;

  return {
    user_id: userId,
    date: activity.startDate,
    started_at: startedAt,
    ended_at: null, // Fitbit doesn't provide end time directly in activity logs
    duration_minutes: durationMin,
    workout_type: mapWorkoutType(activity.activityName),
    activity_name: activity.activityName,
    calories_burned: activity.calories > 0 ? Math.round(activity.calories) : null,
    avg_heart_rate: activity.averageHeartRate ?? null,
    max_heart_rate: null,
    distance_meters: distanceMeters,
    intensity_score: null,
    source: "fitbit",
    raw_data: activity as unknown as Record<string, unknown>,
  };
}

// ── Daily metrics mapper ─────────────────────────────────────────────────────

export interface DailyMetricsInsert {
  user_id: string;
  date: string;
  steps: number | null;
  active_minutes: number | null;
  resting_heart_rate: number | null;
  hrv_average: number | null;
  calories_total: number | null;
  calories_active: number | null;
  stress_score: number | null;
  recovery_score: number | null;
  source: string;
  raw_data: Record<string, unknown>;
}

export function mapFitbitDailyMetrics(
  userId: string,
  date: string,
  data: {
    steps?: number;
    activeMinutes?: number;
    restingHeartRate?: number;
    hrvAverage?: number;
    caloriesTotalBurned?: number;
    caloriesActive?: number;
  }
): DailyMetricsInsert {
  return {
    user_id: userId,
    date,
    steps: data.steps ?? null,
    active_minutes: data.activeMinutes ?? null,
    resting_heart_rate: data.restingHeartRate ?? null,
    hrv_average: data.hrvAverage ?? null,
    calories_total: data.caloriesTotalBurned ?? null,
    calories_active: data.caloriesActive ?? null,
    stress_score: null,
    recovery_score: null,
    source: "fitbit",
    raw_data: data as unknown as Record<string, unknown>,
  };
}
