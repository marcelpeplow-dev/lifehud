import { format, subDays, startOfWeek } from "date-fns";
import { Moon, Dumbbell, SmilePlus, Flame } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { DailyActionCard } from "@/components/dashboard/DailyActionCard";
import { SleepChart } from "@/components/charts/SleepChart";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { StatCardsSection } from "@/components/dashboard/StatCardsSection";
import { ConfigurableGraph } from "@/components/dashboard/ConfigurableGraph";
import type { GraphConfig } from "@/components/dashboard/GraphBuilderModal";
import { buildDateArray, formatRelativeDate } from "@/lib/utils/dates";
import { formatDuration, average, calcProgress } from "@/lib/utils/metrics";
import type { Insight, Goal, CheckIn, DailyAction, SleepChartDataPoint, WorkoutChartDataPoint } from "@/types/index";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lastWeekStart = format(startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const lastWeekEnd = format(subDays(startOfWeek(today, { weekStartsOn: 1 }), 1), "yyyy-MM-dd");

  const [
    { data: recentSleep },
    { data: weekWorkouts },
    { data: lastWeekWorkouts },
    { data: recentMetrics },
    { data: rawInsights },
    { data: activeGoals },
    { data: last7Workouts },
    { data: todayCheckInData },
    { data: dailyActionData },
    { data: allCheckInDates },
    { data: statCardConfigs },
    { data: graphConfigs },
  ] = await Promise.all([
    supabase
      .from("sleep_records")
      .select("date, duration_minutes, sleep_score")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo)
      .order("date", { ascending: false }),
    supabase
      .from("workouts")
      .select("id, date, duration_minutes")
      .eq("user_id", user.id)
      .gte("date", weekStart),
    supabase
      .from("workouts")
      .select("id")
      .eq("user_id", user.id)
      .gte("date", lastWeekStart)
      .lte("date", lastWeekEnd),
    supabase
      .from("daily_metrics")
      .select("date, resting_heart_rate, hrv_average, steps")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo)
      .order("date", { ascending: false }),
    supabase
      .from("insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .order("date", { ascending: false })
      .order("priority", { ascending: false })
      .limit(2),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("workouts")
      .select("date, duration_minutes")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo)
      .order("date", { ascending: false }),
    supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .maybeSingle(),
    supabase
      .from("daily_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", format(subDays(today, 90), "yyyy-MM-dd"))
      .order("date", { ascending: false }),
    supabase
      .from("user_dashboard_config")
      .select("position, config")
      .eq("user_id", user.id)
      .eq("config_type", "stat_card")
      .is("domain", null)
      .order("position"),
    supabase
      .from("user_dashboard_config")
      .select("position, config")
      .eq("user_id", user.id)
      .eq("config_type", "graph")
      .is("domain", null)
      .order("position"),
  ]);

  // ── Metric computations ──────────────────────────────────────────────────

  const lastNight = recentSleep?.[0] ?? null;
  const workoutsThisWeek = weekWorkouts?.length ?? 0;
  const workoutGoal = activeGoals?.find((g) => g.metric_name === "weekly_workouts");
  const weeklyTarget = workoutGoal?.target_value ?? 4;

  // ── Chart data ────────────────────────────────────────────────────────────

  const last7Days = buildDateArray(7);

  const sleepByDate = new Map(recentSleep?.map((s) => [s.date, s.duration_minutes ?? 0]) ?? []);
  const sleepChartData: SleepChartDataPoint[] = last7Days.map((date) => ({
    date,
    duration_minutes: sleepByDate.get(date) ?? 0,
  }));

  const workoutDurationByDate = new Map<string, number>();
  last7Workouts?.forEach((w) => {
    const existing = workoutDurationByDate.get(w.date) ?? 0;
    workoutDurationByDate.set(w.date, existing + (w.duration_minutes ?? 0));
  });
  const activityChartData: WorkoutChartDataPoint[] = last7Days.map((date) => ({
    date,
    workouts: workoutDurationByDate.has(date) ? 1 : 0,
    duration_minutes: workoutDurationByDate.get(date) ?? 0,
  }));

  // ── Goal progress ─────────────────────────────────────────────────────────

  const todaySteps = recentMetrics?.find((m) => m.date === todayStr)?.steps ?? 0;

  function getGoalProgress(goal: Goal): number {
    switch (goal.metric_name) {
      case "weekly_workouts":
        return calcProgress(workoutsThisWeek, goal.target_value);
      case "sleep_duration":
        return calcProgress(lastNight?.duration_minutes ?? 0, goal.target_value);
      case "steps":
        return calcProgress(todaySteps, goal.target_value);
      default:
        return calcProgress(goal.current_value, goal.target_value);
    }
  }

  // Check-in streak
  const checkinDates = new Set((allCheckInDates ?? []).map((c: { date: string }) => c.date));
  let checkinStreak = 0;
  let sd = new Date();
  while (checkinDates.has(format(sd, "yyyy-MM-dd"))) {
    checkinStreak++;
    sd = subDays(sd, 1);
  }

  // Last updated: most recent sleep, workout, or metric record
  const lastSleepDate = recentSleep?.[0]?.date ?? null;
  const lastMetricDate = recentMetrics?.[0]?.date ?? null;
  const lastUpdatedDate = [lastSleepDate, lastMetricDate].filter(Boolean).sort().at(-1) ?? null;

  const todayCheckIn = todayCheckInData as CheckIn | null;
  const dailyAction = dailyActionData as DailyAction | null;
  const insights = (rawInsights ?? []) as Insight[];
  const goals = (activeGoals ?? []) as Goal[];
  const sleepGoal = goals.find((g) => g.metric_name === "sleep_duration");

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">
            {greeting}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {format(today, "EEEE, MMMM d")}
          </p>
        </div>
        {lastUpdatedDate && (
          <p className="text-xs text-zinc-600 shrink-0 pb-0.5">
            Data: {formatRelativeDate(lastUpdatedDate)}
          </p>
        )}
      </div>

      {/* Daily action */}
      <section>
        <DailyActionCard initial={dailyAction} />
      </section>

      {/* Customizable stat cards */}
      <section>
        <StatCardsSection
          initialConfigs={(statCardConfigs ?? []) as { position: number; config: { metricId: string; domain: string } }[]}
        />
      </section>

      {/* Customizable graph widgets */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((pos) => {
            const row = (graphConfigs ?? []).find((c: { position: number; config: GraphConfig }) => c.position === pos);
            return (
              <ConfigurableGraph
                key={pos}
                position={pos}
                initialConfig={row?.config ?? null}
              />
            );
          })}
        </div>
      </section>

      {/* Today's check-in + streak */}
      <section>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SmilePlus className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-zinc-50">Today&apos;s check-in</p>
                {todayCheckIn ? (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Mood&nbsp;<span className="text-emerald-400 font-semibold">{todayCheckIn.mood}</span>
                    &ensp;Energy&nbsp;<span className="text-amber-400 font-semibold">{todayCheckIn.energy}</span>
                    &ensp;Stress&nbsp;<span className="text-red-400 font-semibold">{todayCheckIn.stress}</span>
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {checkinStreak < 7
                      ? "Check-ins help us find better patterns in your data"
                      : "How are you feeling today?"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {checkinStreak > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">{checkinStreak}d</span>
                </div>
              )}
              <Link
                href="/dashboard/checkins"
                className="text-xs text-zinc-400 hover:text-zinc-50 transition-colors"
              >
                View history →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Today's insights */}
      {insights.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Today&apos;s insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Weekly trends */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
          This week
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-zinc-50">Sleep duration</p>
              <Moon className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Last 7 nights · Goal: {formatDuration(sleepGoal?.target_value ?? 420)}
            </p>
            <SleepChart
              data={sleepChartData}
              goalMinutes={sleepGoal?.target_value ?? 420}
            />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-zinc-50">Workout activity</p>
              <Dumbbell className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Last 7 days · {workoutsThisWeek} workout{workoutsThisWeek !== 1 ? "s" : ""} this week
            </p>
            <ActivityChart data={activityChartData} />
          </div>
        </div>
      </section>

      {/* Goals progress */}
      {goals.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Goals
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {goals.map((goal) => {
              const pct = getGoalProgress(goal);
              return (
                <div key={goal.id} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-50">
                      {goal.title}
                    </span>
                    <span className="text-sm font-semibold text-zinc-300 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1.5">
                    Target: {goal.target_value} {goal.target_unit}{" "}
                    {goal.target_frequency === "daily"
                      ? "· " + formatRelativeDate(todayStr)
                      : "· this week"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
