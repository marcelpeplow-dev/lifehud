import { Suspense } from "react";
import { format, subDays } from "date-fns";
import { Dumbbell, Zap, Wind, Trophy, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { DateRangeSelector } from "@/components/sleep/DateRangeSelector";
import { buildDateArray, formatRelativeDate, formatShortDate } from "@/lib/utils/dates";
import { formatDuration, average } from "@/lib/utils/metrics";
import type { DateRange, WorkoutChartDataPoint, Workout } from "@/types/index";

function rangeToDays(range: DateRange): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

const TYPE_META: Record<
  NonNullable<Workout["workout_type"]>,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  strength:    { label: "Strength",    icon: Dumbbell, color: "text-orange-400 bg-orange-500/10" },
  cardio:      { label: "Cardio",      icon: Zap,      color: "text-red-400 bg-red-500/10" },
  flexibility: { label: "Flexibility", icon: Wind,     color: "text-green-400 bg-green-500/10" },
  sport:       { label: "Sport",       icon: Trophy,   color: "text-amber-400 bg-amber-500/10" },
  other:       { label: "Other",       icon: Activity, color: "text-zinc-400 bg-zinc-700" },
};

function TypeBadge({ type }: { type: Workout["workout_type"] }) {
  const meta = TYPE_META[type ?? "other"] ?? TYPE_META.other;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-400 mb-3">{label}</p>
      <p className="text-2xl font-semibold text-zinc-50 tabular-nums mb-1">{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

export default async function FitnessPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange = "7d" } = await searchParams;
  const range = (["7d", "30d", "90d"].includes(rawRange) ? rawRange : "7d") as DateRange;
  const days = rangeToDays(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const startDate = format(subDays(today, days - 1), "yyyy-MM-dd");

  const { data: workouts } = await supabase
    .from("workouts")
    .select(
      "id, date, duration_minutes, workout_type, activity_name, calories_burned, avg_heart_rate, max_heart_rate, intensity_score"
    )
    .eq("user_id", user.id)
    .gte("date", startDate)
    .order("date", { ascending: false });

  // ── Stats ────────────────────────────────────────────────────────────────

  const totalWorkouts = workouts?.length ?? 0;
  const totalMinutes = (workouts ?? []).reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
  const avgMinutes = average(workouts?.map((w) => w.duration_minutes) ?? []);

  const typeCounts = new Map<string, number>();
  workouts?.forEach((w) => {
    const t = w.workout_type ?? "other";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  });
  const topType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const subLabel = `last ${days} days`;

  // ── Chart data ────────────────────────────────────────────────────────────

  const dateArray = buildDateArray(days);
  const durationByDate = new Map<string, number>();
  const countByDate = new Map<string, number>();
  workouts?.forEach((w) => {
    durationByDate.set(w.date, (durationByDate.get(w.date) ?? 0) + (w.duration_minutes ?? 0));
    countByDate.set(w.date, (countByDate.get(w.date) ?? 0) + 1);
  });

  const chartData: WorkoutChartDataPoint[] = dateArray.map((date) => ({
    date,
    workouts: countByDate.get(date) ?? 0,
    duration_minutes: durationByDate.get(date) ?? 0,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Fitness</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Workout history and activity trends</p>
        </div>
        <Suspense>
          <DateRangeSelector active={range} />
        </Suspense>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total workouts"
          value={`${totalWorkouts}`}
          sub={subLabel}
        />
        <StatCard
          label="Total active time"
          value={formatDuration(totalMinutes || null)}
          sub={subLabel}
        />
        <StatCard
          label="Avg duration"
          value={formatDuration(avgMinutes != null ? Math.round(avgMinutes) : null)}
          sub="per workout"
        />
        <StatCard
          label="Top activity"
          value={topType ? (TYPE_META[topType as NonNullable<Workout["workout_type"]>]?.label ?? topType) : "—"}
          sub={topType ? `${typeCounts.get(topType)} session${typeCounts.get(topType) !== 1 ? "s" : ""}` : "no data"}
        />
      </section>

      {/* Volume chart */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-zinc-50">Workout volume</p>
          <Dumbbell className="w-4 h-4 text-zinc-600" />
        </div>
        <p className="text-xs text-zinc-500 mb-4">Active minutes per day</p>
        <ActivityChart
          data={chartData}
          showShortDate={days > 7}
          height={220}
        />
      </section>

      {/* Workout log */}
      {(workouts?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Workout log
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {workouts!.map((w) => (
              <div key={w.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <TypeBadge type={w.workout_type} />
                  <div>
                    <p className="text-sm font-medium text-zinc-50">
                      {w.activity_name ?? TYPE_META[(w.workout_type ?? "other") as NonNullable<Workout["workout_type"]>]?.label ?? "Workout"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatRelativeDate(w.date)} · {formatShortDate(w.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-sm font-semibold text-zinc-50 tabular-nums">
                      {formatDuration(w.duration_minutes)}
                    </p>
                    <p className="text-xs text-zinc-500">duration</p>
                  </div>
                  {w.calories_burned != null && (
                    <div>
                      <p className="text-sm font-semibold text-orange-400 tabular-nums">
                        {w.calories_burned}
                      </p>
                      <p className="text-xs text-zinc-500">kcal</p>
                    </div>
                  )}
                  {w.avg_heart_rate != null && (
                    <div>
                      <p className="text-sm font-semibold text-red-400 tabular-nums">
                        {w.avg_heart_rate}
                      </p>
                      <p className="text-xs text-zinc-500">avg bpm</p>
                    </div>
                  )}
                  {w.intensity_score != null && (
                    <div>
                      <p className="text-sm font-semibold text-zinc-50 tabular-nums">
                        {w.intensity_score}
                      </p>
                      <p className="text-xs text-zinc-500">intensity</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
