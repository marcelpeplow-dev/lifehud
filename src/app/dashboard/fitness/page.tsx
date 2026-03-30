import { format, parseISO, subDays } from "date-fns";
import { Dumbbell, Zap, Wind, Trophy, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DomainPageTemplate } from "@/components/domain/DomainPageTemplate";
import { formatRelativeDate, formatShortDate } from "@/lib/utils/dates";
import { formatDuration } from "@/lib/utils/metrics";
import type { Workout } from "@/types/index";
import { redirect } from "next/navigation";

const TYPE_META: Record<
  NonNullable<Workout["workout_type"]>,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  strength:    { label: "Strength",    icon: Dumbbell },
  cardio:      { label: "Cardio",      icon: Zap      },
  flexibility: { label: "Flexibility", icon: Wind     },
  sport:       { label: "Sport",       icon: Trophy   },
  other:       { label: "Other",       icon: Activity },
};

function TypeBadge({ type }: { type: Workout["workout_type"] }) {
  const meta = TYPE_META[type ?? "other"] ?? TYPE_META.other;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md text-emerald-400 bg-zinc-700">
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

export default async function FitnessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const tenDaysAgo = format(subDays(today, 9), "yyyy-MM-dd");

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id,date,started_at,duration_minutes,workout_type,activity_name,calories_burned,avg_heart_rate,intensity_score")
    .eq("user_id", user.id)
    .gte("date", tenDaysAgo)
    .order("date", { ascending: false })
    .limit(10);

  return (
    <DomainPageTemplate domain="fitness" userId={user.id}>
      {/* Recent workouts */}
      {(workouts?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Recent workouts
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
                      {(() => {
                        const rel = formatRelativeDate(w.date);
                        const short = formatShortDate(w.date);
                        const dateStr = rel === short ? rel : `${rel} · ${short}`;
                        const timeStr = w.started_at ? `, ${format(parseISO(w.started_at), "h:mm a")}` : "";
                        return `${dateStr}${timeStr}`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-sm font-semibold text-zinc-50 tabular-nums">{formatDuration(w.duration_minutes)}</p>
                    <p className="text-xs text-zinc-500">duration</p>
                  </div>
                  {w.calories_burned != null && (
                    <div>
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums">{w.calories_burned}</p>
                      <p className="text-xs text-zinc-500">kcal</p>
                    </div>
                  )}
                  {w.avg_heart_rate != null && (
                    <div>
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums">{w.avg_heart_rate}</p>
                      <p className="text-xs text-zinc-500">avg bpm</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </DomainPageTemplate>
  );
}
