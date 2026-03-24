import { format, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain } from "./domains";
import type {
  SleepRecord,
  Workout,
  DailyMetrics,
  CheckIn,
  ChessGame,
  Goal,
  Insight,
} from "@/types/index";

export interface UserDataBundle {
  userId: string;
  activeDomains: Set<Domain>;

  // All data pre-fetched for the last 30 days
  sleepRecords: SleepRecord[];
  workouts: Workout[];
  dailyMetrics: DailyMetrics[];
  checkins: CheckIn[];
  chessGames: ChessGame[];
  goals: Goal[];

  // Pre-computed lookups for cross-domain joins
  sleepByDate: Map<string, SleepRecord>;
  workoutsByDate: Map<string, Workout[]>;
  checkinByDate: Map<string, CheckIn>;
  metricsByDate: Map<string, DailyMetrics>;
  chessByDate: Map<string, ChessGame[]>;

  // Previous insights for novelty checking
  recentInsights: Insight[];
}

/**
 * Fetch all data for active domains in parallel.
 * Only queries tables for domains that are active.
 */
export async function buildUserDataBundle(
  userId: string,
  activeDomains: Set<Domain>,
  supabase: SupabaseClient,
): Promise<UserDataBundle> {
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const fourteenDaysAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");

  // Build conditional fetches — only query tables for active domains
  const fetchSleep = activeDomains.has("sleep") || activeDomains.has("recovery")
    ? supabase
        .from("sleep_records")
        .select("*")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true })
    : Promise.resolve({ data: [] });

  const fetchWorkouts = activeDomains.has("fitness")
    ? supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true })
    : Promise.resolve({ data: [] });

  const fetchMetrics =
    activeDomains.has("fitness") || activeDomains.has("recovery")
      ? supabase
          .from("daily_metrics")
          .select("*")
          .eq("user_id", userId)
          .gte("date", thirtyDaysAgo)
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] });

  const fetchCheckins = activeDomains.has("mood")
    ? supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: true })
    : Promise.resolve({ data: [] });

  const fetchChess = activeDomains.has("chess")
    ? supabase
        .from("chess_games")
        .select("*")
        .eq("user_id", userId)
        .gte("date", thirtyDaysAgo)
        .order("played_at", { ascending: true })
    : Promise.resolve({ data: [] });

  const fetchGoals = supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  // Recent insights for novelty scoring (last 14 days)
  const fetchRecentInsights = supabase
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .gte("date", fourteenDaysAgo)
    .order("date", { ascending: false });

  const [
    sleepRes,
    workoutRes,
    metricsRes,
    checkinRes,
    chessRes,
    goalsRes,
    insightsRes,
  ] = await Promise.all([
    fetchSleep,
    fetchWorkouts,
    fetchMetrics,
    fetchCheckins,
    fetchChess,
    fetchGoals,
    fetchRecentInsights,
  ]);

  const sleepRecords = (sleepRes.data ?? []) as SleepRecord[];
  const workouts = (workoutRes.data ?? []) as Workout[];
  const dailyMetrics = (metricsRes.data ?? []) as DailyMetrics[];
  const checkins = (checkinRes.data ?? []) as CheckIn[];
  const chessGames = (chessRes.data ?? []) as ChessGame[];
  const goals = (goalsRes.data ?? []) as Goal[];
  const recentInsights = (insightsRes.data ?? []) as Insight[];

  // Build lookup maps
  const sleepByDate = new Map<string, SleepRecord>();
  for (const s of sleepRecords) sleepByDate.set(s.date, s);

  const workoutsByDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    const arr = workoutsByDate.get(w.date) ?? [];
    arr.push(w);
    workoutsByDate.set(w.date, arr);
  }

  const checkinByDate = new Map<string, CheckIn>();
  for (const c of checkins) checkinByDate.set(c.date, c);

  const metricsByDate = new Map<string, DailyMetrics>();
  for (const m of dailyMetrics) metricsByDate.set(m.date, m);

  const chessByDate = new Map<string, ChessGame[]>();
  for (const g of chessGames) {
    const arr = chessByDate.get(g.date) ?? [];
    arr.push(g);
    chessByDate.set(g.date, arr);
  }

  return {
    userId,
    activeDomains,
    sleepRecords,
    workouts,
    dailyMetrics,
    checkins,
    chessGames,
    goals,
    sleepByDate,
    workoutsByDate,
    checkinByDate,
    metricsByDate,
    chessByDate,
    recentInsights,
  };
}
