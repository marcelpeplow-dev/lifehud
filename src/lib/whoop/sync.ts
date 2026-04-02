import { format, subDays, parseISO } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { getValidWhoopToken, whoopFetchAll, whoopGet } from "./client";
import {
  mapWhoopSleep,
  mapWhoopRecovery,
  mapWhoopWorkout,
  mapWhoopCycle,
  type WhoopSleep,
  type WhoopRecovery,
  type WhoopWorkout,
  type WhoopCycle,
  type SleepInsert,
  type WorkoutInsert,
  type DailyMetricsInsert,
} from "./mappers";

// ── Sync result ──────────────────────────────────────────────────────────────

export interface WhoopSyncResult {
  sleep: number;
  workouts: number;
  metrics: number;
  errors: string[];
}

// ── Whoop profile response ───────────────────────────────────────────────────

interface WhoopProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export async function getWhoopProfile(token: string): Promise<WhoopProfile> {
  return (await whoopGet(token, "/v1/user/profile/basic")) as WhoopProfile;
}

// ── Main sync function ───────────────────────────────────────────────────────

/**
 * Sync Whoop data for a single user.
 * On first sync (no last_sync_at), pulls 90 days. Otherwise pulls since last sync.
 */
export async function syncWhoopUser(userId: string): Promise<WhoopSyncResult> {
  const { token, integration } = await getValidWhoopToken(userId);
  const supabase = createServiceClient();

  const today = new Date();

  // Determine sync range (cap at 90 days)
  let startDate: Date;
  if (integration.last_sync_at) {
    startDate = parseISO(integration.last_sync_at);
    const maxStart = subDays(today, 90);
    if (startDate < maxStart) startDate = maxStart;
  } else {
    startDate = subDays(today, 90);
  }

  const startStr = startDate.toISOString();
  const endStr = today.toISOString();

  const result: WhoopSyncResult = { sleep: 0, workouts: 0, metrics: 0, errors: [] };

  // ── 1. Sleep ───────────────────────────────────────────────────────────────
  try {
    const sleepRecords = (await whoopFetchAll(token, "/v1/activity/sleep", {
      start: startStr,
      end: endStr,
    })) as WhoopSleep[];

    const sleepRows: SleepInsert[] = [];
    for (const record of sleepRecords) {
      const mapped = mapWhoopSleep(userId, record);
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

  // Rate limit protection between endpoint groups
  await new Promise((r) => setTimeout(r, 1000));

  // ── 2. Workouts ────────────────────────────────────────────────────────────
  try {
    const workoutRecords = (await whoopFetchAll(token, "/v1/activity/workout", {
      start: startStr,
      end: endStr,
    })) as WhoopWorkout[];

    const workoutRows: WorkoutInsert[] = [];
    for (const record of workoutRecords) {
      const mapped = mapWhoopWorkout(userId, record);
      if (mapped) workoutRows.push(mapped);
    }

    if (workoutRows.length > 0) {
      const dates = [...new Set(workoutRows.map((w) => w.date))];
      await supabase
        .from("workouts")
        .delete()
        .eq("user_id", userId)
        .eq("source", "whoop")
        .in("date", dates);

      const { error } = await supabase.from("workouts").insert(workoutRows);
      if (error) result.errors.push(`Workouts: ${error.message}`);
      else result.workouts = workoutRows.length;
    }
  } catch (e) {
    result.errors.push(`Workouts: ${e instanceof Error ? e.message : String(e)}`);
  }

  await new Promise((r) => setTimeout(r, 1000));

  // ── 3. Recovery → daily_metrics ────────────────────────────────────────────
  // Recovery records are linked to cycles; we need cycle date for the date field
  const recoveryByDate = new Map<string, DailyMetricsInsert>();
  try {
    const cycleRecords = (await whoopFetchAll(token, "/v1/cycle", {
      start: startStr,
      end: endStr,
    })) as WhoopCycle[];

    // Map cycles first (calories + strain)
    for (const cycle of cycleRecords) {
      const mapped = mapWhoopCycle(userId, cycle);
      if (mapped) recoveryByDate.set(mapped.date, mapped);
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Map recovery data (RHR, HRV, recovery score) — merges into cycle row by date
    const recoveryRecords = (await whoopFetchAll(token, "/v1/recovery", {
      start: startStr,
      end: endStr,
    })) as WhoopRecovery[];

    for (const recovery of recoveryRecords) {
      // Recovery date is the date the cycle started
      const cycleDate = format(new Date(recovery.created_at), "yyyy-MM-dd");
      const mapped = mapWhoopRecovery(userId, recovery, cycleDate);
      if (!mapped) continue;

      const existing = recoveryByDate.get(cycleDate);
      if (existing) {
        // Merge: recovery fills in RHR/HRV/recovery_score; cycle has calories/strain
        existing.resting_heart_rate = mapped.resting_heart_rate;
        existing.hrv_average = mapped.hrv_average;
        existing.recovery_score = mapped.recovery_score;
        // Use the recovery raw_data (more interesting)
        existing.raw_data = { cycle: existing.raw_data, recovery: mapped.raw_data };
      } else {
        recoveryByDate.set(cycleDate, mapped);
      }
    }
  } catch (e) {
    result.errors.push(`Metrics: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (recoveryByDate.size > 0) {
    try {
      const metricsRows = [...recoveryByDate.values()];
      const { error } = await supabase
        .from("daily_metrics")
        .upsert(metricsRows, { onConflict: "user_id,date" });
      if (error) result.errors.push(`Metrics upsert: ${error.message}`);
      else result.metrics = metricsRows.length;
    } catch (e) {
      result.errors.push(`Metrics upsert: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Update last_sync_at ────────────────────────────────────────────────────
  await supabase
    .from("user_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return result;
}
