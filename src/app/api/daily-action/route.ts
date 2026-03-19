import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateDailyAction } from "@/lib/ai/generate";
import { average } from "@/lib/utils/metrics";
import type { DailyMetrics, CheckIn, Workout, SleepRecord } from "@/types/index";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
    const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");

    // Check if already generated today
    const { data: existing } = await supabase
      .from("daily_actions")
      .select("id, text")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ text: existing.text, cached: true });
    }

    // Fetch recent data
    const [{ data: sleepData }, { data: workoutData }, { data: checkInData }] = await Promise.all([
      supabase.from("sleep_records").select("date, duration_minutes").eq("user_id", user.id).gte("date", thirtyDaysAgo).order("date", { ascending: false }).limit(7),
      supabase.from("workouts").select("date").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }),
      supabase.from("daily_checkins").select("mood, energy, stress").eq("user_id", user.id).gte("date", sevenDaysAgo),
    ]);

    const sleepRecords = (sleepData ?? []) as Pick<SleepRecord, "date" | "duration_minutes">[];
    const workouts = (workoutData ?? []) as Pick<Workout, "date">[];
    const checkIns = (checkInData ?? []) as Pick<CheckIn, "mood" | "energy" | "stress">[];

    const lastNight = sleepRecords[0];
    const avgSleepMinutes = average(sleepRecords.map((s) => s.duration_minutes));

    const actionText = await generateDailyAction({
      lastNightSleepHours: lastNight?.duration_minutes != null ? lastNight.duration_minutes / 60 : null,
      avgSleepHours: avgSleepMinutes != null ? avgSleepMinutes / 60 : null,
      recentWorkoutCount: workouts.length,
      lastWorkoutDate: workouts[0]?.date ?? null,
      avgMood: checkIns.length > 0 ? average(checkIns.map((c) => c.mood)) : null,
      avgEnergy: checkIns.length > 0 ? average(checkIns.map((c) => c.energy)) : null,
      avgStress: checkIns.length > 0 ? average(checkIns.map((c) => c.stress)) : null,
      topPattern: null,
    });

    if (!actionText) {
      return NextResponse.json({ error: "No action generated" }, { status: 500 });
    }

    const serviceClient = createServiceClient();
    const { data: saved } = await serviceClient
      .from("daily_actions")
      .upsert({ user_id: user.id, date: todayStr, text: actionText }, { onConflict: "user_id,date" })
      .select("text")
      .single();

    return NextResponse.json({ text: saved?.text ?? actionText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
