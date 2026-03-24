import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { detectPatterns } from "@/lib/analysis/patterns";
import { detectBasicStats } from "@/lib/analysis/patterns";
import { generateInsights, generateDailyAction } from "@/lib/ai/generate";
import type { ChessContext } from "@/lib/ai/generate";
import { average } from "@/lib/utils/metrics";
import type { SleepRecord, Workout, DailyMetrics, CheckIn, ChessGame, InsightCategory } from "@/types/index";

export const GET = POST;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");

    // Check for already-generated insights today
    const { data: existingToday } = await supabase
      .from("insights")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .limit(1);

    if (existingToday && existingToday.length > 0) {
      return NextResponse.json({ message: "Insights already generated today", generated: 0 });
    }

    // Fetch last 30 days of data
    const [
      { data: sleepData },
      { data: workoutData },
      { data: metricsData },
      { data: checkInData },
      { data: chessData },
    ] = await Promise.all([
      supabase.from("sleep_records").select("*").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("date", { ascending: true }),
      supabase.from("workouts").select("*").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("date", { ascending: true }),
      supabase.from("daily_metrics").select("*").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("date", { ascending: true }),
      supabase.from("daily_checkins").select("*").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("date", { ascending: true }),
      supabase.from("chess_games").select("*").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("played_at", { ascending: true }),
    ]);

    const sleepRecords = (sleepData ?? []) as SleepRecord[];
    const workouts = (workoutData ?? []) as Workout[];
    const dailyMetrics = (metricsData ?? []) as DailyMetrics[];
    const checkIns = (checkInData ?? []) as CheckIn[];
    const chessGames = (chessData ?? []) as ChessGame[];

    // Detect patterns (cross-domain) and basic stats
    const crossDomainPatterns = detectPatterns({ sleepRecords, workouts, dailyMetrics, checkIns, chessGames, today });
    const basicStats = detectBasicStats({ sleepRecords, workouts, dailyMetrics, checkIns, chessGames, today });

    if (crossDomainPatterns.length === 0 && basicStats.length === 0) {
      return NextResponse.json({ message: "Not enough data for pattern detection", generated: 0 });
    }

    // Build context
    const avgSleepMinutes = average(sleepRecords.map((s) => s.duration_minutes));
    const avgMood = checkIns.length > 0 ? average(checkIns.map((c) => c.mood)) : null;
    const avgEnergy = checkIns.length > 0 ? average(checkIns.map((c) => c.energy)) : null;
    const avgStress = checkIns.length > 0 ? average(checkIns.map((c) => c.stress)) : null;

    const sleepWithStages = sleepRecords.filter(
      (s) => s.duration_minutes && s.duration_minutes > 0 &&
        ((s.deep_sleep_minutes ?? 0) + (s.rem_sleep_minutes ?? 0)) > 0
    );
    const avgDeepRemPct = sleepWithStages.length > 0
      ? average(sleepWithStages.map((s) =>
          ((s.deep_sleep_minutes ?? 0) + (s.rem_sleep_minutes ?? 0)) / s.duration_minutes!
        ))
      : null;

    const lastNight = sleepRecords.at(-1);
    const lastNightSleepHours = lastNight?.duration_minutes != null
      ? lastNight.duration_minutes / 60
      : null;

    // Build chess context if chess data exists
    let chessContext: ChessContext | null = null;
    if (chessGames.length > 0) {
      const fourteenDaysAgo = format(subDays(today, 14), "yyyy-MM-dd");
      const recent14 = chessGames.filter((g) => g.date >= fourteenDaysAgo);
      const latestByTc = (tc: string) => {
        const tcGames = chessGames.filter((g) => g.time_class === tc);
        return tcGames.length > 0 ? tcGames[tcGames.length - 1].player_rating : null;
      };
      // Rating trend: compare first half vs second half
      const mid = Math.floor(chessGames.length / 2);
      const firstHalfAvg = chessGames.length >= 4
        ? chessGames.slice(0, mid).reduce((s, g) => s + g.player_rating, 0) / mid
        : 0;
      const secondHalfAvg = chessGames.length >= 4
        ? chessGames.slice(mid).reduce((s, g) => s + g.player_rating, 0) / (chessGames.length - mid)
        : 0;
      const ratingDiff = secondHalfAvg - firstHalfAvg;
      const ratingTrend: "up" | "down" | "flat" = chessGames.length < 4 ? "flat" : ratingDiff > 10 ? "up" : ratingDiff < -10 ? "down" : "flat";

      const uniqueDays = new Set(chessGames.map((g) => g.date)).size;
      const recentWins = recent14.filter((g) => g.result === "win").length;

      chessContext = {
        gamesCount: chessGames.length,
        gamesPerDay: uniqueDays > 0 ? chessGames.length / uniqueDays : 0,
        rapidRating: latestByTc("rapid"),
        blitzRating: latestByTc("blitz"),
        bulletRating: latestByTc("bullet"),
        ratingTrend,
        recentWinRate: recent14.length > 0 ? recentWins / recent14.length : null,
        recentGames: recent14.length,
      };
    }

    const context = {
      nightCount: sleepRecords.length,
      workoutCount: workouts.length,
      avgSleepHours: avgSleepMinutes != null ? avgSleepMinutes / 60 : null,
      avgDeepRemPct,
      lastNightSleepHours,
      checkInCount: checkIns.length,
      avgMood,
      avgEnergy,
      avgStress,
      chess: chessContext,
    };

    // Generate insights via Claude
    const rawInsights = await generateInsights(crossDomainPatterns, basicStats, context);

    // Insert into DB
    const rows = rawInsights.map((insight) => ({
      user_id: user.id,
      date: todayStr,
      category: insight.category as InsightCategory,
      title: insight.title,
      body: insight.body,
      priority: insight.priority,
      rarity: insight.rarity,
      data_points: {
        patterns_used: crossDomainPatterns.slice(0, 3).map((p) => p.type),
        confidence: insight.confidence,
      },
      is_read: false,
      is_dismissed: false,
    }));

    const { data: inserted, error } = await supabase.from("insights").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate daily action (non-blocking — don't fail if this errors)
    try {
      const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
      const recentWorkouts = workouts.filter((w) => w.date >= sevenDaysAgo);
      const last7Checkins = checkIns.filter((c) => c.date >= sevenDaysAgo);

      const actionText = await generateDailyAction({
        lastNightSleepHours,
        avgSleepHours: avgSleepMinutes != null ? avgSleepMinutes / 60 : null,
        recentWorkoutCount: recentWorkouts.length,
        lastWorkoutDate: workouts.at(-1)?.date ?? null,
        avgMood: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.mood)) : null,
        avgEnergy: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.energy)) : null,
        avgStress: last7Checkins.length > 0 ? average(last7Checkins.map((c) => c.stress)) : null,
        topPattern: crossDomainPatterns[0]?.description ?? null,
      });

      if (actionText) {
        const serviceClient = createServiceClient();
        await serviceClient.from("daily_actions").upsert({
          user_id: user.id,
          date: todayStr,
          text: actionText,
        }, { onConflict: "user_id,date" });
      }
    } catch {
      // Daily action failure is non-fatal
    }

    return NextResponse.json({ generated: inserted?.length ?? 0, insights: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
