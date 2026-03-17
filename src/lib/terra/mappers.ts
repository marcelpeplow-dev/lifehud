import { format, parseISO } from "date-fns";
import type { Workout } from "@/types/index";

// ── Terra activity type → our workout_type ────────────────────────────────

const CARDIO_TYPES = new Set([1, 2, 3, 7, 9, 10, 11, 12, 13, 14, 15, 24, 25, 26]);
const STRENGTH_TYPES = new Set([16, 17, 18, 19, 20, 21, 22, 23]);
const FLEXIBILITY_TYPES = new Set([98, 99, 100, 101]);

function mapActivityType(terraType: number | undefined): Workout["workout_type"] {
  if (terraType == null) return "other";
  if (CARDIO_TYPES.has(terraType)) return "cardio";
  if (STRENGTH_TYPES.has(terraType)) return "strength";
  if (FLEXIBILITY_TYPES.has(terraType)) return "flexibility";
  return "other";
}

function safeDate(isoString: string | undefined): string | null {
  if (!isoString) return null;
  try {
    return format(parseISO(isoString), "yyyy-MM-dd");
  } catch {
    return null;
  }
}

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ── Sleep mapper ──────────────────────────────────────────────────────────

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

export function mapSleepRecord(
  userId: string,
  provider: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any
): SleepInsert | null {
  const startTime: string | undefined = d?.metadata?.start_time;
  const endTime: string | undefined = d?.metadata?.end_time;
  const date = safeDate(startTime);
  if (!date) return null;

  const durations = d?.sleep_durations_data;
  const stageData = durations?.duration_asleep_state_data;
  const deepSecs = stageData?.duration_deep_sleep_state_seconds;
  const remSecs = stageData?.duration_REM_sleep_state_seconds;
  const lightSecs = stageData?.duration_light_sleep_state_seconds;
  const awakeSecs = durations?.duration_awake_state_seconds;
  const totalSecs = durations?.sleep_duration_seconds
    ?? (deepSecs != null && remSecs != null && lightSecs != null
      ? (deepSecs + remSecs + lightSecs + (awakeSecs ?? 0))
      : null);

  const hrSummary = d?.heart_rate_data?.summary;
  const sleepScore = d?.sleep_scores?.sleep_score ?? d?.sleep_scores?.overall ?? null;

  return {
    user_id: userId,
    date,
    bedtime: startTime ?? null,
    wake_time: endTime ?? null,
    duration_minutes: totalSecs != null ? Math.round(totalSecs / 60) : null,
    deep_sleep_minutes: deepSecs != null ? Math.round(deepSecs / 60) : null,
    rem_sleep_minutes: remSecs != null ? Math.round(remSecs / 60) : null,
    light_sleep_minutes: lightSecs != null ? Math.round(lightSecs / 60) : null,
    awake_minutes: awakeSecs != null ? Math.round(awakeSecs / 60) : null,
    sleep_score: safeNum(sleepScore),
    avg_heart_rate: safeNum(hrSummary?.avg_hr_bpm),
    avg_hrv: safeNum(hrSummary?.hrv_rmssd_data?.avg),
    source: provider,
    raw_data: d,
  };
}

// ── Activity mapper ───────────────────────────────────────────────────────

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

export function mapActivityRecord(
  userId: string,
  provider: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any
): WorkoutInsert | null {
  const startTime: string | undefined = d?.metadata?.start_time;
  const date = safeDate(startTime);
  if (!date) return null;

  const activeSecs = d?.active_durations_data?.activity_seconds;
  const hrSummary = d?.heart_rate_data?.summary;
  const distSummary = d?.distance_data?.summary;
  const activityType: number | undefined = d?.metadata?.type;

  return {
    user_id: userId,
    date,
    started_at: startTime ?? null,
    ended_at: d?.metadata?.end_time ?? null,
    duration_minutes: activeSecs != null ? Math.round(activeSecs / 60) : null,
    workout_type: mapActivityType(activityType),
    activity_name: d?.metadata?.name ?? null,
    calories_burned: safeNum(d?.calories_data?.total_burned_calories),
    avg_heart_rate: safeNum(hrSummary?.avg_hr_bpm),
    max_heart_rate: safeNum(hrSummary?.max_hr_bpm),
    distance_meters: safeNum(distSummary?.distance_meters),
    intensity_score: safeNum(d?.TSS_data?.intensity),
    source: provider,
    raw_data: d,
  };
}

// ── Daily mapper ──────────────────────────────────────────────────────────

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

export function mapDailyRecord(
  userId: string,
  provider: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any
): DailyMetricsInsert | null {
  const startTime: string | undefined = d?.metadata?.start_time;
  const date = safeDate(startTime);
  if (!date) return null;

  const hrSummary = d?.heart_rate_data?.summary;
  const activeSecs = d?.active_durations_data?.activity_seconds;

  return {
    user_id: userId,
    date,
    steps: safeNum(d?.distance_data?.steps),
    active_minutes: activeSecs != null ? Math.round(activeSecs / 60) : null,
    resting_heart_rate: safeNum(hrSummary?.resting_hr_bpm),
    hrv_average: safeNum(hrSummary?.avg_hrv_rmssd),
    calories_total: safeNum(d?.calories_data?.total_burned_calories),
    calories_active: safeNum(d?.calories_data?.activity_calories),
    stress_score: safeNum(d?.stress_data?.avg_stress_level),
    recovery_score: safeNum(d?.scores?.recovery_score),
    source: provider,
    raw_data: d,
  };
}
