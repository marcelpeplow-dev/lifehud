import { format, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Domain =
  | "sleep"
  | "fitness"
  | "chess"
  | "wellbeing"
  | "recovery"
  | "caffeine"
  | "hydration"
  | "supplements"
  | "screen_time"
  | "substances";

export const ALL_DOMAINS: Domain[] = [
  "sleep",
  "fitness",
  "chess",
  "wellbeing",
  "recovery",
  "caffeine",
  "hydration",
  "supplements",
  "screen_time",
  "substances",
];

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

  // All manual domain metric IDs — single query covers all 5 manual domains
  const MANUAL_METRIC_IDS: Record<string, string[]> = {
    caffeine:    ["caffeine_total_daily", "caffeine_doses", "caffeine_last_dose", "caffeine_first_dose"],
    hydration:   ["hydration_water_intake"],
    supplements: ["supplements_taken", "supplements_dose"],
    screen_time: ["screen_time_total", "screen_time_before_bed"],
    substances:  ["substances_alcohol", "substances_cannabis"],
  };
  const allManualMetricIds = Object.values(MANUAL_METRIC_IDS).flat();

  // Fetch all domain data counts in parallel
  const [sleepRes, workoutRes, metricsRes, chessRes, checkinRes, recoveryRes, manualRes] =
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

      // Wellbeing: distinct dates in daily_checkins OR manual_entries for wellbeing metrics
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

      // Manual domains (caffeine, hydration, supplements, screen_time, substances)
      // Single batched query for all manual metric IDs
      supabase
        .from("manual_entries")
        .select("date, metric_id")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo)
        .in("metric_id", allManualMetricIds),
    ]);

  const distinctDates = (rows: { date: string }[] | null) =>
    new Set((rows ?? []).map((r) => r.date)).size;

  const sleepCount = distinctDates(sleepRes.data);
  const workoutCount = distinctDates(workoutRes.data);
  const metricsCount = distinctDates(metricsRes.data);
  const fitnessCount = Math.max(workoutCount, metricsCount);
  const chessCount = distinctDates(chessRes.data);

  // Recovery: count days that have HRV or recovery_score data
  const recoveryCount = distinctDates(
    (recoveryRes.data ?? []).filter(
      (r: { hrv_average: number | null; recovery_score: number | null }) =>
        r.hrv_average != null || r.recovery_score != null,
    ),
  );

  // Wellbeing: union of daily_checkins dates and manual_entries wellbeing metric dates
  const checkinDates = new Set((checkinRes.data ?? []).map((r: { date: string }) => r.date));
  const wellbeingMetricIds = new Set(["wellbeing_mood", "wellbeing_energy", "wellbeing_stress", "wellbeing_focus"]);
  for (const row of manualRes.data ?? []) {
    if (wellbeingMetricIds.has((row as { metric_id: string }).metric_id)) {
      checkinDates.add((row as { date: string }).date);
    }
  }
  const moodCount = checkinDates.size;

  // Manual domains: count distinct dates per domain from the single batched query
  const manualRows = (manualRes.data ?? []) as { date: string; metric_id: string }[];
  const manualCountByDomain: Record<string, number> = {};
  for (const [domain, metricIds] of Object.entries(MANUAL_METRIC_IDS)) {
    const metricSet = new Set(metricIds);
    const dates = new Set(manualRows.filter((r) => metricSet.has(r.metric_id)).map((r) => r.date));
    manualCountByDomain[domain] = dates.size;
  }

  const MIN_DAYS = 7;
  const activeDomains = new Set<Domain>();

  if (sleepCount >= MIN_DAYS) activeDomains.add("sleep");
  if (fitnessCount >= MIN_DAYS) activeDomains.add("fitness");
  if (chessCount >= MIN_DAYS) activeDomains.add("chess");
  if (moodCount >= MIN_DAYS) activeDomains.add("wellbeing");

  // Recovery requires sleep OR fitness active, plus HRV/recovery data
  if (
    (activeDomains.has("sleep") || activeDomains.has("fitness")) &&
    recoveryCount >= MIN_DAYS
  ) {
    activeDomains.add("recovery");
  }

  // Manual domains activate at 7+ distinct days with any entry
  for (const domain of Object.keys(MANUAL_METRIC_IDS) as Domain[]) {
    if ((manualCountByDomain[domain] ?? 0) >= MIN_DAYS) activeDomains.add(domain);
  }

  const dataCounts: Record<Domain, number> = {
    sleep: sleepCount,
    fitness: fitnessCount,
    chess: chessCount,
    wellbeing: moodCount,
    recovery: recoveryCount,
    caffeine:    manualCountByDomain["caffeine"]    ?? 0,
    hydration:   manualCountByDomain["hydration"]   ?? 0,
    supplements: manualCountByDomain["supplements"] ?? 0,
    screen_time: manualCountByDomain["screen_time"] ?? 0,
    substances:  manualCountByDomain["substances"]  ?? 0,
  };

  return { activeDomains, dataCounts };
}
