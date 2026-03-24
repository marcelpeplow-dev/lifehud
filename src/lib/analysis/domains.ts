import { format, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Domain = "sleep" | "fitness" | "chess" | "mood" | "recovery";

export const ALL_DOMAINS: Domain[] = ["sleep", "fitness", "chess", "mood", "recovery"];

export interface DomainDiscovery {
  activeDomains: Set<Domain>;
  dataCounts: Record<Domain, number>;
}

/**
 * Check which domains have sufficient data (7+ distinct days in last 30 days).
 * Recovery is derived: active if (sleep OR fitness) is active AND daily_metrics has HRV/recovery data.
 * Runs ONCE at the start of insight generation.
 */
export async function discoverActiveDomains(
  userId: string,
  supabase: SupabaseClient,
): Promise<DomainDiscovery> {
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  // Fetch all domain data counts in parallel
  const [sleepRes, workoutRes, metricsRes, chessRes, checkinRes, recoveryRes] =
    await Promise.all([
      // Sleep: distinct dates in sleep_records
      supabase
        .from("sleep_records")
        .select("date")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),

      // Fitness: distinct dates in workouts
      supabase
        .from("workouts")
        .select("date")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),

      // Fitness (alt): distinct dates in daily_metrics
      supabase
        .from("daily_metrics")
        .select("date")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),

      // Chess: distinct dates in chess_games
      supabase
        .from("chess_games")
        .select("date")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),

      // Mood: distinct dates in daily_checkins
      supabase
        .from("daily_checkins")
        .select("date")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),

      // Recovery: daily_metrics with hrv or recovery_score
      supabase
        .from("daily_metrics")
        .select("date, hrv_average, recovery_score")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo),
    ]);

  const distinctDates = (rows: { date: string }[] | null) =>
    new Set((rows ?? []).map((r) => r.date)).size;

  const sleepCount = distinctDates(sleepRes.data);
  const workoutCount = distinctDates(workoutRes.data);
  const metricsCount = distinctDates(metricsRes.data);
  const fitnessCount = Math.max(workoutCount, metricsCount);
  const chessCount = distinctDates(chessRes.data);
  const moodCount = distinctDates(checkinRes.data);

  // Recovery: count days that have HRV or recovery_score data
  const recoveryCount = distinctDates(
    (recoveryRes.data ?? []).filter(
      (r: { hrv_average: number | null; recovery_score: number | null }) =>
        r.hrv_average != null || r.recovery_score != null,
    ),
  );

  const MIN_DAYS = 7;
  const activeDomains = new Set<Domain>();

  if (sleepCount >= MIN_DAYS) activeDomains.add("sleep");
  if (fitnessCount >= MIN_DAYS) activeDomains.add("fitness");
  if (chessCount >= MIN_DAYS) activeDomains.add("chess");
  if (moodCount >= MIN_DAYS) activeDomains.add("mood");

  // Recovery requires sleep OR fitness active, plus HRV/recovery data
  if (
    (activeDomains.has("sleep") || activeDomains.has("fitness")) &&
    recoveryCount >= MIN_DAYS
  ) {
    activeDomains.add("recovery");
  }

  const dataCounts: Record<Domain, number> = {
    sleep: sleepCount,
    fitness: fitnessCount,
    chess: chessCount,
    mood: moodCount,
    recovery: recoveryCount,
  };

  return { activeDomains, dataCounts };
}
