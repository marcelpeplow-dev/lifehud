import { format, subDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DomainPageTemplate } from "@/components/domain/DomainPageTemplate";
import { formatRelativeDate } from "@/lib/utils/dates";
import { formatDuration } from "@/lib/utils/metrics";
import { redirect } from "next/navigation";

function pct(part: number | null, total: number | null): number | null {
  if (!part || !total) return null;
  return Math.round((part / total) * 100);
}

export default async function SleepPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const sevenDaysAgo = format(subDays(today, 6), "yyyy-MM-dd");

  const { data: recentSleep } = await supabase
    .from("sleep_records")
    .select("date,duration_minutes,deep_sleep_minutes,rem_sleep_minutes,bedtime,wake_time,sleep_score")
    .eq("user_id", user.id)
    .gte("date", sevenDaysAgo)
    .order("date", { ascending: false });

  const recentNights = (recentSleep ?? []).slice(0, 7);

  return (
    <div className="space-y-8">
      <DomainPageTemplate domain="sleep" userId={user.id} />

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
              const bedtime = night.bedtime ? format(parseISO(night.bedtime), "h:mm a") : null;
              const wakeTime = night.wake_time ? format(parseISO(night.wake_time), "h:mm a") : null;
              return (
                <div key={night.date} className="p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-zinc-50">{formatRelativeDate(night.date)}</p>
                    {bedtime && wakeTime && (
                      <p className="text-xs text-zinc-500 mt-0.5">{bedtime} → {wakeTime}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm font-semibold text-zinc-50 tabular-nums">{formatDuration(night.duration_minutes)}</p>
                      <p className="text-xs text-zinc-500">duration</p>
                    </div>
                    {night.sleep_score != null && (
                      <div>
                        <p className={`text-sm font-semibold tabular-nums ${night.sleep_score >= 80 ? "text-emerald-400" : night.sleep_score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {night.sleep_score}
                        </p>
                        <p className="text-xs text-zinc-500">score</p>
                      </div>
                    )}
                    {deepP != null && (
                      <div>
                        <p className="text-sm font-semibold text-blue-400 tabular-nums">{deepP}%</p>
                        <p className="text-xs text-zinc-500">deep</p>
                      </div>
                    )}
                    {remP != null && (
                      <div>
                        <p className="text-sm font-semibold text-blue-300 tabular-nums">{remP}%</p>
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
