import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DailyInputForm } from "@/components/daily-input/DailyInputForm";
import { redirect } from "next/navigation";

export default async function DailyInputPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = format(new Date(), "yyyy-MM-dd");

  const [{ data: configData }, { data: entriesData }, { data: checkinData }] =
    await Promise.all([
      supabase
        .from("user_manual_config")
        .select("domain, metric_id, enabled")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .order("display_order"),
      supabase
        .from("manual_entries")
        .select("metric_id, value")
        .eq("user_id", user.id)
        .eq("date", today),
      supabase
        .from("daily_checkins")
        .select("mood, energy, stress, notes")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

  const enabledMetrics = (configData ?? []) as {
    domain: string;
    metric_id: string;
    enabled: boolean;
  }[];

  // Build initial values from manual_entries, falling back to daily_checkins for wellbeing
  const initialValues: Record<string, number> = {};
  for (const entry of entriesData ?? []) {
    initialValues[entry.metric_id] = Number(entry.value);
  }
  // Backfill wellbeing from daily_checkins if not already in manual_entries
  if (checkinData) {
    if (initialValues["wellbeing_mood"] == null) initialValues["wellbeing_mood"] = checkinData.mood;
    if (initialValues["wellbeing_energy"] == null) initialValues["wellbeing_energy"] = checkinData.energy;
    if (initialValues["wellbeing_stress"] == null) initialValues["wellbeing_stress"] = checkinData.stress;
  }

  const initialJournal = (checkinData?.notes as string | null) ?? "";

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-50 tracking-tight">Daily Input</h1>
          <p className="text-xs text-zinc-500">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
      </div>

      <DailyInputForm
        enabledMetrics={enabledMetrics}
        initialValues={initialValues}
        initialJournal={initialJournal}
        date={today}
      />
    </div>
  );
}
