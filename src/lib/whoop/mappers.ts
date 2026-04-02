import { format } from "date-fns";
import type { Workout } from "@/types/index";

// ── Whoop API response shapes ────────────────────────────────────────────────

interface WhoopSleepStageSummary {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  disturbance_count: number;
}

interface WhoopSleepScore {
  stage_summary: WhoopSleepStageSummary;
  sleep_performance_percentage: number | null;
  sleep_efficiency_percentage: number | null;
  respiratory_rate: number | null;
}

export interface WhoopSleep {
  id: number;
  start: string;
  end: string;
  nap: boolean;
  score_state: string;
  score?: WhoopSleepScore;
}

interface WhoopRecoveryScore {
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage: number | null;
  skin_temp_celsius: number | null;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: WhoopRecoveryScore;
}

interface WhoopWorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number | null;
  percent_recorded: number;
  distance_meter: number | null;
  altitude_gain_meter: number | null;
  altitude_change_meter: number | null;
  zone_duration: unknown;
}

export interface WhoopWorkout {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  score_state: string;
  score?: WhoopWorkoutScore;
}

interface WhoopCycleScore {
  strain: number;
  kilojoule: number | null;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: string;
  score?: WhoopCycleScore;
}

// ── Insert types (matching DB columns) ──────────────────────────────────────

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

// ── Sport ID → workout type ──────────────────────────────────────────────────

// Whoop numeric sport IDs (non-exhaustive — covers common ones)
// https://developer.whoop.com/docs/developing/user-data/workout
const CARDIO_SPORT_IDS = new Set([
  0,  // Running
  1,  // Cycling
  16, // Swimming
  17, // Rowing
  18, // Elliptical
  19, // Stairmaster
  20, // Hiking
  24, // Walking
  25, // Dance
  27, // Skating
  33, // Jump Rope
  36, // Skiing
  37, // Snowboarding
  38, // Snowshoeing
  42, // Soccer
  43, // Basketball
  44, // Tennis
  47, // Boxing
  48, // Kickboxing
  52, // Volleyball
  56, // Baseball
  57, // Softball
  63, // Rugby
  64, // Lacrosse
  70, // Field Hockey
  71, // Cricket
  73, // Badminton
]);

const STRENGTH_SPORT_IDS = new Set([
  2,  // Weightlifting
  22, // Functional Fitness
  23, // CrossFit
  46, // Powerlifting
  49, // Bodybuilding
  50, // Calisthenics
  51, // Pilates
  53, // Gymnastics
  54, // Martial Arts
  55, // Wrestling
  58, // MMA
  59, // Jiu-Jitsu
  60, // Karate
  61, // Taekwondo
  62, // Judo
  66, // Rock Climbing
  68, // Obstacle Racing
]);

const FLEXIBILITY_SPORT_IDS = new Set([
  44, // Yoga (also in cardio? let flexibility win)
]);

function mapWhoopSportType(sportId: number): Workout["workout_type"] {
  if (FLEXIBILITY_SPORT_IDS.has(sportId)) return "flexibility";
  if (STRENGTH_SPORT_IDS.has(sportId)) return "strength";
  if (CARDIO_SPORT_IDS.has(sportId)) return "cardio";
  return "other";
}

// ── Sleep mapper ─────────────────────────────────────────────────────────────

export function mapWhoopSleep(userId: string, sleep: WhoopSleep): SleepInsert | null {
  if (sleep.nap) return null; // Skip naps
  if (sleep.score_state !== "SCORED" || !sleep.score) return null;

  const stages = sleep.score.stage_summary;
  const dateStr = format(new Date(sleep.start), "yyyy-MM-dd");

  return {
    user_id: userId,
    date: dateStr,
    bedtime: sleep.start,
    wake_time: sleep.end,
    duration_minutes: stages.total_in_bed_time_milli
      ? Math.round(stages.total_in_bed_time_milli / 60000)
      : null,
    deep_sleep_minutes: stages.total_slow_wave_sleep_time_milli
      ? Math.round(stages.total_slow_wave_sleep_time_milli / 60000)
      : null,
    rem_sleep_minutes: stages.total_rem_sleep_time_milli
      ? Math.round(stages.total_rem_sleep_time_milli / 60000)
      : null,
    light_sleep_minutes: stages.total_light_sleep_time_milli
      ? Math.round(stages.total_light_sleep_time_milli / 60000)
      : null,
    awake_minutes: stages.total_awake_time_milli
      ? Math.round(stages.total_awake_time_milli / 60000)
      : null,
    // Prefer sleep performance percentage (0-100) over efficiency
    sleep_score: sleep.score.sleep_performance_percentage ?? sleep.score.sleep_efficiency_percentage ?? null,
    avg_heart_rate: null, // Not available per-sleep in Whoop; comes from Recovery
    avg_hrv: null, // Not available per-sleep in Whoop; comes from Recovery
    source: "whoop",
    raw_data: sleep as unknown as Record<string, unknown>,
  };
}

// ── Recovery mapper → daily_metrics ─────────────────────────────────────────

export function mapWhoopRecovery(
  userId: string,
  recovery: WhoopRecovery,
  cycleDate: string
): DailyMetricsInsert | null {
  if (recovery.score_state !== "SCORED" || !recovery.score) return null;

  const score = recovery.score;

  return {
    user_id: userId,
    date: cycleDate,
    steps: null,
    active_minutes: null,
    resting_heart_rate: score.resting_heart_rate ?? null,
    hrv_average: score.hrv_rmssd_milli ?? null,
    calories_total: null,
    calories_active: null,
    stress_score: null,
    recovery_score: score.recovery_score ?? null,
    source: "whoop",
    raw_data: recovery as unknown as Record<string, unknown>,
  };
}

// ── Workout mapper ───────────────────────────────────────────────────────────

export function mapWhoopWorkout(userId: string, workout: WhoopWorkout): WorkoutInsert | null {
  if (workout.score_state !== "SCORED" || !workout.score) return null;

  const startTime = new Date(workout.start);
  const endTime = new Date(workout.end);
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  // Skip very short activities (under 5 minutes)
  if (durationMinutes < 5) return null;

  const score = workout.score;
  const caloriesBurned = score.kilojoule ? Math.round(score.kilojoule * 0.239006) : null;

  return {
    user_id: userId,
    date: format(startTime, "yyyy-MM-dd"),
    started_at: workout.start,
    ended_at: workout.end,
    duration_minutes: durationMinutes,
    workout_type: mapWhoopSportType(workout.sport_id),
    activity_name: `Whoop Sport ${workout.sport_id}`,
    calories_burned: caloriesBurned,
    avg_heart_rate: score.average_heart_rate ?? null,
    max_heart_rate: score.max_heart_rate ?? null,
    distance_meters: score.distance_meter ?? null,
    intensity_score: score.strain ?? null, // Whoop strain → intensity_score
    source: "whoop",
    raw_data: workout as unknown as Record<string, unknown>,
  };
}

// ── Cycle mapper → daily_metrics (calories + strain) ────────────────────────

export function mapWhoopCycle(userId: string, cycle: WhoopCycle): DailyMetricsInsert | null {
  if (cycle.score_state !== "SCORED" || !cycle.score) return null;

  const dateStr = format(new Date(cycle.start), "yyyy-MM-dd");
  const score = cycle.score;
  const caloriesTotal = score.kilojoule ? Math.round(score.kilojoule * 0.239006) : null;

  return {
    user_id: userId,
    date: dateStr,
    steps: null,
    active_minutes: null,
    resting_heart_rate: null,
    hrv_average: null,
    calories_total: caloriesTotal,
    calories_active: null,
    stress_score: score.strain ?? null, // Whoop daily strain → stress_score
    recovery_score: null, // Filled in by recovery mapper
    source: "whoop",
    raw_data: cycle as unknown as Record<string, unknown>,
  };
}
