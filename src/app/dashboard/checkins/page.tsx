import { Suspense } from "react";
import { format, subDays, parseISO } from "date-fns";
import { SmilePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CheckInChart } from "@/components/checkin/CheckInChart";
import { DateRangeSelector } from "@/components/sleep/DateRangeSelector";
import { average } from "@/lib/utils/metrics";
import type { CheckIn, DateRange } from "@/types/index";
import { redirect } from "next/navigation";

function rangeToDays(r: DateRange) {
  return r === "90d" ? 90 : r === "30d" ? 30 : 7;
}

function calcStreak(checkins: CheckIn[]): number {
  const dates = new Set(checkins.map((c) => c.date));
  let streak = 0;
  let d = new Date();
  while (true) {
    if (dates.has(format(d, "yyyy-MM-dd"))) {
      streak++;
      d = subDays(d, 1);
    } else break;
  }
  return streak;
}

interface StatCardProps { label: string; value: string; sub: string; color?: string }
function StatCard({ label, value, sub, color = "text-zinc-50" }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-400 mb-3">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mb-1 ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function ScoreDot({ value, color }: { value: number; color: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${color}`}>
      {value}
    </span>
  );
}

export default async function CheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange = "30d" } = await searchParams;
  const range = (["7d", "30d", "90d"].includes(rawRange) ? rawRange : "30d") as DateRange;
  const days = rangeToDays(range);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const startDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .order("date", { ascending: true });

  const checkins = (data ?? []) as CheckIn[];

  // Stat cards use the selected range (same data already filtered by startDate)
  const avgMood = average(checkins.map((c) => c.mood));
  const avgEnergy = average(checkins.map((c) => c.energy));
  const avgStress = average(checkins.map((c) => c.stress));
  const rangeLabel = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 90 days";
  const streak = calcStreak(checkins);
  const recent = [...checkins].reverse().slice(0, 14);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Check-ins</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Mood, energy, and stress over time</p>
        </div>
        <Suspense>
          <DateRangeSelector active={range} />
        </Suspense>
      </div>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg mood"
          value={avgMood != null ? avgMood.toFixed(1) : "—"}
          sub={rangeLabel}
          color={avgMood != null ? (avgMood >= 7 ? "text-blue-400" : avgMood >= 5 ? "text-amber-400" : "text-red-400") : "text-zinc-50"}
        />
        <StatCard
          label="Avg energy"
          value={avgEnergy != null ? avgEnergy.toFixed(1) : "—"}
          sub={rangeLabel}
          color={avgEnergy != null ? (avgEnergy >= 7 ? "text-amber-400" : avgEnergy >= 5 ? "text-zinc-50" : "text-zinc-500") : "text-zinc-50"}
        />
        <StatCard
          label="Avg stress"
          value={avgStress != null ? avgStress.toFixed(1) : "—"}
          sub={`${rangeLabel} · lower is better`}
          color={avgStress != null ? (avgStress <= 4 ? "text-blue-400" : avgStress <= 6 ? "text-amber-400" : "text-red-400") : "text-zinc-50"}
        />
        <StatCard
          label="Check-in streak"
          value={streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "—"}
          sub={streak >= 7 ? "🔥 On a roll!" : streak > 0 ? "Keep it up" : "No streak yet"}
          color={streak >= 7 ? "text-blue-400" : "text-zinc-50"}
        />
      </section>

      {/* Chart */}
      {checkins.length > 1 ? (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-zinc-50">Wellbeing over time</p>
            <SmilePlus className="w-4 h-4 text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Mood · Energy · Stress · {checkins.length} check-ins
          </p>
          <CheckInChart checkins={checkins} showShortDate={days > 7} />
        </section>
      ) : (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-sm text-zinc-500">Not enough check-ins yet to show a chart.</p>
        </section>
      )}

      {/* Recent log */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Recent check-ins
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
            {recent.map((c) => (
              <div key={c.id} className="p-5 flex items-start gap-4">
                <div className="min-w-[80px]">
                  <p className="text-sm font-medium text-zinc-50">
                    {format(parseISO(c.date), "EEE")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {format(parseISO(c.date), "MMM d")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreDot value={c.mood} color="bg-blue-500/15 text-blue-400" />
                  <ScoreDot value={c.energy} color="bg-amber-500/15 text-amber-400" />
                  <ScoreDot value={c.stress} color="bg-red-500/15 text-red-400" />
                </div>
                {c.notes && (
                  <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2 flex-1">
                    {c.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
