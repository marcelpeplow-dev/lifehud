import { Suspense } from "react";
import { Moon } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { SleepStagesChart } from "@/components/charts/SleepStagesChart";
import { SleepChart } from "@/components/charts/SleepChart";
import { DateRangeSelector } from "@/components/sleep/DateRangeSelector";
import { buildDateArray, formatRelativeDate } from "@/lib/utils/dates";
import { formatDuration, average } from "@/lib/utils/metrics";
import type { DateRange, SleepStagesDataPoint, SleepChartDataPoint, Goal } from "@/types/index";
import { redirect } from "next/navigation";

function rangeToDays(range: DateRange): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

function pct(part: number | null, total: number | null): number | null {
  if (!part || !total) return null;
  return Math.round((part / total) * 100);
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  color?: string;
}

function StatCard({ label, value, sub, color = "text-zinc-50" }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-400 mb-3">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mb-1 ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange = "7d" } = await searchParams;
  const range = (["7d", "30d", "90d"].includes(rawRange) ? rawRange : "7d") as DateRange;
  const days = rangeToDays(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const startDate = format(subDays(today, days - 1), "yyyy-MM-dd");

  const [{ data: sleepData }, { data: goalData }] = await Promise.all([
    supabase
      .from("sleep_records")
      .select(
        "date, duration_minutes, deep_sleep_minutes, rem_sleep_minutes, light_sleep_minutes, awake_minutes, sleep_score, bedtime, wake_time"
      )
      .eq("user_id", user.id)
      .gte("date", startDate)
      .order("date", { ascending: true }),
    supabase
      .from("goals")
      .select("target_value")
      .eq("user_id", user.id)
      .eq("metric_name", "sleep_duration")
      .eq("is_active", true)
      .limit(1),
  ]);

  const sleepGoal = (goalData?.[0] as Pick<Goal, "target_value"> | undefined)?.target_value ?? 420;

  // ── Stats ────────────────────────────────────────────────────────────────

  const avgDuration = average(sleepData?.map((s) => s.duration_minutes) ?? []);
  const avgScore = average(sleepData?.map((s) => s.sleep_score) ?? []);
  const avgDeepPct = average(
    sleepData
      ?.filter((s) => s.duration_minutes && s.deep_sleep_minutes)
      .map((s) => pct(s.deep_sleep_minutes, s.duration_minutes)) ?? []
  );
  const avgRemPct = average(
    sleepData
      ?.filter((s) => s.duration_minutes && s.rem_sleep_minutes)
      .map((s) => pct(s.rem_sleep_minutes, s.duration_minutes)) ?? []
  );

  const nightCount = sleepData?.length ?? 0;
  const subLabel = `${nightCount} night${nightCount !== 1 ? "s" : ""} · last ${days} days`;

  // ── Chart data ────────────────────────────────────────────────────────────

  const dateArray = buildDateArray(days);
  const byDate = new Map(sleepData?.map((s) => [s.date, s]) ?? []);

  const stagesData: SleepStagesDataPoint[] = dateArray.map((date) => {
    const s = byDate.get(date);
    return {
      date,
      deep_minutes: s?.deep_sleep_minutes ?? 0,
      rem_minutes: s?.rem_sleep_minutes ?? 0,
      light_minutes: s?.light_sleep_minutes ?? 0,
      awake_minutes: s?.awake_minutes ?? 0,
    };
  });

  const durationData: SleepChartDataPoint[] = dateArray.map((date) => ({
    date,
    duration_minutes: byDate.get(date)?.duration_minutes ?? 0,
  }));

  // ── Recent nights (newest first) ─────────────────────────────────────────

  const recentNights = [...(sleepData ?? [])].reverse().slice(0, 7);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Sleep</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Sleep analysis and stage breakdown</p>
        </div>
        <Suspense>
          <DateRangeSelector active={range} />
        </Suspense>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg duration"
          value={formatDuration(avgDuration != null ? Math.round(avgDuration) : null)}
          sub={subLabel}
        />
        <StatCard
          label="Avg sleep score"
          value={avgScore != null ? `${Math.round(avgScore)}` : "—"}
          sub={subLabel}
          color={
            avgScore == null
              ? "text-zinc-50"
              : avgScore >= 80
              ? "text-emerald-400"
              : avgScore >= 60
              ? "text-amber-400"
              : "text-red-400"
          }
        />
        <StatCard
          label="Avg deep sleep"
          value={avgDeepPct != null ? `${Math.round(avgDeepPct)}%` : "—"}
          sub="Target ≥ 15%"
          color={avgDeepPct != null && avgDeepPct >= 15 ? "text-blue-400" : "text-zinc-50"}
        />
        <StatCard
          label="Avg REM"
          value={avgRemPct != null ? `${Math.round(avgRemPct)}%` : "—"}
          sub="Target ≥ 20%"
          color={avgRemPct != null && avgRemPct >= 20 ? "text-blue-400" : "text-zinc-50"}
        />
      </section>

      {/* Sleep stages chart */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-zinc-50">Sleep stages</p>
          <Moon className="w-4 h-4 text-zinc-600" />
        </div>
        <p className="text-xs text-zinc-500 mb-4">Deep · REM · Light · Awake per night</p>
        <SleepStagesChart data={stagesData} showShortDate={days > 7} />
      </section>

      {/* Duration chart */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-zinc-50">Sleep duration</p>
          <Moon className="w-4 h-4 text-zinc-600" />
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Goal: {formatDuration(sleepGoal)} · dashed line
        </p>
        <SleepChart data={durationData} goalMinutes={sleepGoal} />
      </section>

      {/* Recent nights */}
      {recentNights.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Recent nights
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {recentNights.map((night) => {
              const deepP = pct(night.deep_sleep_minutes, night.duration_minutes);
              const remP = pct(night.rem_sleep_minutes, night.duration_minutes);
              const bedtime = night.bedtime
                ? format(parseISO(night.bedtime), "h:mm a")
                : null;
              const wakeTime = night.wake_time
                ? format(parseISO(night.wake_time), "h:mm a")
                : null;
              return (
                <div
                  key={night.date}
                  className="p-5 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-50">
                      {formatRelativeDate(night.date)}
                    </p>
                    {bedtime && wakeTime && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {bedtime} → {wakeTime}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm font-semibold text-zinc-50 tabular-nums">
                        {formatDuration(night.duration_minutes)}
                      </p>
                      <p className="text-xs text-zinc-500">duration</p>
                    </div>
                    {night.sleep_score != null && (
                      <div>
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            night.sleep_score >= 80
                              ? "text-emerald-400"
                              : night.sleep_score >= 60
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {night.sleep_score}
                        </p>
                        <p className="text-xs text-zinc-500">score</p>
                      </div>
                    )}
                    {deepP != null && (
                      <div>
                        <p className="text-sm font-semibold text-blue-400 tabular-nums">
                          {deepP}%
                        </p>
                        <p className="text-xs text-zinc-500">deep</p>
                      </div>
                    )}
                    {remP != null && (
                      <div>
                        <p className="text-sm font-semibold text-blue-300 tabular-nums">
                          {remP}%
                        </p>
                        <p className="text-xs text-zinc-500">REM</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
