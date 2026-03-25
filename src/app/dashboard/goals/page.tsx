import { format, subDays, startOfWeek } from "date-fns";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GoalCard } from "@/components/goals/GoalCard";
import { AddGoalButton } from "@/components/goals/AddGoalButton";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import type { Goal } from "@/types/index";
import { redirect } from "next/navigation";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const yesterday = format(subDays(today, 1), "yyyy-MM-dd");

  const [
    { data: goalsData },
    { data: lastSleep },
    { data: weekWorkouts },
    { data: todayMetrics },
    { data: lastChessGames },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("starred", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("sleep_records")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .in("date", [todayStr, yesterday])
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("workouts")
      .select("id")
      .eq("user_id", user.id)
      .gte("date", weekStart),
    supabase
      .from("daily_metrics")
      .select("steps, resting_heart_rate, hrv_average")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .limit(1),
    supabase
      .from("chess_games")
      .select("player_rating")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(1),
  ]);

  const goals = (goalsData ?? []) as Goal[];
  const active = goals.filter((g) => g.is_active !== false && g.status !== "archived");
  const archived = goals.filter((g) => g.is_active === false || g.status === "archived");

  const sleepMinutes = lastSleep?.[0]?.duration_minutes ?? 0;
  const workoutCount = weekWorkouts?.length ?? 0;
  const steps = todayMetrics?.[0]?.steps ?? 0;
  const restingHr = todayMetrics?.[0]?.resting_heart_rate ?? 0;
  const hrv = todayMetrics?.[0]?.hrv_average ?? 0;
  const chessRating = lastChessGames?.[0]?.player_rating ?? 0;

  function getCurrentValue(goal: Goal): number {
    const metricId = goal.metric_id ?? goal.metric_name;
    switch (metricId) {
      case "sleep_total_duration": return sleepMinutes / 60; // hours — metric.format(fmtHours) expects hours
      case "sleep_duration":       return sleepMinutes;     // minutes — legacyFormat/formatDuration expects minutes
      case "fitness_workouts_per_week":
      case "weekly_workouts":      return workoutCount;
      case "fitness_steps":
      case "steps":                return steps;
      case "fitness_resting_hr":
      case "resting_hr":           return restingHr;
      case "fitness_hrv":
      case "hrv_average":          return hrv;
      case "chess_rating":         return chessRating;
      default:                     return goal.current_value;
    }
  }

  // Group active goals by domain
  const domainsWithGoals = DOMAIN_REGISTRY.filter((d) =>
    active.some((g) => (g.domain ?? g.category) === d.id)
  );
  const ungrouped = active.filter((g) => !DOMAIN_REGISTRY.find((d) => d.id === (g.domain ?? g.category)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Goals</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Track your progress toward your targets</p>
        </div>
        <AddGoalButton />
      </div>

      {/* Active goals — grouped by domain */}
      {active.length > 0 ? (
        <section className="space-y-6">
          {domainsWithGoals.map((domain) => (
            <div key={domain.id}>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                {domain.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active
                  .filter((g) => (g.domain ?? g.category) === domain.id)
                  .map((goal) => (
                    <GoalCard key={goal.id} goal={goal} currentValue={getCurrentValue(goal)} />
                  ))}
              </div>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Other</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ungrouped.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} currentValue={getCurrentValue(goal)} />
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">No active goals</p>
          <p className="text-xs text-zinc-500 mb-5">Set a goal to start tracking your progress</p>
          <AddGoalButton />
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Archived · {archived.length}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            {archived.map((goal) => (
              <GoalCard key={goal.id} goal={goal} currentValue={getCurrentValue(goal)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
