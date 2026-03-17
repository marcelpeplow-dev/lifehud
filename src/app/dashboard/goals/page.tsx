import { format, subDays, startOfWeek } from "date-fns";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GoalCard } from "@/components/goals/GoalCard";
import { AddGoalButton } from "@/components/goals/AddGoalButton";
import type { Goal } from "@/types/index";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const yesterday = format(subDays(today, 1), "yyyy-MM-dd");

  const [
    { data: goalsData },
    { data: lastSleep },
    { data: weekWorkouts },
    { data: todayMetrics },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
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
      .select("steps")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .limit(1),
  ]);

  const goals = (goalsData ?? []) as Goal[];
  const active = goals.filter((g) => g.is_active);
  const archived = goals.filter((g) => !g.is_active);

  const sleepMinutes = lastSleep?.[0]?.duration_minutes ?? 0;
  const workoutCount = weekWorkouts?.length ?? 0;
  const steps = todayMetrics?.[0]?.steps ?? 0;

  function getCurrentValue(goal: Goal): number {
    switch (goal.metric_name) {
      case "sleep_duration": return sleepMinutes;
      case "weekly_workouts": return workoutCount;
      case "steps": return steps;
      default: return goal.current_value;
    }
  }

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

      {/* Active goals */}
      {active.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Active · {active.length}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((goal) => (
              <GoalCard key={goal.id} goal={goal} currentValue={getCurrentValue(goal)} />
            ))}
          </div>
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

      {/* Archived goals */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
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
