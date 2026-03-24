import { format, subDays, parseISO, differenceInDays } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { fitbitGet, getValidToken } from "./client";
import {
  mapFitbitSleep,
  mapFitbitActivity,
  mapFitbitDailyMetrics,
  type SleepInsert,
  type WorkoutInsert,
  type DailyMetricsInsert,
} from "./mappers";

// ── Fitbit API response shapes ───────────────────────────────────────────────

interface FitbitSleepResponse {
  sleep: Array<{
    dateOfSleep: string;
    startTime: string;
    endTime: string;
    duration: number;
    efficiency: number;
    minutesAsleep?: number;
    minutesAwake?: number;
    isMainSleep?: boolean;
    levels?: {
      summary?: {
        deep?: { minutes: number };
        rem?: { minutes: number };
        light?: { minutes: number };
        wake?: { minutes: number };
      };
    };
  }>;
}

interface FitbitActivitiesResponse {
  activities: Array<{
    logId: number;
    activityName: string;
    startTime: string;
    startDate: string;
    duration: number;
    activeDuration: number;
    calories: number;
    averageHeartRate?: number;
    distance?: number;
    distanceUnit?: string;
    activityTypeId?: number;
    steps?: number;
  }>;
}

interface FitbitActivitySummary {
  summary: {
    steps: number;
    caloriesOut: number;
    activityCalories: number;
    fairlyActiveMinutes: number;
    veryActiveMinutes: number;
  };
}

interface FitbitHeartResponse {
  "activities-heart": Array<{
    dateTime: string;
    value: {
      restingHeartRate?: number;
    };
  }>;
}

interface FitbitHrvResponse {
  hrv: Array<{
    dateTime: string;
    value: {
      dailyRmssd?: number;
    };
  }>;
}

// ── Main sync function ───────────────────────────────────────────────────────

interface SyncResult {
  sleep: number;
  workouts: number;
  metrics: number;
  errors: string[];
}

/**
 * Sync Fitbit data for a single user.
 * On first sync (no last_sync_at), pulls 30 days. Otherwise pulls since last sync.
 */
export async function syncFitbitUser(userId: string): Promise<SyncResult> {
  const { token, integration } = await getValidToken(userId);
  const supabase = createServiceClient();

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Determine sync range
  let startDate: Date;
  if (integration.last_sync_at) {
    startDate = parseISO(integration.last_sync_at);
    // Cap at 30 days to avoid excessive API calls
    const maxStart = subDays(today, 30);
    if (startDate < maxStart) startDate = maxStart;
  } else {
    startDate = subDays(today, 30);
  }
  const startStr = format(startDate, "yyyy-MM-dd");
  const dayCount = differenceInDays(today, startDate) + 1;

  const result: SyncResult = { sleep: 0, workouts: 0, metrics: 0, errors: [] };
  const fitbitUserId = integration.provider_user_id ?? "-";

  // ── 1. Sleep data ──────────────────────────────────────────────────────────
  // Fitbit sleep endpoint supports date range (max 100 days)
  try {
    const sleepData = (await fitbitGet(
      token,
      `/1.2/user/${fitbitUserId}/sleep/date/${startStr}/${todayStr}.json`
    )) as FitbitSleepResponse;

    const sleepRows: SleepInsert[] = [];
    for (const log of sleepData.sleep ?? []) {
      // Only take main sleep per night
      if (log.isMainSleep === false) continue;
      const mapped = mapFitbitSleep(userId, log);
      if (mapped) sleepRows.push(mapped);
    }

    if (sleepRows.length > 0) {
      const { error } = await supabase
        .from("sleep_records")
        .upsert(sleepRows, { onConflict: "user_id,date" });
      if (error) result.errors.push(`Sleep: ${error.message}`);
      else result.sleep = sleepRows.length;
    }
  } catch (e) {
    result.errors.push(`Sleep: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2. Activity logs (workouts) ────────────────────────────────────────────
  // Fitbit activity log list — afterDate param, returns up to 20
  try {
    const actData = (await fitbitGet(
      token,
      `/1/user/${fitbitUserId}/activities/list.json?afterDate=${startStr}&sort=asc&limit=20&offset=0`
    )) as FitbitActivitiesResponse;

    const workoutRows: WorkoutInsert[] = [];
    for (const activity of actData.activities ?? []) {
      const mapped = mapFitbitActivity(userId, activity);
      if (mapped) workoutRows.push(mapped);
    }

    if (workoutRows.length > 0) {
      // Delete existing fitbit workouts in date range, then insert
      const dates = [...new Set(workoutRows.map((w) => w.date))];
      await supabase
        .from("workouts")
        .delete()
        .eq("user_id", userId)
        .eq("source", "fitbit")
        .in("date", dates);

      const { error } = await supabase.from("workouts").insert(workoutRows);
      if (error) result.errors.push(`Workouts: ${error.message}`);
      else result.workouts = workoutRows.length;
    }
  } catch (e) {
    result.errors.push(`Workouts: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 3. Daily metrics (steps, HR, HRV, calories) ────────────────────────────
  // Batch: fetch time series for the range (1 API call per metric)
  try {
    // Steps + calories from activity summary (per-day requires individual calls for summary,
    // but time series endpoints are more efficient)
    const [stepsData, caloriesData, heartData, hrvData] = await Promise.all([
      fitbitGet(token, `/1/user/${fitbitUserId}/activities/steps/date/${startStr}/${todayStr}.json`)
        .catch(() => null),
      fitbitGet(token, `/1/user/${fitbitUserId}/activities/calories/date/${startStr}/${todayStr}.json`)
        .catch(() => null),
      fitbitGet(token, `/1/user/${fitbitUserId}/activities/heart/date/${startStr}/${todayStr}.json`)
        .catch(() => null),
      fitbitGet(token, `/1/user/${fitbitUserId}/hrv/date/${startStr}/${todayStr}.json`)
        .catch(() => null),
    ]);

    // Parse time series into date-keyed maps
    const stepsByDate = new Map<string, number>();
    const caloriesByDate = new Map<string, number>();
    const hrByDate = new Map<string, number>();
    const hrvByDate = new Map<string, number>();

    // Steps: { "activities-steps": [{ dateTime, value }] }
    const stepsArr = (stepsData as Record<string, unknown>)?.["activities-steps"];
    if (Array.isArray(stepsArr)) {
      for (const entry of stepsArr) {
        const val = Number(entry.value);
        if (val > 0) stepsByDate.set(entry.dateTime, val);
      }
    }

    // Calories: { "activities-calories": [{ dateTime, value }] }
    const calArr = (caloriesData as Record<string, unknown>)?.["activities-calories"];
    if (Array.isArray(calArr)) {
      for (const entry of calArr) {
        const val = Number(entry.value);
        if (val > 0) caloriesByDate.set(entry.dateTime, val);
      }
    }

    // Heart rate: { "activities-heart": [{ dateTime, value: { restingHeartRate } }] }
    const hrArr = (heartData as FitbitHeartResponse)?.["activities-heart"];
    if (Array.isArray(hrArr)) {
      for (const entry of hrArr) {
        const rhr = entry.value?.restingHeartRate;
        if (rhr != null && rhr > 0) hrByDate.set(entry.dateTime, rhr);
      }
    }

    // HRV: { "hrv": [{ dateTime, value: { dailyRmssd } }] }
    const hrvArr = (hrvData as FitbitHrvResponse)?.hrv;
    if (Array.isArray(hrvArr)) {
      for (const entry of hrvArr) {
        const rmssd = entry.value?.dailyRmssd;
        if (rmssd != null && rmssd > 0) hrvByDate.set(entry.dateTime, Math.round(rmssd));
      }
    }

    // Collect all dates that have any data
    const allDates = new Set([
      ...stepsByDate.keys(),
      ...caloriesByDate.keys(),
      ...hrByDate.keys(),
      ...hrvByDate.keys(),
    ]);

    const metricsRows: DailyMetricsInsert[] = [];
    for (const date of allDates) {
      metricsRows.push(
        mapFitbitDailyMetrics(userId, date, {
          steps: stepsByDate.get(date),
          restingHeartRate: hrByDate.get(date),
          hrvAverage: hrvByDate.get(date),
          caloriesTotalBurned: caloriesByDate.get(date),
        })
      );
    }

    if (metricsRows.length > 0) {
      const { error } = await supabase
        .from("daily_metrics")
        .upsert(metricsRows, { onConflict: "user_id,date" });
      if (error) result.errors.push(`Metrics: ${error.message}`);
      else result.metrics = metricsRows.length;
    }
  } catch (e) {
    result.errors.push(`Metrics: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Update last_sync_at ────────────────────────────────────────────────────
  await supabase
    .from("user_integrations")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", integration.id);

  return result;
}
